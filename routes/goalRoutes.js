// routes/goalRoutes.js
const express = require('express');
const router = express.Router();
const { getAllGoals, createGoal, updateGoal, deleteGoal, toggleGoalStatus } = require('../controllers/goalController');

router.get('/goals', getAllGoals);
router.post('/goals', createGoal);
router.put('/goals/:id', updateGoal);
router.delete('/goals/:id', deleteGoal);
router.post('/goals/:id/toggle', toggleGoalStatus);

module.exports = router;