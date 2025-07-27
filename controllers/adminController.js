// controllers/adminController.js
const pool = require('../config/db');

// --- إحصائيات لوحة التحكم ---
const getDashboardStats = async (req, res) => {
    try {
        const [
            [[totalUsers]],
            [[newUsersToday]],
            [[pendingRequests]],
            [[allTimeEarnings]],
            [[todaysEarnings]],
            [[todaysConversions]]
        ] = await Promise.all([
            pool.query("SELECT COUNT(*) as count FROM users"),
            pool.query("SELECT COUNT(*) as count FROM users WHERE DATE(createdAt) = CURDATE()"),
            pool.query("SELECT COUNT(*) as count FROM redemption_requests WHERE status = 'Pending'"),
            pool.query("SELECT SUM(payout) as total FROM conversions"),
            pool.query("SELECT SUM(payout) as total FROM conversions WHERE DATE(created_at) = CURDATE()"),
            pool.query("SELECT COUNT(*) as count FROM conversions WHERE DATE(created_at) = CURDATE()")
        ]);

        res.json({
            totalUsers: totalUsers.count,
            newUsersToday: newUsersToday.count,
            pendingRequests: pendingRequests.count,
            allTimeEarnings: allTimeEarnings.total || 0,
            todaysEarnings: todaysEarnings.total || 0,
            todaysConversions: todaysConversions.count
        });

    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ message: "Error fetching dashboard stats" });
    }
};

// --- إدارة المكافآت والفئات ---
const getAdminRewards = async (req, res) => {
    try {
        const [categories] = await pool.query('SELECT * FROM reward_categories ORDER BY name ASC');
        for (let category of categories) {
            const [rewards] = await pool.query('SELECT * FROM rewards WHERE category_id = ? ORDER BY cost ASC', [category.id]);
            category.rewards = rewards;
        }
        res.json(categories);
    } catch (error) { 
        console.error("Error fetching rewards for admin:", error);
        res.status(500).json({ message: "Error fetching rewards for admin." }); 
    }
};

const addReward = async (req, res) => {
    const { category_id, name, description, cost, image_url, required_level, is_hot, is_new } = req.body;
    if (!category_id || !name || !description || !cost || !required_level) {
        return res.status(400).json({ message: "Missing required fields." });
    }
    try {
        const sql = 'INSERT INTO rewards (category_id, name, description, cost, image_url, required_level, is_hot, is_new) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
        await pool.query(sql, [category_id, name, description, cost, image_url || null, required_level, is_hot ? 1 : 0, is_new ? 1 : 0]);
        res.status(201).json({ success: true, message: "Reward added successfully." });
    } catch (error) { 
        console.error("Error adding reward:", error);
        res.status(500).json({ message: "A server error occurred." }); 
    }
};

const updateReward = async (req, res) => {
    const { id } = req.params;
    const { name, description, cost, image_url, required_level, is_hot, is_new } = req.body;
     if (!name || !description || !cost || !required_level) {
        return res.status(400).json({ message: "Missing required fields." });
    }
    try {
        const sql = `UPDATE rewards SET 
            name = ?, 
            description = ?, 
            cost = ?, 
            image_url = ?, 
            required_level = ?, 
            is_hot = ?, 
            is_new = ? 
            WHERE id = ?`;
        await pool.query(sql, [name, description, cost, image_url || null, required_level, is_hot ? 1 : 0, is_new ? 1 : 0, id]);
        res.json({ success: true, message: "Reward updated successfully." });
    } catch (error) {
        console.error("Error updating reward:", error);
        res.status(500).json({ message: "Error updating reward." });
    }
};

const deleteReward = async (req, res) => {
    const { rewardId } = req.body;
    try {
        await pool.query('DELETE FROM reward_reviews WHERE reward_id = ?', [rewardId]);
        await pool.query('DELETE FROM redemption_requests WHERE reward_id = ?', [rewardId]);
        await pool.query('DELETE FROM rewards WHERE id = ?', [rewardId]);
        res.json({ success: true, message: "Reward deleted successfully." });
    } catch (error) {
        res.status(500).json({ message: "A server error occurred." });
    }
};

