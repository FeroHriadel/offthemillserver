const ErrorResponse = require ('../helpers/ErrorResponse');



exports.createReview = async (req, res, next) => {
    try {
        const user_id = req.user.user_id;
        let { product_id, stars, comment } = req.body;
        if (!product_id || !stars) return next(new ErrorResponse('Star rating is required', 400));
        if (!comment) comment = null;


        db.task(async t => {
            //check if user already wrote a review for this product
            const existingReviewByUser = await t.any('SELECT * FROM reviews WHERE user_id = $1 AND product_id = $2', [user_id, product_id]);
            if (existingReviewByUser && existingReviewByUser[0] && existingReviewByUser[0].review_id) return next(new ErrorResponse('You only can write one review per product', 403));

            //save review
            const savedReview = await t.any('INSERT INTO reviews (user_id, product_id, stars, comment, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *', [user_id, product_id, stars, comment, new Date()]);
            if (!savedReview || !savedReview[0] || !savedReview[0].review_id) return next(new ErrorResponse('Something went wrong. Review NOT saved'));

            res.status(201).json({message: `Review Saved`, review: savedReview[0]});
        })

    } catch (error) {
        next(err);
    }
}



exports.getProductReviews = async (req, res, next) => {
    try {
        const product_id = req.query.product_id;
        if (!product_id) return next(new ErrorResponse('Product ID is required'), 400);       

        const reviews = await db.any('SELECT reviews.*, users.email FROM reviews INNER JOIN users ON users.user_id = reviews.user_id WHERE product_id = $1 ORDER BY reviews.created_at DESC LIMIT 25', [product_id]);
        if (!reviews || !reviews[0]) return next(new ErrorResponse('No reviews found'), 404);

        res.status(200).json({message: 'Reviews found', reviews});
        
    } catch (error) {
        next(error);
    }
}



exports.getReview = async (req, res, next) => {
    try {
        const review_id = req.query.review_id;
        if (!review_id) return next(new ErrorResponse('Review ID is required', 400));

        const review = await db.any('SELECT * FROM reviews WHERE review_id = $1', [review_id]);
        if (!review || !review[0]) return next(new ErrorResponse('Review not found', 404));

        res.status(200).json({message: 'Review found', review: review[0]});
        
    } catch (error) {
        next(error);
    }
}



exports.updateReview = async (req, res, next) => {
    try {
        const {user_id, role } = req.user;
        let { stars, comment, review_id } = req.body;
        if (!stars || !review_id) return next(new ErrorResponse('Star rating is required', 400));
        if (!comment || comment.trim() === '') comment = null;

        db.task(async t => {
            const review = await t.any('SELECT * FROM reviews WHERE review_id = $1', [review_id]);
            if (!review || !review[0]) return next(new ErrorResponse('Review not found', 404));
            console.log(review[0].user_id, user_id);
            
            if (role !== 'admin') {
                if (review[0].user_id !== user_id) return next(new ErrorResponse('Unauthorizedxxx', 401));
            } 

            const updatedReview = await t.any('UPDATE reviews SET stars = $1, comment = $2, created_at = $3 WHERE review_id = $4 RETURNING *', [stars, comment, new Date(), review_id]);
            if (!updatedReview || !updatedReview[0]) return next(new ErrorResponse('Something went wrong. Review NOT updated', 500));

            res.status(200).json({message: `Review updated`, review: updatedReview[0]});
        })

        
    } catch (error) {
        next(error);
    }
}



exports.deleteReview = async (req, res, next) => {
    try {
        const review_id = req.body.review_id;
        if (!review_id) return next(new ErrorResponse('Review ID is required', 400));

        const deletedReview = await db.one('DELETE FROM reviews WHERE review_id = $1 RETURNING *', [review_id]); //pg promise will error out if this doesn;t go well

        res.status(200).json({message: `Review Deleted`})
        
    } catch (error) {
        next(error);
    }
}