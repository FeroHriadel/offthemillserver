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
app.use(cors());
app.use(express.json({limit: "50mb"}));
app.use(morgan('dev'));



//ROUTES
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/products', productRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/stripe', stripeRoutes);



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