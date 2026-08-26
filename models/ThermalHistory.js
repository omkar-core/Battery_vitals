const mongoose = require('mongoose');

const thermalHistorySchema = new mongoose.Schema({
  batteryId: { type: String, required: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
  timestamp: { type: Date, default: Date.now },
  temperature: Number,
  humidity: Number,
  ambientTemp: Number,
  hotSpot: Boolean,
  thermalRunawayRisk: { type: String, enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH'] },
  coolingActive: Boolean
}, { collection: 'thermal_history' });

thermalHistorySchema.index({ batteryId: 1, timestamp: -1 });
thermalHistorySchema.index({ hotSpot: 1 });
thermalHistorySchema.index({ thermalRunawayRisk: 1 });

module.exports = mongoose.model('ThermalHistory', thermalHistorySchema);
