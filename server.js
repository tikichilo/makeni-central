/**
 * server.js — Makeni Central SDA Church
 * Node.js + Express + MongoDB (Mongoose)
 *
 *  — Public endpoints —
 *  POST /api/donate                — Give modal
 *  GET  /api/fund                  — Fund tracker stats
 *  GET  /api/discussions           — Youth board list
 *  POST /api/discussions           — Submit new discussion
 *  POST /api/discussions/:id/like  — Like a discussion
 *  GET  /api/lesson                — Lesson of the week
 *  GET  /api/theme                 — Theme of the month
 *  GET  /api/announcements         — Active announcements
 *  GET  /api/stories               — Kids bible stories
 *  POST /api/visits                — Save a "Plan Your Visit" submission
 *
 *  — Admin endpoints —
 *  GET    /api/donations            — List all donations
 *  DELETE /api/discussions/:id      — Delete a discussion
 *  POST   /api/fund/goal            — Update fundraising goal
 *  POST   /api/lesson               — Save lesson of the week
 *  POST   /api/theme                — Save theme of the month
 *  POST   /api/announcements        — Add announcement
 *  DELETE /api/announcements/:id    — Remove announcement
 *  POST   /api/stories              — Publish a story
 *  POST   /api/stories/:id/feature  — Feature a story
 *  DELETE /api/stories/:id          — Delete a story
 *  GET    /api/visits                — List planned visits
 */

'use strict';

const path     = require('path');
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
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
   MONGODB CONNECTION
═══════════════════════════════════════════════ */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✦ MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
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
const announcementSchema = new mongoose.Schema({
  text:      { type: String, required: true, maxlength: 200 },
  expiresAt: { type: Date,   default: null },
  createdAt: { type: Date,   default: Date.now },
});
const Announcement = mongoose.model('Announcement', announcementSchema);


// ── Story — kids corner ──
const storySchema = new mongoose.Schema({
  title:     { type: String, required: true, maxlength: 100 },
  tag:       { type: String, default: '',    maxlength: 60 },
  ageGroup:  { type: String, default: 'All Ages' },
  preview:   { type: String, default: '',    maxlength: 200 },
  body:      { type: String, required: true, maxlength: 3000 },
  imageUrl:  { type: String, default: '' },
  featured:  { type: Boolean, default: false },
  createdAt: { type: Date,   default: Date.now },
});
const Story = mongoose.model('Story', storySchema);


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


// ── GET /api/stories ──
// Featured stories sort to the top.
app.get('/api/stories', async (req, res) => {
  try {
    const stories = await Story
      .find()
      .sort({ featured: -1, createdAt: -1 })
      .lean();

    res.json(stories);

  } catch (err) {
    console.error('GET /api/stories:', err);
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
    const { text, expiresAt } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const ann = await Announcement.create({
      text:      text.slice(0, 200),
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


// ── POST /api/stories ──
app.post('/api/stories', async (req, res) => {
  try {
    const { title, tag, ageGroup, preview, body, imageUrl, featured } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }

    // Only one story can be featured at a time
    if (featured) await Story.updateMany({ featured: true }, { featured: false });

    const story = await Story.create({
      title:    title.slice(0, 100),
      tag:      (tag     || '').slice(0, 60),
      ageGroup: ageGroup || 'All Ages',
      preview:  (preview || '').slice(0, 200),
      body:     body.slice(0, 3000),
      imageUrl: imageUrl || '',
      featured: !!featured,
    });

    res.status(201).json({ success: true, id: story._id });

  } catch (err) {
    console.error('POST /api/stories:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── POST /api/stories/:id/feature ──
app.post('/api/stories/:id/feature', async (req, res) => {
  try {
    await Story.updateMany({ featured: true }, { featured: false });

    const story = await Story.findByIdAndUpdate(
      req.params.id,
      { featured: true },
      { new: true }
    );

    if (!story) return res.status(404).json({ error: 'Not found' });

    res.json({ success: true });

  } catch (err) {
    console.error('POST /api/stories/:id/feature:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── DELETE /api/stories/:id ──
app.delete('/api/stories/:id', async (req, res) => {
  try {
    const story = await Story.findByIdAndDelete(req.params.id);

    if (!story) return res.status(404).json({ error: 'Not found' });

    res.json({ success: true });

  } catch (err) {
    console.error('DELETE /api/stories/:id:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


/* ═══════════════════════════════════════════════
   START SERVER
═══════════════════════════════════════════════ */
app.listen(PORT, () => {
  console.log(`\x1b[33m✦ Makeni Central SDA — server running on port ${PORT}\x1b[0m`);
});