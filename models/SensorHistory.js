const mongoose = require('mongoose');

const sensorHistorySchema = new mongoose.Schema({
  batteryId: { type: String, required: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
  timestamp: { type: Date, default: Date.now },
  voltage: Number,
  current: Number,
  power: Number,
  soc: Number,
  soh: Number,
  resistance: Number,
  opDirection: { type: String, enum: ['CHARGING', 'DISCHARGING', 'IDLE'] }
}, { collection: 'sensor_history' });

sensorHistorySchema.index({ batteryId: 1, timestamp: -1 });
sensorHistorySchema.index({ timestamp: -1 });

module.exports = mongoose.model('SensorHistory', sensorHistorySchema);
