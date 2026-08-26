const mongoose = require('mongoose');

const batteryHealthSchema = new mongoose.Schema({
  batteryId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  period: { type: String, enum: ['hourly', 'daily', 'weekly'], default: 'hourly' },
  soc: {
    min: Number,
    max: Number,
    avg: Number,
    current: Number
  },
  soh: {
    current: Number,
    trend: { type: String, enum: ['improving', 'stable', 'degrading'] }
  },
  temperature: {
    min: Number,
    max: Number,
    avg: Number
  },
  voltage: {
    min: Number,
    max: Number,
    avg: Number
  },
  current: {
    min: Number,
    max: Number,
    avg: Number
  },
  cycles: {
    chargeCycles: Number,
    dischargeCycles: Number,
    totalCycles: Number
  },
  efficiency: Number,
  bhi: Number,
  safetyEvents: Number
}, { collection: 'battery_health' });

batteryHealthSchema.index({ batteryId: 1, timestamp: -1 });
batteryHealthSchema.index({ batteryId: 1, period: 1 });

module.exports = mongoose.model('BatteryHealth', batteryHealthSchema);
