const express = require('express');
const router = express.Router();
const { requireSignin, requireAdmin } = require('../middleware/auth');
const { createOrder, getUsersOrders } = require('../controllers/orderControllers');



router.post('/createorder', requireSignin, createOrder);
router.get('/getusersorders', requireSignin, getUsersOrders);



module.exports = router;