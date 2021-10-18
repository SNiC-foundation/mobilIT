const User = require("../models/User");
const TalkEnrollment = require("../models/TalkEnrollment");
const [auth, adminAuth] = require("./utils");
const express = require("express");

let speaker_info = require("../speakers.json");

let router = express.Router();

router.post("/api/talk/count/", async function (req, res) {
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

router.post("/api/talk/enroll/:talk", auth, async function (req, res) {
  User.findOne({ email: req.session.passport.user }).exec(async function (
    err,
    user
  ) {
    if (err) {
      res.json({ success: false });
    } else {
      // Possible race condition but it doesn't matter that much
      const count = await TalkEnrollment.count({ talk: req.params.talk });
      if (count >= speaker_info.speakers[req.params.talk].limit) {
        res.json({ success: false });
      } else {
        var newTalkEnrollment = new TalkEnrollment({
          user: user,
          talk: req.params.talk,
        });
        newTalkEnrollment.save(function (err) {
          if (err) {
            res.json({ success: false });
          } else {
            res.json({ success: true });
          }
        });
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
