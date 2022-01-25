const ErrorResponse = require('../helpers/ErrorResponse');


//CREATE ORDER + DECREMENT PRODUCT.INSTOCK + INCREMENT PRODUCT.SOLD
exports.createOrder = async (req, res, next) => {
    try {
        const { address, cart, cartTotal, paymentIntent } = req.body;
        if (!address || !cart || !cartTotal || !paymentIntent) return next(new ErrorResponse('Address, Cart Items, Total and Payment Data are required', 400));

        const products = cart.map(p => ({brand: p.brand, count: p.inCart, price: p.price, product_id: p.product_id, title: p.title}));

        db.task(async t => {
            //save order
            const newOrder = await t.one('INSERT INTO orders (user_id, products, total, address, payment_intent) VALUES ($1, $2, $3, $4, $5) RETURNING *', [req.user.user_id, JSON.stringify(products), cartTotal, address, JSON.stringify(paymentIntent)]);

            //increment 'sold' and decrement 'quantity'
            for (let i = 0; i < products.length; i++) {
                await t.none('UPDATE products SET quantity = quantity - $1, sold = sold + $2 WHERE product_id = $3', [products[i].count, products[i].count, products[i].product_id]);
            }

            res.status(201).json({message: 'Order created', order: newOrder});
        })
        
    } catch (error) {
        next(error);
    }
}



//GET USER'S ORDERS
exports.getUsersOrders = async (req, res, next) => {
    try {
        const orders = await db.any('SELECT * FROM orders WHERE user_id = $1', [req.user.user_id]);
        if (!orders || !orders[0] || !orders[0].order_id) return next(new ErrorResponse('Orders NOT found', 500));

        res.status(200).json({message: 'Orders found', orders});
        
    } catch (error) {
        next(error);
    }
}