const mongoose = require('mongoose');

let cached = global._mongoCache;
if (!cached) cached = global._mongoCache = { conn: null, promise: null, lastError: null };

async function connectDB() {
  // Return cached connection if alive
  if (cached.conn) {
    try {
      if (cached.conn.readyState === 1) return cached.conn;
    } catch (e) {
      cached.conn = null;
      cached.promise = null;
    }
  }

  const URI = process.env.MONGODB_URI;
  if (!URI) throw new Error('MONGODB_URI not set in environment variables');

  // Reuse pending connection attempt
  if (cached.promise) return cached.promise;

  cached.promise = mongoose.connect(URI, {
    serverSelectionTimeoutMS: 8000,
    heartbeatFrequencyMS: 30000,
    maxPoolSize: 5,
    minPoolSize: 0
  }).then(conn => {
    cached.conn = conn;
    cached.lastError = null;
    return conn;
  }).catch(err => {
    cached.promise = null;
    cached.lastError = err.message;
    throw err;
  });

  try {
    return await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
}

function isDBConnected() {
  return cached.conn && cached.conn.readyState === 1;
}

module.exports = connectDB;
module.exports.isDBConnected = isDBConnected;
