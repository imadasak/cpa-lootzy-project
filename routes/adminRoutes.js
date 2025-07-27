// routes/adminRoutes.js
const express = require('express');
const router = express.Router();

const {
    getDashboardStats, getAdminRewards, addReward, updateReward, deleteReward, toggleRewardStatus,
    addCategory, deleteCategory, getHiddenOffers, addHiddenOffer, removeHiddenOffer,
    getPendingRequests, getCompletedRequests, approveRequest, rejectRequest, getUsers
} = require('../controllers/adminController');

router.get('/dashboard-stats', getDashboardStats);
router.get('/rewards', getAdminRewards);
router.post('/rewards', addReward);
router.post('/rewards/:id/update', updateReward);
router.post('/rewards/delete', deleteReward);
router.post('/rewards/toggle-status', toggleRewardStatus);
router.post('/categories', addCategory);
router.post('/categories/delete', deleteCategory);
router.get('/hidden-offers', getHiddenOffers);
router.post('/hidden-offers/add', addHiddenOffer);
router.post('/hidden-offers/remove', removeHiddenOffer);
router.get('/requests', getPendingRequests);
router.get('/requests/completed', getCompletedRequests);
router.post('/approve', approveRequest);
router.post('/reject', rejectRequest);
router.get('/users', getUsers);

module.exports = router;