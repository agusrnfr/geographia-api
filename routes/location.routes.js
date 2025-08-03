const express = require("express");
const router = express.Router();
const { authorization } = require("../middlewares/auth.middleware");
const {
	createLocation,
	updateLocation,
	getAllLocations,
	getRuralLocations,
	getGeographicLocations,
	getHistoricalLocations,
	getLocationById,
	getMyLocations,
	deleteLocation,
	addRating,
	updateRating,
	getMyRating,
	searchLocations,
} = require("../controllers/location.controller");

const { asyncHandler } = require("../middlewares/handler.middleware");
const {
	createLocationSchema,
	updateLocationSchema,
	ratingSchema,
} = require("../validators/location.validator");
const { validateRequest } = require("../middlewares/validate.middleware");

const upload = require("../middlewares/upload.middleware");

router.post(
	"/create",
	authorization,
	upload.array("images", 5),
	validateRequest(createLocationSchema),
	asyncHandler(createLocation)
);
router.put(
	"/location/:id",
	authorization,
	upload.array("images", 5),
	validateRequest(updateLocationSchema),
	asyncHandler(updateLocation)
);
router.get("/location/:id", asyncHandler(getLocationById));
router.delete("/location/:id", authorization, asyncHandler(deleteLocation));
router.get("/all", asyncHandler(getAllLocations));
router.get("/me", authorization, asyncHandler(getMyLocations));
router.post(
	"/location/:id/rate",
	authorization,
	validateRequest(ratingSchema),
	asyncHandler(addRating)
);
router.put(
	"/location/:id/rate",
	authorization,
	validateRequest(ratingSchema),
	asyncHandler(updateRating)
);
router.get("/location/:id/rate", authorization, asyncHandler(getMyRating));
router.get("/rural/", asyncHandler(getRuralLocations));
router.get("/geographic/", asyncHandler(getGeographicLocations));
router.get("/historical/", asyncHandler(getHistoricalLocations));
router.get("/search", asyncHandler(searchLocations));
module.exports = router;
