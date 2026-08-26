const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
  batteryId: { type: String, required: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
  timestamp: { type: Date, default: Date.now },
  modelVersion: String,
  riskLevel: { type: String, enum: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] },
  riskScore: Number,
  predictedSoh: Number,
  predictedRemainingLife: Number,
  failureProbability: Number,
  analysis: String,
  recommendations: [String],
  features: {
    avgVoltage: Number,
    avgCurrent: Number,
    avgTemperature: Number,
    maxTemperature: Number,
    cycleCount: Number,
    daysSinceInstall: Number,
    internalResistance: Number
  }
}, { collection: 'predictions' });

predictionSchema.index({ batteryId: 1, timestamp: -1 });
predictionSchema.index({ riskLevel: 1 });

module.exports = mongoose.model('Prediction', predictionSchema);
