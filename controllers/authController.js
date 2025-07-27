// controllers/authController.js
const passport = require('passport');
const crypto = require('crypto');
const pool = require('../config/db');

const googleStrategyCallback = async (req, accessToken, refreshToken, profile, done) => {
    try {
        const googleId = profile.id;
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
        const username = profile.displayName;
        
        // --- ✨ بداية التعديل النهائي لرابط الصورة ---
        let avatarUrl = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null;
        if (avatarUrl) {
            // هذه الطريقة الجديدة أكثر دقة وتزيل أي لاحقة لتحديد حجم الصورة (مثل =s96-c)
            avatarUrl = avatarUrl.replace(/=s\d+-c$/, ''); 
        }
        // --- ✨ نهاية التعديل ---

        const [rows] = await pool.query('SELECT * FROM users WHERE googleId = ?', [googleId]);

        if (rows.length > 0) {
            // المستخدم موجود بالفعل، قم بتحديث بياناته بالصورة الصحيحة
            await pool.query('UPDATE users SET username = ?, avatar_url = ?, email = ? WHERE googleId = ?', [username, avatarUrl, email, googleId]);
            const [updatedUser] = await pool.query('SELECT * FROM users WHERE googleId = ?', [googleId]);
            return done(null, updatedUser[0]);
        } else {
            // مستخدم جديد، قم بإنشاء حساب جديد
            const referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
            let referredByUserId = null;

            if (req.session.referralCode) {
                const [referrerRows] = await pool.query('SELECT id FROM users WHERE referral_code = ?', [req.session.referralCode]);
                if (referrerRows.length > 0) {
                    referredByUserId = referrerRows[0].id;
                }
                delete req.session.referralCode;
            }

            const [result] = await pool.query(
                'INSERT INTO users (googleId, username, email, avatar_url, referral_code, referred_by_user_id) VALUES (?, ?, ?, ?, ?, ?)',
                [googleId, username, email, avatarUrl, referralCode, referredByUserId]
            );

            const [newUserRows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
            return done(null, newUserRows[0]);
        }
    } catch (err) {
        console.error("Authentication Error:", err);
        return done(err);
    }
};

// ... باقي الكود في الملف يبقى كما هو ...

const googleCallbackRedirect = (req, res) => {
    if (req.user && req.user.isAdmin) {
        res.redirect('/admin');
    } else {
        res.redirect('/index.html');
    }
};

const logout = (req, res, next) => {
    req.logout(err => {
        if (err) { return next(err); }
        req.session.destroy(err => {
            if (err) {
                console.error("Error destroying session on logout:", err);
                return next(err);
            }
            res.clearCookie('connect.sid');
            res.redirect('/login.html');
        });
    });
};

const serializeUser = (user, done) => done(null, user.id);

const deserializeUser = async (id, done) => {
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        done(null, rows[0]);
    } catch (err) {
        done(err);
    }
};

module.exports = {
    googleStrategyCallback,
    googleCallbackRedirect,
    logout,
    serializeUser,
    deserializeUser
};