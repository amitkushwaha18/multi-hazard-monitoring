const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Register Route
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, cityState } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Default to 'Public Citizen' if role is not provided
    const userRole = role === 'Authority/Admin' ? 'Authority/Admin' : 'Public Citizen';

    const newUser = new User({ name, email, passwordHash, role: userRole, cityState });
    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: user.role }, 'SIH_2026_SECRET_KEY', { expiresIn: '1d' });

    res.json({ token, role: user.role, name: user.name, cityState: user.cityState });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;