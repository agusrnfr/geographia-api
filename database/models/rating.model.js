const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Rating = sequelize.define("Rating", {
	score: {
		type: DataTypes.INTEGER,
		allowNull: false,
		validate: {
			min: 1,
			max: 10,
		},
	},
});

module.exports = Rating;
