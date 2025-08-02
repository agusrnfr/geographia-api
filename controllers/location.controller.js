const Sequelize = require("sequelize");

const { Location } = require("../database/models");
const { Rating } = require("../database/models");
const { Tag } = require("../database/models");
const { User } = require("../database/models");
const { Comment } = require("../database/models");
const path = require("path");
const fs = require("fs");

const { Op } = require("sequelize");
const { console } = require("inspector");

const turf = require("@turf/turf");

const cloudinary = require("../services/cloudinary.service");
const streamifier = require("streamifier");

const argentinaMaskPath = path.join(
	__dirname,
	"../utils/argentina-mask.geojson"
);
const argentinaMask = JSON.parse(fs.readFileSync(argentinaMaskPath, "utf8"));

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (degrees) => degrees * (Math.PI / 180);

const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
	const dLat = toRadians(lat2 - lat1);
	const dLon = toRadians(lon2 - lon1);
	const rLat1 = toRadians(lat1);
	const rLat2 = toRadians(lat2);

	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return EARTH_RADIUS_METERS * c;
};

const isLocationNearby = async (
	latitude,
	longitude,
	radius = 10,
	locationIdToIgnore = null
) => {
	const nearbyLocations = await Location.findAll({
		where: {
			latitude: {
				[Op.between]: [latitude - 0.0001, latitude + 0.0001],
			},
			longitude: {
				[Op.between]: [longitude - 0.0001, longitude + 0.0001],
			},
		},
	});

	for (const loc of nearbyLocations) {
		if (locationIdToIgnore && loc.id === locationIdToIgnore) {
			continue;
		}
		const dist = getDistanceInMeters(
			latitude,
			longitude,
			loc.latitude,
			loc.longitude
		);
		if (dist <= radius) {
			return true;
		}
	}
	return false;
};

const isPointInArgentina = (lat, lng) => {
	const point = turf.point([lng, lat]);
	return argentinaMask.features.some((feature) =>
		turf.booleanPointInPolygon(point, feature)
	);
};

const uploadToCloudinary = (fileBuffer) => {
	return new Promise((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(
			{ folder: "geographia" },
			(error, result) => {
				if (result) resolve(result);
				else reject(error);
			}
		);
		streamifier.createReadStream(fileBuffer).pipe(stream);
	});
};

const deleteOldImages = async (imagesUrls, imagesPublicIds) => {
	if (process.env.NODE_ENV === "production") {
		if (imagesPublicIds && imagesPublicIds.length > 0) {
			for (const publicId of imagesPublicIds) {
				try {
					await cloudinary.uploader.destroy(publicId, { invalidate: true });
					console.log(`Deleted Cloudinary image: ${publicId}`);
				} catch (error) {
					console.error("Error deleting Cloudinary image:", error);
				}
			}
		}
	} else {
		if (!imagesUrls || imagesUrls.length === 0) return;
		imagesUrls.forEach((imageUrl) => {
			const oldImagePath = path.join(__dirname, "..", imageUrl);
			fs.unlink(oldImagePath, (err) => {
				if (err) {
					console.error("Error deleting old image:", err.message);
				}
			});
		});
	}
};

const deleteLocationById = async (locationId, userId) => {
	const location = await Location.findByPk(locationId);
	if (!location) {
		throw { status: 404, message: "Location not found" };
	}

	if (location.UserId !== userId) {
		throw {
			status: 403,
			message: "You do not have permission to delete this location",
		};
	}

	await deleteOldImages(location.images, location.images_public_ids);

	await Comment.destroy({ where: { locationId: location.id } });
	await Rating.destroy({ where: { locationId: location.id } });

	await location.setTags([]);
	await location.destroy();
};

