// ============================================================================
// Hazard Alert & Early Warning Service (Server-Side Background Monitor)
// ----------------------------------------------------------------------------
// Continuously polls live hazard feeds (Earthquake / Cyclone / Flood),
// evaluates HIGH RISK events and automatically dispatches Gmail SMTP alert
// emails to every registered user — entirely server-side, no browser needed.
// ============================================================================

require('dotenv').config();
const nodemailer = require('nodemailer');

const gmailAddress = process.env.GMAIL_USER || 'amitkushwaha0804@gmail.com';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailAddress,
    pass: process.env.GMAIL_APP_PASS
  },
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 15000, // 15 seconds
  greetingTimeout: 10000,
  socketTimeout: 15000
});

// ---------------------------------------------------------------------------
// Configuration (all overridable via environment variables)
// ---------------------------------------------------------------------------
const MONITOR_INTERVAL_MS = parseInt(process.env.HAZARD_SCAN_INTERVAL_MS || '300000', 10); // default: every 5 min
const EARTHQUAKE_HIGH_MAG = parseFloat(process.env.EARTHQUAKE_HIGH_MAG || '5.5');
const CYCLONE_HIGH_WIND_KMH = parseFloat(process.env.CYCLONE_HIGH_WIND_KMH || '40');
const FLOOD_HIGH_PRECIP_MM = parseFloat(process.env.FLOOD_HIGH_PRECIP_MM || '10');

// Key Indian conurbations tracked for Cyclone & Flood risk (lat/lng pairs).
const DEFAULT_MONITOR_LOCATIONS = [
  { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { name: 'Visakhapatnam', lat: 17.6868, lng: 83.2185 },
  { name: 'Bhubaneswar', lat: 20.2961, lng: 85.8245 },
  { name: 'Lucknow', lat: 26.8467, lng: 80.9462 },
  { name: 'New Delhi', lat: 28.6139, lng: 77.209 },
  { name: 'Gorakhpur', lat: 26.7606, lng: 83.3732 }
];

const getMonitorLocations = () => {
  try {
    const raw = process.env.MONITOR_LOCATIONS;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn('[HazardAlert] Invalid MONITOR_LOCATIONS JSON in .env, using defaults.');
  }
  return DEFAULT_MONITOR_LOCATIONS;
};

// ---------------------------------------------------------------------------
// Runtime state (kept in-memory for the lifetime of the server process)
// ---------------------------------------------------------------------------
let UserModel = null;          // Mongoose User model (injected by server.js)
let monitorInterval = null;
let isScanning = false;
let lastScan = null;
const activeAlerts = new Map(); // event key -> { hazardType, place, severity, firstDetectedAt }
const sentKeys = new Set();     // event keys already emailed (deduplication)

const getMonitoringEnabled = () => {
  return String(process.env.HAZARD_ALERT_ENABLED || 'true') !== 'false';
};

// ---------------------------------------------------------------------------
// Low level helpers
// ---------------------------------------------------------------------------
const timeoutFetch = async (url, ms = 15000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
};

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

// ---------------------------------------------------------------------------
// Hazard scanners (Earthquake / Cyclone / Flood)
// ---------------------------------------------------------------------------
const scanSeismic = async () => {
  const data = await timeoutFetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson');
  const events = [];
  for (const f of (data.features || [])) {
    const p = f.properties || {};
    const mag = Number(p.mag) || 0;
    if (mag >= EARTHQUAKE_HIGH_MAG) {
      events.push({
        key: `earthquake:${f.id || `${p.time}-${p.place}`}`,
        hazardType: 'Earthquake',
        severity: 'High',
        title: `High-Magnitude Earthquake (M ${mag.toFixed(1)})`,
        place: p.place || 'Unknown Region',
        magnitude: mag,
        time: p.time ? new Date(p.time).toISOString() : null,
        latitude: f.geometry?.coordinates?.[1] || null,
        longitude: f.geometry?.coordinates?.[0] || null
      });
    }
  }
  return events;
};

const scanCyclone = async (loc) => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m&hourly=wind_speed_10m&forecast_days=1&timezone=auto`;
  const data = await timeoutFetch(url);
  const windKmh = round1((data.current?.wind_speed_10m || 0) * 3.6);   // m/s -> km/h
  const gustsKmh = round1((data.current?.wind_gusts_10m || 0) * 3.6);
  if (windKmh >= CYCLONE_HIGH_WIND_KMH || gustsKmh >= CYCLONE_HIGH_WIND_KMH) {
    return {
      key: `cyclone:${loc.name}`,
      hazardType: 'Cyclone',
      severity: 'High',
      title: `High-Wind / Cyclone Risk in ${loc.name}`,
      place: loc.name,
      windSpeedKmh: windKmh,
      windGustsKmh: gustsKmh,
      windDirection: data.current?.wind_direction_10m || 0,
      latitude: loc.lat,
      longitude: loc.lng
    };
  }
  return null;
};

const scanFlood = async (loc) => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&current=precipitation,rain,showers&hourly=precipitation&forecast_days=1&timezone=auto`;
  const data = await timeoutFetch(url);
  const hourlyPrecip = (data.hourly?.precipitation || []).map(v => Number(v) || 0);
  const peak = hourlyPrecip.length ? Math.max(...hourlyPrecip) : 0;
  const current = Math.max(data.current?.precipitation || 0, data.current?.rain || 0, data.current?.showers || 0);
  if (peak >= FLOOD_HIGH_PRECIP_MM || current >= FLOOD_HIGH_PRECIP_MM) {
    return {
      key: `flood:${loc.name}`,
      hazardType: 'Flood',
      severity: 'High',
      title: `Heavy Rainfall / Flood Risk in ${loc.name}`,
      place: loc.name,
      precipitationMm: round1(current),
      peakPrecipitationMm: round1(peak),
      latitude: loc.lat,
      longitude: loc.lng
    };
  }
  return null;
};

