// controllers/userController.js
const pool = require('../config/db');

/**
 * دالة لجلب بيانات المستخدم المسجل حاليًا
 */
const getMyProfile = async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, username, googleId, avatar_url, points, level, xp, firstOfferCompleted, createdAt, isAdmin, referral_code, total_offers_completed, lastLuckyBoxClaim, current_goal_id, current_goal_progress, goal_assigned_date FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }
        const user = users[0];

        // جلب عدد المكافآت المستلمة
        const [redeemedCountRows] = await pool.query(`SELECT COUNT(*) as count FROM redemption_requests WHERE user_id = ? AND status = 'Completed'`, [req.user.id]);
        user.redeemed_rewards_count = redeemedCountRows[0].count;

        // إضافة جديدة: جلب عدد المستخدمين الذين تمت إحالتهم
        const [referralCountRows] = await pool.query('SELECT COUNT(*) as count FROM users WHERE referred_by_user_id = ?', [req.user.id]);
        user.referred_users_count = referralCountRows[0].count;

        // جلب بيانات الهدف الحالي
        if (user.current_goal_id) {
            const [goalRows] = await pool.query('SELECT * FROM daily_weekly_goals WHERE id = ?', [user.current_goal_id]);
            if (goalRows.length > 0) {
                user.currentGoal = goalRows[0];
            }
        }
        res.json(user);
    }
    catch (error) {
        console.error("Error fetching user data and stats:", error);
        res.status(500).json({ message: "Error fetching user data and stats." });
    }
};

/**
 * دالة لجلب قائمة المتصدرين (Leaderboard)
 */
const getLeaderboard = async (req, res) => {
    try {
        const [topUsers] = await pool.query('SELECT id, username, points, avatar_url FROM users ORDER BY points DESC, xp DESC LIMIT 3');
        const [allUsersRanked] = await pool.query('SELECT id, points, xp FROM users ORDER BY points DESC, xp DESC');
        let currentUserRank = -1;
        for (let i = 0; i < allUsersRanked.length; i++) {
            if (allUsersRanked[i].id === req.user.id) {
                currentUserRank = i + 1;
                break;
            }
        }
        res.json({ topUsers, currentUserRank });
    } catch (error) {
        console.error("Error fetching leaderboard data:", error);
        res.status(500).json({ message: "Error fetching leaderboard data." });
    }
};

/**
 * دالة لمطالبة المستخدم بجائزة Lucky Box اليومية
 */
const claimLuckyBox = async (req, res) => {
    const userId = req.user.id;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [users] = await pool.query('SELECT points, xp, level, lastLuckyBoxClaim FROM users WHERE id = ? FOR UPDATE', [userId]);
        
        if (users.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "User not found." });
        }
        
        const user = users[0];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastClaimDate = user.lastLuckyBoxClaim ? new Date(user.lastLuckyBoxClaim) : null;
        if (lastClaimDate) {
            lastClaimDate.setHours(0, 0, 0, 0);
        }

        if (lastClaimDate && lastClaimDate.getTime() === today.getTime()) {
            await connection.rollback();
            return res.status(400).json({ message: "You have already claimed the lucky box today. Try again tomorrow!" });
        }

        const [prizes] = await connection.query('SELECT * FROM lucky_box_prizes WHERE is_active = 1');
        if (prizes.length === 0) {
            await connection.rollback();
            return res.status(500).json({ message: "No lucky box prizes are configured." });
        }

        const weightedList = [];
        prizes.forEach(prize => {
            for (let i = 0; i < prize.probability; i++) {
                weightedList.push(prize);
            }
        });

        const randomPrize = weightedList[Math.floor(Math.random() * weightedList.length)];
        const rewardValue = Math.floor(Math.random() * (randomPrize.max_value - randomPrize.min_value + 1)) + randomPrize.min_value;

        let rewardMessage = "";
        let pointsReward = 0;
        let xpReward = 0;

        if (randomPrize.prize_type === 'points') {
            pointsReward = rewardValue;
            rewardMessage =  `Congratulations! You won ${pointsReward} free points!`;
        } else {
            xpReward = rewardValue;
            rewardMessage = `Awesome! You gained ${xpReward} bonus XP!`;
        }

        const updateSql = `UPDATE users SET points = points + ?, xp = xp + ?, lastLuckyBoxClaim = CURDATE() WHERE id = ?`;
        await connection.query(updateSql, [pointsReward, xpReward, userId]);
        
        const [updatedUserRows] = await connection.query('SELECT level, xp FROM users WHERE id = ?', [userId]);
        const updatedUser = updatedUserRows[0];
        let newXp = updatedUser.xp;
        let newLevel = updatedUser.level;
        const xpNeeded = 100;

        while (newXp >= xpNeeded) {
            newLevel++;
            newXp -= xpNeeded;
        }

        await connection.query('UPDATE users SET level = ?, xp = ? WHERE id = ?', [newLevel, newXp, userId]);
        await connection.query('INSERT INTO notifications (user_id, message, link_url) VALUES (?, ?, ?)', [userId, rewardMessage, '/']);
        
        await connection.commit();
        res.status(200).json({ success: true, message: rewardMessage, points: pointsReward, xp: xpReward });
    } catch (error) {
        await connection.rollback();
        console.error("Lucky box claim error:", error);
        res.status(500).json({ message: "An error occurred while trying to claim the lucky box. Please try again." });
    } finally {
        connection.release();
    }
};

