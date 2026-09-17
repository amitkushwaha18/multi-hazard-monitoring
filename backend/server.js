const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: '*',
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
})
.catch((err) => console.log('MongoDB Connection Error:', err));

// User Schema & Model
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  dob: { type: String, required: true },
  password: { type: String, required: true },
  address: { type: String, required: true },
  state: { type: String, required: true },
  city: { type: String, required: true },
  pinCode: { type: String, required: true },
  role: { type: String, default: 'Public Citizen' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// In-Memory OTP Store for Password Reset
const otpStore = new Map();

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

// 1. Register API Endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, phone, dob, password, address, state, city, pinCode, role } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ success: false, message: 'All mandatory fields are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const safeRole = /admin/i.test(role || '') ? 'Authority/Admin' : 'Public Citizen';

    const newUser = new User({
      fullName,
      email: normalizedEmail,
      phone,
      dob,
      password: hashedPassword,
      address,
      state,
      city,
      pinCode,
      role: safeRole
    });

    await newUser.save();
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        role: safeRole,
        fullName: newUser.fullName,
        email: newUser.email,
        phone: newUser.phone,
        city: newUser.city,
        state: newUser.state,
        address: newUser.address,
        pinCode: newUser.pinCode
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during registration', error: error.message });
  }
});

// 2. Login API Endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found with this email' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password).catch(() => false);
    if (!passwordMatches) {
      return res.status(400).json({ success: false, message: 'Invalid password' });
    }

    const profile = {
      role: user.role || 'Public Citizen',
      fullName: user.fullName || 'User',
      email: user.email,
      phone: user.phone || '',
      city: user.city || '',
      state: user.state || '',
      address: user.address || '',
      pinCode: user.pinCode || ''
    };

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: profile,
      role: profile.role,
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      city: profile.city,
      state: profile.state
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during login', error: error.message });
  }
});

// 3. Send OTP Endpoint (Email or Mobile)
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { target, type } = req.body;
    if (!target) return res.status(400).json({ success: false, message: 'Target email or mobile number is required' });

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(target.toLowerCase().trim(), { otp: generatedOtp, expires: Date.now() + 300000 });

    console.log(`[OTP ENGINE] Generated OTP for ${target}: ${generatedOtp}`);

    return res.status(200).json({
      success: true,
      message: `OTP sent successfully to your registered ${type}!`,
      otpDemo: generatedOtp
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to send OTP', error: error.message });
  }
});

// 4. Verify OTP & Reset Password Endpoint
app.post('/api/auth/reset-password-otp', async (req, res) => {
  try {
    const { target, otp, newPassword } = req.body;
    const key = target.toLowerCase().trim();

    const storedData = otpStore.get(key);
    if (!storedData) {
      return res.status(400).json({ success: false, message: 'No active OTP request found or code expired' });
    }

    if (Date.now() > storedData.expires) {
      otpStore.delete(key);
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (storedData.otp !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code' });
    }

    const user = await User.findOne({
      $or: [{ email: key }, { phone: key }]
    });

    if (user) {
      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();
    }

    otpStore.delete(key);
    return res.status(200).json({ success: true, message: 'Password reset successfully! You can now login.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error resetting password', error: error.message });
  }
});

// 5. Continue with Google Endpoint
app.post('/api/auth/google', async (req, res) => {
  try {
    const { idToken, accessToken, fallbackName, fallbackEmail } = req.body || {};
    let profile = null;

    if (accessToken) {
      try {
        const verifyRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (verifyRes.ok) {
          const payload = await verifyRes.json();
          if (payload && payload.email && payload.email_verified !== false) {
            profile = {
              fullName: payload.name || payload.email.split('@')[0],
              email: payload.email.toLowerCase().trim()
            };
          }
        }
      } catch (verifyErr) {
        console.warn('Google access-token verification unavailable:', verifyErr.message);
      }
      if (!profile) {
        return res.status(401).json({ success: false, message: 'Google authentication failed. Please sign in again.' });
      }
    } else if (idToken) {
      try {
        const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
        if (verifyRes.ok) {
          const payload = await verifyRes.json();
          if (payload && payload.email) {
            profile = {
              fullName: payload.name || payload.email.split('@')[0],
              email: payload.email.toLowerCase().trim()
            };
          }
        }
      } catch (verifyErr) {
        console.warn('Google id-token verification unavailable:', verifyErr.message);
      }
      if (!profile) {
        return res.status(401).json({ success: false, message: 'Google authentication failed. Please sign in again.' });
      }
    }

    if (!profile) {
      const demoSuffix = Date.now().toString().slice(-6);
      profile = {
        fullName: fallbackName || 'Google User',
        email: (fallbackEmail || `google.guest.${demoSuffix}@shm-demo.local`).toLowerCase().trim()
      };
    }

    let user = await User.findOne({ email: profile.email });
    let created = false;
    if (!user) {
      user = new User({
        fullName: profile.fullName,
        email: profile.email,
        phone: 'N/A',
        dob: 'N/A',
        password: await bcrypt.hash(`google-oauth-${Date.now()}`, 10),
        address: 'N/A',
        state: 'Gorakhpur, Uttar Pradesh',
        city: 'Gorakhpur',
        pinCode: 'N/A',
        role: 'Public Citizen'
      });
      await user.save();
      created = true;
    }

    const sessionToken = jwt.sign(
      { id: user._id, role: user.role || 'Public Citizen', authProvider: 'google' },
      process.env.JWT_SECRET || 'SIH_2026_SECRET_KEY',
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      success: true,
      message: created ? 'Account created and signed in with Google' : 'Signed in with Google',
      token: sessionToken,
      user: {
        role: user.role || 'Public Citizen',
        fullName: user.fullName,
        email: user.email,
        phone: user.phone || '',
        city: user.city || '',
        state: user.state || '',
        address: user.address || '',
        pinCode: user.pinCode || ''
      },
      role: user.role || 'Public Citizen',
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || '',
      city: user.city || '',
      state: user.state || ''
    });
  } catch (error) {
    console.warn('Google sign-in error:', error.message);
    return res.status(500).json({ success: false, message: 'Google sign-in failed. Please try again.', error: error.message });
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

// 7. Cyclone / Wind Telemetry API Endpoint (Fixed ECONNRESET with Graceful Fallback)
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

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});