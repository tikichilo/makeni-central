/**
 * server.js — Makeni Central SDA Church
 * Node.js + Express + MongoDB (Mongoose)
 *
 *  — Public endpoints —
 *  POST /api/donate                    — Give modal
 *  GET  /api/fund                      — Fund tracker stats
 *  GET  /api/discussions               — Youth board list
 *  POST /api/discussions               — Submit new discussion
 *  POST /api/discussions/:id/like      — Like a discussion
 *  POST /api/discussions/:id/dislike   — Dislike a discussion
 *  GET  /api/discussions/:id/comments  — List comments on a discussion
 *  POST /api/discussions/:id/comments  — Add a comment to a discussion
 *  GET  /api/lesson                    — Lesson of the week
 *  GET  /api/theme                     — Theme of the month
 *  GET  /api/announcements             — Active announcements
 *  POST /api/announcements/:id/react   — React to an announcement (amen/love/praise)
 *  POST /api/visits                    — Save a "Plan Your Visit" submission
 *  GET  /api/events                    — Upcoming events
 *  GET  /api/events/featured           — The single featured event (or null)
 *  GET  /api/recaps                    — Event recap galleries
 *  GET  /api/hero-slideshow            — Shuffled hero slideshow images
 *  GET  /api/gallery                   — Home page Gallery photos (optional ?category=)
 *  GET  /api/daily-lesson              — Daily lesson pulled from ssnet.org
 *  GET  /api/facebook-live             — Is the Facebook page live right now?
 *
 *  — Auth —
 *  POST /api/admin/login               — { password } -> { token }  (rate limited)
 *  GET  /api/admin/verify              — 200 if the Bearer token is still valid
 *
 *  — Admin endpoints (ALL require  Authorization: Bearer <token>) —
 *  GET    /api/donations             — List all donations
 *  DELETE /api/discussions/:id       — Delete a discussion
 *  POST   /api/fund/goal             — Update fundraising goal
 *  POST   /api/lesson                — Save lesson of the week
 *  POST   /api/theme                 — Save theme of the month
 *  POST   /api/announcements         — Add announcement (text, title, category, expiresAt)
 *  DELETE /api/announcements/:id     — Remove announcement
 *  DELETE /api/comments/:id          — Remove a comment
 *  GET    /api/visits                — List planned visits
 *  POST   /api/events                — Add event (multipart: poster + fields)
 *  PATCH  /api/events/:id/feature    — Mark an event as the featured one
 *  DELETE /api/events/:id            — Remove an event
 *  POST   /api/recaps                — Add event recap (multipart: up to 10 images + fields)
 *  DELETE /api/recaps/:id            — Remove a recap
 *  POST   /api/gallery               — Add Gallery photo (multipart: photo + title + category)
 *  DELETE /api/gallery/:id           — Remove a Gallery photo
 *
 *  — Required environment variables —
 *  MONGO_URI              MongoDB connection string
 *  ADMIN_PASSWORD         Password for the admin dashboard (use a long one)
 *  ADMIN_TOKEN_SECRET     Long random string used to sign admin tokens
 *                         (generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
 *  — Optional —
 *  ALLOWED_ORIGINS        Comma-separated list of extra origins allowed to call the API
 *                         (only needed if a frontend is hosted on a DIFFERENT domain)
 *  FACEBOOK_PAGE_ID, FACEBOOK_ACCESS_TOKEN, PORT, NODE_ENV
 */

'use strict';

require('dotenv').config();

const path      = require('path');
const fs        = require('fs');
const crypto    = require('crypto');
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const multer    = require('multer');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const cheerio   = require('cheerio');

const app  = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const ADMIN_PASSWORD     = process.env.ADMIN_PASSWORD     || '';
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || '';
const ADMIN_TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // admin stays logged in for 8 hours
const ADMIN_CONFIGURED   = Boolean(ADMIN_PASSWORD && ADMIN_TOKEN_SECRET);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

if (!ADMIN_CONFIGURED) {
  console.warn('⚠ ADMIN_PASSWORD and/or ADMIN_TOKEN_SECRET not set — all admin routes are DISABLED until you set them.');
}
if (ADMIN_TOKEN_SECRET && ADMIN_TOKEN_SECRET.length < 32) {
  console.warn('⚠ ADMIN_TOKEN_SECRET is short — use at least 32 random characters.');
}

process.on('unhandledRejection', reason => {
  console.error('Unhandled promise rejection:', reason);
});


/* ═══════════════════════════════════════════════
   SECURITY MIDDLEWARE
═══════════════════════════════════════════════ */

// Render (and most hosts) sit behind a reverse proxy. Without this,
// every visitor looks like the same IP and rate limiting breaks.
app.set('trust proxy', 1);

// Security headers (HSTS, nosniff, frame protection, no X-Powered-By…).
// CSP is OFF for now because the pages likely use inline scripts/styles and
// third-party embeds — turning it on blind would break the site. See the
// notes that came with this file for how to roll a CSP out safely.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS: the frontend is served by this same server, so same-origin calls
// need no CORS at all. Only origins you list in ALLOWED_ORIGINS (plus
// localhost outside production) may call the API from another site.
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // same-origin, curl, server-to-server
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    if (!IS_PROD && LOCAL_ORIGIN.test(origin)) return cb(null, true);
    return cb(null, false);
  },
}));

// Small body limit — nothing here needs more than a few KB of JSON
// (images go through multer, not this parser).
app.use(express.json({ limit: '20kb' }));

// ── Rate limiting ──
const rlMessage = text => ({ error: text });
const rlBase = { standardHeaders: true, legacyHeaders: false };

// Blanket limit for every /api call, per IP
const apiLimiter = rateLimit({
  ...rlBase, windowMs: 15 * 60 * 1000, limit: 1500,
  message: rlMessage('Too many requests — please slow down.'),
});
// Brute-force protection for the admin password
const loginLimiter = rateLimit({
  ...rlBase, windowMs: 15 * 60 * 1000, limit: 8,
  message: rlMessage('Too many login attempts — try again in 15 minutes.'),
});
// Public things that create data (donations, discussions, comments, visits)
const writeLimiter = rateLimit({
  ...rlBase, windowMs: 10 * 60 * 1000, limit: 40,
  message: rlMessage('Too many submissions — please try again in a few minutes.'),
});
// Likes / dislikes / reactions
const reactLimiter = rateLimit({
  ...rlBase, windowMs: 60 * 1000, limit: 40,
  message: rlMessage('Too many reactions — please slow down.'),
});

