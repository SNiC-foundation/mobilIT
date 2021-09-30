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

const speaker_info = require("../speakers.json");
const timetable = require("../timetable.json");
const config = require("../config.json");

var router = express.Router();

router.get("/", function (req, res) {
  res.render("index", {
    title: "",
    ticketSaleStarts: config.ticketSaleStarts,
  });
});

router.get("//", function (req, res) {
  res.render("index", {
    title: "",
    ticketSaleStarts: config.ticketSaleStarts,
  });
});

// router.get("/speakers", function (req, res) {
//   var s = speaker_info.speakers.filter(function (speaker) {
//     return !speaker.hidden;
//   });
//   var p = speaker_info.presenters.filter(function (presenter) {
//     return !presenter.hidden;
//   });
//   res.render("speakers/index", {
//     speakers: s,
//     presenters: p,
//     speakerids: speaker_info.speakerids,
//     settings: {
//       tracks: speaker_info.tracks,
//     },
//   });
// });

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

module.exports = router;
