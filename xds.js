// index.js

// --- الخطوة 1: تحميل متغيرات البيئة ---
require('dotenv').config();

// --- الخطوة 2: استدعاء المكتبات والملفات المحلية ---
const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// استيراد الدوال والمسارات من الملفات المقسمة
const { googleStrategyCallback, serializeUser, deserializeUser } = require('./controllers/authController');
const { checkAuthForPage, checkAdmin } = require('./middleware/auth');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const rewardRoutes = require('./routes/rewardRoutes');
const offerRoutes = require('./routes/offerRoutes');
const goalRoutes = require('./routes/goalRoutes');
const luckyBoxRoutes = require('./routes/luckyBoxRoutes');

// --- الخطوة 3: إعداد تطبيق Express ---
const app = express();
const PORT = 3000;
app.set('trust proxy', true);

// --- الخطوة 4: إعداد Middlewares ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Middleware لمنع التخزين المؤقت (Caching)
app.use((req, res, next) => {
    if (req.path.endsWith('.html') || req.path === '/') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

// إعدادات جلسة Express (Session)
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));

// --- Middleware للتعامل مع روابط الإحالة ---
app.use((req, res, next) => {
    if (req.query.ref) {
        req.session.referralCode = req.query.ref;
    }
    next();
});

// --- الخطوة 5: إعداد Passport.js ---
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    passReqToCallback: true
}, googleStrategyCallback));

passport.serializeUser(serializeUser);
passport.deserializeUser(deserializeUser);

// --- باقي الكود يبقى كما هو ---
// ... (مسارات الصفحات ومسارات الـ API) ...
// --- الخطوة 6: تحديد مسارات الصفحات (HTML Routes) ---

// الصفحة الرئيسية
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/index.html');
    } else {
        res.redirect('/login.html');
    }
});

// صفحات المستخدم
app.get('/index.html', checkAuthForPage, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/offers.html', checkAuthForPage, (req, res) => res.sendFile(path.join(__dirname, 'public', 'offers.html')));
app.get('/store.html', checkAuthForPage, (req, res) => res.sendFile(path.join(__dirname, 'public', 'store.html')));
app.get('/my_requests.html', checkAuthForPage, (req, res) => res.sendFile(path.join(__dirname, 'public', 'my_requests.html')));
app.get('/profile.html', checkAuthForPage, (req, res) => res.sendFile(path.join(__dirname, 'public', 'profile.html')));

// صفحات الأدمن
app.get('/admin', checkAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/admin_requests.html', checkAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin_requests.html')));
app.get('/admin_rewards.html', checkAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin_rewards.html')));
app.get('/admin_users.html', checkAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin_users.html')));
app.get('/admin_goals.html', checkAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin_goals.html')));
app.get('/admin_luckybox.html', checkAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin_luckybox.html'))); // إضافة صفحة Lucky Box

// صفحة تسجيل الدخول
app.get('/login.html', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/index.html');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

// --- الخطوة 7: ربط مسارات الـ API ---
app.use('/', authRoutes);
app.use('/api', userRoutes);
app.use('/api', rewardRoutes);
app.use('/api', offerRoutes);
app.use('/api/admin', checkAdmin, adminRoutes);
app.use('/api/admin', checkAdmin, goalRoutes);
app.use('/api/admin/luckybox', checkAdmin, luckyBoxRoutes); // إضافة مسارات Lucky Box للأدمن

// --- الخطوة 8: تشغيل الخادم ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});