app.use('/api', apiLimiter);

// Every :id in a route must be a real 24-char hex ObjectId. This also
// stops malformed ids from causing 500 CastErrors.
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const isObjectId = v => typeof v === 'string' && OBJECT_ID_RE.test(v);
app.param('id', (req, res, next, id) => {
  if (!isObjectId(id)) return res.status(400).json({ error: 'Invalid id' });
  next();
});


/* ═══════════════════════════════════════════════
   INPUT HELPERS
═══════════════════════════════════════════════ */

// Returns a clean string: must be a string, control characters removed,
// HTML tags stripped, trimmed, length-capped. Anything else becomes ''.
// (Your frontend should STILL render user text with textContent, not
// innerHTML — this is a second layer of defence, not a replacement.)
function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<[a-zA-Z\/!?][^>]*>?/g, '')
    .trim()
    .slice(0, max);
}

// Accepts only a finite number (or numeric string) — rejects objects,
// arrays, NaN and Infinity.
function toFiniteNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return NaN;
  if (typeof value === 'string' && value.trim() === '') return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\/[^\s]+$/i.test(value);
}


/* ═══════════════════════════════════════════════
   ADMIN AUTH — password login -> signed, expiring token
   No extra packages: uses Node's built-in crypto.
═══════════════════════════════════════════════ */
function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}

// Constant-time string comparison (hashing first makes lengths equal)
function safeEqual(a, b) {
  return crypto.timingSafeEqual(sha256(a), sha256(b));
}

function signToken() {
  const exp = String(Date.now() + ADMIN_TOKEN_TTL_MS);
  const sig = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(exp).digest('base64url');
  return `${exp}.${sig}`;
}

