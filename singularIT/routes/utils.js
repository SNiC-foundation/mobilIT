function auth(req, res, next) {
  if (!req.user) {
    req.session.lastPage = req.path;
    req.flash("info", "You have to log in to visit page " + req.path);
    return res.redirect("/login");
  }
  next();
}

function adminAuth(req, res, next) {
  if (!req.user || !req.user.admin) {
    req.session.lastPage = req.path;
    req.flash("info", "You have to log in to visit page " + req.path);
    return res.redirect("/login");
  }
  next();
}

module.exports = [auth, adminAuth];