const createLocation = async (req, res) => {
	let tags = [];
	let images = [];
	let imagesPublicIds = [];
	const { name, address, latitude, longitude, details, type } = req.body;
	tags = req.body.tags ? JSON.parse(req.body.tags) : [];

	const user = await User.findByPk(req.userId);

	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}

	if (!isPointInArgentina(latitude, longitude)) {
		return res.status(400).json({ error: "Location is outside Argentina" });
	}

	const exists = await isLocationNearby(latitude, longitude);

	if (exists) {
		return res.status(409).json({ error: "Location already exists" });
	}

	if (req.files && req.files.length > 0) {
		if (process.env.NODE_ENV === "production") {
			for (const file of req.files) {
				try {
					const result = await uploadToCloudinary(file.buffer);
					images.push(result.secure_url);
					imagesPublicIds.push(result.public_id);
				} catch (error) {
					return res
						.status(500)
						.json({ error: "Error uploading image to Cloudinary" });
				}
			}
		} else {
			images = req.files.map((file) => `/uploads/${file.filename}`);
		}
	} else {
		return res.status(400).json({ error: "No images provided" });
	}

	const location = await Location.create({
		UserId: req.userId,
		name,
		address,
		latitude,
		longitude,
		details,
		type,
		images,
		images_public_ids: imagesPublicIds.length ? imagesPublicIds : [],
	});

	if (tags && tags.length > 0) {
		const tagInstances = await Promise.all(
			tags.map(async (tagName) => {
				const [tag] = await Tag.findOrCreate({
					where: { name: tagName },
				});
				return tag;
			})
		);

		await location.addTags(tagInstances);
	}

	let imagesURL = images;
	if (process.env.NODE_ENV !== "production") {
		imagesURL = images.map(
			(img) => `${req.protocol}://${req.get("host")}${img}`
		);
	}
	res.status(201).json({
		message: "Location created successfully",
		location: {
			id: location.id,
			name: location.name,
			address: location.address,
			latitude: location.latitude,
			longitude: location.longitude,
			details: location.details,
			tags: tags ? tags : [],
			type: location.type,
			images: imagesURL,
		},
	});
};

const updateLocation = async (req, res) => {
	const existingFields = [
		"name",
		"address",
		"latitude",
		"longitude",
		"images",
		"details",
		"tags",
		"type",
	];

	const updateFields = {};

	for (const field of existingFields) {
		if (req.body[field] !== undefined) {
			updateFields[field] = req.body[field];
		}
	}

	const user = await User.findByPk(req.userId);
	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}

	const location = await Location.findByPk(req.params.id);

	if (!location) {
		return res.status(404).json({ error: "Location not found" });
	}

	if (location.UserId !== req.userId) {
		return res.status(403).json({
			error: "You do not have permission to update this location",
		});
	}

	if (
		(req.body.latitude || req.body.longitude) &&
		(!updateFields.latitude || !updateFields.longitude)
	) {
		return res
			.status(400)
			.json({ error: "Both latitude and longitude must be provided" });
	}

	if (req.body.latitude || req.body.longitude) {
		if (!isPointInArgentina(latitude, longitude)) {
			return res.status(400).json({ error: "Location is outside Argentina" });
		}

		const exists = await isLocationNearby(
			updateFields.latitude,
			updateFields.longitude,
			10,
			location.id
		);
		if (exists) {
			return res.status(409).json({ error: "Location already exists" });
		}
	}

	if (req.files && req.files.length > 0) {
		await deleteOldImages(location.images, location.images_public_ids);

		let images = [];
		let imagesPublicIds = [];

		if (process.env.NODE_ENV === "production") {
			for (const file of req.files) {
				try {
					const result = await uploadToCloudinary(file.buffer);
					images.push(result.secure_url);
					imagesPublicIds.push(result.public_id);
				} catch (error) {
					return res
						.status(500)
						.json({ error: "Error uploading image to Cloudinary" });
				}
			}
		} else {
			images = req.files.map((file) => `/uploads/${file.filename}`);
		}

		updateFields.images = images;
		updateFields.images_public_ids = imagesPublicIds.length
			? imagesPublicIds
			: null;
	}

	await location.update(updateFields);

	if (updateFields.tags) {
		const tagInstances = await Promise.all(
			updateFields.tags.map(async (tagName) => {
				const [tag] = await Tag.findOrCreate({
					where: { name: tagName },
				});
				return tag;
			})
		);

		await location.setTags(tagInstances);
	}

	let imagesURL = updateFields.images;
	if (process.env.NODE_ENV !== "production" && imagesURL) {
		imagesURL = imagesURL.map(
			(img) => `${req.protocol}://${req.get("host")}${img}`
		);
	}

	res.status(200).json({
		message: "Location updated successfully",
		location: {
			...updateFields,
			images: imagesURL,
		},
	});
};

