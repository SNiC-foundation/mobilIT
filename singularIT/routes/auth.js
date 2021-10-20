var express = require("express");
var passport = require("passport");
var crypto = require("crypto");
var async = require("async");
var nodemailer = require("nodemailer");
const pug = require("pug");
var path = require("path");
var md5 = require("md5");
const mailchimp = require("@mailchimp/mailchimp_marketing");

const config = require("../config.json");
const partners = require("../partners.json");

mailchimp.setConfig({
  apiKey: config.mailchimp.key,
  server: "us17",
});

let transporter;
if (process.env.NODE_ENV === "production") {
  // We are using the google workspaces email relay and thus don't need any authentication
  transporter = nodemailer.createTransport({
    host: "smtp-relay.gmail.com",
    port: 587,
    name: "websitehost",
  });
} else {
  transporter = nodemailer.createTransport({
    streamTransport: true,
    newline: "unix",
  });
}

const passwordForgotEmailTemplate = pug.compileFile(
  path.join("views", "password_reset_email.pug")
);

const welcomeEmailTemplate = pug.compileFile(
  path.join("views", "welcome_email.pug")
);

var User = require("../models/User");
var Ticket = require("../models/Ticket");

var _ = require("underscore");

var router = express.Router();

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

router.get("/login", function (req, res) {
  res.render("login");
});

router.post("/login", function (req, res) {
  return passport.authenticate("local", {
    successRedirect: req.session.lastPage || "/",
    failureRedirect: "/login",
    failureFlash: "Incorrect e-mail or password",
  })(req, res);
});

router.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

router.get("/privacy-policy", function (req, res) {
  res.render("privacy_policy");
});

router.get("/register", function (req, res) {
  // res.render("register", {
  //   associations: config.associations,
  //   studyProgrammes: config.studyProgrammes,
  //   ticketSaleStarts: config.ticketSaleStarts,
  // });
  res.redirect("/");
});

router.post("/register", function (req, res, next) {
  req.checkBody("code", "Activation code is not provided.").notEmpty();
  req.checkBody("firstname", "First name is not provided.").notEmpty();
  req.checkBody("surname", "Surname is not provided.").notEmpty();
  req.checkBody("email", "Email address is not provided.").notEmpty();
  req.checkBody("email", "Email address is not valid.").isEmail();
  req
    .checkBody("password", "Password needs to be at least 8 characters long.")
    .len(8);
  req
    .checkBody("password", "Passwords are not equal.")
    .equals(req.body.confirm);
  req.checkBody("association", "No association provided.").notEmpty();
  req
    .checkBody("association", "No valid association provided.")
    .isIn(Object.keys(config.associations));

  var association = config.associations[req.body.association];
  if (association) {
    association = association.name;
  }

  req.body.vegetarian = req.body.vegetarian || false;
  req.body.shareInfo = req.body.shareInfo || false;
  req.body.privacyPolicyAgree = req.body.privacyPolicyAgree || false;

  if (association === "Partner") {
    req.checkBody("companyName", "No company name provided").notEmpty();
  } else {
    if (req.body.programme === "other") {
      req
        .checkBody("programmeOther", "No study programme provided.")
        .notEmpty();
      req.body.programme = req.body.programmeOther;
    } else {
      req.checkBody("programme", "No study programme provided.").notEmpty();
      req.body.programmeOther = null;
    }

    req.body.companyName = null;
  }

  req.sanitize("bus").toBoolean();
  req.sanitize("vegetarian").toBoolean();
  req.sanitize("shareInfo").toBoolean();
  req.sanitize("privacyPolicyAgree").toBoolean();

  var errors = req.validationErrors();

  if (!req.body.privacyPolicyAgree) {
    if (!errors) {
      errors = [];
    }

    errors.push({
      param: "privacyPolicyAgree",
      msg: "Please agree to the Privacy Policy.",
      value: req.body.privacyPolicyAgree,
    });
  }

  if (errors) {
    var msg = "";
    errors.forEach(function (err) {
      req.flash("error", err.msg);
    });
    req.session.body = req.body;
    return res.redirect("/");
  }

  var user = new User({
    firstname: req.body.firstname,
    surname: req.body.surname,
    association: req.body.association,
    email: req.body.email,
    bus: req.body.bus,
    vegetarian: req.body.vegetarian,
    specialNeeds: req.body.specialNeeds,
    studyProgramme: req.body.programme,
    companyName: req.body.companyName,
    shareInfo: req.body.shareInfo,
  });

  async.waterfall(
    [
      function (next) {
        mailchimp.lists
          .setListMember(config.mailchimp.id, md5(req.body.email), {
            email_address: req.body.email,
            status: "subscribed",
          })
          .then(function (res) {
            next(null);
          })
          .catch(function (err) {
            console.error("an error with mailchimp has occurred");
            console.error(err.response.res);
            next(new Error(err.response.res.text.detail));
          });
      },
      function (next) {
        Ticket.findById(req.body.code).populate("ownedBy").exec(next);
      },
      function (ticket, next) {
        if (ticket) {
          if (ticket.ownedBy) {
            next(new Error("Ticket has already been activated!"));
          } else {
            user.ticket = ticket;
            user.type = ticket.type;
            User.register(user, req.body.password, function (err, user) {
              next(err, ticket, user);
            });
          }
        } else {
          next(new Error("No valid activation code provided!"));
        }
      },
      function (ticket, user, next) {
        ticket.ownedBy = user;
        ticket.save(function (err, ticket, numAffected) {
          next(err, user);
        });
      },
      function (user, next) {
        req.login(user, next);
        // next(user);
      },
      // function (user, next) {
      //   const html = welcomeEmailTemplate({
      //     user: user,
      //     partners: partners,
      //   });
      //
      //   transporter.sendMail(
      //       {
      //         from: "committee@2020.snic.nl",
      //         to: user.email,
      //         subject: "SNiC: MobilIT - Welcome",
      //         html: html,
      //       },
      //       (err, info) => {
      //         if (err) {
      //           console.error("error while sending email: ", err);
      //         }
      //         if (process.env.NODE_ENV !== "production") {
      //           console.log(info.envelope);
      //           console.log(info.messageId);
      //           info.message.pipe(process.stdout);
      //         }
      //       }
      //   );
      // },
    ],
    function (err) {
      if (err) {
        req.flash("error", err.message || err.error || "Error");
        console.log(err.stack);
        req.session.body = req.body;
        return res.redirect("/#profile");
      } else {
        req.flash("success", "You've succesfully registered");
        return res.redirect("/#profile");
      }
    }
  );
});

