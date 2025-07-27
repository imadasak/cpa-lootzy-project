// controllers/luckyBoxController.js
const pool = require('../config/db');

// جلب جميع الجوائز
const getPrizes = async (req, res) => {
    try {
        const [prizes] = await pool.query('SELECT * FROM lucky_box_prizes ORDER BY id DESC');
        res.json(prizes);
    } catch (error) {
        res.status(500).json({ message: "Error fetching prizes." });
    }
};

// إضافة جائزة جديدة
const addPrize = async (req, res) => {
    const { prize_type, min_value, max_value, probability } = req.body;
    try {
        await pool.query(
            'INSERT INTO lucky_box_prizes (prize_type, min_value, max_value, probability) VALUES (?, ?, ?, ?)',
            [prize_type, min_value, max_value, probability]
        );
        res.status(201).json({ success: true, message: 'Prize added successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error adding prize.' });
    }
};

// تحديث جائزة
const updatePrize = async (req, res) => {
    const { id } = req.params;
    const { prize_type, min_value, max_value, probability } = req.body;
    try {
        await pool.query(
            'UPDATE lucky_box_prizes SET prize_type = ?, min_value = ?, max_value = ?, probability = ? WHERE id = ?',
            [prize_type, min_value, max_value, probability, id]
        );
        res.json({ success: true, message: 'Prize updated successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating prize.' });
    }
};

// حذف جائزة
const deletePrize = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM lucky_box_prizes WHERE id = ?', [id]);
        res.json({ success: true, message: 'Prize deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting prize.' });
    }
};

module.exports = {
    getPrizes,
    addPrize,
    updatePrize,
    deletePrize
};