const getAllLocations = async (req, res) => {
	const locations = await Location.findAll({
		attributes: {
			include: [
				[
					Sequelize.fn(
						"COALESCE",
						Sequelize.fn("AVG", Sequelize.col("Ratings.score")),
						0
					),
					"averageRating",
				],
			],
		},
		include: [
			{
				model: Rating,
				attributes: [],
			},
			{
				model: Tag,
				attributes: ["name"],
				through: { attributes: [] },
			},
		],
		group: [
			"Location.id",
			"Tags.id",
			"Tags->location_tags.LocationId",
			"Tags->location_tags.TagId",
		],
	});
	const formattedLocations = locations.map((loc) => {
		const locJSON = loc.toJSON();

		return {
			...locJSON,
			tags: locJSON.Tags.map((tag) => tag.name),
			Tags: undefined,
		};
	});

	res.status(200).json(formattedLocations);
};

const getRuralLocations = async (req, res) => {
	const ruralLocations = await Location.findAll({
		where: { type: "Rural" },
		attributes: {
			include: [
				[
					Sequelize.fn(
						"COALESCE",
						Sequelize.fn("AVG", Sequelize.col("Ratings.score")),
						0
					),
					"averageRating",
				],
			],
		},
		include: [
			{
				model: Rating,
				attributes: [],
			},
			{
				model: Tag,
				attributes: ["name"],
				through: { attributes: [] },
			},
		],
		group: [
			"Location.id",
			"Tags.id",
			"Tags->location_tags.LocationId",
			"Tags->location_tags.TagId",
		],
	});
	const formattedLocations = ruralLocations.map((loc) => {
		const locJSON = loc.toJSON();

		return {
			...locJSON,
			tags: locJSON.Tags.map((tag) => tag.name),
			Tags: undefined,
		};
	});

	res.status(200).json(formattedLocations);
};

const getGeographicLocations = async (req, res) => {
	const geographicLocations = await Location.findAll({
		where: { type: "Geográfica" },
		attributes: {
			include: [
				[
					Sequelize.fn(
						"COALESCE",
						Sequelize.fn("AVG", Sequelize.col("Ratings.score")),
						0
					),
					"averageRating",
				],
			],
		},
		include: [
			{
				model: Rating,
				attributes: [],
			},
			{
				model: Tag,
				attributes: ["name"],
				through: { attributes: [] },
			},
		],
		group: [
			"Location.id",
			"Tags.id",
			"Tags->location_tags.LocationId",
			"Tags->location_tags.TagId",
		],
	});
	const formattedLocations = geographicLocations.map((loc) => {
		const locJSON = loc.toJSON();

		return {
			...locJSON,
			tags: locJSON.Tags.map((tag) => tag.name),
			Tags: undefined,
		};
	});

	res.status(200).json(formattedLocations);
};

const getHistoricalLocations = async (req, res) => {
	const historicalLocations = await Location.findAll({
		where: { type: "Histórica" },
		attributes: {
			include: [
				[
					Sequelize.fn(
						"COALESCE",
						Sequelize.fn("AVG", Sequelize.col("Ratings.score")),
						0
					),
					"averageRating",
				],
			],
		},
		include: [
			{
				model: Rating,
				attributes: [],
			},
			{
				model: Tag,
				attributes: ["name"],
				through: { attributes: [] },
			},
		],
		group: [
			"Location.id",
			"Tags.id",
			"Tags->location_tags.LocationId",
			"Tags->location_tags.TagId",
		],
	});
	const formattedLocations = historicalLocations.map((loc) => {
		const locJSON = loc.toJSON();

		return {
			...locJSON,
			tags: locJSON.Tags.map((tag) => tag.name),
			Tags: undefined,
		};
	});

	res.status(200).json(formattedLocations);
};

const getMyLocations = async (req, res) => {
	const user = await User.findByPk(req.userId);

	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}

	const locations = await Location.findAll({
		attributes: {
			include: [
				[
					Sequelize.fn(
						"COALESCE",
						Sequelize.fn("AVG", Sequelize.col("Ratings.score")),
						0
					),
					"averageRating",
				],
			],
		},
		include: [
			{
				model: Rating,
				attributes: [],
			},
			{
				model: Tag,
				attributes: ["name"],
				through: { attributes: [] },
			},
		],
		group: [
			"Location.id",
			"Tags.id",
			"Tags->location_tags.LocationId",
			"Tags->location_tags.TagId",
		],
		where: { UserId: req.userId },
	});

	const formattedLocations = locations.map((loc) => {
		const locJSON = loc.toJSON();

		return {
			...locJSON,
			tags: locJSON.Tags.map((tag) => tag.name),
			Tags: undefined,
		};
	});

	res.status(200).json(formattedLocations);
};

