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
const config = require("../config.json");

function loadTimetableJSON(speakers) {
  var dateTimeSettings = { hour: "2-digit", minute: "2-digit", hour12: false };

  var timetable = require("../timetable.json");
  var intervalInMs = timetable.timeInterval * 60 * 1000;

  // Add time intervals to be used in the webpage.
  var startTime = new Date(timetable.date + timetable.startTime);
  var endTime = new Date(timetable.date + timetable.endTime);
  var intervalAmount = Math.abs(endTime - startTime) / intervalInMs;
  var intervals = [];
  for (var i = 0; i <= intervalAmount; i++) {
    var date = new Date(startTime.getTime() + i * intervalInMs);
    date = date.toLocaleTimeString("en-GB", dateTimeSettings);
    intervals.push(date);
  }
  timetable.intervals = intervals;

  for (var track in timetable.tracks) {
    for (var talk in timetable.tracks[track].talks) {
      talk = timetable.tracks[track].talks[talk];
      // Add the length in multiple of 15 minutes. (30 min talk = 2)
      talk.startTime = new Date(timetable.date + talk.startTime);
      talk.endTime = new Date(timetable.date + talk.endTime);
      talk.startTimeDisplay = talk.startTime.toLocaleTimeString(
        "en-GB",
        dateTimeSettings
      );
      talk.endTimeDisplay = talk.endTime.toLocaleTimeString(
        "en-GB",
        dateTimeSettings
      );
      talk.length = Math.abs(talk.endTime - talk.startTime) / intervalInMs;
      if (talk.speakerId) {
        talk.speaker = speakers.speakers.find(
          (item) => item.id === talk.speakerId
        );
      }
    }
  }
  return timetable;
}

var timetable = loadTimetableJSON(speaker_info);

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
//   var s = speakerinfo.speakers.filter(function (speaker) {
//     return !speaker.hidden;
//   });
//   var p = speakerinfo.presenters.filter(function (presenter) {
//     return !presenter.hidden;
//   });
//   res.render("speakers/index", {
//     speakers: s,
//     presenters: p,
//     speakerids: speakerinfo.speakerids,
//     settings: {
//       tracks: speakerinfo.tracks,
//       showTrackNames: speakerinfo.showTrackNames,
//     },
//   });
// });

router.get("/timetable", adminAuth, function (req, res) {
  var enrollment_start_time = new Date(config.enroll_start_time);
  var enrollment_end_time = new Date(config.enroll_end_time);
  var today = new Date();
  var enrollment_possible =
    enrollment_start_time < today && today < enrollment_end_time;

  res.render("timetable", {
    timetable: timetable,
    enrollment_possible: enrollment_possible,
  });
});

module.exports = router;