const toggleRewardStatus = async (req, res) => {
    const { rewardId, field, status } = req.body;
    if (!rewardId || !field || status === undefined) {
        return res.status(400).json({ message: "Missing parameters." });
    }
    if (field !== 'is_hot' && field !== 'is_new') {
        return res.status(400).json({ message: "Invalid field." });
    }
    try {
        await pool.query(`UPDATE rewards SET ${field} = ? WHERE id = ?`, [status, rewardId]);
        res.json({ success: true, message: `Reward ${field} status updated.` });
    } catch (error) {
        console.error(`Error toggling ${field} status:`, error);
        res.status(500).json({ message: `Error updating ${field} status.` });
    }
};

const addCategory = async (req, res) => {
    const { name, image_url } = req.body;
    if (!name || !image_url) return res.status(400).json({ message: "Missing data." });
    try {
        await pool.query('INSERT INTO reward_categories (name, image_url) VALUES (?, ?)', [name, image_url]);
        res.json({ success: true, message: "Category added successfully." });
    } catch (error) { res.status(500).json({ message: "A server error occurred." }); }
};

const deleteCategory = async (req, res) => {
    const { categoryId } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await pool.query('DELETE FROM reward_reviews WHERE reward_id IN (SELECT id FROM rewards WHERE category_id = ?)', [categoryId]);
        await pool.query('DELETE FROM rewards WHERE category_id = ?', [categoryId]);
        await pool.query('DELETE FROM redemption_requests WHERE reward_id IN (SELECT id FROM rewards WHERE category_id = ?)', [categoryId]);
        await pool.query('DELETE FROM reward_categories WHERE id = ?', [categoryId]);
        await connection.commit();
        res.json({ success: true, message: "Category deleted successfully." });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: "A server error occurred." });
    } finally {
        connection.release();
    }
};

// --- إدارة العروض المخفية ---
const getHiddenOffers = async (req, res) => {
    try {
        const [hiddenOffers] = await pool.query('SELECT * FROM hidden_offers ORDER BY hidden_at DESC');
        res.json(hiddenOffers);
    } catch (error) {
        console.error("Error fetching hidden offers:", error);
        res.status(500).json({ message: "Error fetching hidden offers." });
    }
};

const addHiddenOffer = async (req, res) => {
    const { offerExternalId, reason } = req.body;
    if (!offerExternalId) {
        return res.status(400).json({ message: "Offer external ID is required." });
    }
    try {
        await pool.query('INSERT INTO hidden_offers (offer_external_id, reason) VALUES (?, ?)', [offerExternalId, reason || null]);
        res.json({ success: true, message: "Offer added to hidden list." });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: "Offer is already hidden." });
        }
        console.error("Error adding hidden offer:", error);
        res.status(500).json({ message: "Error adding offer to hidden list." });
    }
};

