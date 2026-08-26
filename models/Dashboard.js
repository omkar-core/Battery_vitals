const mongoose = require('mongoose');

const dashboardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  batteryId: { type: String, required: true },
  name: { type: String, default: 'My Dashboard' },
  layout: {
    widgets: [{
      type: { type: String },
      position: { x: Number, y: Number },
      size: { width: Number, height: Number },
      config: mongoose.Schema.Types.Mixed
    }]
  },
  alerts: {
    enabled: { type: Boolean, default: true },
    thresholds: {
      temperature: { warning: Number, critical: Number },
      voltage: { low: Number, high: Number },
      soc: { low: Number },
      gas: { warning: Number, critical: Number }
    }
  },
  refreshInterval: { type: Number, default: 3000 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'dashboards' });

dashboardSchema.index({ userId: 1 });
dashboardSchema.index({ batteryId: 1 });

module.exports = mongoose.model('Dashboard', dashboardSchema);
