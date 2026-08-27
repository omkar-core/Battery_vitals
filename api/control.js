const connectDB = require('./db');
const Command = require('../models/Command');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const defaults = { auto_mode: true, red_led: false, yellow_led: false, green_led: true, buzzer: false };

  try {
    try {
      await connectDB();
    } catch (dbErr) {
      console.error('[control] DB connect failed:', dbErr.message);
      return res.status(200).json(defaults);
    }

    if (req.method === 'GET') {
      let cmd = await Command.findOne({ key: 'default' }).lean();
      if (!cmd) {
        cmd = await Command.create({ key: 'default' });
        cmd = cmd.toObject();
      }
      return res.status(200).json({
        auto_mode: cmd.auto_mode, red_led: cmd.red_led,
        yellow_led: cmd.yellow_led, green_led: cmd.green_led, buzzer: cmd.buzzer
      });
    }

    if (req.method === 'POST') {
      const allowed = ['auto_mode', 'red_led', 'yellow_led', 'green_led', 'buzzer'];
      const update = { updatedAt: new Date() };
      for (const key of allowed) {
        if (req.body[key] !== undefined) update[key] = !!req.body[key];
      }
      const cmd = await Command.findOneAndUpdate({ key: 'default' }, { $set: update }, { upsert: true, new: true }).lean();
      return res.status(200).json({ success: true, commands: cmd });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[control] error:', err.message);
    res.status(200).json(defaults);
  }
};
