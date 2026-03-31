// التحقق من تسجيل الدخول
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash('error', 'يجب تسجيل الدخول أولاً');
  res.redirect('/auth/login');
}

// التحقق من صلاحية الأدمن
function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  req.flash('error', 'غير مصرح لك بالوصول إلى هذه الصفحة');
  res.redirect('/teacher/dashboard');
}

// التحقق من صلاحية الأستاذ أو الأدمن
function isTeacherOrAdmin(req, res, next) {
  if (req.session && req.session.user &&
    (req.session.user.role === 'teacher' || req.session.user.role === 'admin')) {
    return next();
  }
  req.flash('error', 'غير مصرح لك بالوصول');
  res.redirect('/auth/login');
}

module.exports = { isAuthenticated, isAdmin, isTeacherOrAdmin };
