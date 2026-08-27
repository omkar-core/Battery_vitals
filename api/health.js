const connectDB = require('./db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const result = {
    status: 'ok',
    uptime: process.uptime(),
    ts: Date.now(),
    env: {
      mongodb: process.env.MONGODB_URI ? 'configured' : 'MISSING',
      gemini: process.env.GEMINI_API_KEY ? 'configured' : 'MISSING'
    },
    db: 'disconnected'
  };

  try {
    await connectDB();
    result.db = 'connected';
  } catch (err) {
    result.db = 'failed';
    result.dbError = err.message;
    result.status = 'degraded';
  }

  res.status(result.db === 'connected' ? 200 : 200).json(result);
};
