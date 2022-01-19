const express = require('express');
const router = express.Router();
const { requireSignin, requireAdmin } = require('../middleware/auth');
const { createTag, getTags, getTag, updateTag, deleteTag, searchTags } = require('../controllers/tagControllers');



router.post('/createtag', requireSignin, requireAdmin, createTag);
router.get('/gettags', getTags);
router.get('/gettag/:tagSlug', getTag);
router.put('/updatetag/:tagSlug', requireSignin, requireAdmin, updateTag);
router.delete('/deletetag/:tagid', requireSignin, requireAdmin, deleteTag);
router.get('/searchtags', searchTags);



module.exports = router;