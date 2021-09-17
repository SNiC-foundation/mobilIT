var express = require("express");
const fs = require("fs");
var router = express.Router();

var partner_info = JSON.parse(fs.readFileSync("partners.json"));

router.get("/partners", function (req, res) {
  res.render("partners/index", {
    title: "Partners |",
    partners: partner_info,
  });
});

router.get("/partners/:partner", function (req, res) {
  res.render("partners/partner", {
    partner: partner_info.partners[req.params.partner],
  });
});

module.exports = router;
