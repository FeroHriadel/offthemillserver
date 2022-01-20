const express = require('express');
const router = express.Router();
const { requireSignin, requireAdmin } = require('../middleware/auth');
const { createReview, getProductReviews, updateReview, deleteReview, getReview } = require('../controllers/reviewControllers');



router.post('/createreview', requireSignin, createReview);
router.get('/getreviews', getProductReviews);
router.put('/updatereview', requireSignin, updateReview);
router.delete('/deletereview', requireSignin, deleteReview);
router.get('/getreview', getReview);




module.exports = router;