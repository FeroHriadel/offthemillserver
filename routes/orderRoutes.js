const express = require('express');
const router = express.Router();
const { requireSignin, requireAdmin } = require('../middleware/auth');
const { createOrder, getUsersOrders, updateStatus, getOrders, updateToPaid } = require('../controllers/orderControllers');



router.post('/createorder', requireSignin, createOrder);
router.get('/getusersorders', requireSignin, getUsersOrders);
router.put('/updatestatus', requireSignin, requireAdmin, updateStatus);
router.get('/getorders', requireSignin, requireAdmin, getOrders);
router.put('/updatetopaid', requireSignin, requireAdmin, updateToPaid);



module.exports = router;