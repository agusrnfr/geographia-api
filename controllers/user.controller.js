const { User } = require("../database/models");
const { Comment } = require("../database/models");
const { Rating } = require("../database/models");
const { Location } = require("../database/models");
const bcrypt = require("bcrypt");
const defaultImage = "/uploads/default_profile.jpg";
const fs = require("fs");
const path = require("path");
const cloudinary = require("../services/cloudinary.service");
const { deleteLocationById } = require("./location.controller");

const deleteOldLocalImage = (imageUrl) => {
	if (imageUrl && imageUrl !== defaultImage) {
		const oldImagePath = path.join(__dirname, "..", imageUrl);
		fs.unlink(oldImagePath, (err) => {
			if (err) {
				console.error("Error deleting old image:", err.message);
			}
		});
	}
};

const deleteOldCloudinaryImage = async (publicId) => {
	if (!publicId) return;
	try {
		await cloudinary.uploader.destroy(publicId, { invalidate: true });
		console.log(`Deleted Cloudinary image: ${publicId}`);
	} catch (error) {
		console.error("Error deleting Cloudinary image:", error);
	}
};

const getMyProfile = async (req, res) => {
	const user = await User.findByPk(req.userId);

	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}

	const { password, ...userWithoutPassword } = user.toJSON();

	res.json(userWithoutPassword);
};

const getProfile = async (req, res) => {
	const user = await User.findByPk(req.params.id);

	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}

	const { password, ...userWithoutPassword } = user.toJSON();

	if (!userWithoutPassword.show_location) {
		userWithoutPassword.address = "Ubicación no compartida";
	}

	if (!userWithoutPassword.show_email) {
		delete userWithoutPassword.email;
	}
	if (!userWithoutPassword.show_birth_date) {
		delete userWithoutPassword.birth_date;
	}

	res.json(userWithoutPassword);
};

const updateProfile = async (req, res) => {
	const existingFields = ["first_name", "last_name", "email", "birth_date"];

	const updateFields = {};

	const user = await User.findByPk(req.userId);

	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}

	for (const field of existingFields) {
		if (req.body[field] !== undefined) {
			updateFields[field] = req.body[field];
		}
	}

	if (req.body.email) {
		const existingUser = await User.findOne({
			where: { email: req.body.email },
		});
		if (existingUser && existingUser.id !== req.userId) {
			return res.status(400).json({ error: "Email already in use" });
		}
	}

	if (req.file) {
		if (process.env.NODE_ENV === "production") {
			if (user.profile_image_public_id) {
				await deleteOldCloudinaryImage(user.profile_image_public_id);
			}
			const streamUpload = (reqFile) => {
				return new Promise((resolve, reject) => {
					const stream = cloudinary.uploader.upload_stream(
						{ folder: "geographia" },
						(error, result) => {
							if (result) {
								resolve(result);
							} else {
								reject(error);
							}
						}
					);
					stream.end(reqFile.buffer);
				});
			};

			try {
				const result = await streamUpload(req.file);
				updateFields.profile_image_url = result.secure_url;
				updateFields.profile_image_public_id = result.public_id;
			} catch (error) {
				return res
					.status(500)
					.json({ error: "Error uploading image to Cloudinary" });
			}
		} else {
			deleteOldLocalImage(user.profile_image_url);
			updateFields.profile_image_url = `/uploads/${req.file.filename}`;
			updateFields.profile_image_public_id = null;
		}
	} else if (req.body.remove_profile_image) {
		if (process.env.NODE_ENV === "production" && user.profile_image_public_id) {
			await deleteOldCloudinaryImage(user.profile_image_public_id);
		} else {
			deleteOldLocalImage(user.profile_image_url);
		}
		updateFields.profile_image_url = defaultImage;
		updateFields.profile_image_public_id = null;
	}

	await User.update(updateFields, { where: { id: req.userId } });

	let responseImageUrl = updateFields.profile_image_url;
	if (
		process.env.NODE_ENV !== "production" &&
		responseImageUrl &&
		!responseImageUrl.startsWith("http")
	) {
		responseImageUrl = `${req.protocol}://${req.get(
			"host"
		)}${responseImageUrl}`;
	}

	res.status(200).json({
		message: "Profile updated successfully",
		updatedFields: {
			...updateFields,
			profile_image_url: responseImageUrl,
		},
	});
};

const updatePrivacy = async (req, res) => {
	const existingFields = ["show_email", "show_birth_date", "show_location"];

	const updateFields = {};

	for (const field of existingFields) {
		if (req.body[field] !== undefined) {
			updateFields[field] = req.body[field];
		}
	}

	const user = await User.update(updateFields, { where: { id: req.userId } });

	if (!user[0]) {
		return res.status(404).json({ error: "User not found" });
	}
	res.status(200).json({
		message: "Privacy settings updated successfully",
		privacy: updateFields,
	});
};

const updateLocation = async (req, res) => {
	const { address } = req.body;

	const user = await User.update({ address }, { where: { id: req.userId } });

	if (!user[0]) {
		return res.status(404).json({ error: "User not found" });
	}

	res.status(200).json({
		message: "Address updated successfully",
		address: {
			...address,
		},
	});
};

const changePassword = async (req, res) => {
	const { actual_password, new_password } = req.body;
	const hashed = await bcrypt.hash(new_password, 10);

	const user = await User.findByPk(req.userId);

	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}

	if (!(await bcrypt.compare(actual_password, user.password))) {
		return res.status(400).json({ error: "Actual password is incorrect" });
	}

	if (await bcrypt.compare(new_password, user.password)) {
		return res
			.status(400)
			.json({ error: "New password cannot be the same as the old one" });
	}

	await user.update({ password: hashed });

	res.status(200).json({
		message: "Password changed successfully",
	});
};

const deleteUser = async (req, res) => {
	const user = await User.findByPk(req.userId);

	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}

	if (process.env.NODE_ENV === "production" && user.profile_image_public_id) {
		await deleteOldCloudinaryImage(user.profile_image_public_id);
	} else {
		deleteOldLocalImage(user.profile_image_url);
	}

	await Comment.destroy({ where: { UserId: req.userId } });
	await Rating.destroy({ where: { UserId: req.userId } });

	const locations = await Location.findAll({ where: { UserId: req.userId } });

	for (const location of locations) {
		try {
			await deleteLocationById(location.id, req.userId);
		} catch (err) {
			console.error(`Error deleting location ${location.id}: ${err.message}`);
		}
	}

	await user.destroy();

	res.sendStatus(204);
};

module.exports = {
	getProfile,
	getMyProfile,
	updateProfile,
	updatePrivacy,
	updateLocation,
	changePassword,
	deleteUser,
};
