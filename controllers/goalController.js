// controllers/goalController.js
const pool = require('../config/db');

// جلب جميع الأهداف
const getAllGoals = async (req, res) => {
    try {
        const [goals] = await pool.query('SELECT * FROM daily_weekly_goals ORDER BY createdAt DESC');
        res.json(goals);
    } catch (error) {
        res.status(500).json({ message: "Error fetching goals." });
    }
};

// إنشاء هدف جديد
const createGoal = async (req, res) => {
    const { goal_type, required_offers, bonus_points, bonus_xp } = req.body;
    // يجب إضافة وصف تلقائي أو جعله حقلاً في النموذج
    const description = `Complete ${required_offers} offers to get ${bonus_points} bonus points and ${bonus_xp} bonus XP.`;
    
    try {
        await pool.query(
            'INSERT INTO daily_weekly_goals (goal_type, description, required_offers, bonus_points, bonus_xp) VALUES (?, ?, ?, ?, ?)',
            [goal_type, description, required_offers, bonus_points, bonus_xp]
        );
        res.status(201).json({ success: true, message: 'Goal created successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error creating goal.' });
    }
};

// تحديث هدف موجود
const updateGoal = async (req, res) => {
    const { id } = req.params;
    const { required_offers, bonus_points, bonus_xp } = req.body;
    const description = `Complete ${required_offers} offers to get ${bonus_points} bonus points and ${bonus_xp} bonus XP.`;

    try {
        await pool.query(
            'UPDATE daily_weekly_goals SET description = ?, required_offers = ?, bonus_points = ?, bonus_xp = ? WHERE id = ?',
            [description, required_offers, bonus_points, bonus_xp, id]
        );
        res.json({ success: true, message: 'Goal updated successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating goal.' });
    }
};

// حذف هدف
const deleteGoal = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM daily_weekly_goals WHERE id = ?', [id]);
        res.json({ success: true, message: 'Goal deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting goal.' });
    }
};

// تفعيل أو تعطيل هدف
const toggleGoalStatus = async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;
    try {
        await pool.query('UPDATE daily_weekly_goals SET is_active = ? WHERE id = ?', [is_active, id]);
        res.json({ success: true, message: 'Goal status updated.' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating goal status.' });
    }
};

module.exports = {
    getAllGoals,
    createGoal,
    updateGoal,
    deleteGoal,
    toggleGoalStatus
};