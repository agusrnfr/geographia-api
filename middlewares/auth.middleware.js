const jwt = require("jsonwebtoken");

const authorization = (req, res, next) => {
	const authHeader = req.headers.authorization;
	if (!authHeader) return res.sendStatus(401);
	const token = authHeader.split(" ")[1];
	try {
		const payload = jwt.verify(token, process.env.JWT_SECRET);
		req.userId = payload.userId;
		next();
	} catch {
		res.sendStatus(403);
	}
};

module.exports = {
	authorization,
};
