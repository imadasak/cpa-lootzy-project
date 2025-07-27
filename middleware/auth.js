// middleware/auth.js
const checkAuthForPage = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login.html');
};

const checkAuthForAPI = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: "Unauthorized. Please log in." });
};

const checkAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user && req.user.isAdmin) {
        return next();
    }
    res.status(403).send('Access Forbidden');
};

module.exports = {
    checkAuthForPage,
    checkAuthForAPI,
    checkAdmin
};