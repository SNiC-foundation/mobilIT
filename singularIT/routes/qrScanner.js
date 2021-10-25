const User = require("../models/User");
const express = require("express");
const [auth, adminAuth] = require("./utils");

let router = express.Router();

/*******************************************************************************
 * Triggered if someone requests this page. This will be printed on the badge of
 * an attendee in the form of a QR code. Can be scanned with generic QR code
 * scanners. When url has been gotten, can be opened in browser.
 *
 * Will create a list of all people to connected with during the event per user.
 * After the event, this can be used to send an email to everyone who
 * participated to exchange contact details.
 ******************************************************************************/
router.get("/connect/:id", auth, function (req, res, next) {
  User.findOne({ ticket: req.params.id }, function (err, user) {
    if (err || !user) {
      res.render("connect", {
        connected: false,
        error: "qrcode is not valid",
      });
    } else {
      User.findOneAndUpdate(
        { email: req.session.passport.user },
        { $addToSet: { connectlist: req.params.id } },
        function (err, doc) {
          if (err) {
            res.render("connect", {
              connected: false,
              error:
                "Could not connect with " +
                user.firstname +
                " due to an internal error.",
            });
            console.error(
              req.params.id + "could not be added to the connect list!"
            );
          } else {
            res.render("connect", { connected: true, connectee: user });
          }
        }
      );
    }
  });
});

module.exports = router;
