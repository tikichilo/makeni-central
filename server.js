/**
 * server.js — Makeni Central SDA Church
 * Node.js + Express + MongoDB (Mongoose)
 */

'use strict';

const path      = require('path');
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
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

// Serve all files inside /public
app.use(express.static(path.join(__dirname, 'public')));

// Home route
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

// ── Donation Schema ──
const donationSchema = new mongoose.Schema({
  amount:    { type: Number, required: true, min: 1 },
  currency:  { type: String, default: 'ZMW' },
  createdAt: { type: Date, default: Date.now },
});

const Donation = mongoose.model('Donation', donationSchema);


// ── Fund Schema ──
const fundSchema = new mongoose.Schema({
  raised: { type: Number, default: 0 },
  goal:   { type: Number, default: 500000 },
  donors: { type: Number, default: 0 },
});

const Fund = mongoose.model('Fund', fundSchema);


// ── Discussion Schema ──
const discussionSchema = new mongoose.Schema({
  name:      { type: String, required: true, maxlength: 100 },
  category:  { type: String, required: true, maxlength: 60 },
  title:     { type: String, required: true, maxlength: 100 },
  body:      { type: String, required: true, maxlength: 1000 },
  likes:     { type: Number, default: 0 },
  comments:  { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const Discussion = mongoose.model('Discussion', discussionSchema);


/* ═══════════════════════════════════════════════
   ROUTES — PUBLIC
═══════════════════════════════════════════════ */

// ── Donate ──
app.post('/api/donate', async (req, res) => {
  try {
    const { amount, currency } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const donation = await Donation.create({
      amount: Number(amount),
      currency: currency || 'ZMW',
    });

    await Fund.findOneAndUpdate(
      {},
      { $inc: { raised: Number(amount), donors: 1 } },
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      id: donation._id,
    });

  } catch (err) {
    console.error('POST /api/donate:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── Fund Stats ──
app.get('/api/fund', async (req, res) => {
  try {
    let fund = await Fund.findOne();

    if (!fund) {
      fund = await Fund.create({
        raised: 0,
        goal: 500000,
        donors: 0,
      });
    }

    res.json({
      raised: fund.raised,
      goal: fund.goal,
      donors: fund.donors,
    });

  } catch (err) {
    console.error('GET /api/fund:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── Get Discussions ──
app.get('/api/discussions', async (req, res) => {
  try {
    const { category } = req.query;

    const filter =
      category && category !== 'all'
        ? { category }
        : {};

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


// ── Create Discussion ──
app.post('/api/discussions', async (req, res) => {
  try {
    const { name, category, title, body } = req.body;

    if (!name || !category || !title || !body) {
      return res.status(400).json({
        error: 'All fields are required',
      });
    }

    const discussion = await Discussion.create({
      name: name.slice(0, 100),
      category: category.slice(0, 60),
      title: title.slice(0, 100),
      body: body.slice(0, 1000),
    });

    res.status(201).json({
      success: true,
      id: discussion._id,
    });

  } catch (err) {
    console.error('POST /api/discussions:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── Like Discussion ──
app.post('/api/discussions/:id/like', async (req, res) => {
  try {
    const discussion = await Discussion.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );

    if (!discussion) {
      return res.status(404).json({
        error: 'Not found',
      });
    }

    res.json({
      likes: discussion.likes,
    });

  } catch (err) {
    console.error('POST /api/discussions/:id/like:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


/* ═══════════════════════════════════════════════
   ROUTES — ADMIN
═══════════════════════════════════════════════ */

// ── Donations List ──
app.get('/api/donations', async (req, res) => {
  try {
    const donations = await Donation
      .find()
      .sort({ createdAt: -1 })
      .lean();

    res.json(donations);

  } catch (err) {
    console.error('GET /api/donations:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── Delete Discussion ──
app.delete('/api/discussions/:id', async (req, res) => {
  try {
    const discussion = await Discussion.findByIdAndDelete(req.params.id);

    if (!discussion) {
      return res.status(404).json({
        error: 'Not found',
      });
    }

    res.json({ success: true });

  } catch (err) {
    console.error('DELETE /api/discussions/:id:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── Update Fund Goal ──
app.post('/api/fund/goal', async (req, res) => {
  try {
    const { goal } = req.body;

    if (!goal || isNaN(goal) || Number(goal) <= 0) {
      return res.status(400).json({
        error: 'Invalid goal amount',
      });
    }

    const fund = await Fund.findOneAndUpdate(
      {},
      { $set: { goal: Number(goal) } },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      goal: fund.goal,
    });

  } catch (err) {
    console.error('POST /api/fund/goal:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


/* ═══════════════════════════════════════════════
   START SERVER
═══════════════════════════════════════════════ */

app.listen(PORT, () => {
  console.log(
    `✦ Makeni Central SDA server running on port ${PORT}`
  );
});