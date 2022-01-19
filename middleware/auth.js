const jwt = require('jsonwebtoken');
const ErrorResponse = require('../helpers/ErrorResponse');



//REQUIRE SIGNIN (gets Authorization Bearer token from frontend in headers. The token has user_id in it. Finds user by iser_id and puts all user's details into req.user = {email, role, ...})
exports.requireSignin = async (req, res, next) => {
    try {
        //get token
        let token;
        if (req.headers && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token) return next(new ErrorResponse('Unauthorized (check1)', 401));
        console.log(token);
        

        //verify token
        jwt.verify(token, process.env.JWT_SECRET, async function(err, decoded) {
            if (err) return next(new ErrorResponse('Unauthorized (check2)', 401));

            //get user from db
            const user = await db.any('SELECT * FROM users WHERE user_id = $1', [decoded.user_id]);
            if (!user || !user[0] || !user[0].user_id) return next(new ErrorResponse('Non-existing user', 401));

            //put userDetails onto req.user = {email, role, ...}
            delete user[0].password;
            req.user = user[0];
            next();
        });
        
    } catch (error) {
        next(error);
    }
}



//REQUIRE ADMIN (must be used after requireSignin() )
// requireSignin puts user to req like this: req.user = {email, role...})
// we just check if the role is admin
exports.requireAdmin = async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return next(new ErrorResponse('Unauthorized', 401));
        next();
        
    } catch (error) {
        next(error);
    }
}