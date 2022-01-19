const ErrorResponse = require ('../helpers/ErrorResponse');
const slugify = require('slugify');



//CREATE TAG
exports.createTag = async (req, res, next) => {
    try {
        const name = req.body.name;
        if (!name || name.trim() === '') return next(new ErrorResponse('Name is required', 400));

        const tag = await db.any('INSERT INTO tags (name, slug) VALUES ($1, $2) RETURNING *', [name, slugify(name)]);
        if (!tag || !tag[0] || !tag[0].tag_id) return next(new ErrorResponse('Something went wrong. Tag NOT saved.', 500));

        res.status(201).json({message: 'Tag created', tag: {...tag[0]}});
        
    } catch (error) {
        next(error);
    }
}



//GET ALL
exports.getTags = async (req, res, next) => {
    try {
        const tags = await db.any('SELECT * FROM tags ORDER BY name');
        if (!tags) return next(new ErrorResponse('Getting tags failed', 500));

        res.status(200).json({message: 'Tags fetched', count: tags.length, tags});

    } catch (error) {
        next(error);
    }
}



//GET BY SLUG
exports.getTag = async (req, res, next) => {
    try {
        const tagSlug = req.params.tagSlug;
        if (!tagSlug) return next(new ErrorResponse('Tag ID (slug) is required', 400));

        const tag = await db.any('SELECT * FROM tags WHERE slug = $1', [tagSlug]);
        if (!tag || !tag[0] || !tag[0].name) return next(new ErrorResponse('Tag not found', 404));

        res.status(200).json({message: 'Tag found', tag: tag[0]})
        
    } catch (error) {
        next(error);
    }
}



//EDIT TAG (doesn't change slug in db because of SEO)
exports.updateTag = async (req, res, next) => {
    try {
        const tagSlug = req.params.tagSlug;
        if (!tagSlug) return next(new ErrorResponse('Tag ID (slug) is required', 400));

        const newName = req.body.newName;
        if (!newName) return next(new ErrorResponse('New Name is required', 400));

        db.task(async t => {
            const tag = await t.any('SELECT * FROM tags WHERE slug = $1', [tagSlug]);
            if (!tag || !tag[0] || !tag[0].name) return next(new ErrorResponse('Tag not found', 404));

            const updatedTag = await t.any('UPDATE tags SET name = $1 WHERE slug = $2 RETURNING *', [newName, tagSlug]);
            if (!updatedTag || !updatedTag[0] || !updatedTag[0].name) return next(new ErrorResponse('Something went wrong. Tag NOT updated', 500));

            res.status(200).json({message: 'Tag updated', tag: updatedTag[0]});
        });
        
    } catch (error) {
        next(error);
    }
}



//DELETE TAG
exports.deleteTag = async (req, res, next) => {
    try {
        const tagId = req.params.tagid;
        if (!tagId) return next(new ErrorResponse('Tag ID is required', 400));

        const deletedTag = await db.any('DELETE FROM tags WHERE tag_id = $1 RETURNING *', [tagId]);
        if (!deletedTag || !deletedTag[0] || !deletedTag[0].name) return next(new ErrorResponse('Tag NOT deleted. Was the right ID sent?', 500));

        res.status(200).json({message: 'Tag deleted'});

    } catch (error) {
        next(error);
    }
}



//SEARCH TAGS
exports.searchTags = async (req, res, next) => {
    try {
        const name = req.query.name || '';
        
        const tags = await db.any('SELECT * FROM tags WHERE name LIKE $1 ORDER BY name', [`%${name}%`]);
        if (!tags || !tags[0]) return next(new ErrorResponse('No tags matching the search found', 404));
        
        res.status(200).json({message: `Tags matching ${name} found`, count: tags.length, tags: tags })
        
    } catch (error) {
        next(error);
    }
}



