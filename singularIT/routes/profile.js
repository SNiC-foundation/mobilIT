const express = require("express");
const User = require("../models/User");
const SpeedDateTimeSlot = require("../models/SpeedDateTimeSlot");
const [auth, adminAuth] = require("./utils");

const speaker_info = require("../speakers.json");
const config = require("../config.json");

let router = express.Router();

router.get("/profile", auth, async function (req, res) {
  const user = await User.findOne({ email: req.session.passport.user });

  // res.render("profile", {
  //   userHasBus: config.associations[user.association].bus,
  //   associations: config.associations,
  // });
  res.redirect("/");
});

/**
 * This function is used to determine if there is still room for someone to
 * enroll and takes in to account if someone is already enrolled.
 * TODO: possibly combine with countEnrolls?
 */
async function canEnrollForSession(sessionslot, sessionid, useremail) {
  if (Date.now() >= new Date(config.provideTrackPreferencesEnd).getTime()) {
    return false;
  }

  if (
    typeof sessionid === "undefined" ||
    sessionid === "" ||
    sessionid == null
  ) {
    return true;
  }

  var session = speaker_info.speakers.filter(function (speaker) {
    return speaker.id === sessionid;
  });

  // session not found
  if (session.length !== 1) {
    return false;
  }

  session = session[0];

  // Check if there is a limit and if so, if it has been reached
  if (session.limit) {
    var query = {};
    query[sessionslot] = sessionid;
    var result;

    await User.find(query)
      .where("email")
      .ne(useremail)
      .count()
      .then(function (res) {
        result = res;
      });
    return result < session.limit;
  }

  return true;
}

router.post("/profile", auth, async function (req, res) {
  console.log(req.body);
  req.sanitize("vegetarian").toBoolean();
  req.sanitize("bus").toBoolean();
  req.sanitize("allowBadgeScanning").toBoolean();
  req.sanitize("shareInfo").toBoolean();

  User.findOne({ email: req.session.passport.user }).exec(async function (
    err,
    user
  ) {
    if (!err) {
      user.vegetarian = !!req.body.vegetarian;
      user.bus = !!req.body.bus;
      user.specialNeeds = req.body.specialNeeds;
      user.allowBadgeScanning = !!req.body.allowBadgeScanning;
      user.shareInfo = !!req.body.shareInfo;

      user.save();

      if (!err) {
        req.flash("success", "Profile edited");
      }
      res.redirect("/#profile");
    } else {
      console.log(err);
      req.flash("error", "Something went wrong!");
      res.redirect("/profile");
    }
  });
});

module.exports = router;
