const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Comment = sequelize.define("Comment", {
	comment_text: { type: DataTypes.TEXT, allowNull: false },
	comment_address: { type: DataTypes.TEXT, allowNull: false },
});

module.exports = Comment;
