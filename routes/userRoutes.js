// routes/userRoutes.js
const express = require('express');
const { getMyProfile, getLeaderboard, claimLuckyBox, checkAndAssignGoal, claimGoalReward, getNotifications, markNotificationsRead } = require('../controllers/userController');
const { checkAuthForAPI } = require('../middleware/auth');

const router = express.Router();

router.get('/me', checkAuthForAPI, getMyProfile);
router.get('/leaderboard', checkAuthForAPI, getLeaderboard);
router.post('/claim-luckybox', checkAuthForAPI, claimLuckyBox);
router.get('/check-and-assign-goal', checkAuthForAPI, checkAndAssignGoal);
router.post('/claim-goal-reward', checkAuthForAPI, claimGoalReward);
router.get('/notifications', checkAuthForAPI, getNotifications);
router.post('/notifications/mark-read', checkAuthForAPI, markNotificationsRead);

module.exports = router;