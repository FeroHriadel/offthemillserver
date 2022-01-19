const ErrorResponse = require('../helpers/ErrorResponse');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);



//PRE-SIGNUP ( sends email link with jwt token = {email, password} ==> http(s?)://clientUrl/activate/${token} )
exports.preSignup = async (req, res, next) => {
    try {
        //get email & password from req.body
        let { email, password } = req.body;
        if (!email || !password) return next(new ErrorResponse('Email and Password are required', 400));
        email = email.toLowerCase();

        //check if user not already registered
        const user = await db.any('SELECT * FROM users WHERE email = $1', [email]);
        if (user && user[0] && user[0].email) return next(new ErrorResponse('Email is already taken', 403));

        //put {email, password} into JWT
        const token = jwt.sign({email, password}, process.env.JWT_ACCOUNT_ACTIVATION, {expiresIn: '15min'});

        //send email with a link: http://localhost:3000/activate/${token}
        const emailData = {
            from: process.env.EMAIL_FROM,
            to: email,
            subject: 'Complete Registration',
            html: `
                <h1>OFF THE MILL</h1>
                <h3>Please go to the link below to complete your registration</h3>
                <p>
                    ${process.env.CLIENT_URL}/activate/${token}
                </p>
                <hr />
                <small>It is safe to disregard this email if you did not request it</small>
                <br />
                <small>${process.env.CLIENT_URL}</small>
            `
        }

        sgMail.send(emailData)
            .then(sent => {
                if (sent[0].statusCode !== 202) return next(new ErrorResponse('Email failed. Please try again later', 500));
                return res.status(200).json({message: `Registration email sent. Please follow the instructions to complete your registration. It's just 2 clicks :)`});
            })

    } catch (error) {
        next(error);
    }
}



//SIGNUP ( user sends {token: tokenWithEmail&PasswordTheyGotFromPreSignup} - we verify and save user in db )
// respnse = cookie ==> {usertoken, jwthash(user_id)} & .json({usertoken: jwthash(user_id), user: userDetails})
exports.signup = async (req, res, next) => {
    try {
        //get token from req
        const token = req.body.token;
        if (!token) return next(new ErrorResponse('No token sent', 400));

        //verify token
        let verified = false;
        jwt.verify(token, process.env.JWT_ACCOUNT_ACTIVATION, function(err, decoded) {
            if (err) return next(new ErrorResponse('Bad or expired link', 403));
            verified = true;
        })

        //get email and password from token
        if (verified) {
            let { email, password } = jwt.decode(token);
            if (!email.includes('@') || !email.includes('.')) return next(new ErrorResponse('Please enter a valid email', 400));

            //hash password
            const salt = await bcrypt.genSalt(10);
            password = await bcrypt.hash(password.toString(), salt);

            //save user in db
            const user = await db.one('INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *', [email, password]);
            if (!user || !user.user_id) return next(new ErrorResponse('User was NOT saved, please try again later', 500));

            //generate jwt = {user_id}
            const usertoken = jwt.sign({user_id: user.user_id}, process.env.JWT_SECRET);
            
            //respond with cookie and token and userDetails
            res.status(201).cookie('usertoken', usertoken).json({usertoken, message: `Thank you for registering!`, user: {email: user.email, user_id: user.user_id, role: user.role}});
        }

    } catch (error) {
        next(error);
    }
}



//SIGNIN ( responds with cookie = {usertoken: jwthash(user_id)} & .json({usertoken: jwthash(user_id)}) )
exports.signin = async (req, res, next) => {
    try {
        //get email and password from req
        const { email, password } = req.body;
        if (!email || !password) return next(new ErrorResponse('Email and password are required', 400));

        //find user in db
        const user = await db.any('SELECT * FROM users WHERE email = $1', [email]);
        if (!user || !user[0] || !user[0].email) return next(new ErrorResponse('Invalid credentials', 401));

        //check password
        const isMatch = await bcrypt.compare(password.toString(), user[0].password.toString());
        if (!isMatch) return next(new ErrorResponse('Invalid credentials', 401));

        // respond with json & cookie, both: {usertoken: jwthash(user_id)} and userdetails
        const usertoken = jwt.sign({user_id: user[0].user_id}, process.env.JWT_SECRET);
        res.status(200).cookie('usertoken', usertoken).json({usertoken, message: 'You are now signed in', user: {user_id: user[0].user_id, email: user[0].email, role: user[0].role}});

    } catch (error) {
        next(error);
    }
}


////////////////////////////////////////////////////////////////////////////////////TEST
exports.getSignedInUser = async (req, res, next) => {
    try {
        if (!req.user) return next(new ErrorResponse('No user in req object'), 500);
        const user = await db.any('SELECT user_id, email, role, created_at FROM users WHERE user_id = $1', [req.user.user_id]);
        if (!user || !user[0] || !user[0].user_id) return next(new ErrorResponse('User not found', 404));

        res.status(200).json({message: 'User found', user: user[0]});

    } catch (error) {
        next(error);
    }
}
////////////////////////////////////////////////////////////////////////////////////



//SEND GOOGLE CLIENT ID TO FRONTEND
exports.getGoogleClientId = async (req, res, next) => {
    try {
        res.status(200).json({googleClientId: process.env.GOOGLE_CLIENT_ID});
        
    } catch (error) {
        next(error);
    }
}



