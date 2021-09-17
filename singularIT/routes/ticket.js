const User = require("../models/User");
const Ticket = require("../models/Ticket");
const bwipjs = require("bwip-js");
const express = require("express");
const [auth, adminAuth] = require("./utils");

let router = express.Router();

router.get("/ticket", auth, function (req, res, next) {
  User.findOne({ email: req.session.passport.user }, function (err, doc) {
    res.redirect("/tickets/" + doc.ticket);
  });
});

router.get("/tickets/:id", auth, function (req, res, next) {
  Ticket.findById(req.params.id)
    .populate("ownedBy")
    .exec(function (err, ticket) {
      if (err) {
        err.code = 403;
        return next(err);
      }
      if (
        !ticket ||
        !ticket.ownedBy ||
        ticket.ownedBy.email !== req.session.passport.user
      ) {
        var error = new Error("Forbidden");
        error.code = 403;
        return next(error);
      }
      res.render("tickets/ticket", { ticket: ticket });
    });
});

router.get("/tickets/:id/barcode", function (req, res) {
  bwipjs.toBuffer(
    {
      bcid: "code128",
      text: req.params.id,
      height: 10,
    },
    function (err, png) {
      if (err) {
        console.error(err);
      } else {
        res.set("Content-Type", "image/png");
        res.send(png);
      }
    }
  );
});

module.exports = router;