router.get("/forgot", function (req, res) {
  res.render("forgot", {
    user: req.user,
  });
});

/// forgot password
router.post("/forgot", function (req, res, next) {
  async.waterfall(
    [
      function (done) {
        crypto.randomBytes(20, function (err, buf) {
          done(err, buf.toString("hex"));
        });
      },
      function (token, done) {
        User.findOne({ email: req.body.email }, function (err, user) {
          if (!user) {
            req.flash(
              "error",
              "There does not appear to be a ticket used with this email address."
            );
            return res.redirect("/forgot");
          }
          user.resetPasswordToken = token;
          user.resetPasswordExpires = Date.now() + 3600000;
          user.save(function (err) {
            done(err, token, user);
          });
        });
      },
      function (token, user, done) {
        var html = passwordForgotEmailTemplate({
          user: user,
          token: token,
        });

        transporter.sendMail(
          {
            from: "committee@2020.snic.nl",
            to: user.email,
            subject: "SNiC: MobilIT - Password reset",
            html: html,
          },
          (err, info) => {
            if (err) {
              console.error("error while sending email: ", err);
            }
            if (process.env.NODE_ENV !== "production") {
              console.log(info.envelope);
              console.log(info.messageId);
              info.message.pipe(process.stdout);
            }
          }
        );
        req.flash(
          "info",
          "An email has been sent to " +
            user.email +
            " with instructions on how to change your password"
        );
        done();
      },
    ],
    function (err) {
      if (err) {
        return next(err);
      }
      res.redirect("/forgot");
    }
  );
});

router.get("/reset/:token", function (req, res) {
  User.findOne(
    {
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    },
    function (err, user) {
      if (!user) {
        req.flash("error", "Password reset token is invalid.");
        return res.redirect("/forgot");
      } else {
        res.render("reset", { user: req.user });
      }
    }
  );
});

router.post("/reset/:token", function (req, res, next) {
  User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() },
  })
    .exec()
    .then(function (user) {
      if (!user) {
        req.flash("error", "Password reset token is invalid.");
        throw "error";
      }

      req
        .checkBody(
          "password",
          "Passwords needs to be atleast 6 characters long"
        )
        .len(6);
      req
        .checkBody("password", "Passwords are not equal.")
        .equals(req.body.confirm);
      return req
        .getValidationResult()
        .then(function (errors) {
          if (!errors.isEmpty()) {
            errors.array().forEach(function (err) {
              req.flash("error", err.msg);
            });
            throw errors;
          }
          user.setPassword(req.body.password, function (err, user) {
            // user.resetPasswordToken = undefined;
            // user.resetPasswordExpires = undefined;

            user.save(function (err) {
              if (err) {
                console.log("reset, within save: " + err);
                throw err;
              }
              req.flash(
                "success",
                "Password changed. Please log in with your new password"
              );
              return res.redirect("/login");
            });
          });
        })
        .catch(function (error) {
          console.log("error of validationresults: " + error);
          return res.redirect("back");
        });
    })
    .catch(function (error) {
      console.log("error of get user: " + error);
      return res.redirect("back");
    });
});

module.exports = router;
