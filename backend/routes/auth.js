const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Brevo = require('@getbrevo/brevo');
const User = require('../models/User');
require('dotenv').config();

const OTP_TTL_MS = 5 * 60 * 1000;
const registerOtpStore = new Map();
const resetOtpStore = new Map();

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const brevoApi = new Brevo.TransactionalEmailsApi();
if (process.env.BREVO_API_KEY) {
  brevoApi.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
}

const SENDER_NAME = process.env.SENDER_NAME || 'SHM Monitor';
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'amitkushwaha0804@gmail.com';

const EMAIL_REQUEST_TIMEOUT_MS = 20000;

const sendViaBrevo = async ({ to, subject, html, text }) => {
  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = html;
  if (text) sendSmtpEmail.textContent = text;
  sendSmtpEmail.sender = { name: SENDER_NAME, email: SENDER_EMAIL };
  sendSmtpEmail.to = [{ email: to }];

  try {
    const response = await Promise.race([
      brevoApi.sendTransacEmail(sendSmtpEmail),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Brevo API request timed out')), EMAIL_REQUEST_TIMEOUT_MS)
      )
    ]);
    console.log(`[EMAIL OTP] Sent via Brevo → ${to} (messageId: ${response?.messageId || 'n/a'})`);
    return true;
  } catch (err) {
    console.error('[EMAIL OTP] Brevo send failed:', err?.message || err);
    throw err;
  }
};

