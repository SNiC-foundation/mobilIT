const User = require("../models/User");
const express = require("express");
const [auth, adminAuth] = require("./utils");
const CSV = require("csv-string");
const config = require("../config.json");
const TalkEnrollment = require("../models/TalkEnrollment");
const moment = require("moment");
const Ticket = require("../models/Ticket");
const async = require("async");
const timetable = require("../timetable.json");
const speaker_info = require("../speakers.json");

let router = express.Router();

router.get("/users", adminAuth, function (req, res, next) {
  var query = {};

  if (req.query.email) {
    query.email = { $regex: new RegExp(req.query.email, "i") };
  }
  if (req.query.firstname) {
    query.firstname = { $regex: new RegExp(req.query.firstname, "i") };
  }
  if (req.query.surname) {
    query.surname = { $regex: new RegExp(req.query.surname, "i") };
  }
  if (req.query.association) {
    query.association = { $regex: new RegExp(req.query.association, "i") };
  }
  if (req.query.ticket) {
    query.ticket = { $regex: new RegExp(req.query.ticket, "i") };
  }
  if (req.query.present) {
    query.present = { $regex: new RegExp(req.query.present, "i") };
  }

  User.find(query)
    .sort({ association: 1, firstname: 1 })
    .exec(function (err, results) {
      if (err) {
        return next(err);
      }
      res.render("users", {
        users: results,
        associations: config.associations,
      });
    });
});

router.get("/users/:id", adminAuth, function (req, res, next) {
  User.findOne({ _id: req.params.id }, function (err, result) {
    if (err) {
      return next(err);
    }
    res.render("users/edit", {
      user: result,
      associations: config.associations,
    });
  });
});

router.post("/users/:id", adminAuth, function (req, res, next) {
  User.findOne({ _id: req.params.id }, function (err, result) {
    if (err) {
      return next(err);
    }

    result.present = req.body.present === "on";
    result.admin = req.body.admin === "on";

    result.save(function (err) {
      if (err) {
        return next(err);
      }

      req.flash("success", "User edited!");
      return res.redirect("/users/" + req.params.id);
    });
  });
});

router.post("/sign-in", adminAuth, function (req, res, next) {
  User.findOne({ ticket: req.body.ticket }, function (err, result) {
    if (err) {
      return next(err);
    }

    if (result.present === true) {
      req.flash(
        "error",
        result.firstname + " " + result.surname + " is already signed in"
      );
      return res.redirect("/users/");
    }

    result.present = true;

    result.save(function (err) {
      if (err) {
        return next(err);
      }

      req.flash(
        "success",
        result.firstname + " " + result.surname + " has signed in"
      );
      return res.redirect("/users/");
    });
  });
});

router.get("/users/export-csv/all", adminAuth, async function (req, res) {
  var data = [
    [
      "First Name",
      "Surname",
      "Email",
      "Bus",
      "Association",
      "Ticket code",
      "Session 1",
      "Session 2",
      "Session 3",
      "Speeddate start",
      "Speeddate end",
    ],
  ];

  data.push(
    await Promise.all(
      (
        await User.find()
          .sort([
            ["firstname", 1],
            ["lastname", 1],
          ])
          .populate("speedDateTimeSlot")
      ).map(async function (u) {
        var session1 = u.session1 ? u.session1 : "";
        var session2 = u.session2 ? u.session2 : "";
        var session3 = u.session3 ? u.session3 : "";

        var spStart = "";
        var spEnd = "";

        if (u.speedDateTimeSlot) {
          spStart = moment(u.speedDateTimeSlot.startTime).format("HH:mm");
          spEnd = moment(u.speedDateTimeSlot.endTime).format("HH:mm");
        }

        return [
          u.firstname,
          u.surname,
          u.email,
          u.bus,
          config.associations[u.association].name,
          u.ticket,
          session1,
          session2,
          session3,
          spStart,
          spEnd,
        ];
      })
    )
  );

  res.set("Content-Type", "text/plain");
  res.set(
    "Content-Disposition",
    'attachment; filename="all_registered_users.csv"'
  );
  res.send(CSV.stringify(data));
});

router.get(
  "/users/export-csv/:association",
  adminAuth,
  async function (req, res) {
    var data = [["First Name", "Surname", "Email", "Bus", "Ticket code"]];

    var association = config.associations[req.params.association];
    if (!association) {
      req.flash("error", "Association does not exist");
      return res.redirect("/users");
    }
    var associationName = association.name;

    data.push(
      await Promise.all(
        (
          await User.find({ association: req.params.association })
        ).map(async function (u) {
          return [u.firstname, u.surname, u.email, u.bus, u.ticket];
        })
      )
    );

    var filename = associationName.replace(/ /g, "_") + "_registered_users.csv";

    res.set("Content-Type", "text/plain");
    res.set("Content-Disposition", 'attachment; filename="' + filename + '"');
    res.send(CSV.stringify(data));
  }
);

/**
 * Output all dietary wishes provided by users
 */
router.get("/diet", adminAuth, function (req, res, next) {
  User.find({ $or: [{ specialNeeds: { $ne: "" } }, { vegetarian: true }] })
    .sort({ association: 1, firstname: 1 })
    .exec(function (err, results) {
      if (err) {
        return next(err);
      }
      res.render("diet", { users: results, associations: config.associations });
    });
});

/**
 * Session choices displayed for administrators
 */
let talks_table = timetable
  .map(function (slot) {
    let talks = [];
    for (const event of slot.events) {
      if (
        event.speakerId &&
        speaker_info.speakers[event.speakerId].limit !== undefined
      ) {
        talks.push(event.speakerId);
      }
    }
    return talks;
  })
  .filter((el) => el.length > 0);

router.get("/choices", adminAuth, async function (req, res, next) {
  let talks_count = {};
  for (const speaker in speaker_info.speakers) {
    if (speaker_info.speakers[speaker].limit !== undefined) {
      talks_count[speaker] = await TalkEnrollment.count({ talk: speaker });
    }
  }

  const enrolled = await TalkEnrollment.distinct("user").count();
  console.debug(talks_count);

  const visitor_count = await User.count();

  res.render("choices", {
    talksTable: talks_table,
    talksCount: talks_count,
    enrolled: enrolled,
    visitorCount: visitor_count,
  });
});

router.get("/tickets", adminAuth, async function (req, res) {
  res.render("new_tickets");
});

router.get("/new_tickets", adminAuth, function (req, res, next) {
  Ticket.find({ rev: 1, ownedBy: undefined }, function (err, tickets) {
    if (err) {
      return next(err);
    }
    res.render("tickets", { tickets: tickets });
  });
});

router.post("/tickets", adminAuth, function (req, res, next) {
  var tasks = [];

  var n = +req.body.amount;

  for (var i = 0; i < n; i++) {
    tasks.push(function (callback) {
      var params;
      if (req.body.type === "partner") {
        params = { type: process.argv[3], rev: 1 };
      } else {
        params = { rev: 1 };
      }
      var ticket = new Ticket(params);
      console.log("New ticket: " + ticket._id);

      return ticket.save(callback);
    });
  }

  async.parallel(tasks, function (err) {
    if (err) {
      console.log(err);
    }
    console.log(n + " tickets generated!");
    res.redirect("/new_tickets");
  });
});

module.exports = router;
