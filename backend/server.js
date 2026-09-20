const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { startHazardAlertService } = require('./services/hazardAlertService');
const { GoogleGenAI } = require('@google/genai');
const OpenAI = require('openai');
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
app.use('/api/auth', authRoutes);

// Admin Dashboard: All Registered Users
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

// 8. Struct AI Copilot / AI Chat Backend Endpoint
const buildStructCopilotPrompt = (contextData) => `
YOU ARE STRUCT AI COPILOT, A REAL-TIME MULTI-HAZARD DISASTER AND STRUCTURAL HEALTH ASSISTANT EMBEDDED IN THIS DASHBOARD.
YOU HAVE ACCESS TO LIVE REAL-TIME SENSOR AND HAZARD TELEMETRY DATA BELOW:

LIVE SYSTEM CONTEXT:
${JSON.stringify(contextData || {}, null, 2)}

STRICT LANGUAGE & IDENTITY RULES:
- Your name is STRUCT AI COPILOT.
- Speak ONLY in English or Hinglish (Hindi written in Roman/English script, e.g., "Main aapko live data ke basis par bata raha hu").
- NEVER use Devanagari script (DO NOT write in "हिंदी" script like "जानकारी नहीं दे सकता").
- Keep the tone casual, respectful, professional, and friendly.

EXECUTION INSTRUCTIONS:
- Always analyze the LIVE SYSTEM CONTEXT above to answer queries regarding flood levels, wind speeds, cyclone alerts, earthquake updates, or structural asset health.
- NEVER say "I don't have access to real-time data". You DO have live access via contextData.
- Provide clear risk predictions and immediate safety steps based on live telemetry numbers.
`;

let genaiClient = null;

const getGenaiClient = () => {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return null;
  if (!genaiClient) {
    genaiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return genaiClient;
};

const STRUCT_COPILOT_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];
const GROQ_MODELS = ['groq/compound-mini', 'groq/compound', 'llama-3.3-70b-versatile', 'llama3-8b-8192', 'qwen/qwen3.8-27b'];

const jarvisChatHandler = async (req, res) => {
  const lang = typeof req.body?.lang === 'string' ? req.body.lang : 'en-US';
  const offlineReply = (l) =>
    l === 'hi-IN'
      ? 'Struct AI Copilot abhi offline hai, kripya GROQ_API_KEY check karein.'
      : 'Struct AI Copilot is offline, please check GROQ_API_KEY.';

  try {
    const message = typeof req.body?.message === 'string' ? req.body.message : String(req.body?.message || '').trim();
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const contextData =
      req.body?.contextData && typeof req.body.contextData === 'object' && !Array.isArray(req.body.contextData)
        ? req.body.contextData
        : {};

    const structuredPrompt = buildStructCopilotPrompt(contextData);
    const customPrompt =
      typeof req.body?.systemPrompt === 'string' && req.body.systemPrompt.trim()
        ? req.body.systemPrompt.trim()
        : '';
    const systemPrompt = customPrompt
      ? `${structuredPrompt}\n\nADDITIONAL GUIDELINES FROM THE EMBEDDING APP:\n${customPrompt}`
      : structuredPrompt;

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      console.error('StructCopilot/Chat: GROQ_API_KEY is not set in .env — Groq API call aborted.');
      return res.json({ reply: offlineReply(lang) });
    }

    const groq = new OpenAI({
      apiKey: GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1"
    });

    const messages = [{ role: 'system', content: systemPrompt }];
    for (const h of history.slice(-8)) {
      const role = h.role === 'assistant' || h.role === 'model' ? 'assistant' : 'user';
      const text = typeof h.content === 'string' ? h.content : String(h.content || '');
      if (text) messages.push({ role, content: text });
    }
    messages.push({ role: 'user', content: message });

    let replyText = '';
    let lastErr = null;
    for (const model of GROQ_MODELS) {
      try {
        const completion = await groq.chat.completions.create({ model, messages });
        replyText = (completion?.choices?.[0]?.message?.content || '').trim();
        if (replyText) break;
      } catch (err) {
        lastErr = err;
        console.error(
          `StructCopilot/Chat: Groq model ${model} failed — status=${err?.status} message=${String(err?.message).slice(0, 200)}, trying next.`
        );
      }
    }

    if (!replyText) {
      console.error('StructCopilot/Chat: all Groq models failed (falling back to offline reply). Last error:', lastErr);
      return res.json({ reply: offlineReply(lang) });
    }
    res.json({ reply: replyText });
  } catch (err) {
    console.error('Backend error (falling back to offline reply):', err);
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