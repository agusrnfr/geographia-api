const multer = require("multer");
const path = require("path");
const fs = require("fs");

const fileFilter = (req, file, cb) => {
	const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
	if (allowedTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(new Error("File type not allowed"), false);
	}
};

let upload;

if (process.env.NODE_ENV === "production") {
	upload = multer({ storage: multer.memoryStorage(), fileFilter });
} else {
	const uploadDir = path.join(__dirname, "..", "uploads");
	if (!fs.existsSync(uploadDir)) {
		fs.mkdirSync(uploadDir);
	}
	const storage = multer.diskStorage({
		destination: (req, file, cb) => {
			cb(null, uploadDir);
		},
		filename: (req, file, cb) => {
			const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
			cb(null, uniqueSuffix + path.extname(file.originalname));
		},
	});
	upload = multer({ storage, fileFilter });
}

module.exports = upload;