function verifyToken(token) {
  if (typeof token !== 'string') return false;
  const [expStr, sig] = token.split('.');
  if (!expStr || !sig) return false;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  const expected = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(expStr).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Put this BEFORE any multer middleware so strangers can't upload files.
function requireAdmin(req, res, next) {
  if (!ADMIN_CONFIGURED) {
    return res.status(503).json({ error: 'Admin access is not configured on the server' });
  }
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.set('Cache-Control', 'no-store');
  next();
}

app.post('/api/admin/login', loginLimiter, (req, res) => {
  if (!ADMIN_CONFIGURED) {
    return res.status(503).json({ error: 'Admin access is not configured on the server' });
  }
  const password = typeof (req.body || {}).password === 'string' ? req.body.password : '';
  if (!password || !safeEqual(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  res.set('Cache-Control', 'no-store');
  res.json({ token: signToken(), expiresInMs: ADMIN_TOKEN_TTL_MS });
});

app.get('/api/admin/verify', requireAdmin, (req, res) => {
  res.json({ ok: true });
});


/* ═══════════════════════════════════════════════
   STATIC FRONTEND FILES
   Anything inside /public is world-readable — never put .env files,
   database backups or private documents in there.
═══════════════════════════════════════════════ */
app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'ignore' }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


/* ═══════════════════════════════════════════════
   UPLOADS (event posters + recap gallery images + gallery photos)
   Stored under public/uploads/... so express.static above serves them
   directly at /uploads/events/<file>, /uploads/recaps/<file>, and
   /uploads/gallery/<file>. Uploads are admin-only, restricted to
   JPG/PNG/WEBP, max 5MB, and the real file contents are checked
   (not just the label the browser sends) before they are kept.
═══════════════════════════════════════════════ */
const UPLOAD_ROOT        = path.join(__dirname, 'public', 'uploads');
const EVENT_UPLOAD_DIR   = path.join(UPLOAD_ROOT, 'events');
const RECAP_UPLOAD_DIR   = path.join(UPLOAD_ROOT, 'recaps');
const GALLERY_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'gallery');
[EVENT_UPLOAD_DIR, RECAP_UPLOAD_DIR, GALLERY_UPLOAD_DIR].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

// Hero slideshow images — dropped in manually (not via multer upload),
// but the folder still needs to exist or GET /api/hero-slideshow below
// throws ENOENT on the very first request.
const SLIDESHOW_DIR = path.join(__dirname, 'public', 'slideshow');
fs.mkdirSync(SLIDESHOW_DIR, { recursive: true });

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function makeStorage(dir) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
      // Random name from the server — the visitor's filename is never used on disk
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`);
    },
  });
}

function imageFileFilter(req, file, cb) {
  if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
    const err = new Error('Only JPG, PNG, and WEBP images are allowed');
    err.code = 'INVALID_FILE_TYPE';
    return cb(err);
  }
  cb(null, true);
}

const uploadEventPoster = multer({
  storage: makeStorage(EVENT_UPLOAD_DIR),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB
});

const uploadRecapImages = multer({
  storage: makeStorage(RECAP_UPLOAD_DIR),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 }, // 5MB each, 10 max
});

const uploadGalleryPhoto = multer({
  storage: makeStorage(GALLERY_UPLOAD_DIR),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB
});

// Looks at the first bytes of the file to confirm it really is a
// JPEG / PNG / WEBP (the browser-supplied mimetype can be faked).
function detectImageType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

async function fileLooksLikeImage(filePath) {
  let handle;
  try {
    handle = await fs.promises.open(filePath, 'r');
    const buf = Buffer.alloc(12);
    await handle.read(buf, 0, 12, 0);
    return detectImageType(buf) !== null;
  } catch (err) {
    return false;
  } finally {
    if (handle) await handle.close();
  }
}

// Runs right after multer. If any saved file isn't a genuine image,
// every file from this request is deleted and the request is rejected.
function verifyUploadedImages(req, res, next) {
  const files = req.files || (req.file ? [req.file] : []);
  Promise.all(files.map(f => fileLooksLikeImage(f.path)))
    .then(results => {
      if (results.every(Boolean)) return next();
      files.forEach(f => fs.unlink(f.path, () => {}));
      res.status(400).json({ error: 'Only real JPG, PNG, and WEBP images are allowed' });
    })
    .catch(next);
}

// Best-effort file deletion — never throws, just logs if it fails
// (e.g. file already gone). Used when deleting events/recaps/gallery photos.
// Refuses to touch anything outside public/uploads.
function deleteUploadedFile(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return;
  const filePath = path.join(__dirname, 'public', publicUrl);
  if (!filePath.startsWith(UPLOAD_ROOT + path.sep)) {
    console.warn('Refused to delete file outside uploads folder:', publicUrl);
    return;
  }
  fs.unlink(filePath, err => {
    if (err && err.code !== 'ENOENT') {
      console.warn('Could not delete uploaded file:', filePath, err.message);
    }
  });
}


/* ═══════════════════════════════════════════════
   MONGODB CONNECTION
   Non-fatal on failure — the server keeps running and serving
   static pages (like leaders.html) even if the DB is unreachable.
   Any /api routes that touch the DB will simply return a 500 error
   until MongoDB reconnects.
═══════════════════════════════════════════════ */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✦ MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    console.warn('⚠ Continuing without a database connection — static pages will still work, but any /api routes that touch the DB will fail until MongoDB reconnects.');
  });

// Keep the process alive and log if the connection drops later too
mongoose.connection.on('error', err => {
  console.error('MongoDB runtime error:', err.message);
});
mongoose.connection.on('disconnected', () => {
  console.warn('⚠ MongoDB disconnected — API routes needing the DB will fail until it reconnects.');
});


/* ═══════════════════════════════════════════════
   SCHEMAS & MODELS
═══════════════════════════════════════════════ */

// ── Donation ──
const donationSchema = new mongoose.Schema({
  amount:    { type: Number, required: true, min: 1 },
  currency:  { type: String, default: 'ZMW', maxlength: 3 },
  createdAt: { type: Date,   default: Date.now },
});
const Donation = mongoose.model('Donation', donationSchema);


// ── Fund — single document ──
const fundSchema = new mongoose.Schema({
  raised: { type: Number, default: 0 },
  goal:   { type: Number, default: 500000 },
  donors: { type: Number, default: 0 },
});
const Fund = mongoose.model('Fund', fundSchema);


// ── Discussion ──
const discussionSchema = new mongoose.Schema({
  name:      { type: String, required: true, maxlength: 100 },
  category:  { type: String, required: true, maxlength: 60  },
  title:     { type: String, required: true, maxlength: 100 },
  body:      { type: String, required: true, maxlength: 1000 },
  likes:     { type: Number, default: 0 },
  dislikes:  { type: Number, default: 0 },
  comments:  { type: Number, default: 0 },
  createdAt: { type: Date,   default: Date.now },
});
const Discussion = mongoose.model('Discussion', discussionSchema);


// ── Comment — replies on a Discussion ──
const commentSchema = new mongoose.Schema({
  discussionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Discussion', required: true, index: true },
  parentCommentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null, index: true },
  name:         { type: String, required: true, maxlength: 100 },
  body:         { type: String, required: true, maxlength: 500 },
  createdAt:    { type: Date,   default: Date.now },
});
const Comment = mongoose.model('Comment', commentSchema);


// ── Lesson — single active document ──
const lessonSchema = new mongoose.Schema({
  title:     { type: String, required: true, maxlength: 100 },
  verse:     { type: String, default: '',    maxlength: 200 },
  body:      { type: String, required: true, maxlength: 1000 },
  url:       { type: String, default: '',    maxlength: 500 },
  updatedAt: { type: Date,   default: Date.now },
});
const Lesson = mongoose.model('Lesson', lessonSchema);


// ── Theme — single active document ──
const themeSchema = new mongoose.Schema({
  heading:   { type: String, required: true, maxlength: 60 },
  ref:       { type: String, default: '',    maxlength: 40 },
  body:      { type: String, default: '',    maxlength: 300 },
  updatedAt: { type: Date,   default: Date.now },
});
const Theme = mongoose.model('Theme', themeSchema);


// ── Announcement ──
// title/category are optional additions on top of your original `text`
// field — fully backward compatible. Existing text-only announcements
// keep working; the news page derives a title from `text` when `title`
// is blank, and treats a blank `category` as "general".
const ANNOUNCEMENT_REACTION_KEYS = ['amen', 'love', 'praise'];

const announcementSchema = new mongoose.Schema({
  text:      { type: String, required: true, maxlength: 200 },
  title:     { type: String, default: '',        maxlength: 100 },
  category:  { type: String, default: 'general', maxlength: 40, lowercase: true, trim: true },
  expiresAt: { type: Date,   default: null },
  reactions: {
    amen:   { type: Number, default: 0, min: 0 },
    love:   { type: Number, default: 0, min: 0 },
    praise: { type: Number, default: 0, min: 0 },
  },
  createdAt: { type: Date,   default: Date.now },
});
const Announcement = mongoose.model('Announcement', announcementSchema);


// ── Visit — "Plan Your Visit" modal submissions ──
const visitSchema = new mongoose.Schema({
  date:      { type: Date,   required: true },
  service:   { type: String, required: true, maxlength: 60  }, // e.g. "Divine Service"
  time:      { type: String, default: '',    maxlength: 60  }, // e.g. "11:00 AM"
  name:      { type: String, default: '',    maxlength: 100 },
  phone:     { type: String, default: '',    maxlength: 20  }, // e.g. "0977 123 456"
  createdAt: { type: Date,   default: Date.now },
});
const Visit = mongoose.model('Visit', visitSchema);


// Allowed values, kept in sync with the service buttons in index.html
const VISIT_SERVICES = ['Sabbath School', 'Divine Service', 'Bible Study', 'Full Day'];
const VISIT_NEEDS     = ['prayer', 'welcome', 'kids', 'transport'];


// ── Event — Upcoming Events + Featured Event on news.html ──
const eventSchema = new mongoose.Schema({
  title:     { type: String,  required: true, maxlength: 120 },
  posterUrl: { type: String,  default: '' },                  // /uploads/events/<file>
  date:      { type: Date,    required: true },
  time:      { type: String,  default: '',    maxlength: 60  }, // e.g. "09:00 AM – 04:00 PM"
  location:  { type: String,  default: '',    maxlength: 150 },
  info:      { type: String,  default: '',    maxlength: 1000 },
  featured:  { type: Boolean, default: false },                 // only one should be true at a time
  createdAt: { type: Date,    default: Date.now },
});
const Event = mongoose.model('Event', eventSchema);


// ── Recap — Event Recaps gallery on news.html ──
const recapSchema = new mongoose.Schema({
  title:       { type: String, required: true, maxlength: 120 },
  description: { type: String, default: '',    maxlength: 1000 },
  images: {
    type: [String],   // /uploads/recaps/<file>, up to 10
    default: [],
    validate: {
      validator: arr => arr.length > 0 && arr.length <= 10,
      message: 'A recap needs between 1 and 10 images',
    },
  },
  createdAt: { type: Date, default: Date.now },
});
const Recap = mongoose.model('Recap', recapSchema);


// ── GalleryPhoto — home page "Moments of Grace" gallery ──
// One document per photo (not grouped into albums like Recap) so each
// tile on the home page can be filtered independently by category.
const GALLERY_CATEGORIES = ['worship', 'youth', 'community', 'baptism', 'events'];

const galleryPhotoSchema = new mongoose.Schema({
  title:     { type: String, required: true, maxlength: 120 },
  category:  { type: String, required: true, enum: GALLERY_CATEGORIES },
  imageUrl:  { type: String, required: true }, // /uploads/gallery/<file>
  createdAt: { type: Date,   default: Date.now },
});
const GalleryPhoto = mongoose.model('GalleryPhoto', galleryPhotoSchema);


/* ═══════════════════════════════════════════════
   ROUTES — PUBLIC
═══════════════════════════════════════════════ */

// ── POST /api/donate ──
// NOTE: this only RECORDS what the visitor says they gave. Nothing here
// verifies a real payment, so treat the fund total as "pledged" unless
// you connect a payment/mobile-money confirmation.
const MAX_DONATION = 1000000;

app.post('/api/donate', writeLimiter, async (req, res) => {
  try {
    const { amount, currency } = req.body || {};

    const value = toFiniteNumber(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    if (value > MAX_DONATION) {
      return res.status(400).json({ error: 'Amount is too large' });
    }
    const rounded = Math.round(value * 100) / 100;

    const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
    const safeCurrency = /^[A-Z]{3}$/.test(code) ? code : 'ZMW';

    const donation = await Donation.create({ amount: rounded, currency: safeCurrency });

    await Fund.findOneAndUpdate(
      {},
      { $inc: { raised: rounded, donors: 1 } },
      { upsert: true, new: true }
    );

    res.status(201).json({ success: true, id: donation._id });

  } catch (err) {
    console.error('POST /api/donate:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── GET /api/fund ──
app.get('/api/fund', async (req, res) => {
  try {
    let fund = await Fund.findOne();
    if (!fund) fund = await Fund.create({ raised: 0, goal: 500000, donors: 0 });

    res.json({ raised: fund.raised, goal: fund.goal, donors: fund.donors });

  } catch (err) {
    console.error('GET /api/fund:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── GET /api/discussions ──
app.get('/api/discussions', async (req, res) => {
  try {
    // Only a plain string is accepted — blocks ?category[$ne]=x style injection
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const filter = category && category !== 'all' ? { category } : {};

    const discussions = await Discussion
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();

    res.json(discussions);

  } catch (err) {
    console.error('GET /api/discussions:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/discussions ──
app.post('/api/discussions', writeLimiter, async (req, res) => {
  try {
    const b = req.body || {};
    const name     = cleanText(b.name, 100);
    const category = cleanText(b.category, 60);
    const title    = cleanText(b.title, 100);
    const body     = cleanText(b.body, 1000);

    if (!name || !category || !title || !body) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const discussion = await Discussion.create({ name, category, title, body });

    res.status(201).json({ success: true, id: discussion._id });

  } catch (err) {
    console.error('POST /api/discussions:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/discussions/:id/like ──
app.post('/api/discussions/:id/like', reactLimiter, async (req, res) => {
  try {
    const discussion = await Discussion.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );

    if (!discussion) return res.status(404).json({ error: 'Not found' });

    res.json({ likes: discussion.likes });

  } catch (err) {
    console.error('POST /api/discussions/:id/like:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/discussions/:id/dislike ──
app.post('/api/discussions/:id/dislike', reactLimiter, async (req, res) => {
  try {
    const discussion = await Discussion.findByIdAndUpdate(
      req.params.id,
      { $inc: { dislikes: 1 } },
      { new: true }
    );

    if (!discussion) return res.status(404).json({ error: 'Not found' });

    res.json({ dislikes: discussion.dislikes });

  } catch (err) {
    console.error('POST /api/discussions/:id/dislike:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── GET /api/discussions/:id/comments ──
// Oldest first, so a reply thread reads top-to-bottom naturally.
app.get('/api/discussions/:id/comments', async (req, res) => {
  try {
    const comments = await Comment
      .find({ discussionId: req.params.id })
      .sort({ createdAt: 1 })
      .limit(1000)
      .lean();

    res.json(comments);

  } catch (err) {
    console.error('GET /api/discussions/:id/comments:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/discussions/:id/comments ──
app.post('/api/discussions/:id/comments', writeLimiter, async (req, res) => {
  try {
    const b = req.body || {};
    const name = cleanText(b.name, 100);
    const body = cleanText(b.body, 500);

    if (!name || !body) {
      return res.status(400).json({ error: 'Name and comment are required' });
    }

    const discussionExists = await Discussion.exists({ _id: req.params.id });
    if (!discussionExists) return res.status(404).json({ error: 'Discussion not found' });

    let parentId = null;
    const { parentCommentId } = b;
    if (parentCommentId !== undefined && parentCommentId !== null && parentCommentId !== '') {
      if (!isObjectId(parentCommentId)) {
        return res.status(400).json({ error: 'Invalid parent comment' });
      }
      const parent = await Comment.findOne({
        _id: parentCommentId,
        discussionId: req.params.id,
      });
      if (!parent) return res.status(400).json({ error: 'Parent comment not found' });
      parentId = parent._id;
    }

    const comment = await Comment.create({
      discussionId: req.params.id,
      parentCommentId: parentId,
      name,
      body,
    });

    const discussion = await Discussion.findByIdAndUpdate(
      req.params.id,
      { $inc: { comments: 1 } },
      { new: true }
    );

    res.status(201).json({ success: true, comment, commentCount: discussion.comments });

  } catch (err) {
    console.error('POST /api/discussions/:id/comments:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── GET /api/lesson ──
// Returns the latest lesson with the latest theme bundled as `theme`.
app.get('/api/lesson', async (req, res) => {
  try {
    const lesson = await Lesson.findOne().sort({ updatedAt: -1 }).lean();
    const theme  = await Theme.findOne().sort({ updatedAt: -1 }).lean();

    if (!lesson) return res.json(null);

    res.json({ ...lesson, theme: theme || null });

  } catch (err) {
    console.error('GET /api/lesson:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── GET /api/theme ──
app.get('/api/theme', async (req, res) => {
  try {
    const theme = await Theme.findOne().sort({ updatedAt: -1 }).lean();
    res.json(theme || null);

  } catch (err) {
    console.error('GET /api/theme:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── GET /api/announcements ──
// Only returns announcements that have not expired.
app.get('/api/announcements', async (req, res) => {
  try {
    const now = new Date();
    const announcements = await Announcement
      .find({ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json(announcements);

  } catch (err) {
    console.error('GET /api/announcements:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/announcements/:id/react ──
// Increments/decrements a reaction counter. No user accounts exist yet,
// so this trusts the client's `active` flag (toggle on/off) rather than
// tracking who reacted — matches the news.html frontend, which already
// tracks each visitor's own toggle state in localStorage and just tells
// the server whether to add or remove one from the count. Rate limiting
// keeps the counts from being spammed. Decrements never go below 0.
app.post('/api/announcements/:id/react', reactLimiter, async (req, res) => {
  try {
    const { reaction, active } = req.body || {};

    if (typeof reaction !== 'string' || !ANNOUNCEMENT_REACTION_KEYS.includes(reaction)) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    const field = `reactions.${reaction}`;
    const adding = active === true || active === 'true';
    let ann;

    if (adding) {
      ann = await Announcement.findByIdAndUpdate(
        req.params.id,
        { $inc: { [field]: 1 } },
        { new: true }
      );
    } else {
      // Only decrement when the counter is above zero (atomic — no clamp step needed)
      ann = await Announcement.findOneAndUpdate(
        { _id: req.params.id, [field]: { $gt: 0 } },
        { $inc: { [field]: -1 } },
        { new: true }
      );
      if (!ann) ann = await Announcement.findById(req.params.id);
    }

    if (!ann) return res.status(404).json({ error: 'Not found' });

    res.json({ success: true, reactions: ann.reactions });

  } catch (err) {
    console.error('POST /api/announcements/:id/react:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/visits ──
// Saves a "Plan Your Visit" submission: date, service, name, phone.
app.post('/api/visits', writeLimiter, async (req, res) => {
  try {
    const { date, service, time, name, phone } = req.body || {};

    if (!date || typeof date !== 'string' || !service || typeof service !== 'string') {
      return res.status(400).json({ error: 'Date and service are required' });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    if (!VISIT_SERVICES.includes(service)) {
      return res.status(400).json({ error: 'Invalid service' });
    }

    const safePhone = typeof phone === 'string'
      ? phone.replace(/[^\d+()\-\s]/g, '').trim().slice(0, 20)
      : '';

    const visit = await Visit.create({
      date:    parsedDate,
      service,
      time:    cleanText(time, 60),
      name:    cleanText(name, 100),
      phone:   safePhone,
    });

    res.status(201).json({ success: true, id: visit._id });

  } catch (err) {
    console.error('POST /api/visits:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── GET /api/events ──
// Upcoming events only, soonest first — matches the "Upcoming Events"
// grid on news.html. Past events simply stop appearing once their
// date passes; nothing needs to delete them.
app.get('/api/events', async (req, res) => {
  try {
    const now = new Date();
    const events = await Event
      .find({ date: { $gte: now } })
      .sort({ date: 1 })
      .limit(200)
      .lean();

    res.json(events);

  } catch (err) {
    console.error('GET /api/events:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── GET /api/events/featured ──
// The single event currently marked featured (if any, and if it's
// still upcoming) — feeds the Featured Event section on news.html.
app.get('/api/events/featured', async (req, res) => {
  try {
    const event = await Event
      .findOne({ featured: true, date: { $gte: new Date() } })
      .sort({ date: 1 })
      .lean();

    res.json(event || null);

  } catch (err) {
    console.error('GET /api/events/featured:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── GET /api/recaps ──
// Newest recap galleries first.
app.get('/api/recaps', async (req, res) => {
  try {
    const recaps = await Recap.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json(recaps);

  } catch (err) {
    console.error('GET /api/recaps:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── GET /api/hero-slideshow ──
// Reads public/slideshow/ and returns a freshly shuffled array of
// image URLs for whatever standard-format photos are sitting in that
// folder — a new random order on every request. Drop photos in as
// .jpg/.jpeg/.png/.webp/.gif and they show up automatically, no code
// changes needed.
const HERO_SLIDESHOW_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function shuffleHeroImages(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

app.get('/api/hero-slideshow', async (req, res) => {
  try {
    const entries = await fs.promises.readdir(SLIDESHOW_DIR, { withFileTypes: true });

    const urls = entries
      .filter(e => e.isFile() && HERO_SLIDESHOW_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
      .map(e => '/slideshow/' + encodeURIComponent(e.name));

    // Never cache this response — a fresh shuffle every page load is
    // the whole point.
    res.set('Cache-Control', 'no-store');
    res.json({ images: shuffleHeroImages(urls) });

  } catch (err) {
    console.error('GET /api/hero-slideshow:', err);
    res.status(500).json({ images: [] });
  }
});


// ── GET /api/gallery ──
// Home page "Moments of Grace" gallery photos, newest first.
// Optional ?category=worship|youth|community|baptism|events filters;
// omit (or pass "all") to get everything.
app.get('/api/gallery', async (req, res) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const filter = category && category !== 'all' ? { category } : {};

    const photos = await GalleryPhoto.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    res.json(photos);

  } catch (err) {
    console.error('GET /api/gallery:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


/* ═══════════════════════════════════════════════
   ROUTES — ADMIN (every route below requires a valid admin token)
═══════════════════════════════════════════════ */

// ── GET /api/donations ──
app.get('/api/donations', requireAdmin, async (req, res) => {
  try {
    const donations = await Donation.find().sort({ createdAt: -1 }).limit(2000).lean();
    res.json(donations);

  } catch (err) {
    console.error('GET /api/donations:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── GET /api/visits ──
// Lists planned visits, soonest upcoming first; optional ?upcoming=true
// filters out past dates so the admin only sees what's still ahead.
// Contains visitor names + phone numbers, so it is admin-only.
app.get('/api/visits', requireAdmin, async (req, res) => {
  try {
    const { upcoming } = req.query;
    const filter = upcoming === 'true'
      ? { date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
      : {};

    const visits = await Visit.find(filter).sort({ date: 1 }).limit(2000).lean();
    res.json(visits);

  } catch (err) {
    console.error('GET /api/visits:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── DELETE /api/discussions/:id ──
app.delete('/api/discussions/:id', requireAdmin, async (req, res) => {
  try {
    const discussion = await Discussion.findByIdAndDelete(req.params.id);

    if (!discussion) return res.status(404).json({ error: 'Not found' });

    // Clean up any comments left orphaned by this discussion
    await Comment.deleteMany({ discussionId: req.params.id });

    res.json({ success: true });

  } catch (err) {
    console.error('DELETE /api/discussions/:id:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── DELETE /api/comments/:id ──
app.delete('/api/comments/:id', requireAdmin, async (req, res) => {
  try {
    const comment = await Comment.findByIdAndDelete(req.params.id);

    if (!comment) return res.status(404).json({ error: 'Not found' });

    await Discussion.findByIdAndUpdate(comment.discussionId, { $inc: { comments: -1 } });

    res.json({ success: true });

  } catch (err) {
    console.error('DELETE /api/comments/:id:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/fund/goal ──
app.post('/api/fund/goal', requireAdmin, async (req, res) => {
  try {
    const goal = toFiniteNumber((req.body || {}).goal);

    if (!Number.isFinite(goal) || goal <= 0 || goal > 1e9) {
      return res.status(400).json({ error: 'Invalid goal amount' });
    }

    const fund = await Fund.findOneAndUpdate(
      {},
      { $set: { goal } },
      { upsert: true, new: true }
    );

    res.json({ success: true, goal: fund.goal });

  } catch (err) {
    console.error('POST /api/fund/goal:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/lesson ──
// Always replaces — only one lesson is active at a time.
app.post('/api/lesson', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const title = cleanText(b.title, 100);
    const verse = cleanText(b.verse, 200);
    const body  = cleanText(b.body, 1000);
    const url   = typeof b.url === 'string' ? b.url.trim() : '';

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }
    if (url && (!isHttpUrl(url) || url.length > 500)) {
      return res.status(400).json({ error: 'URL must start with http:// or https://' });
    }

    await Lesson.deleteMany({});
    await Lesson.create({ title, verse, body, url });

    res.json({ success: true });

  } catch (err) {
    console.error('POST /api/lesson:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/theme ──
// Always replaces — only one theme is active at a time.
app.post('/api/theme', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const heading = cleanText(b.heading, 60);

    if (!heading) {
      return res.status(400).json({ error: 'Heading is required' });
    }

    await Theme.deleteMany({});
    await Theme.create({
      heading,
      ref:  cleanText(b.ref, 40),
      body: cleanText(b.body, 300),
    });

    res.json({ success: true });

  } catch (err) {
    console.error('POST /api/theme:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/announcements ──
app.post('/api/announcements', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const text = cleanText(b.text, 200);

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    let expiresAt = null;
    if (b.expiresAt) {
      expiresAt = new Date(b.expiresAt);
      if (typeof b.expiresAt !== 'string' || isNaN(expiresAt.getTime())) {
        return res.status(400).json({ error: 'Invalid expiry date' });
      }
    }

    const ann = await Announcement.create({
      text,
      title:    cleanText(b.title, 100),
      category: cleanText(b.category, 40).toLowerCase() || 'general',
      expiresAt,
    });

    res.status(201).json({ success: true, id: ann._id });

  } catch (err) {
    console.error('POST /api/announcements:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── DELETE /api/announcements/:id ──
app.delete('/api/announcements/:id', requireAdmin, async (req, res) => {
  try {
    const ann = await Announcement.findByIdAndDelete(req.params.id);

    if (!ann) return res.status(404).json({ error: 'Not found' });

    res.json({ success: true });

  } catch (err) {
    console.error('DELETE /api/announcements/:id:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/events ──
// multipart/form-data: fields (title, date, time, location, info) +
// a single `poster` file. Poster is optional — an event without one
// just renders without a cover image on the frontend.
app.post('/api/events', requireAdmin, uploadEventPoster.single('poster'), verifyUploadedImages, async (req, res) => {
  try {
    const b = req.body || {};
    const title = cleanText(b.title, 120);

    if (!title || !b.date || typeof b.date !== 'string') {
      if (req.file) deleteUploadedFile(`/uploads/events/${req.file.filename}`);
      return res.status(400).json({ error: 'Title and date are required' });
    }

    const parsedDate = new Date(b.date);
    if (isNaN(parsedDate.getTime())) {
      if (req.file) deleteUploadedFile(`/uploads/events/${req.file.filename}`);
      return res.status(400).json({ error: 'Invalid date' });
    }

    const event = await Event.create({
      title,
      posterUrl: req.file ? `/uploads/events/${req.file.filename}` : '',
      date:      parsedDate,
      time:      cleanText(b.time, 60),
      location:  cleanText(b.location, 150),
      info:      cleanText(b.info, 1000),
    });

    res.status(201).json({ success: true, id: event._id });

  } catch (err) {
    console.error('POST /api/events:', err);
    if (req.file) deleteUploadedFile(`/uploads/events/${req.file.filename}`);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── PATCH /api/events/:id/feature ──
// Marks one event as featured, unmarking any other — only one event
// can be featured at a time, matching the single Featured Event section.
app.patch('/api/events/:id/feature', requireAdmin, async (req, res) => {
  try {
    const exists = await Event.exists({ _id: req.params.id });
    if (!exists) return res.status(404).json({ error: 'Not found' });

    await Event.updateMany({}, { $set: { featured: false } });
    await Event.findByIdAndUpdate(req.params.id, { $set: { featured: true } });

    res.json({ success: true });

  } catch (err) {
    console.error('PATCH /api/events/:id/feature:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── DELETE /api/events/:id ──
app.delete('/api/events/:id', requireAdmin, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);

    if (!event) return res.status(404).json({ error: 'Not found' });

    deleteUploadedFile(event.posterUrl);

    res.json({ success: true });

  } catch (err) {
    console.error('DELETE /api/events/:id:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/recaps ──
// multipart/form-data: fields (title, description) + up to 10 files
// under the `images` field. At least one image is required.
app.post('/api/recaps', requireAdmin, uploadRecapImages.array('images', 10), verifyUploadedImages, async (req, res) => {
  try {
    const b = req.body || {};
    const title = cleanText(b.title, 120);

    if (!title) {
      (req.files || []).forEach(f => deleteUploadedFile(`/uploads/recaps/${f.filename}`));
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!req.files || !req.files.length) {
      return res.status(400).json({ error: 'At least one image is required' });
    }

    const images = req.files.map(f => `/uploads/recaps/${f.filename}`);

    const recap = await Recap.create({
      title,
      description: cleanText(b.description, 1000),
      images,
    });

    res.status(201).json({ success: true, id: recap._id });

  } catch (err) {
    console.error('POST /api/recaps:', err);
    (req.files || []).forEach(f => deleteUploadedFile(`/uploads/recaps/${f.filename}`));
    res.status(500).json({ error: 'Server error' });
  }
});


// ── DELETE /api/recaps/:id ──
app.delete('/api/recaps/:id', requireAdmin, async (req, res) => {
  try {
    const recap = await Recap.findByIdAndDelete(req.params.id);

    if (!recap) return res.status(404).json({ error: 'Not found' });

    (recap.images || []).forEach(deleteUploadedFile);

    res.json({ success: true });

  } catch (err) {
    console.error('DELETE /api/recaps/:id:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/gallery ──
// multipart/form-data: fields (title, category) + a single `photo` file.
// Both title and category are required; category must be one of
// GALLERY_CATEGORIES so it always lines up with a filter pill on the
// home page.
app.post('/api/gallery', requireAdmin, uploadGalleryPhoto.single('photo'), verifyUploadedImages, async (req, res) => {
  try {
    const b = req.body || {};
    const title = cleanText(b.title, 120);
    const category = typeof b.category === 'string' ? b.category : '';

    if (!title || !category) {
      if (req.file) deleteUploadedFile(`/uploads/gallery/${req.file.filename}`);
      return res.status(400).json({ error: 'Title and category are required' });
    }

    if (!GALLERY_CATEGORIES.includes(category)) {
      if (req.file) deleteUploadedFile(`/uploads/gallery/${req.file.filename}`);
      return res.status(400).json({ error: 'Invalid category' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'A photo is required' });
    }

    const photo = await GalleryPhoto.create({
      title,
      category,
      imageUrl: `/uploads/gallery/${req.file.filename}`,
    });

    res.status(201).json({ success: true, id: photo._id });

  } catch (err) {
    console.error('POST /api/gallery:', err);
    if (req.file) deleteUploadedFile(`/uploads/gallery/${req.file.filename}`);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── DELETE /api/gallery/:id ──
app.delete('/api/gallery/:id', requireAdmin, async (req, res) => {
  try {
    const photo = await GalleryPhoto.findByIdAndDelete(req.params.id);

    if (!photo) return res.status(404).json({ error: 'Not found' });

    deleteUploadedFile(photo.imageUrl);

    res.json({ success: true });

  } catch (err) {
    console.error('DELETE /api/gallery/:id:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


/* ═══════════════════════════════════════════════
   DAILY LESSON — pulled live from ssnet.org
═══════════════════════════════════════════════ */

// Update this array ~4x/year when ssnet.org publishes a new quarter.
// `start` = the Sabbath (Saturday) that begins Lesson 1 — find it by
// opening https://ssnet.org/lessons/<code>/index.html and reading the
// date range shown for Lesson 01.
const LESSON_QUARTERS = [
  { code: '26a', start: '2025-12-27' }, // Q1 2026: Uniting Heaven and Earth
  { code: '26b', start: '2026-03-28' }, // Q2 2026 — unverified guess, double check when you're rested
  { code: '26c', start: '2026-06-27' }, // Q3 2026: First and Second Corinthians — confirmed (Lesson 3 = July 11–17)
];

const DAY_KEYS = ['sab', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
const DAY_LABELS = {
  sab: 'Sabbath', sun: 'Sunday', mon: 'Monday', tue: 'Tuesday',
  wed: 'Wednesday', thu: 'Thursday', fri: 'Friday',
};

const TIMEZONE = 'Africa/Lusaka'; // UTC+2 year-round, no DST

const lessonCache = new Map(); // url -> { fetchedAt, data }
const LESSON_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

// ── Timezone-safe date helpers ──────────────────────────────

// Parse a 'YYYY-MM-DD' string into a UTC-anchored midnight Date.
// This makes all downstream day-math immune to the server's local TZ.
function parseDateOnlyUTC(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// What calendar date is it *in Zambia* right now, regardless of
// what timezone the server (Render, etc.) is actually running in?
function getTodayInZambia() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()); // en-CA formats as YYYY-MM-DD
}

// ── Lesson lookup ────────────────────────────────────────────

function findQuarter(date) {
  const sorted = [...LESSON_QUARTERS].sort(
    (a, b) => parseDateOnlyUTC(a.start) - parseDateOnlyUTC(b.start)
  );
  let match = sorted[0];
  for (const q of sorted) {
    if (parseDateOnlyUTC(q.start) <= date) match = q;
  }
  return match;
}

// `date` must be a UTC-midnight Date — always pass output of parseDateOnlyUTC()
function getLessonInfo(date) {
  const quarter = findQuarter(date);
  const start = parseDateOnlyUTC(quarter.start);
  const diffDays = Math.round((date - start) / 86400000);
  let lessonNum = Math.floor(diffDays / 7) + 1;
  lessonNum = Math.min(Math.max(lessonNum, 1), 13);

  const weekSabbath = new Date(start);
  weekSabbath.setUTCDate(weekSabbath.getUTCDate() + (lessonNum - 1) * 7);

  // Which day-of-week (0=sab...6=fri) is `date` within this lesson week?
  const dayOffset = Math.round((date - weekSabbath) / 86400000);
  const dayKey = DAY_KEYS[Math.min(Math.max(dayOffset, 0), 6)];

  const num = String(lessonNum).padStart(2, '0');
  const url = `https://ssnet.org/lessons/${quarter.code}/less${num}.html`;

  return { url, lessonNum, dayKey, weekSabbath };
}

