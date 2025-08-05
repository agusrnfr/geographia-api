const { User } = require("../database/models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../services/email.service");

const register = async (req, res) => {
	const { first_name, last_name, email, birth_date, password, address } =
		req.body;
	const hashedPassword = await bcrypt.hash(password, 10);

	const existingUser = await User.findOne({ where: { email } });
	if (existingUser) {
		return res.status(400).json({ error: "User already exists" });
	}

	const user = await User.create({
		first_name,
		last_name,
		email,
		birth_date,
		address,
		password: hashedPassword,
		profile_image_url: "/uploads/default_profile.jpg",
	});

	res.status(201).json({
		message: "User registered successfully",
		user: {
			id: user.id,
			first_name: user.first_name,
			last_name: user.last_name,
			email: user.email,
			birth_date: user.birth_date,
		},
	});
};

const login = async (req, res) => {
	const { email, password } = req.body;
	const user = await User.findOne({ where: { email } });

	if (!user) {
		return res.status(401).json({ error: "Invalid credentials" });
	}

	if (!(await bcrypt.compare(password, user.password)))
		return res.status(401).json({ error: "Invalid credentials" });
	const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRATION || "1h",
	});
	res.json({ token });
};

const requestPasswordReset = async (req, res) => {
	const { email } = req.body;
	const user = await User.findOne({ where: { email } });
	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}

	const code = Math.floor(1000 + Math.random() * 9000).toString();

	const token = jwt.sign(
		{
			email,
			code,
		},
		process.env.JWT_SECRET,
		{ expiresIn: "10m" }
	);

	sendEmail(email, code);

	res.status(200).json({
		message: "Password reset requested. Check your email for the code.",
		token,
	});
};

const verifyCode = async (req, res) => {
	const { token, code } = req.body;
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		if (decoded.code !== code) {
			return res.status(400).json({ message: "Código incorrecto" });
		}
		return res.json({ message: "Código verificado" });
	} catch (err) {
		return res.status(401).json({ message: "Token expirado o inválido" });
	}
};

const resetPassword = async (req, res) => {
	const { token, newPassword } = req.body;
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const user = await User.findOne({ where: { email: decoded.email } });

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		if (await bcrypt.compare(newPassword, user.password)) {
			return res.status(400).json({
				error: "New password cannot be the same as the old one",
			});
		}

		const hashed = await bcrypt.hash(newPassword, 10);
		await user.update({ password: hashed });
		res.status(200).json({ message: "Password reset successfully" });
	} catch (err) {
		res.status(401).json({ message: "Token expired or invalid" });
	}
};

module.exports = {
	register,
	login,
	requestPasswordReset,
	verifyCode,
	resetPassword,
};