//SIGN IN WITH GOOGLE
exports.signinWithGoogle = async (req, res, next) => {
    try {
        //get token from req
        const idToken = req.body.tokenId;
        if (!idToken) return next(new ErrorResponse('Google token didnt make it thru :( \n Cannot authenticate', 400));

        //verify token
        const response = await client.verifyIdToken({idToken, audience: process.env.GOOGLE_CLIENT_ID});
        const { email_verified, email, jti } = response.payload; //get email_verified, email and jti (that's some code google sends) from response.payload

        if (email_verified) {
            db.task(async t => {
                //check if user is in db
                const user = await t.any('SELECT * FROM users WHERE email = $1', [email]);

                //if user not in db, sign them up
                if (!user || !user[0]) {
                    const savedUser = await t.one('INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *', [email, jti]);
                    if (!savedUser || !savedUser.user_id) return next(new ErrorResponse('User was NOT saved, please try again later', 500));

                    const usertoken = jwt.sign({user_id: savedUser.user_id}, process.env.JWT_SECRET);
                    
                    return res.status(201).cookie('usertoken', usertoken).json({usertoken, message: `Thank you for registering!`, user: {email: savedUser.email, user_id: savedUser.user_id, role: savedUser.role}});

                //if user is in DB
                } else {
                    const usertoken = jwt.sign({user_id: user[0].user_id}, process.env.JWT_SECRET);

                    return res.status(201).cookie('usertoken', usertoken).json({usertoken, message: `Thank you for registering!`, user: {email: user[0].email, user_id: user[0].user_id, role: user[0].role}});
                
                }
            })       
        } else {
            return next(new ErrorResponse('Sorry. Google authentication failed. Try logging in with email and password', 500));
        }
        
    } catch (error) {
        next(error);
    }
}



//FORGOT PASSWORD (jwt hashes user_id and sends an email to http(s?)//clientDomain/resetpassword/${resettoken}). Also saves the token under user.reset_token in db
exports.forgotPassword = async (req, res, next) => {
    try {
        //check email in req
        const { email } = req.body;
        if (!email) return next(new ErrorResponse('Please include an email', 400));
        if (!email.includes('@') || !email.includes('.')) return next(new ErrorResponse('Please enter a valid email', 400));

        db.task(async t => {
            //find user in db
            const user = await t.any('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
            if (!user || !user[0] || !user[0].email) return next(new ErrorResponse('User not found', 404));

            //jwt hash user_id
            const resettoken = jwt.sign({user_id: user[0].user_id}, process.env.JWT_RESET_PASSWORD, {expiresIn: '15min'});

            //save resettoken in db
            const updatedUser = await t.any('UPDATE users SET reset_token = $1 WHERE email = $2 RETURNING *', [resettoken, email]);
            if (!updatedUser || !updatedUser[0] || !updatedUser[0].reset_token) return next(new ErrorResponse('Failed to save reset token. Try again later.', 500));

            //send email to http(s?)://clientDomain/resetpassword/${resettoken}
            const emailData = {
                from: process.env.EMAIL_FROM,
                to: email,
                subject: 'Reset your Off The Mill password',
                html: `
                    <h1>OFF THE MILL</h1>
                    <h3>Please, go to the link below to reset your password:</h3>
                    <p>${process.env.CLIENT_URL}/resetpassword/${resettoken}</p>
                    <hr />
                    <small>It is safe to disregard this email if you did not request it</small>
                    <br />
                    <small>${process.env.CLIENT_URL}</small>
                `
            };

            sgMail.send(emailData)
                .then(sent => {
                    if (sent[0].statusCode !== 202) return next(new ErrorResponse('Email failed. Please try again later', 500));
                    return res.status(200).json({message: `Reset password email sent. Please follow the instructions to complete your password change. It will only take a second.`});
                });
        })

    } catch (error) {
        next(error);
    }
}



//RESET PASSWORD
exports.resetPassword = async (req, res, next) => {
    try {
        //check resettoken and newPassword in req
        const { resettoken, newPassword } = req.body;
        if (!resettoken || !newPassword) return next(new ErrorResponse('Reset token and Password are required', 400));

        //verify if resettoken matches user_id
        let verified = false;
        jwt.verify(resettoken, process.env.JWT_RESET_PASSWORD, function(err, decoded) {
            if (err) return next(new ErrorResponse('Bad or expired link'), 401);
            verified = true;
        });

        //hash new password, save it in db.
        if (verified) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);
            
            const updatedUser = await db.any('UPDATE users SET password = $1, reset_token = $2 WHERE reset_token = $3 RETURNING *', [hashedPassword, null, resettoken]);
            if (!updatedUser || !updatedUser[0] || !updatedUser[0].email) return next(new ErrorResponse('Password reset failed.', 500));

            res.status(200).json({message: `Password updated. You may now log in with your new password`});
        }

    } catch (error) {
        next(error);
    }
}



//CHANGE PASSWORD
exports.changePassword = async (req, res, next) => {
    try {
        const newPassword = req.body.newPassword;
        if (!newPassword || newPassword.trim() === '') return next(new ErrorResponse('New Password is required', 400));

        //hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword.toString(), salt);

        //update user's password
        const updatedUser = await db.any('UPDATE users SET password = $1 WHERE user_id = $2 RETURNING *', [hashedPassword, req.user.user_id]);
        if (!updatedUser || !updatedUser[0] || !updatedUser[0].user_id) return next(new ErrorResponse('Password update failed :(', 500));

        res.status(200).json({message: 'Password updated successfully'});
        
    } catch (error) {
        next(error);
    }
}



////////////////////////////////////////////////////////////////////////////////TEST
//ADMIN TEST 
exports.adminTest = async (req, res, next) => {
    try {
        res.json({message: 'Admin checked'});
        
    } catch (error) {
        next(error);
    }
}
////////////////////////////////////////////////////////////////////////////////////