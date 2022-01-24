const ErrorResponse = require ('../helpers/ErrorResponse');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);



exports.createPaymentIntent = async (req, res, next) => {
    try {
        const {cartTotal, address} = req.body;
        if (!cartTotal || !address || address.trim() === '') return next(new ErrorResponse('Cart Total and Address are required', 400));



        const paymentIntent = await stripe.paymentIntents.create({
            amount: cartTotal, //in cents
            currency: 'usd'
        });


        res.status(200).send({clientSecret: paymentIntent.client_secret});
        
    } catch (error) {
        next(error);
    }
}