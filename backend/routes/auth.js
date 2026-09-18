const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
require('dotenv').config();

const OTP_TTL_MS = 5 * 60 * 1000;
const registerOtpStore = new Map();
const resetOtpStore = new Map();

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendEmailOtp = async ({ to, otp, purpose }) => {
  const toAddress = String(to || '').toLowerCase().trim();
  if (!toAddress) return false;

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

  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (token) {
    try {
      const res = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Postmark-Server-Token': token
        },
        body: JSON.stringify({
          From: process.env.POSTMARK_FROM_EMAIL || process.env.EMAIL_USER || 'noreply@shm-monitor.local',
          To: toAddress,
          Subject: subject,
          HtmlBody: html,
          TextBody: text,
          MessageStream: 'outbound'
        })
      });
      if (res.ok) return true;
    } catch (postmarkErr) {
      console.warn('[EMAIL OTP] Postmark fallback to Nodemailer:', postmarkErr.message);
    }
  }

  try {
    const mailOptions = {
      from: `"SHM Multi-Hazard Security" <${process.env.EMAIL_USER || 'support@shm-monitor.local'}>`,
      to: toAddress,
      subject,
      html
    };
    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error('[EMAIL OTP] Failed to send email:', err.message);
    return false;
  }
};

const ALLOWED_ADMINS = ['amitkushwaha0804@gmail.com'];
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

    const sent = await sendEmailOtp({ to: normalizedEmail, otp: generatedOtp, purpose: 'register' });
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
    const { target, type } = req.body || {};
    if (!target) {
      return res.status(400).json({ success: false, message: 'Target email or mobile number is required' });
    }

    const cleanTarget = target.toLowerCase().trim();
    const userExists = await User.findOne({
      $or: [{ email: cleanTarget }, { phone: cleanTarget }, { mobileNumber: cleanTarget }]
    });

    if (!userExists) {
      return res.status(404).json({ success: false, message: 'No account found registered with these details.' });
    }

    const generatedOtp = generateOtp();
    resetOtpStore.set(cleanTarget, { otp: generatedOtp, expires: Date.now() + OTP_TTL_MS });

    if (type === 'email' || cleanTarget.includes('@')) {
      const sent = await sendEmailOtp({ to: cleanTarget, otp: generatedOtp, purpose: 'reset' });
      if (!sent) {
        return res.status(500).json({ success: false, message: 'Failed to send OTP.' });
      }
    }

    return res.status(200).json({ success: true, message: `OTP sent successfully to your registered ${type}!` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to send OTP.', error: error.message });
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