const removeHiddenOffer = async (req, res) => {
    const { offerExternalId } = req.body;
    if (!offerExternalId) {
        return res.status(400).json({ message: "Offer external ID is required." });
    }
    try {
        const [result] = await pool.query('DELETE FROM hidden_offers WHERE offer_external_id = ?', [offerExternalId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Offer not found in hidden list." });
        }
        res.json({ success: true, message: "Offer removed from hidden list." });
    } catch (error) {
        console.error("Error removing hidden offer:", error);
        res.status(500).json({ message: "Error removing offer from hidden list." });
    }
};

// --- إدارة الطلبات ---
const getPendingRequests = async (req, res) => {
    try {
        const sql = `SELECT rr.id, u.username, r.name as reward_name, r.cost as reward_cost, rr.request_date FROM redemption_requests rr JOIN users u ON rr.user_id = u.id JOIN rewards r ON rr.reward_id = r.id WHERE rr.status = 'Pending' ORDER BY rr.request_date ASC`;
        const [requests] = await pool.query(sql);
        res.json(requests);
    }
    catch (error) { 
        console.error("Error fetching admin requests:", error);
        res.status(500).json({ message: "Error fetching admin requests." }); 
    }
};

const getCompletedRequests = async (req, res) => {
    try {
        const sql = `SELECT rr.id, u.username, r.name as reward_name, rr.completion_date, rr.redeem_code, rr.status, rr.admin_notes FROM redemption_requests rr JOIN users u ON rr.user_id = u.id JOIN rewards r ON rr.reward_id = r.id WHERE rr.status != 'Pending' ORDER BY rr.completion_date DESC LIMIT 50`;
        const [requests] = await pool.query(sql);
        res.json(requests);
    } catch (error) { 
        console.error("Error fetching completed requests:", error);
        res.status(500).json({ message: "Error fetching completed requests." }); 
    }
};

const approveRequest = async (req, res) => {
    const { requestId, serialKey } = req.body;
    if (!requestId || !serialKey) return res.status(400).json({ message: "Missing data." });
    try {
        const [requests] = await pool.query('SELECT user_id FROM redemption_requests WHERE id = ?', [requestId]);
        if (requests.length === 0) return res.status(404).json({ message: "Request not found." });
        const userId = requests[0].user_id;
        const sql = `UPDATE redemption_requests SET status = 'Completed', redeem_code = ?, completion_date = NOW() WHERE id = ?`;
        await pool.query(sql, [serialKey, requestId]);
        const notificationMessage = `Your request has been approved! Check the My Requests page for your code.`;
        await pool.query('INSERT INTO notifications (user_id, message, link_url) VALUES (?, ?, ?)', [userId, notificationMessage, '/my_requests.html']);
        res.json({ success: true, message: "Request approved and a notification was sent to the user." });
    } catch (error) { 
        console.error("Error approving request:", error);
        res.status(500).json({ message: "A server error occurred." }); 
    }
};

const rejectRequest = async (req, res) => {
    const { requestId, reason } = req.body;
    if (!requestId) return res.status(400).json({ message: "Request ID is missing." });
    try {
        const [requests] = await pool.query('SELECT user_id FROM redemption_requests WHERE id = ?', [requestId]);
        if (requests.length === 0) return res.status(404).json({ message: "Request not found." });
        
        const userId = requests[0].user_id;
        const sql = `UPDATE redemption_requests SET status = 'Rejected', admin_notes = ?, completion_date = NOW() WHERE id = ?`;
        await pool.query(sql, [reason || 'No reason provided.', requestId]);
        
        const notificationMessage = `Your request was rejected. Reason: ${reason || 'No reason provided.'}`;
        await pool.query('INSERT INTO notifications (user_id, message, link_url) VALUES (?, ?, ?)', [userId, notificationMessage, '/my_requests.html']);
        
        res.json({ success: true, message: "Request rejected and a notification was sent to the user." });
    } catch (error) {
        console.error("Error rejecting request:", error);
        res.status(500).json({ message: "A server error occurred." });
    }
};

// --- إدارة المستخدمين ---
const getUsers = async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, username, email, points, level, xp, createdAt, total_offers_completed, referral_code FROM users ORDER BY createdAt DESC');
        res.json(users);
    } catch (error) {
        console.error("Error fetching users for admin:", error);
        res.status(500).json({ message: "Error fetching users." });
    }
};

module.exports = {
    getDashboardStats,
    getAdminRewards,
    addReward,
    updateReward,
    deleteReward,
    toggleRewardStatus,
    addCategory,
    deleteCategory,
    getHiddenOffers,
    addHiddenOffer,
    removeHiddenOffer,
    getPendingRequests,
    getCompletedRequests,
    approveRequest,
    rejectRequest,
    getUsers
};