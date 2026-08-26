const mongoose = require('mongoose');

const mlTrainingDatasetSchema = new mongoose.Schema({
  batteryId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  label: { type: String, enum: ['NORMAL', 'DEGRADING', 'FAULT', 'PREDICTIVE_FAILURE'] },
  features: {
    voltage: Number,
    current: Number,
    power: Number,
    temperature: Number,
    humidity: Number,
    soc: Number,
    soh: Number,
    resistance: Number,
    gasIndex: Number,
    cycleCount: Number,
    daysSinceInstall: Number,
    avgTemperature: Number,
    maxTemperature: Number,
    temperatureVariance: Number,
    voltageVariance: Number,
    currentVariance: Number,
    chargeTime: Number,
    dischargeTime: Number,
    efficiency: Number
  },
  usedForTraining: { type: Boolean, default: false },
  modelVersion: String
}, { collection: 'ml_training_dataset' });

mlTrainingDatasetSchema.index({ batteryId: 1, timestamp: -1 });
mlTrainingDatasetSchema.index({ label: 1 });
mlTrainingDatasetSchema.index({ usedForTraining: 1 });

module.exports = mongoose.model('MLTrainingDataset', mlTrainingDatasetSchema);
