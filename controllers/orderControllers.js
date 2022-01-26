const ErrorResponse = require('../helpers/ErrorResponse');


//CREATE ORDER + DECREMENT PRODUCT.INSTOCK + INCREMENT PRODUCT.SOLD
exports.createOrder = async (req, res, next) => {
    try {
        const { address, cart, cartTotal, paymentIntent, paid } = req.body;
        if (!address || !cart || !cartTotal) return next(new ErrorResponse('Address, Cart Items and Total are required', 400));

        const products = cart.map(p => ({brand: p.brand, count: p.inCart, price: p.price, product_id: p.product_id, title: p.title}));

        db.task(async t => {
            //save order
            const newOrder = await t.one('INSERT INTO orders (user_id, products, total, address, payment_intent, paid) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [req.user.user_id, JSON.stringify(products), cartTotal, address, JSON.stringify(paymentIntent), paid]);

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
        const orders = await db.any('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.user.user_id]);
        if (!orders || !orders[0] || !orders[0].order_id) return next(new ErrorResponse('Orders NOT found', 500));

        res.status(200).json({message: 'Orders found', orders});
        
    } catch (error) {
        next(error);
    }
}



//CHANGE ORDER STATUS
exports.updateStatus = async (req, res, next) => {
    try {
        const {orderId, newStatus} = req.body;
        if (!orderId || !newStatus) return next(new ErrorResponse('Order ID and New Status are required', 400));

        const updatedOrder = await db.one('UPDATE orders SET status = $1 WHERE order_id = $2 RETURNING *', [newStatus, orderId]);
        
        res.status(200).json({message: `Order status updated`, order: updatedOrder})

        
    } catch (error) {
        next(error);
    }
}



//GET ALL ORDERS + FILTER + PAGINATION
exports.getOrders = async (req, res, next) => {
    try {
        let perPage = req.query.perpage || 2; if (perPage === 'null') perPage = 2;
        let skip = req.query.skip || 0; if (skip === 'null') skip = 0;
        let orderId = req.query.orderid; if (orderId === 'null') orderId = null;
        let address = req.query.address; if (address === 'null') address = null;

        const orderQuery = orderId ? `AND order_id = $1` : '';
        let addressQuery = address ? `OR address LIKE $2` : ''; if (address && orderQuery === '') addressQuery = ` AND address LIKE $2`;

        db.task(async t => {
            const orders = await t.any('SELECT * FROM orders WHERE user_id >= 0' + orderQuery + addressQuery + 'ORDER BY created_at DESC LIMIT $3 OFFSET $4', [orderId, `%${address}%`, perPage, skip]);
            if (!orders || !orders[0] || !orders[0].order_id) return next(new ErrorResponse('No orders found', 404));

            const total = await t.one('SELECT COUNT(*) FROM orders WHERE user_id >=0' + orderQuery + addressQuery, [orderId, `%${address}%`])

            res.status(200).json({message: 'Orders found', orders, total: Number(total.count), perPage: Number(perPage), skip: Number(skip)});
        })
        
    } catch (error) {
        next(error);
    }
}



//UPDATE ORDER AS PAID
exports.updateToPaid = async (req, res, next) => {
    try {
        const orderId = req.query.orderid;
        if (!orderId) return next(new ErrorResponse('Order ID is required', 400));

        const updatedOrder = await db.any('UPDATE orders SET paid = true WHERE order_id = $1 RETURNING *', [orderId]);
        if (!updatedOrder || !updatedOrder[0] || !updatedOrder[0].order_id) return next (new ErrorResponse('Error. Order NOT updated'), 500);

        res.status(200).json({message: `Order Updated to PAID`});
        
    } catch (error) {
        next(error);
    }
}