const multer = require("multer");
const upload = require("../middlewares/upload.middleware");

const singleUploadMiddleware = (fieldName) => {
	return (req, res, next) => {
		upload.single(fieldName)(req, res, (err) => {
			if (err instanceof multer.MulterError) {
				return res.status(400).json({ error: err.message });
			}
			next();
		});
	};
};

module.exports = singleUploadMiddleware;
