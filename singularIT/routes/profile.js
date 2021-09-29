const express = require("express");
const User = require("../models/User");
const SpeedDateTimeSlot = require("../models/SpeedDateTimeSlot");
const [auth, adminAuth] = require("./utils");

const speaker_info = require("../speakers.json");
const config = require("../config.json");

let router = express.Router();

/**
 * Queries the database to get all the visitor counts for non plenary sessions.
 */
async function getVisitorCounts() {
  // Query database to check how many people are going to each session
  var promises = [];
  for (
    var session_idx = Object.keys(speaker_info.speakerids).length - 1;
    session_idx >= 0;
    session_idx--
  ) {
    var session = Object.keys(speaker_info.speakerids)[session_idx];
    // Filter out the plenary sessions
    if (speaker_info.speakerids[session] instanceof Array) {
      for (
        var speakeridx = speaker_info.speakerids[session].length - 1;
        speakeridx >= 0;
        speakeridx--
      ) {
        var speaker = speaker_info.speakerids[session][speakeridx];
        promises.push(countEnrolls(session, speaker));
      }
    }
  }

  // Gather all the data and make a dict with
  return Promise.all(promises);
}

/**
 * Count the amount of people enrolled for a session and returns object with sessionid
 */
async function countEnrolls(sessions_lot, session_id) {
  var query = {};
  query[sessions_lot] = session_id;
  var result = await User.find(query).count();
  return {
    id: session_id,
    count: result,
  };
}

router.get("/profile", auth, async function (req, res) {
  var user = await User.findOne({ email: req.session.passport.user });
  var spTimeSlot = null;
  var allSpTimeSlots = null;
  var freeSpTimeSlots = null;

  if (user.speedDateTimeSlot) {
    spTimeSlot = await SpeedDateTimeSlot.findById(user.speedDateTimeSlot);
  } else {
    allSpTimeSlots = await SpeedDateTimeSlot.find().sort({ startTime: 1 });

    allSpTimeSlots = await Promise.all(
      allSpTimeSlots.map(async function (ts) {
        var userCount = await User.find({ speedDateTimeSlot: ts.id }).count();

        ts.isFree = userCount < ts.capacity;

        return ts;
      })
    );

    freeSpTimeSlots = allSpTimeSlots.filter((ts) => ts.isFree);
  }

  // Don't try to unescape here, it's not stored in user.
  // Do it in the template
  var visitorCounts = await getVisitorCounts();

  res.render("profile", {
    userHasBus: config.associations[user.association].bus,
    providePreferences: config.providePreferences,
    speakerids: speaker_info.speakerids,
    speakers: speaker_info.speakers,
    matchingterms: config.matchingterms,
    visitorCounts: visitorCounts,
    spTimeSlot: spTimeSlot,
    allSpTimeSlots: allSpTimeSlots,
    freeSpTimeSlots: freeSpTimeSlots,
    provideTrackPreferencesEnd: config.provideTrackPreferencesEnd,
    associations: config.associations,
  });
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

  if (typeof req.body.session1 === "undefined") {
    req.body.session1 = "";
  }

  if (typeof req.body.session2 === "undefined") {
    req.body.session2 = "";
  }

  if (typeof req.body.session3 === "undefined") {
    req.body.session3 = "";
  }

  console.log(req.body);

  if (
    req.body.session1 !== "" &&
    req.body.session1 !== null &&
    !speaker_info.speakerids.session1.includes(req.body.session1)
  ) {
    req.flash("error", "session1 went wrong!");
    return res.redirect("/profile");
  }
  if (
    req.body.session2 !== "" &&
    req.body.session2 !== null &&
    !speaker_info.speakerids.session2.includes(req.body.session2)
  ) {
    req.flash("error", "session2 went wrong!");
    return res.redirect("/profile");
  }
  if (
    req.body.session3 !== "" &&
    req.body.session3 !== null &&
    !speaker_info.speakerids.session3.includes(req.body.session3)
  ) {
    req.flash("error", "session3 went wrong!");
    return res.redirect("/profile");
  }

  User.findOne({ email: req.session.passport.user }).exec(async function (
    err,
    user
  ) {
    if (!err) {
      /*******************************************************************************
       * There is some form of race condition possible. the check if the session is
       * full can be done after someone else has been checked but before he has been
       * enrolled.
       *
       * Best would be to do a conditional update, however, Mongo does not support
       * this feature in mongo 3.4.
       *
       * For now this is not as big as a problem because one person extra is not
       * that big of a problem. However, watch carefully if people actively abuse
       * this
       ******************************************************************************/

      var canEnrollSession1 = await canEnrollForSession(
        "session1",
        req.body.session1,
        req.session.passport.user
      );
      var canEnrollSession2 = await canEnrollForSession(
        "session2",
        req.body.session2,
        req.session.passport.user
      );
      var canEnrollSession3 = await canEnrollForSession(
        "session3",
        req.body.session3,
        req.session.passport.user
      );

      var tracksClosed =
        Date.now() >= new Date(config.provideTrackPreferencesEnd).getTime();

      if (canEnrollSession1) {
        user.session1 = req.body.session1;
      } else if (!tracksClosed) {
        req.flash(
          "error",
          "It is not possible to sign up for the talk you chose for the first session. It's possibly full."
        );
        err = true;
      }

      if (canEnrollSession2) {
        user.session2 = req.body.session2;
      } else if (!tracksClosed) {
        req.flash(
          "error",
          "It is not possible to sign up for the talk you chose for the second session. It's possibly full."
        );
        err = true;
      }

      if (canEnrollSession3) {
        user.session3 = req.body.session3;
      } else if (!tracksClosed) {
        req.flash(
          "error",
          "It is not possible to sign up for the talk you chose for the third session. It's possibly full."
        );
        err = true;
      }

      user.vegetarian = !!req.body.vegetarian;
      user.bus = !!req.body.bus;
      user.specialNeeds = req.body.specialNeeds;
      user.allowBadgeScanning = !!req.body.allowBadgeScanning;

      if (req.body.speedDateTimeSlot) {
        var spTimeSlot = await SpeedDateTimeSlot.findById(
          req.body.speedDateTimeSlot
        );
        if (!spTimeSlot) {
          req.flash("error", "Invalid speed date timeslot chosen");
          err = true;
        } else {
          var userCount = await User.find({
            speedDateTimeSlot: spTimeSlot.id,
          }).count();

          if (userCount >= spTimeSlot.capacity) {
            req.flash(
              "error",
              "The speed date timeslot you chose is already full."
            );
            err = true;
          } else {
            user.speedDateTimeSlot = spTimeSlot.id;
          }
        }
      }

      var matching = [];
      for (var i = 0; i < config.matchingterms.length; i++) {
        if (req.body[config.matchingterms[i]]) {
          matching.push(config.matchingterms[i]);
        }
      }
      user.matchingterms = matching;
      user.save();

      if (!err) {
        req.flash("success", "Profile edited");
      }
      res.redirect("/profile");
    } else {
      // debug(err);
      console.log(err);
      req.flash("error", "Something went wrong!");
      res.redirect("/profile");
    }
  });
});

module.exports = router;
