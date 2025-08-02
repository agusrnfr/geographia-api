const express = require("express");
const router = express.Router();
const {
	register,
	login,
	requestPasswordReset,
	verifyCode,
	resetPassword,
} = require("../controllers/auth.controller");
const { registerSchema, loginSchema } = require("../validators/user.validator");
const { validateRequest } = require("../middlewares/validate.middleware");
const { asyncHandler } = require("../middlewares/handler.middleware");

router.post(
	"/register",
	validateRequest(registerSchema),
	asyncHandler(register)
);
router.post("/login", validateRequest(loginSchema), asyncHandler(login));

router.post("/request-password-reset", asyncHandler(requestPasswordReset));
router.post("/verify-code", asyncHandler(verifyCode));
router.post("/reset-password", asyncHandler(resetPassword));

module.exports = router;
