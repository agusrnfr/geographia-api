const Joi = require("joi");

const nameRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;

const createLocationSchema = Joi.object({
	name: Joi.string().pattern(nameRegex).required(),
	address: Joi.string().max(255).required(),
	latitude: Joi.number().min(-90).max(90).required(),
	longitude: Joi.number().min(-180).max(180).required(),
	details: Joi.string().max(1000).optional(),
	tags: Joi.string().optional(),
	type: Joi.string().valid("RURAL", "GEOGRÁFICA", "HISTÓRICA").required(),
});

const updateLocationSchema = Joi.object({
	name: Joi.string().pattern(nameRegex).optional(),
	address: Joi.string().max(255).optional(),
	latitude: Joi.number().min(-90).max(90).optional(),
	longitude: Joi.number().min(-180).max(180).optional(),
	details: Joi.string().max(1000).optional(),
	tags: Joi.string().optional(),
	type: Joi.string().valid("RURAL", "GEOGRÁFICA", "HISTÓRICA").optional(),
}).min(1);

const ratingSchema = Joi.object({
	score: Joi.number().min(1).max(10).required(),
});

module.exports = {
	createLocationSchema,
	updateLocationSchema,
	ratingSchema,
};
