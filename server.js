const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const pgp = require('pg-promise')();
const morgan = require('morgan');
const cors = require('cors');
const colors = require('colors');
const errorHandler = require('./middleware/errorHandler');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const tagRoutes = require('./routes/tagRoutes');
const productRoutes = require('./routes/productRoutes');
const imageRoutes = require('./routes/imageRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const stripeRoutes = require('./routes/stripeRoutes');
const orderRoutes = require('./routes/orderRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const helmet = require('helmet');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');



//CONNECT DB
const cn = {
    host: process.env.DB_HOST,
    port: '5432',
    database: process.env.DB_DATABASE,
    user: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD
};
db = pgp(cn);
db.connect()
    .then(obj => {
        console.log(`DB connected: ${obj.client.serverVersion}`.cyan.bold);
    })
    //.catch(err => {...})    //err not handled here bc unhandledRejections are caught at the bottom

/* RELEASE DB CONNECTION LIKE THIS: *****************************************************************

    let savedConnectionObject;
    db.connect()
        .then(obj => {
            savedConnectionObject = obj;
            return savedConnectionObject.any('SELECT * FROM users');
        })
        .then(data => {
            res.json({users: data})
        })
        .finally(() => {
            savedConnectionObject.done();
        })

******************************************************************************************************/



//APP MIDDLEWARE
const app = express();
app.use(express.json({limit: "50mb"}));
app.use(morgan('dev'));



//SECURITY MIDDLEWARE
app.use(cors()); //allow any cross origin
app.use(helmet()); //no bad headers
app.use(xss()); //no <tags> in input
//no billion calls a minute
const limiter = rateLimit({
    windowMs: 10 * 60 * 1000, //10 minutes
    max: 100 //max number of calls
  });
app.use(limiter);
app.use(hpp());




//ROUTES
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/products', productRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/wishlist', wishlistRoutes);



//HANDLE ERRORS (must come at the end)
app.use(errorHandler);




//RUN SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is up on port ${PORT} in ${process.env.NODE_ENV} mode`.yellow);
})

process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`.red)
})