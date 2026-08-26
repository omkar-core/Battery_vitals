const mongoose = require('mongoose');

const batterySchema = new mongoose.Schema({
  batteryId: { type: String, required: true, unique: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
  name: { type: String, required: true },
  chemistry: { type: String, enum: ['LEAD_ACID', 'LIPO', 'LI_ION', 'LIFEPO4'], default: 'LI_ION' },
  nominalVoltage: { type: Number, required: true },
  capacity: { type: Number, required: true },
  manufacturer: String,
  model: String,
  serialNumber: String,
  manufactureDate: Date,
  installDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'inactive', 'retired', 'faulty'], default: 'active' },
  totalCycles: { type: Number, default: 0 },
  totalChargeTime: { type: Number, default: 0 },
  notes: String,
  passport: {
    originalCapacity: Number,
    currentCapacity: Number,
    healthScore: Number,
    purchaseDate: Date,
    warrantyExpiry: Date
  }
}, { collection: 'batteries' });

batterySchema.index({ batteryId: 1 });
batterySchema.index({ deviceId: 1 });
batterySchema.index({ status: 1 });

module.exports = mongoose.model('Battery', batterySchema);
