const ErrorResponse = require ('../helpers/ErrorResponse');
const slugify = require('slugify');



//CREATE CATEGORY
exports.createCategory = async (req, res, next) => {
    try {
        const name = req.body.name;
        if (!name || name.trim() === '') return next(new ErrorResponse('Name is required', 400));

        const category = await db.any('INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING *', [name, slugify(name)]);
        if (!category || !category[0] || !category[0].category_id) return next(new ErrorResponse('Something went wrong. Category NOT saved.', 500));

        res.status(201).json({message: 'Category created', category: {...category[0]}});
        
    } catch (error) {
        next(error);
    }
}



//GET ALL
exports.getCategories = async (req, res, next) => {
    try {
        const categories = await db.any('SELECT * FROM categories ORDER BY name');
        if (!categories) return next(new ErrorResponse('Getting categories failed', 500));

        res.status(200).json({message: 'Categories fetched', count: categories.length, categories});

    } catch (error) {
        next(error);
    }
}



//GET BY SLUG
exports.getCategory = async (req, res, next) => {
    try {
        const categorySlug = req.params.categorySlug;
        if (!categorySlug) return next(new ErrorResponse('Category ID (slug) is required', 400));

        const category = await db.any('SELECT * FROM categories WHERE slug = $1', [categorySlug]);
        if (!category || !category[0] || !category[0].name) return next(new ErrorResponse('Category not found', 404));

        res.status(200).json({message: 'Category found', category: category[0]})
        
    } catch (error) {
        next(error);
    }
}



//EDIT CATEGORY (doesn't change slug in db because of SEO)
exports.updateCategory = async (req, res, next) => {
    try {
        const categorySlug = req.params.categorySlug;
        if (!categorySlug) return next(new ErrorResponse('Category ID (slug) is required', 400));

        const newName = req.body.newName;
        if (!newName) return next(new ErrorResponse('New Name is required', 400));

        db.task(async t => {
            const category = await t.any('SELECT * FROM categories WHERE slug = $1', [categorySlug]);
            if (!category || !category[0] || !category[0].name) return next(new ErrorResponse('Category not found', 404));

            const updatedCategory = await t.any('UPDATE categories SET name = $1 WHERE slug = $2 RETURNING *', [newName, categorySlug]);
            if (!updatedCategory || !updatedCategory[0] || !updatedCategory[0].name) return next(new ErrorResponse('Something went wrong. Category NOT updated', 500));

            res.status(200).json({message: 'Category updated', category: updatedCategory[0]});
        })
        
    } catch (error) {
        next(error);
    }
}



//DELETE CATEGORY
exports.deleteCategory = async (req, res, next) => {
    try {
        const categoryId = req.params.categoryid;
        if (!categoryId) return next(new ErrorResponse('Category ID is required', 400));

        const deletedCategory = await db.any('DELETE FROM categories WHERE category_id = $1 RETURNING *', [categoryId]);
        if (!deletedCategory || !deletedCategory[0] || !deletedCategory[0].name) return next(new ErrorResponse('Category NOT deleted. Was the right ID sent?', 500));

        res.status(200).json({message: 'Category deleted'});

    } catch (error) {
        next(error);
    }
}



//SEARCH CATEGORIES
exports.searchCategories = async (req, res, next) => {
    try {
        const name = req.query.name || '';
        
        const categories = await db.any('SELECT * FROM categories WHERE name LIKE $1 ORDER BY name', [`%${name}%`]);
        if (!categories || !categories[0]) return next(new ErrorResponse('No categories matching the search found', 404));
        
        res.status(200).json({message: `Categories matching ${name} found`, count: categories.length, categories: categories })
        
    } catch (error) {
        next(error);
    }
}