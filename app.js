const express = require("express");
const fs = require("fs");
const cors = require("cors");
const app = express();
const path = require("path");
require("dotenv").config();

const sequelize = require("./database/db");

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",");

app.use(
	cors({
		origin: function (origin, callback) {
			if (!origin || allowedOrigins.includes(origin)) {
				callback(null, true);
			} else {
				callback(new Error("Not allowed by CORS"));
			}
		},
		credentials: true,
	})
);

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const locationRoutes = require("./routes/location.routes");
const commentRoutes = require("./routes/comment.routes");

if (process.env.NODE_ENV === "reset") {
	const uploadsPath = path.join(__dirname, "uploads");
	fs.readdir(uploadsPath, (err, files) => {
		if (err) {
			console.error("Error reading uploads directory:", err);
			return;
		}
		files.forEach((file) => {
			if (file !== "404_error.png" && file !== "default_profile.jpg") {
				fs.unlink(path.join(uploadsPath, file), (err) => {
					if (err) {
						console.error("Error deleting file:", err);
					}
				});
			}
		});
	});
	sequelize.sync({ force: true }).then(() => {
		console.log("Database reset and synced successfully");
	});
}

app.get("/", (req, res) => {
	res.status(200).json({ message: "Welcome to the Geographia API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/comments", commentRoutes);

app.use((req, res) => {
	res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
	console.error("Error occurred:", err.message);
	console.error(err.stack);
	res.status(500).json({
		message: "Internal Server Error",
	});
});

module.exports = app;
