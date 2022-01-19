const express = require('express');
const router = express.Router();
const { requireSignin, requireAdmin } = require('../middleware/auth');
const { createCategory, getCategories, getCategory, updateCategory, deleteCategory, searchCategories } = require('../controllers/categoryControllers');



router.post('/createcategory', requireSignin, requireAdmin, createCategory);
router.get('/getcategories', getCategories);
router.get('/getcategory/:categorySlug', getCategory);
router.put('/updatecategory/:categorySlug', requireSignin, requireAdmin, updateCategory);
router.delete('/deletecategory/:categoryid', requireSignin, requireAdmin, deleteCategory);
router.get('/searchcategories', searchCategories);



module.exports = router;