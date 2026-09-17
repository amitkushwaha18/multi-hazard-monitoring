const express = require('express');
const router = express.Router();
const { sendEmergencyAlert } = require('../controllers/alertController');

router.post('/dispatch', sendEmergencyAlert);

module.exports = router;