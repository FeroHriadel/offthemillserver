const express = require('express');
const router = express.Router();
const { preSignup, signup, signin, getSignedInUser, getGoogleClientId, signinWithGoogle, forgotPassword, resetPassword, changePassword, adminTest } = require('../controllers/userControllers');
const { requireSignin, requireAdmin } = require('../middleware/auth');



//auth
router.post('/presignup', preSignup);
router.post('/signup', signup);
router.post('/signin', signin);
router.get('/getsignedinuser', requireSignin, getSignedInUser); ////////test
router.get('/getgoogleclientid', getGoogleClientId);
router.post('/signinwithgoogle', signinWithGoogle);
router.put('/forgotpassword', forgotPassword);
router.put('/resetpassword', resetPassword);

//user routes
router.put('/changepassword', requireSignin, changePassword);

//admin routes
router.get('/admin', requireSignin, requireAdmin, adminTest) ////////test




module.exports = router;