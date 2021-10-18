var express = require("express");
var User = require("../models/User");
var TalkEnrollment = require("../models/TalkEnrollment");
const [auth, adminAuth] = require("./utils");

let speaker_info = require("../speakers.json");
let timetable = require("../timetable.json");
const config = require("../config.json");
let partners = require("../partners.json");

var router = express.Router();

router.get("/", async function (req, res) {
  const today = new Date();

  const ticket_sale_start_time = new Date(config.ticketSaleStarts);
  const ticket_sale_possible = ticket_sale_start_time < today;

  const event_start = new Date(config.eventStarts);
  const eventToday = event_start < today;

  const enrollment_start = new Date(config.talkEnrollmentStarts);
  const enrollment_possible = enrollment_start < today;

  let talk_capacity = {};
  for (const speaker in speaker_info.speakers) {
    if (speaker_info.speakers[speaker].limit !== undefined) {
      talk_capacity[speaker] = await TalkEnrollment.count({ talk: speaker });
    }
  }

  if (req.user) {
    const user = await User.findOne({ email: req.session.passport.user });

    let user_talk_enrollments = await TalkEnrollment.find({ user: user });
    user_talk_enrollments = user_talk_enrollments.map((obj) => obj.talk);

    res.render("index", {
      timetable: timetable,
      speakers: speaker_info,
      ticketSalePossible: ticket_sale_possible,
      enrollmentPossible: enrollment_possible,
      ticketSaleStart: ticket_sale_start_time,
      userHasBus: config.associations[user.association].bus,
      associations: config.associations,
      studyProgrammes: config.studyProgrammes,
      eventToday: eventToday,
      partners: partners,
      talkEnrollments: user_talk_enrollments,
      talkCapacity: talk_capacity,
    });
  } else {
    res.render("index", {
      timetable: timetable,
      speakers: speaker_info,
      ticketSalePossible: ticket_sale_possible,
      enrollmentPossible: enrollment_possible,
      ticketSaleStart: ticket_sale_start_time,
      userHasBus: undefined,
      associations: config.associations,
      studyProgrammes: config.studyProgrammes,
      eventToday: eventToday,
      partners: partners,
      talkEnrollments: [],
      talkCapacity: talk_capacity,
    });
  }
});

router.get("/timetable", function (req, res) {
  // var enrollment_start_time = new Date(config.enrollStartTime);
  // var enrollment_end_time = new Date(config.enrollEndTime);
  // var today = new Date();
  // var enrollment_possible =
  //   enrollment_start_time < today && today < enrollment_end_time;
  //
  // res.render("timetable", {
  //   timetable: timetable,
  //   speakers: speaker_info,
  //   enrollment_possible: enrollment_possible,
  // });
  res.redirect("/");
});

router.get("/reload/timetable", adminAuth, function (req, res) {
  delete require.cache[require.resolve("../speakers.json")];
  delete require.cache[require.resolve("../timetable.json")];

  speaker_info = require("../speakers.json");
  timetable = require("../timetable.json");

  res.redirect("/#timetable-modal");
});

module.exports = router;
