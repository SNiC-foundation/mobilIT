var mongoose = require("mongoose");
var Schema = mongoose.Schema;
var plm = require("passport-local-mongoose");

var User = new mongoose.Schema({
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  firstname: { type: String, required: true },
  surname: { type: String, required: true },
  shareEmail: Boolean,
  linkedin: { type: String, default: "" },
  phonenumber: { type: String, default: "" },
  association: { type: String, required: true },
  bus: { type: Boolean, default: true },
  vegetarian: { type: Boolean, required: true },
  specialNeeds: { type: String },
  ticket: { type: String, ref: "Ticket" },
  present: { type: Boolean, default: false },
  admin: { type: Boolean, default: false },
  type: { type: String, default: "student" },
  company: { type: String },
  connectlist: [String],
  matchingterms: [String],
  studyProgramme: { type: String, required: false },
  companyName: { type: String, required: false },
  allowBadgeScanning: { type: Boolean, default: false },
  share: { type: Boolean, default: false },
  speedDateTimeSlot: { type: String, ref: "SpeedDateTimeSlot" },
  favorites: { type: [Number], required: false },
});

User.plugin(plm, {
  usernameField: "email",
  usernameLowerCase: true,
  incorrectPasswordError: "Incorrect password given",
  incorrectUsernameError: "This email address is not known to us: ",
  missingUsernameError: "No email given",
  missingPasswordError: "No password given",
  userExistsError: "The following email address is already in use: ",
});

module.exports = mongoose.model("User", User);
