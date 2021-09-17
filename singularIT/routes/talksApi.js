const User = require("../models/User");
const TalkEnrollment = require("../models/TalkEnrollment");
const [auth, adminAuth] = require("./utils");
const express = require("express");

let router = express.Router();

/**
 * Enroll for a talk for this user.
 */
router.post("/api/enroll/:id", auth, async function (req, res) {
  User.findOne({ email: req.session.passport.user }).exec(async function (
    err,
    user
  ) {
    if (err) {
      res.json({ success: false });
    } else {
      var newTalkEnrollment = new TalkEnrollment({
        user: user,
        talk: req.params.id,
      });
      newTalkEnrollment.save(function (err) {
        if (err) {
          res.json({ success: false });
        } else {
          res.json({ success: true });
        }
      });
    }
  });
});

router.post("/api/unenroll/:id", auth, async function (req, res) {
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