async function fetchLessonPage(url) {
  const cached = lessonCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < LESSON_CACHE_TTL) return cached.data;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MakeniCentralSDA-site/1.0)' },
    signal: AbortSignal.timeout(8000), // don't let a slow ssnet.org hang our requests
  });
  if (!response.ok) throw new Error(`ssnet.org responded ${response.status}`);
  const html = await response.text();
  const $ = cheerio.load(html);

  const weekTitle = $('h2').first().text().trim();
  let memoryText = '';
  $('p').each((i, el) => {
    const t = $(el).text().trim();
    if (!memoryText && /^Memory Text/i.test(t)) {
      memoryText = t.replace(/^Memory Text:\s*/i, '').trim();
    }
  });

  // Split the page into day sections using the #sab #sun #mon... anchors.
  // Each anchor is immediately followed by a date line and an <h3> section
  // title, then paragraphs, until the next day's anchor.
  const days = {};
  DAY_KEYS.forEach((key, i) => {
    const anchor = $(`#${key}`).first();
    if (!anchor.length) return;

    const nextKey = DAY_KEYS[i + 1] || 'is';
    const startNode = anchor.get(0);
    const stopNode = $(`#${nextKey}`).first().get(0);

    let title = '';
    const bodyParts = [];
    let collecting = false;

    $('body').find('*').each((_, el) => {
      if (el === startNode) { collecting = true; return; }
      if (el === stopNode) { collecting = false; return false; }
      if (!collecting) return;

      const tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (tag === 'h3' && !title) {
        title = $(el).text().trim();
      } else if (tag === 'p') {
        const text = $(el).text().trim();
        if (text && !/^Discuss on the Daily Blog/i.test(text)) bodyParts.push(text);
      }
    });

    days[key] = {
      key,
      label: DAY_LABELS[key],
      title: title || weekTitle,
      excerpt: (bodyParts[0] || '').slice(0, 420),
      content: bodyParts,
    };
  });

  const data = { weekTitle, memoryText, days };
  lessonCache.set(url, { fetchedAt: Date.now(), data });
  return data;
}

