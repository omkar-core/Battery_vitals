const demoBase = {
  risk: { bhi: 28 },
  battery: { safety: 'SAFE', voltage: 12.64, current: 1.23, power: 15.55, soc: 72, op: 'CHARGING', resistance: 8.5 },
  gas: { index_mq2: 342, status_mq2: 'NORMAL', index_mq135: 75, warm: true },
  environment: { temperature: 34.5, humidity: 62.3 },
  network: { rssi: -65, ip: '192.168.1.150', requests: 0, heap: 185432 },
  outputs: { green: false, yellow: false, red: false, buzzer: false, auto: true },
  errors: 0, firmware: 'v1.0', mac: 'AA:BB:CC:DD:EE:FF', uptime: '--',
};

function startDemo() {
  state.isDemo = true;
  document.getElementById('demoBanner').classList.add('show');
  if (state.fetchTimer) clearInterval(state.fetchTimer);
  if (state.demoTimer) clearInterval(state.demoTimer);
  state.demoTimer = setInterval(generateDemo, 2000);
  generateDemo();
}

function exitDemo() {
  state.isDemo = false;
  document.getElementById('demoBanner').classList.remove('show');
  if (state.demoTimer) clearInterval(state.demoTimer);
  startFetchLoop();
}

function generateDemo() {
  const walk = (v, min, max, step) => Math.max(min, Math.min(max, v + (Math.random() - 0.5) * step * 2));
  const d = JSON.parse(JSON.stringify(demoBase));
  demoBase.gas.index_mq2 = walk(demoBase.gas.index_mq2, 200, 800, 15);
  demoBase.gas.index_mq135 = walk(demoBase.gas.index_mq135, 40, 160, 5);
  demoBase.environment.temperature = walk(demoBase.environment.temperature, 28, 42, 0.3);
  demoBase.environment.humidity = walk(demoBase.environment.humidity, 40, 80, 1);
  demoBase.battery.voltage = walk(demoBase.battery.voltage, 12.0, 13.2, 0.05);
  demoBase.battery.current = walk(demoBase.battery.current, 0.5, 2.5, 0.1);
  demoBase.battery.power = demoBase.battery.voltage * demoBase.battery.current;
  demoBase.battery.resistance = walk(demoBase.battery.resistance, 5, 25, 0.5);
  demoBase.battery.soc = walk(demoBase.battery.soc, 30, 95, 1);
  demoBase.network.requests++;
  const g = demoBase.gas.index_mq2 / 5000;
  const v = demoBase.gas.index_mq135 / 300;
  const t = (demoBase.environment.temperature - 20) / 60;
  const bhi = Math.round(Math.min(100, Math.max(0, (g * 25 + v * 20 + t * 15 + (1 - demoBase.battery.soc / 100) * 20 + (demoBase.battery.resistance / 50) * 20))));
  demoBase.risk.bhi = bhi;
  if (bhi > 75) demoBase.battery.safety = 'CRITICAL';
  else if (bhi > 55) demoBase.battery.safety = 'WARNING';
  else if (bhi > 30) demoBase.battery.safety = 'CAUTION';
  else demoBase.battery.safety = 'SAFE';

  Object.assign(d, JSON.parse(JSON.stringify(demoBase)));
  d.outputs = { ...state.ledStates, auto: state.autoMode };

  state.lastDataTs = Date.now();
  processTelemetry(d);
  
  // Save to MongoDB if server is connected
  if (state.serverConnected) {
    saveToMongoDB(d);
  }
}
