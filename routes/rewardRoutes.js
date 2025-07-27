// routes/rewardRoutes.js
const express = require('express');
const { getRewards, addReview, getReviews, getMyRequests, cancelRequest, redeemReward } = require('../controllers/rewardController');
const { checkAuthForAPI } = require('../middleware/auth');

const router = express.Router();

// Publicly accessible but needs auth for user-specific actions
router.get('/rewards', checkAuthForAPI, getRewards);
router.get('/rewards/:rewardId/reviews', getReviews);

// Authenticated routes
router.post('/rewards/:rewardId/reviews', checkAuthForAPI, addReview);
router.get('/my-requests', checkAuthForAPI, getMyRequests);
router.post('/requests/:requestId/cancel', checkAuthForAPI, cancelRequest);
router.post('/redeem/:rewardId', checkAuthForAPI, redeemReward);


module.exports = router;