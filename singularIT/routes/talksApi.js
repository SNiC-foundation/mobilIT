const User = require("../models/User");
const TalkEnrollment = require("../models/TalkEnrollment");
const [auth, adminAuth] = require("./utils");
const express = require("express");

let speaker_info = require("../speakers.json");
let timetable = require("../timetable.json");
const config = require("../config.json");

let router = express.Router();

let talks_table = timetable.map(function (slot) {
  let talks = [];
  for (const event of slot.events) {
    if (event.speakerId) {
      talks.push(event.speakerId);
    }
  }
  return talks;
});

router.get("/api/talk/count/", async function (req, res) {
  let talk_capacity = {};
  for (const speaker in speaker_info.speakers) {
    if (speaker_info.speakers[speaker].limit !== undefined) {
      talk_capacity[speaker] = {
        count: await TalkEnrollment.count({ talk: speaker }),
        limit: speaker_info.speakers[speaker].limit,
      };
    }
  }
  res.json({ success: true, content: talk_capacity });
});

router.get("/api/talk/enrolled", auth, async function (req, res) {
  User.findOne({ email: req.session.passport.user }).exec(async function (
    err,
    user
  ) {
    if (err) {
      res.json({ success: false, error: "Could not find user" });
    } else {
      let user_talk_enrollments = await TalkEnrollment.find({ user: user });
      res.json({
        success: true,
        content: user_talk_enrollments.map((obj) => obj.talk),
      });
    }
  });
});

router.post("/api/talk/enroll/:talk", auth, async function (req, res) {
  User.findOne({ email: req.session.passport.user }).exec(async function (
    err,
    user
  ) {
    if (err) {
      res.json({ success: false, error: "Could not find user" });
    } else {
      const today = new Date();
      const enrollment_start = new Date(config.talkEnrollmentStarts);
      if (enrollment_start < today) {
        res.json({
          success: false,
          error: "Talk enrollment is not yet possible",
        });
      } else {
        // Check if talk is full
        // Possible race condition but it doesn't matter that much
        const count = await TalkEnrollment.count({ talk: req.params.talk });
        if (count >= speaker_info.speakers[req.params.talk].limit) {
          res.json({ success: false, error: "Talk is already full" });
        } else {
          const enrolled_talks = await TalkEnrollment.find({ user: user });
          if (
            talks_table
              .find((el) => el.includes(req.params.talk))
              .some((el) => enrolled_talks.map((t) => t.talk).includes(el))
          ) {
            res.json({
              success: false,
              error:
                "You can only enroll for one session during this time slot",
            });
          } else {
            let newTalkEnrollment = new TalkEnrollment({
              user: user,
              talk: req.params.talk,
            });
            await newTalkEnrollment.save(function (err) {
              if (err) {
                res.json({
                  success: false,
                  error: "You are already enrolled for this talk",
                });
              } else {
                res.json({ success: true });
              }
            });
          }
        }
      }
    }
  });
});

router.post("/api/talk/unenroll/:id", auth, async function (req, res) {
  User.findOne({ email: req.session.passport.user }).exec(async function (
    err,
    user
  ) {
    if (err) {
      res.json({ success: false });
    } else {
      TalkEnrollment.deleteOne(
        { user: user, talk: req.params.id },
        function (err) {
          if (err) {
            res.json({ success: false });
          } else {
            res.json({ success: true });
          }
        }
      );
    }
  });
});

router.get("/api/enrolled/:id", auth, async function (req, res) {
  User.findOne({ email: req.session.passport.user }).exec(async function (
    err,
    user
  ) {
    if (err) {
      res.json({ success: false });
    } else {
      TalkEnrollment.findOne(
        { user: user, talk: req.params.id },
        function (err, result) {
          if (err) {
            res.json({ success: false });
          } else {
            var enrolled = true;
            if (!result) {
              enrolled = false;
            }
            res.json({ success: true, enrolled: enrolled });
          }
        }
      );
    }
  });
});

module.exports = router;