// ---------------------------------------------------------------------------
// Gmail SMTP email dispatch (via Nodemailer) to registered users located in
// the affected alert region.
// ---------------------------------------------------------------------------
const getAllRegisteredUsers = async () => {
  if (!UserModel) return [];
  try {
    const users = await UserModel.find(
      { email: { $exists: true, $ne: '' } },
      { email: 1, fullName: 1, city: 1, state: 1, cityState: 1, address: 1 }
    ).lean();
    const seen = new Set();
    const unique = [];
    for (const u of users) {
      const email = (u.email || '').trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      unique.push({ ...u, email });
    }
    console.log(`[HazardAlert] Found ${unique.length} registered recipient(s) with email.`);
    return unique;
  } catch (err) {
    console.error('[HazardAlert] Failed to fetch registered users:', err.message);
    return [];
  }
};

const getUserLocationAreas = (user) => {
  const fields = [user.city, user.state, user.cityState, user.address];
  return [...new Set(
    fields
      .filter(Boolean)
      .map(v => String(v).trim().toLowerCase())
      .filter(Boolean)
  )];
};

const isLocationMatch = (user, event) => {
  const alertArea = String(`${event.place || ''} ${event.title || ''}`).toLowerCase().trim();
  if (!alertArea) return false;

  const userAreas = getUserLocationAreas(user);
  if (!userAreas.length) return false;

  return userAreas.some(area =>
    area.length > 1 && (alertArea.includes(area) || area.includes(alertArea))
  );
};

const escapeHtml = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const buildDetailRow = (label, value) =>
  `<tr><td style="padding:5px 10px 5px 0;color:#94a3b8;white-space:nowrap;font-size:12px">${label}</td>` +
  `<td style="padding:5px 0;color:#f8fafc;font-weight:700;font-size:12px">${value}</td></tr>`;

