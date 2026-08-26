const mongoose = require('mongoose');

const liveDataSchema = new mongoose.Schema({
  batteryId: { type: String, required: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
  timestamp: { type: Date, default: Date.now },
  voltage: Number,
  current: Number,
  power: Number,
  soc: Number,
  soh: Number,
  temperature: Number,
  humidity: Number,
  gasIndex: {
    mq2: Number,
    mq135: Number
  },
  safety: { type: String, enum: ['SAFE', 'CAUTION', 'WARNING', 'CRITICAL', 'EMERGENCY'], default: 'SAFE' },
  bhi: Number,
  opDirection: { type: String, enum: ['CHARGING', 'DISCHARGING', 'IDLE'], default: 'IDLE' },
  resistance: Number,
  outputs: {
    green: Boolean,
    yellow: Boolean,
    red: Boolean,
    buzzer: Boolean,
    auto: Boolean
  },
  network: {
    rssi: Number,
    ip: String,
    heap: Number
  }
}, { collection: 'live_data' });

liveDataSchema.index({ batteryId: 1 });
liveDataSchema.index({ timestamp: -1 });

module.exports = mongoose.model('LiveData', liveDataSchema);
