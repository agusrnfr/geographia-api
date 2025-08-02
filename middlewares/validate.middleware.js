const validateRequest = (schema) => (req, res, next) => {
	if (!req.body) {
		return res.status(400).json({ error: "Request body is required" });
	}

	const { error } = schema.validate(req.body, { abortEarly: false });
	if (error) {
		const errors = error.details.map((d) => ({
			field: d.context.label || d.context.key,
			type: d.type,
		}));
		return res.status(400).json({ errors });
	}
	next();
};

module.exports = {
	validateRequest,
};