const buildEmailContent = (event) => {
  const place = escapeHtml(event.place);
  const subject = `🚨 HIGH RISK ALERT: ${event.title} — SHM Multi-Hazard Alert`;

  let rows = '';
  if (event.magnitude != null) rows += buildDetailRow('Magnitude', `M ${Number(event.magnitude).toFixed(1)}`);
  if (event.windSpeedKmh != null) rows += buildDetailRow('Wind Speed', `${event.windSpeedKmh} km/h`);
  if (event.windGustsKmh != null) rows += buildDetailRow('Wind Gusts', `${event.windGustsKmh} km/h`);
  if (event.precipitationMm != null) rows += buildDetailRow('Current Rain', `${event.precipitationMm} mm`);
  if (event.peakPrecipitationMm != null) rows += buildDetailRow('Peak Forecast', `${event.peakPrecipitationMm} mm`);
  if (event.latitude != null) rows += buildDetailRow('Coordinates', `${round1(event.latitude)}°, ${round1(event.longitude)}°`);
  if (event.time) rows += buildDetailRow('Detected At', new Date(event.time).toUTCString());

  const html =
    `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0b0f19;font-family:'Segoe UI',Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;background:#0f172a;border:1px solid #1e293b;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#7f1d1d,#b91c1c);padding:24px;text-align:center;">
          <div style="font-size:40px;">🚨</div>
          <div style="font-size:22px;font-weight:800;color:#fff;margin-top:4px;">HIGH RISK HAZARD ALERT</div>
          <div style="color:#fecaca;font-size:13px;margin-top:2px;">SHM Multi-Hazard Monitoring System</div>
        </div>
        <div style="padding:24px;">
          <div style="background:#020617;border:1px solid #334155;border-radius:12px;padding:16px;">
            <div style="color:#ef4444;font-size:15px;font-weight:700;">${escapeHtml(event.title)}</div>
            <div style="color:#f8fafc;font-size:13px;margin-top:6px;">
              Severity assessed as <b style="color:#ef4444;">HIGH RISK</b> for <b>${place}</b>.
            </div>
            <table style="width:100%;border-collapse:collapse;margin-top:12px;">${rows}</table>
          </div>
          <div style="background:#1e293b;border-radius:10px;padding:12px 16px;margin-top:14px;color:#cbd5e1;font-size:12px;line-height:1.7;">
            <b style="color:#38bdf8;">IMMEDIATE ACTIONS:</b><br/>
            • Follow instructions from local authorities and emergency dispatchers.<br/>
            • Move to higher ground or a reinforced structure if in a flood/cyclone zone.<br/>
            • Stay tuned to official alerts and the SHM Monitor dashboard.
          </div>
          <div style="color:#64748b;font-size:11px;margin-top:16px;text-align:center;">
            This is an automated early-warning notification from the Multi-Hazard Monitoring System.<br/>
            Geo-Tagged • CAP Protocol • Delivered via Gmail SMTP
          </div>
        </div>
      </div>
    </body></html>`;

  const text =
    `🚨 HIGH RISK ALERT: ${event.title}\n\n` +
    `Affected Area: ${event.place}\nSeverity: HIGH RISK\n\n` +
    `Immediate actions: follow local authorities, move to higher ground, ` +
    `and stay tuned to official alerts.\n\n— SHM Multi-Hazard Monitoring System (automated via Gmail SMTP)`;

  return { subject, html, text };
};

const sendAlertEmail = async ({ to, subject, html, text }) => {
  try {
    await transporter.sendMail({
      from: `"SHM Multi-Hazard Monitoring" <${gmailAddress}>`,
      to,
      subject,
      html,
      text
    });
    console.log(`[HazardAlert] ✔ Alert email sent via Gmail SMTP → ${to}`);
    return true;
  } catch (err) {
    console.error(`[HazardAlert] Gmail SMTP send failed → ${to}:`, err.message);
    return false;
  }
};

// Run a function over an array with limited concurrency (SMTP rate-limit safe).
const mapConcurrent = async (items, limit, fn) => {
  const results = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        results[i] = { error: err };
      }
    }
  });
  await Promise.all(workers);
  return results;
};

const dispatchAlerts = async (events) => {
  const users = await getAllRegisteredUsers();
  if (!users.length) {
    console.warn('[HazardAlert] No registered users with emails — nothing to notify.');
    return;
  }

  for (const event of events) {
    const { subject, html, text } = buildEmailContent(event);

    // Only notify users whose registered location matches the affected area.
    const recipients = users
      .filter(u => isLocationMatch(u, event))
      .map(u => u.email);

    if (!recipients.length) {
      console.log(
        `[HazardAlert] No registered users located in the affected region ("${event.place}") — ` +
        `skipping email dispatch for "${event.title}".`
      );
      sentKeys.add(event.key);
      continue;
    }

    const results = await mapConcurrent(recipients, 5, (to) =>
      sendAlertEmail({ to, subject, html, text })
    );
    const okCount = results.filter(r => r === true).length;
    console.log(
      `[HazardAlert] Dispatched "${event.title}" → ${okCount}/${recipients.length} registered users ` +
      `located in the affected region ("${event.place}").`
    );

    // Mark as sent so the same persistent event is only emailed once.
    sentKeys.add(event.key);
  }
};

