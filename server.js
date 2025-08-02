const app = require("./app");
const db = require("./database/db");

const PORT = process.env.PORT || 3000;

(async () => {
	try {
		await db.authenticate();
		console.log("DB connected");
		app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
	} catch (err) {
		console.error("Unable to connect to the database:", err);
	}
})();

process.on("SIGINT", async () => {
	console.log("Closing DB connection...");
	await db.close();
	console.log("DB connection closed. Exiting.");
	process.exit(0);
});
