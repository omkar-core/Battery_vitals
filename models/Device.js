const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceName: { type: String, required: true },
  macAddress: { type: String, required: true, unique: true },
  firmwareVersion: String,
  hardwareVersion: String,
  ipAddress: String,
  lastSeen: { type: Date, default: Date.now },
  status: { type: String, enum: ['online', 'offline', 'maintenance'], default: 'offline' },
  registeredAt: { type: Date, default: Date.now },
  location: String,
  notes: String,
  config: {
    sampleInterval: { type: Number, default: 3 },
    batteryType: { type: String, default: 'LI_ION' },
    nominalVoltage: { type: Number, default: 12.6 },
    capacity: { type: Number, default: 60 }
  }
}, { collection: 'devices' });

// macAddress index already created by unique: true
deviceSchema.index({ status: 1 });
deviceSchema.index({ lastSeen: -1 });

module.exports = mongoose.model('Device', deviceSchema);
