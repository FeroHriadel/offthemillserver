const express = require('express');
const router = express.Router();
const { requireSignin } = require('../middleware/auth')
const { createPaymentIntent } = require('../controllers/stripeControllers');



router.post('/createpaymentintent', requireSignin, createPaymentIntent);



module.exports = router;