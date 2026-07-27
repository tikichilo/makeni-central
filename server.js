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
 *  GET  /api/lesson                    — Lesson of the week
 *  GET  /api/theme                     — Theme of the month
 *  GET  /api/announcements             — Active announcements
 *  POST /api/announcements/:id/react   — React to an announcement (amen/love/praise)
 *  POST /api/visits                    — Save a "Plan Your Visit" submission
 *  GET  /api/events                    — Upcoming events
 *  GET  /api/events/featured           — The single featured event (or null)
 *  GET  /api/recaps                    — Event recap galleries
 *  GET  /api/hero-slideshow            — Shuffled hero slideshow images
 *
 *  — Admin endpoints —
 *  GET    /api/donations             — List all donations
 *  DELETE /api/discussions/:id       — Delete a discussion
 *  POST   /api/fund/goal             — Update fundraising goal
 *  POST   /api/lesson                — Save lesson of the week
 *  POST   /api/theme                 — Save theme of the month
 *  POST   /api/announcements         — Add announcement (text, title, category, expiresAt)
 *  DELETE /api/announcements/:id     — Remove announcement
 *  GET    /api/visits                — List planned visits
 *  POST   /api/events                — Add event (multipart: poster + fields)
 *  PATCH  /api/events/:id/feature    — Mark an event as the featured one
 *  DELETE /api/events/:id            — Remove an event
 *  POST   /api/recaps                — Add event recap (multipart: up to 10 images + fields)
 *  DELETE /api/recaps/:id            — Remove a recap
 */

'use strict';

const path     = require('path');
const fs       = require('fs');
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const multer   = require('multer');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;


/* ═══════════════════════════════════════════════
   MIDDLEWARE
═══════════════════════════════════════════════ */
app.use(cors());
app.use(express.json());


/* ═══════════════════════════════════════════════
   STATIC FRONTEND FILES
═══════════════════════════════════════════════ */
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


/* ═══════════════════════════════════════════════
   UPLOADS (event posters + recap gallery images)
   Stored under public/uploads/... so express.static above serves them
   directly at /uploads/events/<file> and /uploads/recaps/<file> —
   no extra route needed. Non-image files and anything over 5MB are
   rejected before they touch disk.
═══════════════════════════════════════════════ */
const UPLOAD_ROOT       = path.join(__dirname, 'public', 'uploads');
const EVENT_UPLOAD_DIR  = path.join(UPLOAD_ROOT, 'events');
const RECAP_UPLOAD_DIR  = path.join(UPLOAD_ROOT, 'recaps');
[EVENT_UPLOAD_DIR, RECAP_UPLOAD_DIR].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

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
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
    },
  });
}

function imageFileFilter(req, file, cb) {
  if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error('Only JPG, PNG, and WEBP images are allowed'));
  }
  cb(null, true);
}

const uploadEventPoster = multer({
  storage: makeStorage(EVENT_UPLOAD_DIR),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const uploadRecapImages = multer({
  storage: makeStorage(RECAP_UPLOAD_DIR),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 }, // 5MB each, 10 max
});

// Best-effort file deletion — never throws, just logs if it fails
// (e.g. file already gone). Used when deleting events/recaps.
function deleteUploadedFile(publicUrl) {
  if (!publicUrl) return;
  const filePath = path.join(__dirname, 'public', publicUrl);
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
  currency:  { type: String, default: 'ZMW' },
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
  comments:  { type: Number, default: 0 },
  createdAt: { type: Date,   default: Date.now },
});
const Discussion = mongoose.model('Discussion', discussionSchema);