// ── GET /api/daily-lesson?date=YYYY-MM-DD ──
// Live-pulls the current week's lesson from ssnet.org, split by day.
// Defaults `date` to "today in Zambia" (Africa/Lusaka), not raw server
// time — fixes the day-boundary bug when the server runs in UTC.
// Falls back gracefully (502) if ssnet.org is unreachable or changed
// their markup — the frontend keeps its static placeholder in that case.
app.get('/api/daily-lesson', async (req, res) => {
  try {
    const dateStr = req.query.date === undefined ? getTodayInZambia() : req.query.date;
    if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    const date = parseDateOnlyUTC(dateStr);
    if (isNaN(date.getTime())) return res.status(400).json({ error: 'Invalid date' });

    const { url, lessonNum, dayKey } = getLessonInfo(date);
    const lessonData = await fetchLessonPage(url);

    res.json({
      lessonNum,
      lessonUrl: url,
      weekTitle: lessonData.weekTitle,
      memoryText: lessonData.memoryText,
      todayKey: dayKey,
      days: DAY_KEYS.filter(k => lessonData.days[k]).map(k => lessonData.days[k]),
    });

  } catch (err) {
    console.error('GET /api/daily-lesson:', err.message);
    res.status(502).json({ error: 'Could not reach ssnet.org' });
  }
});


