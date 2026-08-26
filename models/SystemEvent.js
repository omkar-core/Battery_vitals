const mongoose = require('mongoose');

const systemEventSchema = new mongoose.Schema({
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
  batteryId: String,
  timestamp: { type: Date, default: Date.now },
  type: { type: String, enum: ['DEVICE_ONLINE', 'DEVICE_OFFLINE', 'CONFIG_CHANGE', 'FIRMWARE_UPDATE', 'USER_ACTION', 'SYSTEM_ERROR', 'SAFETY_EVENT'] },
  severity: { type: String, enum: ['INFO', 'WARNING', 'ERROR'], default: 'INFO' },
  message: { type: String, required: true },
  details: mongoose.Schema.Types.Mixed,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ipAddress: String
}, { collection: 'system_events' });

systemEventSchema.index({ timestamp: -1 });
systemEventSchema.index({ type: 1 });
systemEventSchema.index({ deviceId: 1 });

module.exports = mongoose.model('SystemEvent', systemEventSchema);
