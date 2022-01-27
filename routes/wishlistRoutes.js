const express = require('express');
const router = express.Router();
const { requireSignin } = require('../middleware/auth');
const { addToWishlist, getWishlist, removeFromWishlist } = require('../controllers/wishlistControllers');



router.post('/addtowishlist', requireSignin, addToWishlist);
router.get('/getwishlist', requireSignin, getWishlist);
router.delete('/removefromwishlist', requireSignin, removeFromWishlist);



module.exports = router;



