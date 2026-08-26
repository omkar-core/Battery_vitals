const mongoose = require('mongoose');

const firmwareLogSchema = new mongoose.Schema({
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, enum: ['BOOT', 'CRASH', 'OTA_START', 'OTA_COMPLETE', 'OTA_FAILED', 'WATCHDOG', 'ERROR', 'INFO'] },
  version: String,
  previousVersion: String,
  message: String,
  stackTrace: String,
  freeHeap: Number,
  uptime: Number,
  ipAddress: String,
  restartReason: String
}, { collection: 'firmware_logs' });

firmwareLogSchema.index({ deviceId: 1, timestamp: -1 });
firmwareLogSchema.index({ type: 1 });

module.exports = mongoose.model('FirmwareLog', firmwareLogSchema);
