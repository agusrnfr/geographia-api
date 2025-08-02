const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Tag = sequelize.define("Tag", {
	name: { type: DataTypes.STRING, allowNull: false },
});

module.exports = Tag;
