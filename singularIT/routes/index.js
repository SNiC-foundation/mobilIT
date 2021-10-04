var express = require("express");
var bwipjs = require("bwip-js");
var Ticket = require("../models/Ticket");
var User = require("../models/User");
var TalkEnrollment = require("../models/TalkEnrollment");
var ScannerUser = require("../models/ScannerUser");
var ScannerResult = require("../models/ScannerResult");
var SpeedDateTimeSlot = require("../models/SpeedDateTimeSlot");
var _ = require("underscore");
var async = require("async");
const CSV = require("csv-string");
var moment = require("moment");
var fs = require("fs");
const [auth, adminAuth] = require("./utils");

let speaker_info = require("../speakers.json");
let timetable = require("../timetable.json");
const config = require("../config.json");

var router = express.Router();

router.get("/", async function (req, res) {
  var enrollment_start_time = new Date(config.enrollStartTime);
  var enrollment_end_time = new Date(config.enrollEndTime);
  var today = new Date();
  var enrollment_possible =
    enrollment_start_time < today && today < enrollment_end_time;

  if (req.user) {
    const user = await User.findOne({ email: req.session.passport.user });

    res.render("index", {
      logged_in: true,
      timetable: timetable,
      speakers: speaker_info,
      enrollment_possible: enrollment_possible,
      ticketSaleStarts: config.ticketSaleStarts,
      userHasBus: config.associations[user.association].bus,
      associations: config.associations,
      studyProgrammes: config.studyProgrammes,
    });
  }

  res.render("index", {
    logged_out: false,
    timetable: timetable,
    speakers: speaker_info,
    enrollment_possible: enrollment_possible,
    ticketSaleStarts: config.ticketSaleStarts,
    userHasBus: false,
    associations: config.associations,
    studyProgrammes: config.studyProgrammes,
  });
});

router.get("/timetable", function (req, res) {
  var enrollment_start_time = new Date(config.enrollStartTime);
  var enrollment_end_time = new Date(config.enrollEndTime);
  var today = new Date();
  var enrollment_possible =
    enrollment_start_time < today && today < enrollment_end_time;

  res.render("timetable", {
    timetable: timetable,
    speakers: speaker_info,
    enrollment_possible: enrollment_possible,
  });
});

router.get("/reload/timetable", adminAuth, function (req, res) {
  delete require.cache[require.resolve("../speakers.json")];
  delete require.cache[require.resolve("../timetable.json")];

  speaker_info = require("../speakers.json");
  timetable = require("../timetable.json");

  res.redirect("/");
});

module.exports = router;
