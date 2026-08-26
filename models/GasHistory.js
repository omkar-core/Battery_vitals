const mongoose = require('mongoose');

const gasHistorySchema = new mongoose.Schema({
  batteryId: { type: String, required: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
  timestamp: { type: Date, default: Date.now },
  mq2Index: Number,
  mq2Status: String,
  mq135Index: Number,
  mq135Status: String,
  warm: Boolean,
  gasDetected: { type: Boolean, default: false },
  gasType: { type: String, enum: ['NONE', 'SMOKE', 'METHANE', 'LPG', 'CO', 'VOC'] },
  riskLevel: { type: String, enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH'] }
}, { collection: 'gas_history' });

gasHistorySchema.index({ batteryId: 1, timestamp: -1 });
gasHistorySchema.index({ gasDetected: 1 });

module.exports = mongoose.model('GasHistory', gasHistorySchema);
