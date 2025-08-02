const User = require("./user.model");
const Location = require("./location.model");
const Comment = require("./comment.model");
const Tag = require("./tag.model");
const Rating = require("./rating.model");

User.hasMany(Location);
Location.belongsTo(User);

User.hasMany(Comment);
Comment.belongsTo(User);

User.hasMany(Rating);
Rating.belongsTo(User);

Location.hasMany(Comment);
Comment.belongsTo(Location);

Location.hasMany(Rating);
Rating.belongsTo(Location);

Location.belongsToMany(Tag, { through: "location_tags" });
Tag.belongsToMany(Location, { through: "location_tags" });

module.exports = { User, Location, Comment, Tag, Rating };
