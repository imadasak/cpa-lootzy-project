// controllers/offerController.js

const pool = require('../config/db');
const axios = require('axios');

/**
 * دالة لجلب العروض للمستخدم الحالي
 */
const getOffers = async (req, res) => {
    // --- بداية التعديل ---
    // تم حذف `const userIp = req.ip;` لأنه يسبب المشكلة
    
    // 1. جلب الرابط الأساسي من ملف .env
    let offerFeedURL = process.env.ADBLUE_OFFER_FEED_URL;

    // 2. التحقق من وجود الرابط
    if (!offerFeedURL) {
        console.error("ADBLUE_OFFER_FEED_URL is not defined in .env file");
        return res.status(500).json({ message: "Offer feed is not configured." });
    }

    // 3. إضافة معرف المستخدم (s1) فقط إلى نهاية الرابط
    // تم حذف إضافة عنوان IP من هنا
    offerFeedURL += `&s1=${req.user.id}`;
    
    // --- نهاية التعديل ---
    
    try {
        const response = await axios.get(offerFeedURL);
        let offers = response.data;

        // إزالة العروض المخفية من طرف الأدمن
        const [hiddenOffersRows] = await pool.query('SELECT offer_external_id FROM hidden_offers');
        const hiddenOfferIds = new Set(hiddenOffersRows.map(row => row.offer_external_id));
        
        if (Array.isArray(offers)) {
            offers = offers.filter(offer => !hiddenOfferIds.has(offer.offer_id));
        } else {
            console.warn("Offer feed did not return an array:", offers);
            offers = []; 
        }
        
        res.json(offers);
    } catch (error) {
        console.error("Error fetching offers:", error.message);
        res.status(500).json({ message: "Error fetching offers." });
    }
};

/**
 * دالة لمعالجة إشعارات إتمام العروض (Postback)
 * الأمان هنا يعتمد على أن الرابط الذي يستدعي هذه الدالة سري وغير معروف
 */
const handlePostback = async (req, res) => {
    // قراءة المتغيرات الأساسية من الرابط
    const { user_id, payout, s2 } = req.query;
    const transaction_id = s2; // استخدام s2 كرقم فريد للعملية

    // التحقق من وجود المتغيرات الضرورية
    if (!user_id || !payout || !transaction_id) {
        return res.status(400).send('Missing parameters');
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [users] = await connection.query('SELECT * FROM users WHERE id = ? FOR UPDATE', [user_id]);
        if (users.length === 0) {
            await connection.rollback();
            return res.status(404).send('User not found');
        }
        
        const user = users[0];
        const payoutValue = parseFloat(payout);

        if (payoutValue > 0) {
            await connection.query('INSERT INTO conversions (user_id, payout) VALUES (?, ?)', [user_id, payoutValue]);
        }

        let pointsToAdd = 0;
        let xpToAdd = 0;
        let updateFirstOffer = false;
        
        if (user.firstOfferCompleted === 0) {
            pointsToAdd = 1;
            updateFirstOffer = true;
        } else if (payoutValue >= 2.00) {
            pointsToAdd = 1;
        }
        
        if (payoutValue > 0) {
            xpToAdd = 10;
        }

        let newXp = user.xp + xpToAdd;
        let newLevel = user.level;
        const xpNeeded = 100;

        if (newXp >= xpNeeded) {
            newLevel++;
            newXp -= xpNeeded;
        }
        
        const sql = `UPDATE users SET points = points + ?, level = ?, xp = ?, firstOfferCompleted = ?, total_offers_completed = total_offers_completed + 1, current_goal_progress = current_goal_progress + 1 WHERE id = ?`;
        await connection.query(sql, [pointsToAdd, newLevel, newXp, updateFirstOffer || user.firstOfferCompleted, user_id]);
        
        if (updateFirstOffer && user.referred_by_user_id) {
            await connection.query('UPDATE users SET points = points + 0.5 WHERE id = ?', [user.referred_by_user_id]);
            const referrerNotificationMessage =  `You earned 0.5 points because your friend (${user.username}) completed their first offer!`;
            await connection.query('INSERT INTO notifications (user_id, message, link_url) VALUES (?, ?, ?)', [user.referred_by_user_id, referrerNotificationMessage, '/']);
        }
        
        const notificationMessage =`Congratulations! You earned ${pointsToAdd} point(s) and ${xpToAdd} XP.`;
        await connection.query('INSERT INTO notifications (user_id, message, link_url) VALUES (?, ?, ?)', [user_id, notificationMessage, '/']);
        
        await connection.commit();
        res.status(200).send('1');
    } catch (error) {
        await connection.rollback();
        console.error("Postback processing error:", error);
        res.status(500).send('Error');
    } finally {
        connection.release();
    }
};

module.exports = {
    getOffers,
    handlePostback
};