// ---------------------------------------------------------------------------
// Core scan pipeline
// ---------------------------------------------------------------------------
const runScan = async () => {
  if (isScanning) {
    console.log('[HazardAlert] Scan already in progress — skipping this tick.');
    return;
  }
  isScanning = true;
  const startedAt = new Date();
  const detected = [];
  const detectedKeys = new Set();

  try {
    try {
      detected.push(...await scanSeismic());
    } catch (err) {
      console.warn('[HazardAlert] Earthquake scan failed:', err.message);
    }

    const locations = getMonitorLocations();
    for (const loc of locations) {
      try {
        const cy = await scanCyclone(loc);
        if (cy) detected.push(cy);
      } catch (err) {
        console.warn(`[HazardAlert] Cyclone scan failed for ${loc.name}:`, err.message);
      }
      try {
        const fl = await scanFlood(loc);
        if (fl) detected.push(fl);
      } catch (err) {
        console.warn(`[HazardAlert] Flood scan failed for ${loc.name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[HazardAlert] Scan pipeline error:', err.message);
  }

  // Clean up alerts that are no longer present in the live feeds.
  for (const e of detected) detectedKeys.add(e.key);
  for (const key of activeAlerts.keys()) {
    if (!detectedKeys.has(key)) activeAlerts.delete(key);
  }

  // Identify NEW events (never seen before) that should trigger emails.
  const toNotify = [];
  for (const event of detected) {
    if (!activeAlerts.has(event.key)) {
      activeAlerts.set(event.key, {
        hazardType: event.hazardType,
        place: event.place,
        severity: event.severity,
        firstDetectedAt: new Date().toISOString()
      });
      if (!sentKeys.has(event.key)) toNotify.push(event);
    }
  }

  lastScan = {
    at: new Date().toISOString(),
    durationMs: new Date() - startedAt,
    detected: detected.map(e => ({ type: e.hazardType, place: e.place, severity: e.severity })),
    newAlerts: toNotify.map(e => e.key),
    activeAlerts: activeAlerts.size
  };

  if (toNotify.length) {
    console.log(`[HazardAlert] ${toNotify.length} new HIGH RISK event(s) → dispatching Gmail SMTP emails to registered users.`);
    await dispatchAlerts(toNotify);
  } else {
    console.log(`[HazardAlert] Scan complete — ${detected.length} high-risk event(s) detected, none new.`);
  }

  isScanning = false;
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
const startHazardAlertService = (userModel) => {
  UserModel = userModel;

  if (!getMonitoringEnabled()) {
    console.log('[HazardAlert] Service disabled via HAZARD_ALERT_ENABLED=false.');
    return null;
  }
  if (monitorInterval) {
    console.log('[HazardAlert] Service already running.');
    return monitorInterval;
  }

  monitorInterval = setInterval(() => runScan(), MONITOR_INTERVAL_MS);
  console.log(
    `[HazardAlert] Background hazard alert service started — scanning Earthquake/Cyclone/Flood every ` +
    `${Math.round(MONITOR_INTERVAL_MS / 1000)}s, dispatching via Gmail SMTP.`
  );

  // Run an initial scan shortly after boot.
  setTimeout(() => runScan(), 8000);
  return monitorInterval;
};

const stopHazardAlertService = () => {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
};

// ---------------------------------------------------------------------------
// HTTP status / manual trigger handlers
// ---------------------------------------------------------------------------
const getMonitorStatus = (req, res) => {
  res.status(200).json({
    success: true,
    enabled: getMonitoringEnabled(),
    intervalMs: MONITOR_INTERVAL_MS,
    isScanning,
    dbRecipientsReady: !!UserModel,
    lastScan,
    activeAlertCount: activeAlerts.size,
    activeAlerts: [...activeAlerts.values()].map(a => ({
      hazardType: a.hazardType,
      place: a.place,
      severity: a.severity,
      firstDetectedAt: a.firstDetectedAt
    }))
  });
};

const triggerMonitorScan = async (req, res) => {
  if (isScanning) {
    return res.status(409).json({ success: false, message: 'A hazard scan is already running.' });
  }
  res.status(202).json({
    success: true,
    message: 'Hazard scan started. Check /api/alerts/monitor/status for results.'
  });
  runScan().catch((err) => console.error('[HazardAlert] Manual scan error:', err.message));
};

module.exports = {
  startHazardAlertService,
  stopHazardAlertService,
  runScan,
  getMonitorStatus,
  triggerMonitorScan
};