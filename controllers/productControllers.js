const ErrorResponse = require('../helpers/ErrorResponse');
const slugify = require('slugify');
const cloudinary = require('../helpers/cloudinary');



//CREATE PRODUCT
exports.createProduct = async (req, res, next) => {
    try {
        //get product details from req
        const { category_id, title, description, price, quantity, brand } = req.body;
        if (!category_id || !title || !description || !price || !quantity || !brand) return next(new ErrorResponse('Please fill in all required parameters'));

        //populate slug
        const slug = slugify(req.body.title);

        db.task(async t => {
            //save product
            const newProduct = await t.any('INSERT INTO products (category_id, title, description, price, quantity, brand, slug) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [category_id, title, description, Number(price), Number(quantity), brand, slug]);
            if (!newProduct || !newProduct[0]) return next(new ErrorResponse('Failed. Product NOT saved', 500));

            //save product tags
            //now this is weird and potentially dangerous => can be too many db calls. But I don't want to save a stringified array like: product.tags = '[tag1_id, tag2_id]'     because imagine someone deletes a tag. Now how will you extract that from a hundred product.tags? He? I think this is lesser evil.
            if (req.body.tags) {
                for (let i = 0; i < req.body.tags.length; i++) {
                    await t.none('INSERT INTO product_tag_rel (product_id, tag_id) VALUES ($1, $2)', [newProduct[0].product_id, Number(req.body.tags[i])]);
                }
            }

            //get saved tags
            const savedTags = await t.any('SELECT tag_id FROM product_tag_rel WHERE product_id = $1', [newProduct[0].product_id]); //this is an extra db call but it makes sure you only return product.tags that really got saved in res. Doing product.tags = req.body.tags would be risky - what if some tag didn't get saved in db? You would say it was and it wasn't and frontend would come crashing down

            //save product images
            //this is the same stupid situation like with tags :(
            if (req.body.images) {
                for (let i = 0; i < req.body.images.length; i++) {
                    await t.none('INSERT INTO product_img_rel (product_id, url, public_id) VALUES ($1, $2, $3)', [newProduct[0].product_id, req.body.images[i].url, req.body.images[i].public_id]);
                }
            }
            const savedImages = await t.any('SELECT * FROM product_img_rel WHERE product_id = $1', [newProduct[0].product_id]);

            //respond
            res.status(201).json({message: 'Product saved', product: {...newProduct[0], tags: savedTags, images: savedImages}})
        })
        
    } catch (error) {
        next(error);
    }
}




//GET PRODUCTS + FILTER + PAGINATION
//SINGLE QUERY VERSION
//{{URL}}/api/products/getproducts?perpage=10&skip=0&category=51&title=ab&description=ab&maxprice=1000&minquantity=10&minsold=2&orderby=title
/*
SELECT 
    products.product_id AS aggregatedby,   --what's in GROUP BY must also be in SELECT
    products.*,
    ARRAY_AGG(DISTINCT(product_tag_rel.tag_id || '=>' || tags.name)) AS tags,   --ARRAY_AGG() creates an arr, || adds to arr[i]
    ARRAY_AGG(DISTINCT(product_img_rel.url || '=>' || product_img_rel.public_id)) AS images,   --DISTINCT removes doubles that img join will add to the array
    categories.name AS category_name
FROM products
    JOIN categories 
        ON categories.category_id = products.category_id
    LEFT JOIN product_tag_rel   --LEFT JOIN so products with no tags don't get omitted
        ON product_tag_rel.product_id = products.product_id
    LEFT JOIN tags   --so you get tag name
        ON tags.tag_id = product_tag_rel.tag_id
    LEFT JOIN product_img_rel   --this doubles the ARRAY_AGG, but I don't know what else to do
        ON products.product_id = product_img_rel.product_id
WHERE products.price <= 10000
    AND products.category_id = 52
    AND product_tag_rel.tag_id = 13
GROUP BY products.product_id, categories.name
ORDER BY products.title, products.product_id --product_id must be here as a 2nd arg or SQL feels free to repeat what was already chosen before
LIMIT 2 OFFSET 2;
*/
exports.getProducts = async (req, res, next) => {
    try {
        //get sql WHERE-clause out of the way:
        const WHERE = ` WHERE products.product_id >= 0 `; //this does nothing but enables all other queries to start with AND

        //fileter by category
        const categoryid = req.query.category;
        const categoryQuery = req.query.category && req.query.category !== 'null' ? `AND products.category_id = $1` : '';

        //filter by title
        const title = req.query.title;
        const titleQuery = req.query.title && req.query.title !== 'null' ? `AND products.title LIKE $2` : '';

        //filter by description
        const description = req.query.description;
        const descriptionQuery = req.query.description && req.query.description !== 'null' ? `AND products.description LIKE $3` : '';

        //filter by maxprice
        const maxprice = req.query.maxprice;
        let priceQuery = req.query.maxprice && req.query.maxprice !== 'null' ? `AND products.price <= $4` : '';

        //filter by minquantity
        const minquantity = req.query.minquantity;
        const quantityQuery = req.query.minquantity && req.query.minquantity !== 'null' ? `AND products.quantity >= $5` : '';

        //filter by sold
        const minsold = req.query.minsold;
        const soldQuery = req.query.minsold && req.query.minsold !== 'null' ? `AND products.sold >= $6` : '';

        //filter by brand
        const brand = req.query.brand;
        const brandQuery = req.query.brand && req.query.brand !== 'null' ? `AND products.brand LIKE $7` : '';

        //filter by tag
        const tagid = req.query.tag;
        const tagQuery = req.query.tag && req.query.tag !== 'null' ? `AND product_tag_rel.tag_id = $8` : '';

        //skip & limit
        let perpage = Number(req.query.perpage) || 5; if (perpage === 'null') perpage = 5;
        let skip = Number(req.query.skip) || 0; if (skip === 'null') skip = 0;

        //orderby
        let orderby = req.query.orderby || 'title'; if (orderby === 'null') orderby = 'title';
        if (orderby !== 'category_id' && orderby !== 'title' && orderby !== 'price' && orderby !== 'quantity' && orderby !== 'sold' && orderby !== 'brand' && orderby !== 'created_at') return next(new ErrorResponse(`Cannot sort by ${req.query.orderby}`, 400)); //this is here not only to avoid sorting by non-existing columns but mainly to avoid sql-injection. Pg-Promise does not support ORDER BY with $variables and we have to sanitize ORDER BY ourselves.
        const orderbyQuery = ` ORDER BY products.${orderby}, products.product_id DESC `


        
        db.task(async t => {
            //get products
            const products = await t.any("SELECT products.product_id AS aggregatedby, products.*, ARRAY_AGG(DISTINCT(product_tag_rel.tag_id || '=>' || tags.name)) AS tags, ARRAY_AGG(DISTINCT(product_img_rel.url || '=>' || product_img_rel.public_id)) AS images, categories.name AS category_name FROM products JOIN categories ON categories.category_id = products.category_id LEFT JOIN product_tag_rel ON product_tag_rel.product_id = products.product_id LEFT JOIN tags ON tags.tag_id = product_tag_rel.tag_id LEFT JOIN product_img_rel ON products.product_id = product_img_rel.product_id"
            +
            WHERE
            +
            categoryQuery 
            +
            titleQuery
            +
            descriptionQuery
            +
            priceQuery
            +
            quantityQuery
            +
            soldQuery
            +
            brandQuery
            +
            tagQuery
            +
            "GROUP BY products.product_id, categories.name" + orderbyQuery + "LIMIT $9 OFFSET $10",
            [categoryid, `%${title}%`, `%${description}%`, Number(maxprice) * 100, Number(minquantity), Number(minsold), `%${brand}%`, tagid, perpage, skip]);

            if (!products || !products[0]) return next(new ErrorResponse('No products found', 404));

            
            
            //format tags like [{tag_id, tag_name}, ...]
            for (let i = 0; i < products.length; i++) {               
                for (let j = 0; j < products[i].tags.length; j++) {
                    if (products[i].tags[j]) {
                        products[i].tags[j] = {tag_id: products[i].tags[j].split('=>')[0], tag_name: products[i].tags[j].split('=>')[1]}
                    }
                }
            }



            //format images like [{url, public_id}, ...]
            for (let i = 0; i < products.length; i++) {
                for (let j = 0; j < products[i].images.length; j++) {
                    if (products[i].images[j]) {
                        products[i].images[j] = {url: products[i].images[j].split('=>')[0], public_id: products[i].images[j].split('=>')[1]}
                    }
                }
            }
            


            //get total of products matching the search criteria
            const total = await t.one(
                'SELECT COUNT(DISTINCT(products.*)) FROM products LEFT JOIN product_tag_rel ON product_tag_rel.product_id = products.product_id'
                +
                WHERE
                +
                categoryQuery 
                +
                titleQuery
                +
                descriptionQuery
                +
                priceQuery
                +
                quantityQuery
                +
                soldQuery
                +
                brandQuery
                +
                tagQuery,
                [categoryid, `%${title}%`, `%${description}%`, Number(maxprice) * 100, Number(minquantity), Number(minsold), `%${brand}%`, tagid]
            );

            

            //respond with {message, products, perPage, skip, total}
            res.json({message: 'Products found', products, perPage: Number(perpage), skip: Number(skip), total: Number(total.count)})
        })

    } catch (error) {
        next(error);
    }
}



//GET PRODUCT BY SLUG
/*
SELECT 
	products.product_id AS aggregatedby,   --what's in GROUP BY must also be in SELECT
	products.*,
	ARRAY_AGG(DISTINCT(product_tag_rel.tag_id || '=>' || tags.name)) AS tags,
	ARRAY_AGG(DISTINCT(product_img_rel.url || '=>' || product_img_rel.public_id)) AS images,
	categories.name AS category_name
FROM products
JOIN categories ON categories.category_id = products.category_id
LEFT JOIN product_tag_rel
	ON product_tag_rel.product_id = products.product_id
LEFT JOIN tags
	ON tags.tag_id = product_tag_rel.tag_id
LEFT JOIN product_img_rel
	ON products.product_id = product_img_rel.product_id
WHERE products.slug = 'abc'
GROUP BY products.product_id, categories.name;
*/
exports.getProductBySlug = async (req, res, next) => {
    try {
        const slug = req.query.slug;
        if (!slug) return next(new ErrorResponse('Product ID (slug) is required', 400));

        const product = await db.any("SELECT products.product_id AS aggregatedby, products.*, ARRAY_AGG(DISTINCT(product_tag_rel.tag_id || '=>' || tags.name)) AS tags, ARRAY_AGG(DISTINCT(product_img_rel.url || '=>' || product_img_rel.public_id)) AS images, categories.name AS category_name FROM products JOIN categories ON categories.category_id = products.category_id LEFT JOIN product_tag_rel ON product_tag_rel.product_id = products.product_id LEFT JOIN tags ON tags.tag_id =  product_tag_rel.tag_id LEFT JOIN product_img_rel ON products.product_id = product_img_rel.product_id WHERE products.slug = $1 GROUP BY products.product_id, categories.name", [slug]);
        if (!product || !product[0]) return next(new ErrorResponse('Product not found', 400));

        //format tags [{tag_id, tag_name}, ...]
        for (let j = 0; j < product[0].tags.length; j++) {
            if (product[0].tags[j]) {
                product[0].tags[j] = {tag_id: product[0].tags[j].split('=>')[0], tag_name: product[0].tags[j].split('=>')[1]}
            }
        }

        //format images like [{url, public_id}, ...]
        for (let j = 0; j < product[0].images.length; j++) {
            if (product[0].images[j]) {
                product[0].images[j] = {url: product[0].images[j].split('=>')[0], public_id: product[0].images[j].split('=>')[1]}
            }
        }
        
        //respond
        res.status(200).json({message: 'Product found', product: product[0]});
        
    } catch (error) {
        next(error);
    }
}



//UPDATE PRODUCT
exports.updateProduct = async (req, res, next) => {
    try {
        //get product details from req
        const { product_id, category_id, title, description, price, quantity, brand } = req.body;
        if (!product_id || !category_id || !title || !description || !price || !quantity || !brand) return next(new ErrorResponse('Please fill in all required parameters'));

        db.task(async t => {
            //update in products
            const updatedProduct = await t.any('UPDATE products SET category_id = $1, title = $2, description = $3, price = $4, quantity = $5, brand = $6 WHERE product_id = $7 RETURNING *', [category_id, title, description, Number(price), Number(quantity), brand, product_id]);
            if (!updatedProduct || !updatedProduct[0]) return next(new ErrorResponse('Product update failed', 500));

            //update product_tag_rel
            await t.none('DELETE FROM product_tag_rel WHERE product_id = $1', [product_id]);
            if (req.body.tags && req.body.tags.length) {
                for (let i = 0; i < req.body.tags.length; i++) {
                    await t.none('INSERT INTO product_tag_rel (product_id, tag_id) VALUES ($1, $2)', [product_id, Number(req.body.tags[i])]);
                }
            }
            const savedTags = await t.any('SELECT tag_id FROM product_tag_rel WHERE product_id = $1', [product_id]); //it is an extra call but makes sure you only return tags that actually got saved

            //update product_img_rel
            await t.none('DELETE FROM product_img_rel WHERE product_id = $1', [product_id]);
            if (req.body.images && req.body.images.length) {
                for (let i = 0; i < req.body.images.length; i++) {
                    await db.none('INSERT INTO product_img_rel (product_id, url, public_id) VALUES ($1, $2, $3)', [product_id, req.body.images[i].url, req.body.images[i].public_id]);
                }
            }
            const savedImages = await t.any('SELECT * FROM product_img_rel WHERE product_id = $1', [product_id]);

            //respond
            res.status(200).json({message: 'Product updated', product: {...updatedProduct, tags: savedTags, images: savedImages}});
        })
        
    } catch (error) {
        next(error);
    }
}



//DELETE PRODUCT
exports.deleteProduct = async (req, res, next) => {
    try {
        //check body for product_id
        const product_id = req.body.product_id;
        if (!product_id) return next(new ErrorResponse('Product ID is required', 400));

        db.task(async t => {
            //get product images
            const productImages = await t.any('SELECT public_id FROM product_img_rel WHERE product_id = $1', [product_id]);

            //delete product
            const deletedProduct = await t.any('DELETE FROM products WHERE product_id = $1 RETURNING *', [product_id]);
            if (!deletedProduct || !deletedProduct[0]) return next(new ErrorResponse('Failed. Product NOT deleted', 500));

            //delete Cloudinary images
            if (productImages && productImages.length) {
                for (let i = 0; i < productImages.length; i++) {
                    let result = await cloudinary.uploader.destroy(productImages[i].public_id);
                    console.log(result);
                }
            }

            res.status(200).json({message: 'Product deleted'});
        })
   
    } catch (error) {
        next(error);
    }
}



//GET LATEST PRODUCTS
/*
SELECT 
	products.*,
	categories.name AS category_name,
	ARRAY_AGG(product_img_rel.url) AS images,
	ARRAY_AGG(DISTINCT(tags.name)) AS tags
FROM products
	LEFT JOIN product_img_rel
		ON products.product_id = product_img_rel.product_id
	INNER JOIN categories
		ON categories.category_id = products.category_id
	LEFT JOIN product_tag_rel
		ON product_tag_rel.product_id = products.product_id
	LEFT JOIN tags
		ON tags.tag_id = product_tag_rel.tag_id
GROUP BY products.product_id, categories.name
ORDER BY products.created_at DESC
LIMIT 3;
*/
exports.getLatestProducts = async (req, res, next) => {
    try {
        const products = await db.any('SELECT products.*, categories.name AS category_name, ARRAY_AGG(product_img_rel.url) AS images, ARRAY_AGG(DISTINCT(tags.name)) AS tags FROM products LEFT JOIN product_img_rel ON products.product_id = product_img_rel.product_id INNER JOIN categories ON categories.category_id = products.category_id LEFT JOIN product_tag_rel ON product_tag_rel.product_id = products.product_id LEFT JOIN tags ON tags.tag_id = product_tag_rel.tag_id GROUP BY products.product_id, categories.name ORDER BY products.created_at DESC LIMIT 3');

        if (!products || !products[0]) return next(new ErrorResponse('No products found', 404));

        res.status(200).json({message: 'Products found', products});

    } catch (error) {
        next(error);
    }
}



exports.verifyCart = async (req, res, next) => {
    try {
        let cart = req.body.cart;
        if (!cart) return next(new ErrorResponse('Cart not included in request', 400));
        if (cart.length === 0) return next(new ErrorResponse('Cannot verify empty cart', 400));

        db.task(async t => {
            for (let i = 0; i < cart.length; i++) {
                const productPrice = await t.one('SELECT price FROM products WHERE product_id = $1', [cart[i].product_id]);
                cart[i].price = productPrice;
            }
        });
        
        const total = cart.reduce((acc, curr) => {
            acc += curr.price * curr.inCart
            return acc;
        }, 0);

        res.status(200).json({message: 'Cart verified', cart, total})

        
        
    } catch (error) {
        next(error);
    }
}