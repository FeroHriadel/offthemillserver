const express = require('express');
const router = express.Router();
const { requireSignin, requireAdmin } = require('../middleware/auth');
const { createReview, getProductReviews, updateReview, deleteReview } = require('../controllers/reviewControllers');



router.post('/createreview', requireSignin, createReview);
router.get('/getreviews', getProductReviews);
router.put('/updatereview', requireSignin, updateReview);
router.delete('/deletereview', requireSignin, requireAdmin, deleteReview);




module.exports = router;