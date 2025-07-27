// routes/offerRoutes.js
const express = require('express');
const { getOffers, handlePostback } = require('../controllers/offerController');
const { checkAuthForAPI } = require('../middleware/auth');

const router = express.Router();

// This endpoint is for logged-in users to see offers
router.get('/offers', checkAuthForAPI, getOffers);

// This is the postback URL the offer network will call.
// It should ideally be protected by a different method (e.g., API key), not a user session.
// For now, we leave it open as it was in the original file, but it's a security consideration.
// routes/offerRoutes.js
// استخدم الرابط السري الجديد
router.get('/postback/a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4', handlePostback);


module.exports = router;