// ── Lesson — single active document ──
const lessonSchema = new mongoose.Schema({
  title:     { type: String, required: true, maxlength: 100 },
  verse:     { type: String, default: '',    maxlength: 200 },
  body:      { type: String, required: true, maxlength: 1000 },
  url:       { type: String, default: '' },
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
  needs:     { type: [String], default: [] },                  // e.g. ["prayer","welcome"]
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


/* ═══════════════════════════════════════════════
   ROUTES — PUBLIC
═══════════════════════════════════════════════ */

// ── POST /api/donate ──
app.post('/api/donate', async (req, res) => {
  try {
    const { amount, currency } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const donation = await Donation.create({
      amount:   Number(amount),
      currency: currency || 'ZMW',
    });

    await Fund.findOneAndUpdate(
      {},
      { $inc: { raised: Number(amount), donors: 1 } },
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
    const { category } = req.query;
    const filter = category && category !== 'all' ? { category } : {};

    const discussions = await Discussion
      .find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json(discussions);

  } catch (err) {
    console.error('GET /api/discussions:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/discussions ──
app.post('/api/discussions', async (req, res) => {
  try {
    const { name, category, title, body } = req.body;

    if (!name || !category || !title || !body) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const discussion = await Discussion.create({
      name:     name.slice(0, 100),
      category: category.slice(0, 60),
      title:    title.slice(0, 100),
      body:     body.slice(0, 1000),
    });

    res.status(201).json({ success: true, id: discussion._id });

  } catch (err) {
    console.error('POST /api/discussions:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/discussions/:id/like ──
app.post('/api/discussions/:id/like', async (req, res) => {
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
// the server whether to add or remove one from the count.
app.post('/api/announcements/:id/react', async (req, res) => {
  try {
    const { reaction, active } = req.body;

    if (!ANNOUNCEMENT_REACTION_KEYS.includes(reaction)) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    const delta = active ? 1 : -1;
    let ann = await Announcement.findByIdAndUpdate(
      req.params.id,
      { $inc: { [`reactions.${reaction}`]: delta } },
      { new: true }
    );

    if (!ann) return res.status(404).json({ error: 'Not found' });

    // Guard against the count dipping below 0 (e.g. a stale toggle from
    // a second tab). $min could do this atomically, but a follow-up
    // clamp is simpler and this endpoint is low-stakes/low-traffic.
    if (ann.reactions[reaction] < 0) {
      ann.reactions[reaction] = 0;
      await ann.save();
    }

    res.json({ success: true, reactions: ann.reactions });

  } catch (err) {
    console.error('POST /api/announcements/:id/react:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/visits ──
// Saves a "Plan Your Visit" submission: date, service, name, needs.
app.post('/api/visits', async (req, res) => {
  try {
    const { date, service, time, name, needs } = req.body;

    if (!date || !service) {
      return res.status(400).json({ error: 'Date and service are required' });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    if (!VISIT_SERVICES.includes(service)) {
      return res.status(400).json({ error: 'Invalid service' });
    }

    // Drop any need values that aren't in our known list, just in case
    const cleanNeeds = Array.isArray(needs)
      ? needs.filter(n => VISIT_NEEDS.includes(n))
      : [];

    const visit = await Visit.create({
      date:    parsedDate,
      service,
      time:    (time || '').slice(0, 60),
      name:    (name || '').slice(0, 100),
      needs:   cleanNeeds,
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
    const recaps = await Recap.find().sort({ createdAt: -1 }).lean();
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


/* ═══════════════════════════════════════════════
   ROUTES — ADMIN
═══════════════════════════════════════════════ */

// ── GET /api/donations ──
app.get('/api/donations', async (req, res) => {
  try {
    const donations = await Donation.find().sort({ createdAt: -1 }).lean();
    res.json(donations);

  } catch (err) {
    console.error('GET /api/donations:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── GET /api/visits ──
// Lists planned visits, soonest upcoming first; optional ?upcoming=true
// filters out past dates so the admin only sees what's still ahead.
app.get('/api/visits', async (req, res) => {
  try {
    const { upcoming } = req.query;
    const filter = upcoming === 'true'
      ? { date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
      : {};

    const visits = await Visit.find(filter).sort({ date: 1 }).lean();
    res.json(visits);

  } catch (err) {
    console.error('GET /api/visits:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── DELETE /api/discussions/:id ──
app.delete('/api/discussions/:id', async (req, res) => {
  try {
    const discussion = await Discussion.findByIdAndDelete(req.params.id);

    if (!discussion) return res.status(404).json({ error: 'Not found' });

    res.json({ success: true });

  } catch (err) {
    console.error('DELETE /api/discussions/:id:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/fund/goal ──
app.post('/api/fund/goal', async (req, res) => {
  try {
    const { goal } = req.body;

    if (!goal || isNaN(goal) || Number(goal) <= 0) {
      return res.status(400).json({ error: 'Invalid goal amount' });
    }

    const fund = await Fund.findOneAndUpdate(
      {},
      { $set: { goal: Number(goal) } },
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
app.post('/api/lesson', async (req, res) => {
  try {
    const { title, verse, body, url } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }

    await Lesson.deleteMany({});
    await Lesson.create({
      title: title.slice(0, 100),
      verse: (verse || '').slice(0, 200),
      body:  body.slice(0, 1000),
      url:   url || '',
    });

    res.json({ success: true });

  } catch (err) {
    console.error('POST /api/lesson:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/theme ──
// Always replaces — only one theme is active at a time.
app.post('/api/theme', async (req, res) => {
  try {
    const { heading, ref, body } = req.body;

    if (!heading) {
      return res.status(400).json({ error: 'Heading is required' });
    }

    await Theme.deleteMany({});
    await Theme.create({
      heading: heading.slice(0, 60),
      ref:     (ref  || '').slice(0, 40),
      body:    (body || '').slice(0, 300),
    });

    res.json({ success: true });

  } catch (err) {
    console.error('POST /api/theme:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/announcements ──
app.post('/api/announcements', async (req, res) => {
  try {
    const { text, title, category, expiresAt } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const ann = await Announcement.create({
      text:      text.slice(0, 200),
      title:     (title || '').slice(0, 100),
      category:  (category || 'general').slice(0, 40).toLowerCase(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    res.status(201).json({ success: true, id: ann._id });

  } catch (err) {
    console.error('POST /api/announcements:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── DELETE /api/announcements/:id ──
app.delete('/api/announcements/:id', async (req, res) => {
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
app.post('/api/events', uploadEventPoster.single('poster'), async (req, res) => {
  try {
    const { title, date, time, location, info } = req.body;

    if (!title || !date) {
      if (req.file) deleteUploadedFile(`/uploads/events/${req.file.filename}`);
      return res.status(400).json({ error: 'Title and date are required' });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      if (req.file) deleteUploadedFile(`/uploads/events/${req.file.filename}`);
      return res.status(400).json({ error: 'Invalid date' });
    }

    const event = await Event.create({
      title:     title.slice(0, 120),
      posterUrl: req.file ? `/uploads/events/${req.file.filename}` : '',
      date:      parsedDate,
      time:      (time || '').slice(0, 60),
      location:  (location || '').slice(0, 150),
      info:      (info || '').slice(0, 1000),
    });

    res.status(201).json({ success: true, id: event._id });

  } catch (err) {
    console.error('POST /api/events:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── PATCH /api/events/:id/feature ──
// Marks one event as featured, unmarking any other — only one event
// can be featured at a time, matching the single Featured Event section.
app.patch('/api/events/:id/feature', async (req, res) => {
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
app.delete('/api/events/:id', async (req, res) => {
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
app.post('/api/recaps', uploadRecapImages.array('images', 10), async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title) {
      (req.files || []).forEach(f => deleteUploadedFile(`/uploads/recaps/${f.filename}`));
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!req.files || !req.files.length) {
      return res.status(400).json({ error: 'At least one image is required' });
    }

    const images = req.files.map(f => `/uploads/recaps/${f.filename}`);

    const recap = await Recap.create({
      title:       title.slice(0, 120),
      description: (description || '').slice(0, 1000),
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
app.delete('/api/recaps/:id', async (req, res) => {
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


const cheerio = require('cheerio');

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
      // Short excerpt only — see copyright note above. Full text stays on ssnet.org.
      excerpt: (bodyParts[0] || '').slice(0, 420),
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
    const dateStr = req.query.date || getTodayInZambia();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
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
   ERROR HANDLING — must be registered after all routes.
   Catches multer upload errors (bad file type, too large, too many
   files) and returns clean JSON instead of Express's default HTML
   stack trace, so the dashboard can show a real error message.
═══════════════════════════════════════════════ */
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE:       'Image is too large — max 5MB per file.',
      LIMIT_FILE_COUNT:      'Too many images — max 10 per recap.',
      LIMIT_UNEXPECTED_FILE: 'Too many images — max 10 per recap.',
    };
    return res.status(400).json({ error: messages[err.code] || err.message });
  }
  if (err && /Only image files are allowed/.test(err.message || '')) {
    return res.status(400).json({ error: err.message });
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