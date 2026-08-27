const mongoose = require('mongoose');

const commandSchema = new mongoose.Schema({
  key: { type: String, required: true, default: 'default', unique: true },
  auto_mode: { type: Boolean, default: true },
  red_led: { type: Boolean, default: false },
  yellow_led: { type: Boolean, default: false },
  green_led: { type: Boolean, default: true },
  buzzer: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'commands' });

module.exports = mongoose.model('Command', commandSchema);
