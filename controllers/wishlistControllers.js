const ErrorResponse = require('../helpers/ErrorResponse');



//ADD TO WISHLIST
exports.addToWishlist = async (req, res, next) => {
    try {
        const { product_id } = req.body;
        if (!product_id) return next(new ErrorResponse('Product ID is required', 400));

        db.task(async t => {
            const productInWishlist = await t.any('SELECT * FROM wishlist WHERE user_id = $1 AND product_id = $2', [req.user.user_id, product_id]);
            if (productInWishlist && productInWishlist[0] && productInWishlist[0].product_id) return next(new ErrorResponse('Product is already in your Wishlist', 403));

            const newWish = await t.any('INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2) RETURNING *', [req.user.user_id, product_id]);
            if (!newWish || !newWish[0] || !newWish[0].wish_id) return next(new ErrorResponse('Error. Product NOT added to wishlist', 500));

            res.status(201).json({message: 'Product added to Wishlist', wish: newWish[0]});
        })

    } catch (error) {
        next(error);
    }
}



exports.getWishlist = async (req, res, next) => {
    try {
        const products = await db.any('SELECT products.*, ARRAY_AGG(product_img_rel.url) AS images, wishlist.wish_id FROM products INNER JOIN wishlist ON wishlist.product_id = products.product_id LEFT JOIN product_img_rel ON product_img_rel.product_id = products.product_id WHERE wishlist.user_id = $1 GROUP BY (products.product_id, wishlist.wish_id)', [req.user.user_id]);
        if (!products || !products[0] || !products[0].product_id) return next(new ErrorResponse('No products found', 404));

        res.status(200).json({message: 'Wishlist Products found', products})
        
    } catch (error) {
        next(error);
    }
}



exports.removeFromWishlist = async (req, res, next) => {
    try {
        const wish_id = req.body.wish_id;
        if (!wish_id) return next(new ErrorResponse('Wishlist Item ID is required', 400));
        console.log(wish_id); /***************************** */

        db.task(async t => {
            const wish = await t.any('SELECT * FROM wishlist WHERE wish_id = $1', [wish_id]);
            if (!wish || !wish[0] || !wish[0].wish_id) return next(new ErrorResponse('Wishlist Item not found', 404));

            if (wish[0].user_id == req.user.user_id) {
                const deletedWish = await t.any('DELETE FROM wishlist WHERE wish_id = $1 RETURNING *', [wish_id]);
                if (!deletedWish || !deletedWish[0] || !deletedWish[0].wish_id) return next(new ErrorResponse('Error. Wishlist Item NOT deleted', 500));
                return res.status(200).json({message: `Wishlist Item deleted`});
            } else {
                return res.status(401).json({error: `Unauthorized`});
            }
        })

    } catch (error) {
        next(error);
    }
}