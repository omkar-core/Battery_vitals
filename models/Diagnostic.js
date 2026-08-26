const mongoose = require('mongoose');

const diagnosticSchema = new mongoose.Schema({
  batteryId: { type: String, required: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, enum: ['SELF_TEST', 'CALIBRATION', 'DIAGNOSTIC', 'FACTORY_RESET'] },
  status: { type: String, enum: ['pending', 'running', 'passed', 'failed'] },
  results: {
    voltageSensor: { type: String, enum: ['PASS', 'FAIL', 'SKIP'] },
    currentSensor: { type: String, enum: ['PASS', 'FAIL', 'SKIP'] },
    gasSensor: { type: String, enum: ['PASS', 'FAIL', 'SKIP'] },
    tempSensor: { type: String, enum: ['PASS', 'FAIL', 'SKIP'] },
    buzzer: { type: String, enum: ['PASS', 'FAIL', 'SKIP'] },
    leds: { type: String, enum: ['PASS', 'FAIL', 'SKIP'] },
    memory: { type: String, enum: ['PASS', 'FAIL', 'SKIP'] }
  },
  overallResult: { type: String, enum: ['PASS', 'FAIL', 'PARTIAL'] },
  details: String,
  performedBy: { type: String, enum: ['USER', 'AUTO', 'FIRMWARE'] }
}, { collection: 'diagnostics' });

diagnosticSchema.index({ batteryId: 1, timestamp: -1 });
diagnosticSchema.index({ type: 1 });
diagnosticSchema.index({ status: 1 });

module.exports = mongoose.model('Diagnostic', diagnosticSchema);
