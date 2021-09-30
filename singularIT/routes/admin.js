const User = require("../models/User");
const express = require("express");
const [auth, adminAuth] = require("./utils");
const SpeedDateTimeSlot = require("../models/SpeedDateTimeSlot");
const CSV = require("csv-string");
const config = require("../config.json");
const ScannerUser = require("../models/ScannerUser");
const ScannerResult = require("../models/ScannerResult");
const moment = require("moment");
const Ticket = require("../models/Ticket");
const async = require("async");

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

router.get("/speeddate", adminAuth, async function (req, res) {
  var timeslots = await SpeedDateTimeSlot.find().sort({ startTime: 1 });

  var createSlot = async function (slot) {
    var users = await User.find({ speedDateTimeSlot: slot.id });
    return {
      name: slot.name,
      capacity: slot.capacity,
      usersRegistered: users,
      id: slot.id,
    };
  };

  var result = await Promise.all(timeslots.map(createSlot));

  res.render("speeddate", { timeslots: result });
});

router.get("/speeddate/export-csv", adminAuth, async function (req, res) {
  var data = [["Slot", "Name", "Email", "Study programme", "Association"]];

  var slots = await SpeedDateTimeSlot.find().sort({ startTime: 1 });

  for (var i = 0; i < slots.length; i++) {
    var slot = slots[i];

    var users = await User.find({ speedDateTimeSlot: slot.id });
    var userData = users.map((user) => [
      slot.name,
      user.firstname + " " + user.surname,
      user.email,
      user.studyProgramme,
      config.associations[user.association].name,
    ]);

    if (userData.length > 0) {
      data.push(userData);
    }
  }

  res.set("Content-Type", "text/plain");
  res.set(
    "Content-Disposition",
    'attachment; filename="speeddating_participants.csv"'
  );
  res.send(CSV.stringify(data));
});

router.get("/speeddate/remove/:id", adminAuth, async function (req, res) {
  console.log("Removing speeddate: " + req.params.id);
  res.redirect("/speeddate");
});

router.get("/badge-scanning", adminAuth, async function (req, res) {
  var badgeScanningAllowed = await User.find({
    allowBadgeScanning: true,
    type: "student",
  }).count();
  var totalUsers = await User.find({ type: "student" }).count();

  var scannerAccounts = await Promise.all(
    (
      await ScannerUser.find().sort({ displayName: 1 })
    ).map(async function (account) {
      var scans = await ScannerResult.find({ scanner_user: account._id })
        .populate("user")
        .sort({ "user.studyProgramme": 1 });

      return {
        id: account._id,
        display_name: account.display_name,
        username: account.username,
        scans: scans,
      };
    })
  );

  res.render("badge_scanning", {
    badgeScanningAllowed: badgeScanningAllowed,
    totalUsers: totalUsers,
    scannerAccounts: scannerAccounts,
  });
});

router.get(
  "/badge-scanning/export-csv/:id",
  adminAuth,
  async function (req, res) {
    var data = [["Time", "Email", "Name", "Study programme", "Comments"]];

    var scannerUser = await ScannerUser.findById(req.params.id);

    data.push(
      await Promise.all(
        (
          await ScannerResult.find({ scanner_user: req.params.id })
            .populate("user")
            .sort({ "user.surname": 1, "user.firstname": 1 })
        ).map(async function (r) {
          return [
            r.scan_time_string,
            r.user.email,
            r.user.firstname + " " + r.user.surname,
            r.user.studyProgramme,
            r.comment,
          ];
        })
      )
    );

    var filename =
      scannerUser.display_name.replace(/ /g, "_") + "_badge_scans.csv";

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
router.get("/choices", adminAuth, function (req, res, next) {
  User.aggregate(
    [{ $group: { _id: "$session1", count: { $sum: 1 } } }],
    function (err, session1) {
      User.aggregate(
        [{ $group: { _id: "$session2", count: { $sum: 1 } } }],
        function (err, session2) {
          User.aggregate(
            [{ $group: { _id: "$session3", count: { $sum: 1 } } }],
            function (err, session3) {
              console.log(session1, session2, session3);
              res.render("choices", {
                session1: session1,
                session2: session2,
                session3: session3,
              });
            }
          );
        }
      );
    }
  );
});

async function getMatchingStats() {
  // based on https://github.com/Automattic/mongoose/blob/master/examples/mapreduce/mapreduce.js
  var map = function () {
    for (var i = this.matchingterms.length - 1; i >= 0; i--) {
      emit(this.matchingterms[i], 1);
    }
  };

  var reduce = function (key, values) {
    return Array.sum(values);
  };

  // map-reduce command
  var command = {
    map: map, // a function for mapping
    reduce: reduce, // a function  for reducing
  };

  return User.mapReduce(command);
}

router.get("/matchingstats", adminAuth, function (req, res, next) {
  getMatchingStats()
    .then((results) => {
      console.log(results);
      res.render("matchingstats", { interests: results });
    })
    .catch(function (err) {
      res.render("matchingstats", { error: err });
    });
});

router.get("/tickets", adminAuth, async function (req, res) {
  res.render("new_tickets");
});

router.get('/new_tickets', adminAuth, function (req, res, next) {
  Ticket.find({rev:1, ownedBy:undefined}, function (err, tickets) {
    if (err) { return next(err); }
    res.render('tickets', {tickets: tickets});
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

router.post("/speeddate", adminAuth, function (req, res, next) {
  console.log("Creating " + req.body.startTime + "-" + req.body.endTime);

  var ts = new SpeedDateTimeSlot({
    startTime: "2019-11-26T" + req.body.startTime,
    endTime: "2019-11-26T" + req.body.endTime,
    capacity: req.body.capacity,
  });
  ts.save().then(
    function (doc) {
      console.log("Created speeddate time slot!");
      return res.redirect("/speeddate");
    },
    function (err) {
      console.log(err);
      return next(err);
    }
  );
});

module.exports = router;
