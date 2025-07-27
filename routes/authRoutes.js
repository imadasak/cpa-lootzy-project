// routes/authRoutes.js
const express = require('express');
const passport = require('passport');
const { googleCallbackRedirect, logout } = require('../controllers/authController');

const router = express.Router();

// Auth APIs
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login.html' }),
    googleCallbackRedirect
);

router.get('/api/logout', logout);

module.exports = router;