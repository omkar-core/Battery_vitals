// ===================================================================
// Battery Vitals Server — Local Development
// For Vercel deployment, see api/index.js
// ===================================================================
const app = require('./api/index');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log('  Battery Vital Server v2.0 (Dev Mode)');
  console.log('========================================');
  console.log(`  URL:     http://localhost:${PORT}`);
  console.log(`  DB:      BatteryVitals (MongoDB Atlas)`);
  console.log(`  Mode:    Local Development`);
  console.log('========================================');
  console.log('');
});
