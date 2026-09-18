const express = require('express');
const router = express.Router();
const { sendEmergencyAlert } = require('../controllers/alertController');
const { getMonitorStatus, triggerMonitorScan } = require('../services/hazardAlertService');

// Manual CAP dispatch (existing behavior)
router.post('/dispatch', sendEmergencyAlert);

// Automated hazard monitor endpoints
router.get('/monitor/status', getMonitorStatus);
router.post('/monitor/trigger', triggerMonitorScan);

module.exports = router;