/**
 * دالة للتحقق من هدف المستخدم وتعيين هدف جديد إذا لزم الأمر
 */
const checkAndAssignGoal = async (req, res) => {
    const userId = req.user.id;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [users] = await pool.query('SELECT current_goal_id, goal_assigned_date, current_goal_progress FROM users WHERE id = ? FOR UPDATE', [userId]);
        const user = users[0];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const goalAssignedDate = user.goal_assigned_date ? new Date(user.goal_assigned_date) : null;
        if (goalAssignedDate) {
            goalAssignedDate.setHours(0, 0, 0, 0);
        }
        let goalUpdated = false;
        if (!user.current_goal_id || (goalAssignedDate && goalAssignedDate.getTime() < today.getTime())) {
            const [availableGoals] = await pool.query('SELECT id FROM daily_weekly_goals WHERE goal_type = "daily" AND is_active = 1 ORDER BY RAND() LIMIT 1');
            if (availableGoals.length > 0) {
                const newGoalId = availableGoals[0].id;
                await connection.query('UPDATE users SET current_goal_id = ?, current_goal_progress = 0, goal_assigned_date = CURDATE() WHERE id = ?', [newGoalId, userId]);
                goalUpdated = true;
            } else {
                console.warn("No active daily goals found to assign.");
            }
        }
        await connection.commit();
        res.json({ success: true, goalUpdated: goalUpdated });
    } catch (error) {
        await connection.rollback();
        console.error("Error checking/assigning goal:", error);
        res.status(500).json({ message: "Error processing daily goal." });
    } finally {
        connection.release();
    }
};

/**
 * دالة لمطالبة المستخدم بمكافأة الهدف المكتمل
 */
const claimGoalReward = async (req, res) => {
    const userId = req.user.id;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [users] = await pool.query('SELECT points, xp, level, current_goal_id, current_goal_progress FROM users WHERE id = ? FOR UPDATE', [userId]);
        const user = users[0];
        if (!user.current_goal_id) {
            await connection.rollback();
            return res.status(400).json({ message: "You have no active goal to claim." });
        }
        const [goalRows] = await pool.query('SELECT * FROM daily_weekly_goals WHERE id = ?', [user.current_goal_id]);
        if (goalRows.length === 0 || !goalRows[0].is_active) {
            await connection.rollback();
            return res.status(404).json({ message: "Goal not found or is inactive." });
        }
        const goal = goalRows[0];
        if (user.current_goal_progress < goal.required_offers) {
            await connection.rollback();
            return res.status(400).json({ message: `Complete ${goal.required_offers - user.current_goal_progress} more offers to claim the reward.` });
        }

        await connection.query(
            'UPDATE users SET points = points + ?, xp = xp + ?, current_goal_id = NULL, current_goal_progress = 0, goal_assigned_date = NULL WHERE id = ?', 
            [goal.bonus_points, goal.bonus_xp, userId]
        );

        const [updatedUserRows] = await pool.query('SELECT level, xp FROM users WHERE id = ?', [userId]);
        const updatedUser = updatedUserRows[0];
        let userNewXp = updatedUser.xp;
        let userNewLevel = updatedUser.level;
        const xpNeeded = 100;
        
        while (userNewXp >= xpNeeded) {
            userNewLevel++;
            userNewXp -= xpNeeded;
        }
        await connection.query('UPDATE users SET level = ?, xp = ? WHERE id = ?', [userNewLevel, userNewXp, userId]);
        
        const notificationMessage =`Congratulations! You completed your goal and earned ${goal.bonus_points} points and ${goal.bonus_xp} XP!`;
        await connection.query('INSERT INTO notifications (user_id, message, link_url) VALUES (?, ?, ?)', [userId, notificationMessage, '/']);
        
        await connection.commit();
        res.json({ success: true, message: `Successfully claimed goal reward: ${goal.bonus_points} points and ${goal.bonus_xp} XP!` });
    } catch (error) {
        await connection.rollback();
        console.error("Error claiming goal reward:", error);
        res.status(500).json({ message: "An error occurred while claiming the goal reward." });
    } finally {
        connection.release();
    }
};

/**
 * دالة لجلب إشعارات المستخدم
 */
const getNotifications = async (req, res) => {
    try {
        const [notifications] = await pool.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY createdAt DESC LIMIT 10', [req.user.id]);
        res.json(notifications);
    } catch (error) { 
        res.status(500).json({ message: "Error fetching notifications." }); 
    }
};

/**
 * دالة لوضع علامة "مقروء" على إشعارات المستخدم
 */
const markNotificationsRead = async (req, res) => {
    try {
        await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
        res.json({ success: true });
    } catch (error) { 
        res.status(500).json({ message: "Error updating notifications." }); 
    }
};

module.exports = {
    getMyProfile,
    getLeaderboard,
    claimLuckyBox,
    checkAndAssignGoal,
    claimGoalReward,
    getNotifications,
    markNotificationsRead
};