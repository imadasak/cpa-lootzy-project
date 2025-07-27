// controllers/rewardController.js
const pool = require('../config/db');

const getRewards = async (req, res) => {
    try {
        const [categories] = await pool.query('SELECT * FROM reward_categories');
        for (let category of categories) {
            const [rewards] = await pool.query('SELECT r.*, AVG(rr.rating) as avg_rating, COUNT(rr.id) as review_count FROM rewards r LEFT JOIN reward_reviews rr ON r.id = rr.reward_id WHERE r.category_id = ? GROUP BY r.id ORDER BY r.cost ASC', [category.id]);
            category.rewards = rewards;
        }
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: "Error fetching rewards." });
    }
};

const addReview = async (req, res) => {
    const { rewardId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;
    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5." });
    }
    try {
        const [existingReview] = await pool.query('SELECT id FROM reward_reviews WHERE reward_id = ? AND user_id = ?', [rewardId, userId]);
        if (existingReview.length > 0) {
            return res.status(409).json({ message: "You have already reviewed this reward." });
        }
        await pool.query('INSERT INTO reward_reviews (reward_id, user_id, rating, comment) VALUES (?, ?, ?, ?)', [rewardId, userId, rating, comment]);
        res.status(201).json({ success: true, message: "Your review has been submitted successfully!" });
    } catch (error) {
        console.error("Error submitting review:", error);
        res.status(500).json({ message: "An error occurred while submitting your review." });
    }
};

const getReviews = async (req, res) => {
    const { rewardId } = req.params;
    try {
        const [reviews] = await pool.query('SELECT rr.rating, rr.comment, rr.created_at, u.username, u.avatar_url FROM reward_reviews rr JOIN users u ON rr.user_id = u.id WHERE rr.reward_id = ? ORDER BY rr.created_at DESC', [rewardId]);
        res.json(reviews);
    } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ message: "Error fetching reviews." });
    }
};

const getMyRequests = async (req, res) => {
    try {
        const sql = `
            SELECT rr.id, r.name, r.description, r.image_url, rr.request_date, rr.status, rr.redeem_code, rr.admin_notes
            FROM redemption_requests rr 
            JOIN rewards r ON rr.reward_id = r.id 
            WHERE rr.user_id = ? 
            ORDER BY rr.request_date DESC`;
        const [requests] = await pool.query(sql, [req.user.id]);
        res.json(requests);
    } catch (error) {
        console.error("Error fetching my-requests:", error);
        res.status(500).json({ message: "Error fetching requests." });
    }
};

const cancelRequest = async (req, res) => {
    const { requestId } = req.params;
    const userId = req.user.id;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [requests] = await connection.query(
            `SELECT rr.user_id, r.cost 
             FROM redemption_requests rr
             JOIN rewards r ON rr.reward_id = r.id
             WHERE rr.id = ? AND rr.status = 'Pending'`, [requestId]
        );
        if (requests.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Request not found or not in pending state." });
        }
        const request = requests[0];
        if (request.user_id !== userId) {
            await connection.rollback();
            return res.status(403).json({ message: "You are not authorized to cancel this request." });
        }
        await connection.query('DELETE FROM redemption_requests WHERE id = ?', [requestId]);
        await connection.query('UPDATE users SET points = points + ? WHERE id = ?', [request.cost, userId]);
        await connection.commit();
        res.json({ success: true, message: "Request cancelled and points refunded." });
    } catch (error) {
        await connection.rollback();
        console.error("Error cancelling request:", error);
        res.status(500).json({ message: "A server error occurred while cancelling the request." });
    } finally {
        connection.release();
    }
};

const redeemReward = async (req, res) => {
    const { rewardId } = req.params;
    const userId = req.user.id;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [users] = await pool.query('SELECT points, level FROM users WHERE id = ? FOR UPDATE', [userId]);
        const [rewards] = await pool.query('SELECT cost, required_level FROM rewards WHERE id = ?', [rewardId]);
        if (users.length === 0 || rewards.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "User or Reward not found." });
        }
        const user = users[0];
        const reward = rewards[0];
        if (user.level < reward.required_level) {
            await connection.rollback();
            return res.status(400).json({ message: `You need to be level ${reward.required_level} to unlock this reward.` });
        }
        if (user.points < reward.cost) {
            await connection.rollback();
            return res.status(400).json({ message: "You do not have enough points." });
        }
        await connection.query('UPDATE users SET points = points - ? WHERE id = ?', [reward.cost, userId]);
        await pool.query('INSERT INTO redemption_requests (user_id, reward_id) VALUES (?, ?)', [userId, rewardId]);
        await connection.commit();
        res.json({ message: "Your request has been sent successfully!" });
    } catch (error) {
        await connection.rollback();
        console.error("Error during redemption process:", error);
        res.status(500).json({ message: "A server error occurred during the redemption process." });
    } finally {
        connection.release();
    }
};

module.exports = {
    getRewards,
    addReview,
    getReviews,
    getMyRequests,
    cancelRequest,
    redeemReward
};