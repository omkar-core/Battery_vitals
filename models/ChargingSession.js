const mongoose = require('mongoose');

const chargingSessionSchema = new mongoose.Schema({
  batteryId: { type: String, required: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
  startTime: { type: Date, required: true },
  endTime: Date,
  startSoc: Number,
  endSoc: Number,
  duration: Number,
  energyConsumed: Number,
  maxVoltage: Number,
  minVoltage: Number,
  maxCurrent: Number,
  avgCurrent: Number,
  maxTemperature: Number,
  avgTemperature: Number,
  efficiency: Number,
  status: { type: String, enum: ['charging', 'completed', 'interrupted', 'faulty'], default: 'charging' },
  interruptions: [{
    time: Date,
    reason: String,
    duration: Number
  }]
}, { collection: 'charging_sessions' });

chargingSessionSchema.index({ batteryId: 1, startTime: -1 });
chargingSessionSchema.index({ status: 1 });

module.exports = mongoose.model('ChargingSession', chargingSessionSchema);
