const express = require("express");
const router = express.Router();
const { authorization } = require("../middlewares/auth.middleware");
const { validateRequest } = require("../middlewares/validate.middleware");
const {
	updateProfileSchema,
	updatePrivacySchema,
	updateAddressSchema,
	updatePasswordSchema,
} = require("../validators/user.validator");
const {
	getProfile,
	getMyProfile,
	updateProfile,
	updatePrivacy,
	updateLocation,
	deleteUser,
	changePassword,
} = require("../controllers/user.controller");

const { asyncHandler } = require("../middlewares/handler.middleware");

const singleUpload = require("../middlewares/singleUpload.middleware");

router.get("/profile/:id", asyncHandler(getProfile));
router.get("/me", authorization, asyncHandler(getMyProfile));
router.put(
	"/me",
	authorization,
	singleUpload("profile_image"),
	validateRequest(updateProfileSchema),
	asyncHandler(updateProfile)
);
router.put(
	"/me/privacy",
	authorization,
	validateRequest(updatePrivacySchema),
	asyncHandler(updatePrivacy)
);
router.put(
	"/me/location",
	authorization,
	validateRequest(updateAddressSchema),
	asyncHandler(updateLocation)
);
router.put(
	"/me/password",
	authorization,
	validateRequest(updatePasswordSchema),
	asyncHandler(changePassword)
);
router.delete("/me", authorization, asyncHandler(deleteUser));

module.exports = router;
