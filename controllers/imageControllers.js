const ErrorResponse = require('../helpers/ErrorResponse');
const cloudinary = require('../helpers/cloudinary');




//you dont have to enable form-data in server.js because front end will send the image as a string and use axios to take care of all
//but you still need app.use(express.json({limit: "50mb"}));
exports.uploadImage = async (req, res, next) => {
    try {
        if (!req.body || !req.body.image) return next(new ErrorResponse('No images included', 400));

        const response = await cloudinary.uploader.upload(req.body.image);
        if (!response || !response.url) return next(new ErrorResponse('Image upload failed', 500));

        res.status(200).json({message: `Image uploaded`, image: {public_id: response.public_id, url: response.url}})
        
    } catch (error) {
        next(error);
    }
}



exports.removeImage = async (req, res, next) => {
    try {
        const image_id = req.body.public_id;
        if (!image_id) return next(new ErrorResponse('Image ID (public_id) is required', 400));

        const result = await cloudinary.uploader.destroy(image_id);
        console.log(result.result)
        if (!result || !result.result || result.result !== 'ok') return next(new ErrorResponse('Error. Image NOT deleted', 500));

        res.status(200).json({message: 'Image deleted'});
        
    } catch (error) {
        next(error);
    }
}