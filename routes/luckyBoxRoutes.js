// routes/luckyBoxRoutes.js
const express = require('express');
const router = express.Router();
const { getPrizes, addPrize, updatePrize, deletePrize } = require('../controllers/luckyBoxController');

// المسارات ستبدأ بـ /api/admin/luckybox
router.get('/prizes', getPrizes);
router.post('/prizes', addPrize);
router.put('/prizes/:id', updatePrize);
router.delete('/prizes/:id', deletePrize);

module.exports = router;