const sendEmailOtp = async ({ to, otp, purpose }) => {
  const toAddress = String(to || '').toLowerCase().trim();
  if (!toAddress) throw new Error('No recipient email address provided');

  const isRegister = purpose === 'register';
  const subject = isRegister
    ? 'Verify Your Email - Complete Your Registration (SHM Monitor)'
    : 'Password Reset OTP - SHM Monitor';

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; background: #0f172a; color: #fff; border-radius: 12px; border: 1px solid #1e293b;">
      <h2 style="color: #22d3ee; margin-top: 0;">${isRegister ? 'Email Verification Required' : 'Password Reset Request'}</h2>
      <p style="color: #cbd5e1;">${isRegister
        ? 'Thank you for registering with SHM Monitor. Please verify your email address to activate your account.'
        : 'You requested to reset your password for your SHM Monitor account.'}</p>
      <p style="color: #cbd5e1;">Your secure verification OTP code is:</p>
      <div style="background: #1e293b; color: #38bdf8; font-size: 28px; font-weight: bold; padding: 12px 24px; display: inline-block; letter-spacing: 6px; border-radius: 8px; margin: 10px 0;">
        ${otp}
      </div>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">This OTP is valid for 5 minutes. If you did not request this, please ignore this email.</p>
    </div>
  `;
  const text = `Your SHM Monitor OTP is ${otp}. It is valid for 5 minutes.`;

  try {
    if (!process.env.BREVO_API_KEY) {
      console.error('[EMAIL OTP] OTP delivery FAILED: Brevo API key missing (set BREVO_API_KEY in backend/.env).');
      throw new Error('OTP delivery failed: Email service is not configured on the server (missing BREVO_API_KEY).');
    }
    return await sendViaBrevo({ to: toAddress, subject, html, text });
  } catch (err) {
    console.error('[EMAIL OTP] Failed to send email via Brevo:', err);
    throw new Error(`Failed to send OTP email: ${err.message}`);
  }
};

const ALLOWED_ADMINS = ['amitkushwaha0804@gmail.com', 'sdeepanshi010@gmail.com', 'mrityunjaikush@gmail.com', 'samarthkr55@gmail.com', 'akarnav815@gmail.com', 'pandeyshreya585@gmail.com'];
const resolveRole = (email, requestedRole) => {
  if (/admin/i.test(requestedRole || '')) {
    return ALLOWED_ADMINS.includes(email) ? 'Authority/Admin' : null;
  }
  return 'Public Citizen';
};

router.post('/register', (req, res) => {
  return res.status(400).json({
    success: false,
    message: 'Direct registration without Email OTP is disabled. Please request an OTP with /api/auth/send-otp to create your account.'
  });
});

router.post('/send-otp', async (req, res) => {
  try {
    const { email, name, phone, dob, address, state, city, pinCode, role } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Account already exists with this Email. Please Login.' });
    }

    const resolvedRole = resolveRole(normalizedEmail, role);
    if (!resolvedRole) {
      return res.status(403).json({
        success: false,
        message: '⚠️ Access Denied: Only authorized administrators can register as Admin.'
      });
    }

    const generatedOtp = generateOtp();

    registerOtpStore.set(normalizedEmail, {
      otp: generatedOtp,
      expires: Date.now() + OTP_TTL_MS,
      profile: {
        name: name || '',
        phone: phone || '',
        dob: dob || '',
        address: address || '',
        state: state || 'Uttar Pradesh',
        city: city || '',
        pinCode: pinCode || '',
        role: resolvedRole
      }
    });

    let sent = false;
    try {
      sent = await sendEmailOtp({ to: normalizedEmail, otp: generatedOtp, purpose: 'register' });
    } catch (sendErr) {
      console.error('Registration OTP send error:', sendErr);
      registerOtpStore.delete(normalizedEmail);
      return res.status(500).json({ success: false, message: sendErr.message });
    }
    if (!sent) {
      registerOtpStore.delete(normalizedEmail);
      return res.status(500).json({ success: false, message: 'Failed to send the verification email. Please try again.' });
    }

    return res.status(200).json({
      success: true,
      otpRequired: true,
      message: `A 6-digit verification OTP has been sent to ${normalizedEmail}. Please verify to complete registration.`
    });
  } catch (error) {
    console.error('Registration OTP request error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration', error: error.message });
  }
});

router.post('/verify-otp-register', async (req, res) => {
  try {
    const { name, email, password, otp } = req.body || {};
    if (!email || !otp || !name || !password) {
      return res.status(400).json({ success: false, message: 'Email, OTP, name, and password are required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const pending = registerOtpStore.get(normalizedEmail);

    if (!pending) {
      return res.status(400).json({ success: false, message: 'No pending registration found. Please request an OTP again.' });
    }

    if (Date.now() > pending.expires) {
      registerOtpStore.delete(normalizedEmail);
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (pending.otp !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code entered.' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      registerOtpStore.delete(normalizedEmail);
      return res.status(400).json({ success: false, message: 'Account already exists with this Email. Please Login.' });
    }

    const resolvedRole = resolveRole(normalizedEmail, req.body.role || pending.profile?.role);
    if (!resolvedRole) {
      return res.status(403).json({ success: false, message: '⚠️ Access Denied: Only authorized administrators can register as Admin.' });
    }

    const p = pending.profile || {};
    const hashedPassword = await bcrypt.hash(password, 10);
    const fullName = String(name).trim();

    const newUser = new User({
      fullName,
      name: fullName,
      email: normalizedEmail,
      phone: String(req.body.phone || p.phone || ''),
      mobileNumber: String(req.body.phone || p.phone || ''),
      dob: String(req.body.dob || p.dob || ''),
      password: hashedPassword,
      passwordHash: hashedPassword,
      address: String(req.body.address || p.address || ''),
      state: String(req.body.state || p.state || 'Uttar Pradesh').trim(),
      city: String(req.body.city || p.city || '').trim(),
      pinCode: String(req.body.pinCode || p.pinCode || '').trim(),
      role: resolvedRole,
      authProvider: 'local'
    });

    await newUser.save();
    registerOtpStore.delete(normalizedEmail);

    return res.status(201).json({
      success: true,
      message: 'Email verified! Account created successfully.',
      user: {
        role: newUser.role,
        fullName: newUser.fullName,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error('Registration OTP verification error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration', error: error.message });
  }
});

// Standard Login Route
router.post('/login', async (req, res) => {
  try {
    const { email, password, selectedRole } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) {
      return res.status(403).json({ success: false, message: 'Please register and login' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password || user.passwordHash || '').catch(() => false);
    if (!passwordMatches) {
      return res.status(400).json({ success: false, message: 'Invalid password' });
    }

    const userRegisteredRole = user.role || 'Public Citizen';
    if (selectedRole && selectedRole === 'Admin' && userRegisteredRole !== 'Authority/Admin') {
      return res.status(403).json({
        success: false,
        message: '⚠️ Warning: This account is registered as a Public Citizen. You cannot log in with administrative privileges.'
      });
    }

    const profile = {
      role: userRegisteredRole,
      fullName: user.fullName || user.name || 'User',
      email: user.email,
      phone: user.phone || user.mobileNumber || '',
      city: user.city || '',
      state: user.state || '',
      address: user.address || '',
      pinCode: user.pinCode || ''
    };

    const token = jwt.sign(
      { id: user._id, role: userRegisteredRole },
      process.env.JWT_SECRET || 'SIH_2026_SECRET_KEY',
      { expiresIn: '1d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: profile,
      role: profile.role,
      fullName: profile.fullName,
      email: profile.email
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during login', error: error.message });
  }
});

router.post('/send-password-otp', async (req, res) => {
  try {
    const { target, email } = req.body || {};
    const rawTarget = String(target || email || '').trim();
    if (!rawTarget) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const cleanTarget = rawTarget.toLowerCase().trim();
    console.log("Forgot Password requested for:", cleanTarget);
    const userExists = await User.findOne({ email: cleanTarget });

    if (!userExists) {
      return res.status(404).json({ success: false, message: 'No account found registered with this email.' });
    }

    const generatedOtp = generateOtp();
    resetOtpStore.set(cleanTarget, { otp: generatedOtp, expires: Date.now() + OTP_TTL_MS });

    const sent = await sendEmailOtp({ to: cleanTarget, otp: generatedOtp, purpose: 'reset' });
    if (!sent) {
      throw new Error('Failed to send OTP email via Brevo.');
    }

    return res.status(200).json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Mail error details:', error);
    console.error('[PASSWORD OTP] Failed to send OTP:', error);
    // Return the 500 immediately so the HTTP response does NOT time out or hang.
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/reset-password-otp', async (req, res) => {
  try {
    const { target, otp, newPassword } = req.body || {};
    if (!target || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Target, OTP and new password are required' });
    }

    const key = target.toLowerCase().trim();
    const storedData = resetOtpStore.get(key);

    if (!storedData || Date.now() > storedData.expires || storedData.otp !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    const user = await User.findOne({
      $or: [{ email: key }, { phone: key }, { mobileNumber: key }]
    });

    if (!user) return res.status(404).json({ success: false, message: 'User account not found.' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.passwordHash = hashedPassword;
    await user.save();

    resetOtpStore.delete(key);
    return res.status(200).json({ success: true, message: 'Password reset successfully!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error updating password', error: error.message });
  }
});

// Admin Dashboard: Fetch All Registered Users from MongoDB
router.get('/users', async (req, res) => {
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

// Google OAuth Route
router.post('/google', async (req, res) => {
  try {
    const { idToken, accessToken, googleToken, fallbackName, fallbackEmail, email, password } = req.body || {};
    const bearerToken = accessToken || googleToken;
    let profile = null;

    if (bearerToken) {
      try {
        const verifyRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${bearerToken}` }
        });
        if (verifyRes.ok) {
          const payload = await verifyRes.json();
          if (payload && payload.email) {
            profile = { fullName: payload.name || payload.email.split('@')[0], email: payload.email.toLowerCase().trim() };
          }
        }
      } catch (verifyErr) {}
    }

    if (!profile) {
      const rawEmail = String(email || fallbackEmail || '').toLowerCase().trim();
      if (rawEmail) profile = { fullName: fallbackName || 'Google User', email: rawEmail };
    }

    if (!profile || !profile.email) {
      return res.status(401).json({ success: false, message: 'Google authentication failed.' });
    }

    const user = await User.findOne({ email: profile.email });

    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'Please register and login'
      });
    }

    if (!password) {
      return res.status(200).json({
        success: true,
        needsPassword: true,
        message: 'Account found. Please enter your password to complete Google login.',
        email: user.email
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password || user.passwordHash || '').catch(() => false);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: 'Invalid password.' });
    }

    const sessionToken = jwt.sign(
      { id: user._id, role: user.role || 'Public Citizen', authProvider: 'google' },
      process.env.JWT_SECRET || 'SIH_2026_SECRET_KEY',
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Signed in with Google',
      token: sessionToken,
      user: {
        role: user.role || 'Public Citizen',
        fullName: user.fullName || user.name || 'User',
        email: user.email,
        phone: user.phone || ''
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Google sign-in failed', error: error.message });
  }
});

module.exports = router;