const getLocationById = async (req, res) => {
	const location = await Location.findByPk(req.params.id, {
		attributes: {
			include: [
				[
					Sequelize.fn(
						"COALESCE",
						Sequelize.fn("AVG", Sequelize.col("Ratings.score")),
						0
					),
					"averageRating",
				],
			],
		},
		include: [
			{
				model: Rating,
				attributes: [],
			},
			{
				model: Tag,
				attributes: ["name"],
				through: { attributes: [] },
			},
		],
		group: [
			"Location.id",
			"Tags.id",
			"Tags->location_tags.LocationId",
			"Tags->location_tags.TagId",
		],
	});
	if (!location) {
		return res.status(404).json({ error: "Location not found" });
	}
	const formattedLocation = {
		...location.toJSON(),
		tags: location.Tags.map((tag) => tag.name),
		Tags: undefined,
	};

	res.json(formattedLocation);
};

const deleteLocation = async (req, res) => {
	await deleteLocationById(req.params.id, req.userId);
	res.status(204).send();
};

const addRating = async (req, res) => {
	const { score } = req.body;
	const location = await Location.findByPk(req.params.id);

	const user = await User.findByPk(req.userId);
	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}

	if (!location) {
		return res.status(404).json({ error: "Location not found" });
	}

	const existingRating = await Rating.findOne({
		where: {
			UserId: req.userId,
			LocationId: location.id,
		},
	});

	if (existingRating) {
		return res
			.status(400)
			.json({ error: "You have already rated this location" });
	}

	const ratingData = await Rating.create({
		UserId: req.userId,
		LocationId: location.id,
		score: score,
	});

	res.status(201).json(ratingData);
};

const updateRating = async (req, res) => {
	const { score } = req.body;
	const location = await Location.findByPk(req.params.id);

	const user = await User.findByPk(req.userId);

	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}

	if (!location) {
		return res.status(404).json({ error: "Location not found" });
	}

	const existingRating = await Rating.findOne({
		where: {
			UserId: req.userId,
			LocationId: location.id,
		},
	});

	if (!existingRating) {
		return res
			.status(404)
			.json({ error: "You have not rated this location yet" });
	}

	await existingRating.update({ score: score });

	res.status(200).json({
		message: "Rating updated successfully",
		score: existingRating,
	});
};

const searchLocations = async (req, res) => {
	const query = req.query.q;

	if (!query || query.trim() === "") {
		return res.status(400).json({ error: "Query parameter is required" });
	}

	const locations = await Location.findAll({
		where: {
			[Op.or]: [
				{ address: { [Op.like]: `%${query}%` } },
				{ name: { [Op.like]: `%${query}%` } },
			],
		},
		attributes: {
			include: [
				[
					Sequelize.fn(
						"COALESCE",
						Sequelize.fn("AVG", Sequelize.col("Ratings.score")),
						0
					),
					"averageRating",
				],
			],
		},
		include: [
			{
				model: Rating,
				attributes: [],
			},
			{
				model: Tag,
				attributes: ["name"],
				through: { attributes: [] },
			},
		],
		group: [
			"Location.id",
			"Tags.id",
			"Tags->location_tags.LocationId",
			"Tags->location_tags.TagId",
		],
	});

	const formattedLocations = locations.map((loc) => {
		const locJSON = loc.toJSON();

		return {
			...locJSON,
			tags: locJSON.Tags.map((tag) => tag.name),
			Tags: undefined,
		};
	});

	res.status(200).json(formattedLocations);
};

const getMyRating = async (req, res) => {
	const location = await Location.findByPk(req.params.id);
	if (!location) {
		return res.status(404).json({ error: "Location not found" });
	}
	const rating = await Rating.findOne({
		where: {
			UserId: req.userId,
			LocationId: location.id,
		},
	});

	if (!rating) {
		return res.status(404).json({ error: "Rating not found" });
	}

	res.status(200).json(rating);
};

module.exports = {
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
	searchLocations,
	deleteLocationById,
	getMyRating,
};
