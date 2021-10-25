var compress = require("compression");
var express = require("express");
var path = require("path");
var morgan = require("morgan");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
var session = require("express-session");
var flash = require("express-flash");
var mongoose = require("mongoose");
var fs = require("fs");
var passport = require("passport");
var expressValidator = require("express-validator");
const helmet = require("helmet");

var app = express();
app.use(bodyParser.urlencoded({ extended: true }));

/// load configuration
const config = require("./config.json");

/// configure database
mongoose.connect(config.mongodb.url);
mongoose.Promise = require("q").Promise;

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(
  compress({
    filter: function (req, res) {
      if (req.headers["x-no-compression"]) {
        return false;
      }
      return /json|text|javascript|dart|image\/svg\+xml|application\/x-font-ttf|application\/vnd\.ms-opentype|application\/vnd\.ms-fontobject/.test(
        res.getHeader("Content-Type")
      );
    },
  })
);

app.use(morgan("combined"));

app.use(
  helmet({
    contentSecurityPolicy: false,
    noSniff: false,
  })
);

app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
); // Because default for lower versions
app.use(expressValidator());
app.use(cookieParser());
app.use(
  session({
    secret: config.session.secret,
    // store: new MongoStore({
    //   url: config.mongodb.url
    // }),
    cookie: { maxAge: 4 * 7 * 24 * 60 * 60 * 1000 },
    rolling: true,
    saveUninitialized: true,
    resave: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(express.static(path.join(__dirname, "public")));

// set up locals that we use in every template
app.use(function (req, res, next) {
  res.locals.path = req.path;
  res.locals.user = req.user;
  res.locals.body = req.session.body || {};
  res.locals.ucfirst = function (value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  };
  res.locals.hypenate = function (value) {
    return value
      .replace(/\s/g, "-")
      .replace("?", "")
      .replace(":", "")
      .replace("!", "")
      .toLowerCase();
  };

  next();
});

app.use("/", require("./routes/index"));
app.use("/", require("./routes/auth"));
app.use("/", require("./routes/parteners"));
app.use("/", require("./routes/admin"));
app.use("/", require("./routes/profile"));
app.use("/", require("./routes/qrScanner"));
app.use("/", require("./routes/talksApi"));
app.use("/", require("./routes/ticket"));

/// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error("Page not found");
  err.status = 404;
  next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get("env") === "development") {
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render("error", {
      message: err.message,
      error: err,
    });
  });
} else {
  // production error handler, no stack traces leaked to user
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render("error", {
      message: err.message,
      error: {},
    });
  });
}

process.on("message", function (message) {
  if (message === "shutdown") {
    mongoose.disconnect();
    process.exit(0);
  }
});

module.exports = app;
