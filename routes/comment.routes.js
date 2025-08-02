const express = require("express");
const router = express.Router();
const { authorization } = require("../middlewares/auth.middleware");
const {
	addComment,
	getCommentsByLocation,
} = require("../controllers/comment.controller");

const { asyncHandler } = require("../middlewares/handler.middleware");
const { createCommentSchema } = require("../validators/comment.validator");
const { validateRequest } = require("../middlewares/validate.middleware");

router.post(
	"/:locationId",
	authorization,
	validateRequest(createCommentSchema),
	asyncHandler(addComment)
);
router.get("/:locationId", asyncHandler(getCommentsByLocation));

module.exports = router;
