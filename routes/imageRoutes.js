const express = require('express');
const router = express.Router();
const { requireSignin, requireAdmin } = require('../middleware/auth');
const { uploadImage, removeImage } = require('../controllers/imageControllers');



router.post('/uploadimage', requireSignin, requireAdmin, uploadImage);
router.post('/removeimage', requireSignin, requireAdmin, removeImage);



module.exports = router;