/* ═══════════════════════════════════════════════
   FACEBOOK LIVE
   Requires FACEBOOK_PAGE_ID and FACEBOOK_ACCESS_TOKEN in the server
   environment. The token stays server-side and is never sent to the browser.
   Results are cached for 30s so visitors can't burn through Facebook's
   API rate limit.
═══════════════════════════════════════════════ */
const FB_CACHE_TTL = 30 * 1000;
let fbCache = { at: 0, data: null };

app.get('/api/facebook-live', async (req, res) => {
  const pageId = process.env.FACEBOOK_PAGE_ID || '100091185906540';
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!accessToken) return res.json({ live: false, configured: false });

  if (fbCache.data && Date.now() - fbCache.at < FB_CACHE_TTL) {
    return res.json(fbCache.data);
  }

  try {
    const endpoint = new URL(`https://graph.facebook.com/v20.0/${encodeURIComponent(pageId)}/live_videos`);
    endpoint.searchParams.set('fields', 'id,permalink_url,status,title,creation_time');
    endpoint.searchParams.set('status', 'LIVE');
    endpoint.searchParams.set('access_token', accessToken);

    const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || `HTTP ${response.status}`);

    const liveVideo = Array.isArray(payload.data) ? payload.data[0] : null;
    const data = {
      live: Boolean(liveVideo?.permalink_url),
      configured: true,
      videoUrl: liveVideo?.permalink_url || null,
      title: liveVideo?.title || '',
    };
    fbCache = { at: Date.now(), data };
    res.json(data);
  } catch (err) {
    console.error('GET /api/facebook-live:', err.message);
    res.json({ live: false, configured: true });
  }
});


/* ═══════════════════════════════════════════════
   404 FOR UNKNOWN API ROUTES + ERROR HANDLING
   Both must be registered after all routes.
   Catches multer upload errors (bad file type, too large, too many
   files) and bad JSON bodies, and returns clean JSON instead of
   Express's default HTML stack trace.
═══════════════════════════════════════════════ */
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE:       'Image is too large — max 5MB per file.',
      LIMIT_FILE_COUNT:      'Too many images — max 10 per recap.',
      LIMIT_UNEXPECTED_FILE: 'Too many images, or the wrong upload field was used.',
    };
    return res.status(400).json({ error: messages[err.code] || err.message });
  }
  if (err && err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({ error: err.message });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON in request body' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Server error' });
});


/* ═══════════════════════════════════════════════
   START SERVER
═══════════════════════════════════════════════ */
app.listen(PORT, () => {
  console.log(`\x1b[33m✦ Makeni Central SDA — server running on port ${PORT}\x1b[0m`);
});