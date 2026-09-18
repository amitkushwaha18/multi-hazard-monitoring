const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { startHazardAlertService } = require('./services/hazardAlertService');
const { GoogleGenAI } = require('@google/genai');
const User = require('./models/User');
const authRoutes = require('./routes/auth');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
const ALLOWED_ORIGINS = [
  'https://multi-hazard-frontend.onrender.com',
  'https://multi-hazard-backend.onrender.com',
  'http://localhost:3000'
];

app.use(cors({
  origin: ALLOWED_ORIGINS,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/multihazard_db';
const Asset = require('./models/Asset');
const SAMPLE_INFRA_ASSETS = require('./data/sampleAssets');

// The sample assets are auto-seeded only when the assets collection is empty.
mongoose.connect(MONGO_URI)
.then(async () => {
  console.log('MongoDB Connected Successfully');
  try {
    const assetCount = await Asset.countDocuments();
    if (assetCount === 0) {
      await Asset.insertMany(SAMPLE_INFRA_ASSETS);
      console.log('Seeded sample infrastructure assets.');
    }
  } catch (err) {
    console.log('Asset auto-seed skipped:', err.message);
  }

  // Start the automated hazard alert monitoring service (server-side background job).
  // It fetches Earthquake/Cyclone/Flood risk levels and dispatches Postmark
  // alert emails to every registered user — completely independent of the browser.
  startHazardAlertService(User);
})
.catch((err) => console.log('MongoDB Connection Error:', err));

// Direct Assets Fallback Route
app.get('/api/assets', async (req, res) => {
  try {
    const assets = await Asset.find();
    if (assets && assets.length > 0) {
      return res.status(200).json(assets);
    }
    return res.status(200).json(SAMPLE_INFRA_ASSETS);
  } catch (err) {
    console.warn('MongoDB connection issue, returning sample assets fallback.');
    return res.status(200).json(SAMPLE_INFRA_ASSETS);
  }
});

// Authentication Routes (Registration OTP Verification + Login + Google OAuth).
// All authorization logic lives in routes/auth.js — direct account creation
// without Email OTP verification is strictly disabled.
app.use('/api/auth', authRoutes);

// Admin Dashboard: All Registered Users (compatibility alias for /api/auth/users).
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    return res.status(200).json(
      users.map((u) => ({
        _id: u._id,
        fullName: u.fullName || u.name || 'User',
        name: u.name || u.fullName || '',
        email: u.email,
        phone: u.phone || '',
        mobileNumber: u.mobileNumber || '',
        role: u.role || 'Public Citizen',
        createdAt: u.createdAt,
        city: u.city || '',
        state: u.state || ''
      }))
    );
  } catch (error) {
    console.error('Error fetching registered users:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching registered users',
      error: error.message
    });
  }
});

// Mount existing route files
const hazardRoutes = require('./routes/hazardRoutes');
const assetRoutes = require('./routes/assetRoutes');
const alertRoutes = require('./routes/alertRoutes');

