const Joi = require("joi");

const createCommentSchema = Joi.object({
	comment_text: Joi.string().min(1).max(500).required(),
	comment_address: Joi.string().max(500).required(),
});

module.exports = {
	createCommentSchema,
};
