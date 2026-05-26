/**
 * server.js — Makeni Central SDA Church
 * Node.js + Express + MongoDB (Mongoose)
 *
 * Handles all data endpoints consumed by func.js and sda.js:
 *  POST /api/donate        — Give modal (sda.js §5)
 *  GET  /api/fund          — Fund tracker stats (func.js initFundTracker)
 *  GET  /api/discussions   — Youth board list
 *  POST /api/discussions   — Submit new discussion (func.js submitDiscussion)
 *  POST /api/discussions/:id/like — Like a discussion
 *
 * Usage:
 *  npm install express mongoose dotenv cors
 *  node server.js
 *
 * .env file needed:
 *  MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/makenicentral
 *  PORT=3000
 */

'use strict';

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
   MONGODB CONNECTION
═══════════════════════════════════════════════ */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✦ MongoDB connected'))
  .catch(err => { console.error('MongoDB connection error:', err); process.exit(1); });


/* ═══════════════════════════════════════════════
   SCHEMAS & MODELS
═══════════════════════════════════════════════ */

// ── Donation — from sda.js Give modal ──
const donationSchema = new mongoose.Schema({
  amount:    { type: Number, required: true, min: 1 },
  currency:  { type: String, default: 'ZMW' },
  createdAt: { type: Date,   default: Date.now },
});
const Donation = mongoose.model('Donation', donationSchema);


// ── Fund — single document tracking building fund totals ──
const fundSchema = new mongoose.Schema({
  raised:  { type: Number, default: 0 },
  goal:    { type: Number, default: 500000 },
  donors:  { type: Number, default: 0 },
});
const Fund = mongoose.model('Fund', fundSchema);


// ── Discussion — youth board posts ──
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


/* ═══════════════════════════════════════════════
   ROUTES
═══════════════════════════════════════════════ */

// ── POST /api/donate ──────────────────────────
// Called by sda.js Give modal on submit
app.post('/api/donate', async (req, res) => {
  try {
    const { amount, currency } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Save donation record
    const donation = await Donation.create({
      amount:   Number(amount),
      currency: currency || 'ZMW',
    });

    // Update fund totals atomically
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


// ── GET /api/fund ─────────────────────────────
// Called by func.js initFundTracker on building.html
app.get('/api/fund', async (req, res) => {
  try {
    let fund = await Fund.findOne();

    // Seed default doc if none exists yet
    if (!fund) {
      fund = await Fund.create({ raised: 0, goal: 500000, donors: 0 });
    }

    res.json({
      raised:  fund.raised,
      goal:    fund.goal,
      donors:  fund.donors,
    });
  } catch (err) {
    console.error('GET /api/fund:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── GET /api/discussions ─────────────────────
// Returns all discussions, newest first
app.get('/api/discussions', async (req, res) => {
  try {
    const { category } = req.query; // optional ?category=faith
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


// ── POST /api/discussions ────────────────────
// Called by func.js submitDiscussion
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


// ── POST /api/discussions/:id/like ───────────
// Called when a like button is clicked on the youth board
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


/* ═══════════════════════════════════════════════
   START
═══════════════════════════════════════════════ */
app.listen(PORT, () => {
  console.log(
    `\x1b[33m✦ Makeni Central SDA — server running on port ${PORT}\x1b[0m`
  );
});