app.use('/api/hazards', hazardRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/alerts', alertRoutes);

// 6. Flood Risk Telemetry API Endpoint
app.get('/api/hazards/flood-analysis', async (req, res) => {
  try {
    const { lat, lng, city } = req.query;
    const latitude = lat || 26.8467;
    const longitude = lng || 80.9462;
    const cityName = city || 'Lucknow';

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=precipitation,rain,showers,temperature_2m,soil_moisture_0_to_1cm&hourly=precipitation,temperature_2m,soil_moisture_0_to_1cm&forecast_days=1&past_days=1&timezone=auto`
    );
    const data = await response.json();

    const hourly = data.hourly || {};
    const times = hourly.time || [];
    const split = Math.floor(times.length / 2);
    const pick = (arr, half) => (arr || []).filter((_, i) => (half === 0 ? i < split : i >= split));

    const history = {
      time: pick(times, 0),
      precipitation: pick(hourly.precipitation, 0),
      temperature_2m: pick(hourly.temperature_2m, 0)
    };
    const forecast = {
      time: pick(times, 1),
      precipitation: pick(hourly.precipitation, 1),
      temperature_2m: pick(hourly.temperature_2m, 1)
    };
    const forecastPrecip = forecast.precipitation;
    const peakHourlyPrecipitation = forecastPrecip.length ? Math.max(...forecastPrecip) : 0;

    res.status(200).json({
      success: true,
      cityName: cityName,
      coordinates: { lat: latitude, lng: longitude },
      currentPrecipitation: data.current?.precipitation || 0,
      currentTemperature: data.current?.temperature_2m || 0,
      currentSoilMoisture: data.current?.soil_moisture_0_to_1cm || 0,
      peakHourlyPrecipitation,
      history,
      hourlyForecast: forecast
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching flood telemetry data', error: error.message });
  }
});

// 7. Cyclone / Wind Telemetry API Endpoint
app.get('/api/hazards/cyclone', async (req, res) => {
  try {
    const { lat = 26.8467, lng = 80.9462 } = req.query;

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m&hourly=wind_speed_10m`
    );

    if (!response.ok) {
      throw new Error(`Open-Meteo HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    res.status(200).json({
      success: true,
      currentWindSpeed: data.current?.wind_speed_10m || 0,
      currentWindGusts: data.current?.wind_gusts_10m || 0,
      windDirection: data.current?.wind_direction_10m || 0,
      hourlyForecast: data.hourly || { wind_speed_10m: Array(24).fill(0) },
      elevation: data.elevation || 0
    });
  } catch (error) {
    console.warn('[CYCLONE TELEMETRY] Connection issue (ECONNRESET/Network). Returning 0 state:', error.message);
    res.status(200).json({
      success: false,
      currentWindSpeed: 0,
      currentWindGusts: 0,
      windDirection: 0,
      hourlyForecast: { wind_speed_10m: Array(24).fill(0) },
      elevation: 0,
      message: 'Network issue fetching live wind telemetry'
    });
  }
});

// 8. Jarvis AI Chat Backend Endpoint
const defaultJarvisSystemPrompt = (lang) => `JARVIS CORE PROTOCOL
IDENTITY: You are JARVIS, an efficient, professional, warm and slightly witty AI assistant embedded in a Multi-Hazard Disaster Dashboard. No fluff.

LANGUAGE:
- The language of your reply is the language of the user's MOST RECENT message. Nothing else decides it.
- If the user writes Hindi in Roman letters ("Hinglish"), reply the same way - Hindi words in Roman script. If they write Devanagari Hindi, reply in Devanagari.
- Never answer in a language the user has not used, and never mix two languages in one reply.
- Address the user with the ordinary respectful form of the language you are speaking.
- Current language hint for this request: ${lang}

EXECUTION RULES:
- You can discuss any topic (general knowledge, casual chat, advice, disaster safety).
- Speak like a real person having a casual conversation.
- Keep replies short (1-3 sentences) and conversational.
- Always react fast; speed is your number one priority. Don't make it complicated and slow.`;

let genaiClient = null;

const getGenaiClient = () => {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return null;
  if (!genaiClient) {
    genaiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return genaiClient;
};

const JARVIS_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];

const jarvisChatHandler = async (req, res) => {
  const lang = typeof req.body?.lang === 'string' ? req.body.lang : 'en-US';
  const offlineReply = (l) =>
    l === 'hi-IN'
      ? 'Jarvis AI abhi offline hai, kripya API key check karein.'
      : 'Jarvis AI is offline, please check API key.';

  try {
    const message = typeof req.body?.message === 'string' ? req.body.message : String(req.body?.message || '').trim();
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const systemPrompt =
      typeof req.body?.systemPrompt === 'string' && req.body.systemPrompt.trim()
        ? req.body.systemPrompt.trim()
        : defaultJarvisSystemPrompt(lang);

    const ai = getGenaiClient();
    if (!ai) {
      console.warn('Jarvis chat: GEMINI_API_KEY is not set in .env');
      return res.json({ reply: offlineReply(lang) });
    }

    const contents = [];
    for (const h of history.slice(-8)) {
      const role = h.role === 'assistant' || h.role === 'model' ? 'model' : 'user';
      const text = typeof h.content === 'string' ? h.content : String(h.content || '');
      if (text) contents.push({ role, parts: [{ text }] });
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    let replyText = '';
    let lastErr = null;
    for (const model of JARVIS_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: { systemInstruction: systemPrompt }
        });
        replyText = (response?.text || '').trim();
        if (replyText) break;
      } catch (err) {
        lastErr = err;
        console.warn(`Jarvis chat: model ${model} failed — ${String(err.message).slice(0, 160)}, trying next.`);
      }
    }

    if (!replyText) {
      console.error('Jarvis backend error (falling back to offline reply):', lastErr);
      return res.json({ reply: offlineReply(lang) });
    }
    res.json({ reply: replyText });
  } catch (err) {
    console.error('Jarvis backend error (falling back to offline reply):', err);
    res.json({ reply: offlineReply(lang) });
  }
};

app.post('/api/jarvis-chat', jarvisChatHandler);
app.post('/api/chat', jarvisChatHandler);

// ==========================================
// STATIC FRONTEND SERVING FOR SINGLE DEPLOYMENT
// ==========================================

// Serve static assets from frontend build folder
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Handle Single Page Application (SPA) Routing (Express 5 Syntax Compatible)
app.get('{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});