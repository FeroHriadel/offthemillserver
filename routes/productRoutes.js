const express = require('express');
const router = express.Router();
const { requireSignin, requireAdmin } = require('../middleware/auth');
const { createProduct, getProducts, getProductBySlug, updateProduct, deleteProduct, getLatestProducts, verifyCart } = require('../controllers/productControllers');



router.post('/createproduct', requireSignin, requireAdmin, createProduct);
router.get('/getproducts', getProducts);
router.get('/getproductbyslug', getProductBySlug);
router.put('/updateproduct', requireSignin, requireAdmin, updateProduct);
router.delete('/deleteproduct', requireSignin, requireAdmin, deleteProduct);
router.get('/getlatestproducts', getLatestProducts);
router.post('/verifycart', verifyCart);



module.exports = router;