const express = require("express");
const User = require("../models/User");
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
