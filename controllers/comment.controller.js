const { Comment } = require("../database/models");
const { Location } = require("../database/models");
const { User } = require("../database/models");

const addComment = async (req, res) => {
	const { comment_text, comment_address } = req.body;
	const { locationId } = req.params;

	const location = await Location.findByPk(locationId);

	if (!location) {
		return res.status(404).json({ error: "Location not found" });
	}

	const comment = await Comment.create({
		comment_text,
		comment_address,
		UserId: req.userId,
		LocationId: locationId,
	});

	res.status(201).json(comment);
};

const getCommentsByLocation = async (req, res) => {
	const { locationId } = req.params;

	const location = await Location.findByPk(locationId);

	if (!location) {
		return res.status(404).json({ error: "Location not found" });
	}

	const comments = await Comment.findAll({ where: { locationId } });

	if (!comments || comments.length === 0) {
		return res
			.status(200)
			.json({ message: "This location doesn't have any comments yet" });
	}

	const commentsWithUser = await Promise.all(
		comments.map(async (comment) => {
			const user = await User.findByPk(comment.UserId, {
				attributes: [
					"first_name",
					"last_name",
					"profile_image_url",
					"show_location",
				],
			});

			const commentData = comment.toJSON();

			if (!user.show_location) {
				commentData.comment_address = "Ubicación no compartida";
			}

			return {
				...commentData,
				user_first_name: user.first_name,
				user_last_name: user.last_name,
				user_profile_image_url: user.profile_image_url,
			};
		})
	);

	res.json(commentsWithUser);
};

module.exports = {
	addComment,
	getCommentsByLocation,
};
