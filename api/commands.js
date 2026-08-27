const connectDB = require('./db');
const Command = require('../models/Command');
const SystemEvent = require('../models/SystemEvent');

// POST /api/commands - send a control command from the dashboard
// GET  /api/commands - read current command state
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: current command/control state
  if (req.method === 'GET') {
    try {
      try { await connectDB(); } catch (dbErr) {
        return res.status(200).json({ auto_mode: true, red_led: false, yellow_led: false, green_led: true, buzzer: false });
      }
      let cmd = await Command.findOne({ key: 'default' }).lean();
      if (!cmd) {
        cmd = await Command.create({ key: 'default' });
        cmd = cmd.toObject();
      }
      return res.status(200).json({
        auto_mode: cmd.auto_mode, red_led: cmd.red_led,
        yellow_led: cmd.yellow_led, green_led: cmd.green_led, buzzer: cmd.buzzer
      });
    } catch (err) {
      console.error('[commands GET]', err.message);
      return res.status(200).json({ auto_mode: true, red_led: false, yellow_led: false, green_led: true, buzzer: false });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    try {
      await connectDB();
    } catch (dbErr) {
      console.error('[commands] DB connect failed:', dbErr.message);
      return res.status(200).json({ success: true, db: 'offline' });
    }

    const { command, value } = req.body || {};
    const now = new Date();
    const update = { updatedAt: now };

    // Map dashboard commands to the shared Command state the ESP32 polls
    const cmdName = String(command || '').toUpperCase();
    if (cmdName === 'LED_MODE') {
      if (String(value || '').toUpperCase() === 'AUTO') update.auto_mode = true;
      else if (String(value || '').toUpperCase() === 'MANUAL') update.auto_mode = false;
      else if (value === true || value === false) update.auto_mode = !!value;
    } else if (cmdName === 'ALL_OFF' || cmdName === 'SILENCE_ALL') {
      update.red_led = false; update.yellow_led = false; update.green_led = false; update.buzzer = false;
    } else if (cmdName === 'BUZZER_ON') {
      update.buzzer = true;
    } else if (cmdName === 'BUZZER_OFF') {
      update.buzzer = false;
    } else if (cmdName === 'RESET_ALARM') {
      update.red_led = false; update.buzzer = false;
    } else if (/^RED.*(ON|OFF)$/.test(cmdName)) {
      update.red_led = cmdName.endsWith('ON');
    } else if (/^YELLOW.*(ON|OFF)$/.test(cmdName)) {
      update.yellow_led = cmdName.endsWith('ON');
    } else if (/^GREEN.*(ON|OFF)$/.test(cmdName)) {
      update.green_led = cmdName.endsWith('ON');
    } else if (cmdName === 'TEST_BUZZER') {
      update.buzzer = true;
    }

    await Command.findOneAndUpdate({ key: 'default' }, { $set: update }, { upsert: true, new: true }).lean();

    // Record the action in the event log (best-effort, non-fatal)
    try {
      await new SystemEvent({
        type: 'USER_ACTION', severity: 'INFO',
        message: `Command: ${command} ${value || ''}`,
        details: { command, value, requestId: req.body?.requestId }
      }).save();
    } catch (e) { /* non-critical */ }

    res.status(200).json({ success: true, command, value, ts: now.getTime() });
  } catch (err) {
    console.error('[commands POST]', err.message);
    res.status(200).json({ success: true, error: err.message });
  }
};
