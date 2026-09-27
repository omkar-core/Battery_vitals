// Battery Vital — ESP32 Firmware v14.1.1 — Full feature set, ESP32_RULES.md compliant.
// Fixed & Hardened:
// 1. Dual ESP32 Core 2.x and 3.x Watchdog initialization (TWDT)
// 2. DHT11 bus state pre-check and rate-limit guard (prevents Interrupt Watchdog IWDT crash)
// 3. Removed invalid trailing '/s' from FIREBASE_DB_URL
// 4. Non-blocking asynchronous Firebase connection at boot
// Wiring: SDA=21 SCL=22 (INA219 @0x40) DHT11=4 (requires 4.7k-10k pull-up to 3.3V) MQ2=34 MQ135=35 Buzzer=25 LED_Y=26 LED_R=27 LED_G=14

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <Adafruit_INA219.h>
#include <DHT.h>
#include <Firebase_ESP_Client.h>
#include <Preferences.h>
#include <esp_task_wdt.h>
#include <esp_idf_version.h>

// ── CONFIG ──
#define WIFI_SSID            "Om"
#define WIFI_PASSWORD        "123456789"

#define FIREBASE_API_KEY     "AIzaSyDHbJaTX83jCa1w7jhEb29ZmPBkTEXanxY"
// Note: Removed trailing '/s' which caused RTDB path corruption
#define FIREBASE_DB_URL      "https://batteryvital-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_USER_EMAIL  "esp32@batteryvital.local"
#define FIREBASE_USER_PASS   "Esp32SecurePass2026omkar@12345"

// Optional Sink 2 fallback (REST gateway). Leave GATEWAY_HOST empty ("") to disable.
#define GATEWAY_HOST          ""
#define GATEWAY_TELEMETRY_PATH "/api/telemetry"

#define BATTERY_ID           "BAT001"
#define DEVICE_ID             "BV001"
#define FIRMWARE_VERSION      "14.1.1"

// ── PIN MAP ──
#define I2C_SDA        21
#define I2C_SCL        22
#define INA219_ADDR    0x40
#define DHT_PIN        4
#define DHT_TYPE       DHT11
#define MQ2_PIN        34
#define MQ135_PIN      35
#define BUZZER_PIN     25
#define LED_YELLOW     26
#define LED_RED        27
#define LED_GREEN      14

// ── TIMING ──
const unsigned long SENSOR_INTERVAL_MS      = 1500;
const unsigned long DHT_MIN_INTERVAL_MS     = 2500; // DHT11 strictly requires >= 2.0s
const unsigned long TELEMETRY_INTERVAL_MS   = 2000;
const unsigned long COMMAND_POLL_MS         = 1000;
const unsigned long WIFI_RETRY_MS           = 10000;
const unsigned long NVS_SAVE_MS             = 60000;
const unsigned long GAS_WARMUP_MS           = 120000;
const unsigned long MQ_CONFIDENCE_WINDOW_MS = 180000;
const uint8_t        WDT_TIMEOUT_S          = 15;

// ── BATTERY CONSTANTS ──
const float PACK_CAPACITY_AH = 7.0f;
const float R_NOMINAL_MOHM   = 20.0f;
const float R_EOL_MOHM       = 150.0f;
const float SOC_V_LOW        = 10.5f;
const float SOC_V_HIGH       = 14.4f;

// ── SEVERITY ──
enum Severity { SEV_SAFE = 0, SEV_CAUTION = 1, SEV_WARNING = 2, SEV_CRITICAL = 3, SEV_EMERGENCY = 4 };

const char* severityToString(int s) {
  switch (s) {
    case SEV_EMERGENCY: return "EMERGENCY";
    case SEV_CRITICAL:  return "CRITICAL";
    case SEV_WARNING:   return "WARNING";
    case SEV_CAUTION:   return "CAUTION";
    default:            return "SAFE";
  }
}

// Mandated deterministic snippet, ESP32_RULES.md §5.1, used verbatim.
int evaluateDeterministicSafety(float v, float t, int mq2, float bhi, bool inaOk, bool dhtOk) {
  if (!inaOk && !dhtOk) return SEV_CRITICAL;
  if (v < 9.5f || t > 55.0f || bhi >= 90.0f) return SEV_EMERGENCY;
  if (v < 10.0f || v > 14.4f || t > 45.0f || mq2 > 3000 || bhi >= 75.0f) return SEV_CRITICAL;
  if (v < 10.5f || v > 14.2f || t > 40.0f || mq2 > 1500 || bhi >= 50.0f) return SEV_WARNING;
  if (bhi >= 25.0f) return SEV_CAUTION;
  return SEV_SAFE;
}

enum BuzzerMode { BZ_OFF, BZ_WARNING, BZ_CRITICAL, BZ_EMERGENCY };

struct SensorData {
  float voltage = 12.0f, current_mA = 0.0f, power_mW = 0.0f;
  float temperature = 25.0f, humidity = 50.0f;
  int   mq2Raw = 0, mq135Raw = 0;
  float mq2_pct = 0.0f;
  int   mq135_ppm = 0;
  float soc = 50.0f, soh = 100.0f;
  bool  sohValid = false;
  float bhi = 0.0f, resistance = 0.0f;
  float dV_dt = 0.0f, dT_dt = 0.0f, energyWh = 0.0f, cycles = 0.0f;
  uint32_t errors = 0;
  bool  inaOk = false, dhtOk = false, gasWarm = false;
  float inaConfidence = 1.0f, dhtConfidence = 1.0f, mqConfidence = 0.2f;
  bool  autoMode = true;
  bool  redLed = false, yellowLed = false, greenLed = false, buzzerOn = false;
};

struct SelfTest {
  bool ina_ack = false, dht_ok = false, mq2_ok = false, mq135_ok = false;
  bool gpio_ok = false, buzzer_ok = false, wifi_ok = false, config_ok = false, passed = false;
};

Adafruit_INA219 ina219(INA219_ADDR);
DHT dht(DHT_PIN, DHT_TYPE);
Preferences prefs;
FirebaseData fbdo;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;
SensorData sensorData;
SelfTest selfTest;
bool firebaseReady = false;

int    currentSeverity = SEV_SAFE;
String currentStateLabel = "SAFE";
bool   latchedRecovery = false;

BuzzerMode activeBuzzerMode = BZ_OFF;
bool buzzerPinState = false;
unsigned long lastBuzzerToggle = 0;
bool buzzerMuted = false;
unsigned long buzzerMuteUntil = 0;

unsigned long lastSensorMillis = 0, lastDhtMillis = 0, lastTelemetryMillis = 0, lastCommandMillis = 0, lastNvsMillis = 0, lastWifiAttempt = 0;

float coulombAh = PACK_CAPACITY_AH / 2.0f;
float totalThroughputAh = 0.0f;
unsigned long lastCoulombMillis = 0;
bool lastIdleValid = false;
float lastIdleVoltage = 12.0f;
float zeroCurrentOffsetMA = 0.0f;

float prevVoltage = 12.0f; unsigned long prevVoltageMillis = 0;
float prevTemp = 25.0f;    unsigned long prevTempMillis = 0;

#define GAS_SAMPLES 10
int mq2Samples[GAS_SAMPLES] = {0};
int mq135Samples[GAS_SAMPLES] = {0};
int gasIdx = 0, gasCount = 0;

#define RING_SIZE 30
String ringBuffer[RING_SIZE];
int ringHead = 0, ringCount = 0;

void initWatchdog();
void connectWiFi();
void maintainWiFi();
void runBootSelfTest();
void readINA219Sensor();
void readDHTSensor();
void readGasSensors();
void updateCoulombAndSOC();
void updateResistanceAndSOH();
void updateBHI();
int  evaluateFullSafety(SensorData &sd);
void updateActuatorsAuto(int sev);
void updateBuzzerPattern();
void calibrateZeroCurrent();
String buildTelemetryJSON(FirebaseJson &json);
bool sendToFirebaseRTDB(FirebaseJson &json);
bool sendToGateway(const String &jsonStr);
void flushRingBuffer();
void sendTelemetry();
void pollCommands();
void loadPersistentState();
void savePersistentState();

// Initialize Task Watchdog Timer cleanly for both Core 2.x and Core 3.x
void initWatchdog() {
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
  esp_task_wdt_config_t wdtConfig = {
    .timeout_ms = (uint32_t)WDT_TIMEOUT_S * 1000,
    .idle_core_mask = 0,
    .trigger_panic = true
  };
  if (esp_task_wdt_reconfigure(&wdtConfig) != ESP_OK) {
    esp_task_wdt_init(&wdtConfig);
  }
#else
  esp_task_wdt_init(WDT_TIMEOUT_S, true);
#endif
  // CRITICAL: Enroll current task into TWDT watch BEFORE calling any esp_task_wdt_reset()
  esp_task_wdt_add(NULL);
}

void setup() {
  Serial.begin(115200);
  delay(300);

  // 1. Initialize Watchdog FIRST so any subsequent loop can safely call esp_task_wdt_reset()
  initWatchdog();

  pinMode(BUZZER_PIN, OUTPUT); digitalWrite(BUZZER_PIN, LOW);
  pinMode(LED_GREEN, OUTPUT); pinMode(LED_YELLOW, OUTPUT); pinMode(LED_RED, OUTPUT);
  digitalWrite(LED_GREEN, LOW); digitalWrite(LED_YELLOW, LOW); digitalWrite(LED_RED, LOW);

  // DHT pin mode with internal pullup as safeguard
  pinMode(DHT_PIN, INPUT_PULLUP);

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(100000);

  sensorData.inaOk = ina219.begin();
  if (sensorData.inaOk) ina219.setCalibration_32V_2A();

  dht.begin();

  loadPersistentState();
  connectWiFi();
  runBootSelfTest();

  // Configure Firebase (non-blocking begin)
  fbConfig.api_key = FIREBASE_API_KEY;
  fbConfig.database_url = FIREBASE_DB_URL;
  fbAuth.user.email = FIREBASE_USER_EMAIL;
  fbAuth.user.password = FIREBASE_USER_PASS;
  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);

  // Single crisp beep on system startup (100ms)
  digitalWrite(BUZZER_PIN, HIGH);
  delay(100);
  digitalWrite(BUZZER_PIN, LOW);

  // Immediately light up Green LED as symbol that system is powered ON and healthy
  digitalWrite(LED_GREEN, HIGH);
  sensorData.greenLed = true;

  lastSensorMillis = lastTelemetryMillis = lastCommandMillis = lastNvsMillis = millis();
  lastDhtMillis = millis() - DHT_MIN_INTERVAL_MS;
  Serial.println("[BOOT] Complete. System ON - Green LED Lit.");
}

void loop() {
  esp_task_wdt_reset();
  unsigned long now = millis();

  if (now - lastSensorMillis >= SENSOR_INTERVAL_MS) {
    lastSensorMillis = now;

    readINA219Sensor();
    readDHTSensor();
    readGasSensors();
    updateCoulombAndSOC();
    updateResistanceAndSOH();
    updateBHI();

    int rawSev = evaluateFullSafety(sensorData);
    if (rawSev >= SEV_CRITICAL) latchedRecovery = true;

    int displaySev = rawSev;
    if (latchedRecovery && rawSev < SEV_CRITICAL) {
      displaySev = max(rawSev, (int)SEV_WARNING);
      currentStateLabel = "RECOVERY";
    } else {
      currentStateLabel = String(severityToString(rawSev));
    }
    currentSeverity = displaySev;

    if (rawSev >= SEV_CRITICAL) sensorData.autoMode = true;

    sensorData.energyWh += fabs(sensorData.power_mW) / 1000.0f * (SENSOR_INTERVAL_MS / 3600000.0f);
    sensorData.cycles = totalThroughputAh / (PACK_CAPACITY_AH * 2.0f);
  }

  // Drive actuators smoothly every loop iteration (non-blocking millis cadence)
  if (sensorData.autoMode) {
    updateActuatorsAuto(currentSeverity);
  }
  updateBuzzerPattern();

  if (now - lastTelemetryMillis >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMillis = now;
    sendTelemetry();
  }

  if (now - lastCommandMillis >= COMMAND_POLL_MS) {
    lastCommandMillis = now;
    pollCommands();
  }

  if (now - lastNvsMillis >= NVS_SAVE_MS) {
    lastNvsMillis = now;
    savePersistentState();
  }

  if (buzzerMuted && now >= buzzerMuteUntil) buzzerMuted = false;
  if (!firebaseReady) firebaseReady = Firebase.ready();

  maintainWiFi();
  yield();
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(300);
    esp_task_wdt_reset();
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[WIFI] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("[WIFI] Initial connect timed out. Operating in autonomous offline mode.");
  }
}

void maintainWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  unsigned long now = millis();
  if (now - lastWifiAttempt < WIFI_RETRY_MS) return;
  lastWifiAttempt = now;
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void runBootSelfTest() {
  Wire.beginTransmission(INA219_ADDR);
  selfTest.ina_ack = (Wire.endTransmission() == 0);

  // Safe DHT check: verify bus idle state first to prevent Interrupt WDT
  pinMode(DHT_PIN, INPUT_PULLUP);
  if (digitalRead(DHT_PIN) == HIGH) {
    float t = dht.readTemperature();
    selfTest.dht_ok = !isnan(t);
  } else {
    selfTest.dht_ok = false;
    Serial.println("[WARN] DHT data line held LOW or missing pull-up. Skipping blocking read.");
  }

  selfTest.mq2_ok   = analogRead(MQ2_PIN)   > 50;
  selfTest.mq135_ok = analogRead(MQ135_PIN) > 50;

  digitalWrite(LED_GREEN, HIGH); delay(50); digitalWrite(LED_GREEN, LOW);
  selfTest.gpio_ok = true;

  digitalWrite(BUZZER_PIN, HIGH); delay(50); digitalWrite(BUZZER_PIN, LOW);
  selfTest.buzzer_ok = true;

  selfTest.wifi_ok = (WiFi.status() == WL_CONNECTED);
  selfTest.config_ok = true;

  selfTest.passed = selfTest.ina_ack && selfTest.dht_ok && selfTest.mq2_ok &&
                     selfTest.mq135_ok && selfTest.gpio_ok && selfTest.buzzer_ok && selfTest.config_ok;

  Serial.printf("[SELFTEST] ina=%d dht=%d mq2=%d mq135=%d gpio=%d buzz=%d wifi=%d passed=%d\n",
                selfTest.ina_ack, selfTest.dht_ok, selfTest.mq2_ok, selfTest.mq135_ok,
                selfTest.gpio_ok, selfTest.buzzer_ok, selfTest.wifi_ok, selfTest.passed);
}

void readINA219Sensor() {
  if (!sensorData.inaOk) {
    if (ina219.begin()) { ina219.setCalibration_32V_2A(); sensorData.inaOk = true; }
    else { sensorData.inaConfidence = 0.0f; return; }
  }

  float busV = ina219.getBusVoltage_V();
  float rawCurrent_mA = ina219.getCurrent_mA() - zeroCurrentOffsetMA;

  if (isnan(busV) || busV < 0.0f || busV > 32.0f) {
    sensorData.inaOk = false;
    sensorData.inaConfidence = 0.0f;
    sensorData.errors |= (1 << 0);
    return;
  }

  unsigned long now = millis();
  if (prevVoltageMillis > 0) {
    float dtSec = (now - prevVoltageMillis) / 1000.0f;
    if (dtSec > 0) sensorData.dV_dt = (busV - prevVoltage) / dtSec;
  }
  prevVoltage = busV; prevVoltageMillis = now;

  sensorData.voltage = busV;
  sensorData.current_mA = rawCurrent_mA;
  sensorData.power_mW = busV * (rawCurrent_mA / 1000.0f) * 1000.0f;
  sensorData.inaOk = true;
  sensorData.inaConfidence = (busV > 26.0f) ? 0.0f : 1.0f;
}

// Hardened DHT reading: strict rate-limit and bus line pre-check to prevent IWDT lockup
void readDHTSensor() {
  unsigned long now = millis();
  if (now - lastDhtMillis < DHT_MIN_INTERVAL_MS) {
    return; // Enforce minimum 2.5s between DHT11 readings
  }
  lastDhtMillis = now;

  // Pre-check: if line is pulled LOW by ground fault or missing pull-up, avoid bit-banging
  pinMode(DHT_PIN, INPUT_PULLUP);
  if (digitalRead(DHT_PIN) == LOW) {
    sensorData.dhtOk = false;
    sensorData.dhtConfidence = 0.0f;
    sensorData.errors |= (1 << 1);
    return;
  }

  float t = dht.readTemperature();
  if (isnan(t)) {
    sensorData.dhtOk = false;
    sensorData.dhtConfidence = max(0.0f, sensorData.dhtConfidence - 0.2f);
    sensorData.errors |= (1 << 1);
    return;
  }

  float h = dht.readHumidity();
  if (isnan(h)) h = 50.0f; // Graceful fallback

  if (prevTempMillis > 0) {
    float dtSec = (now - prevTempMillis) / 1000.0f;
    if (dtSec > 0) sensorData.dT_dt = (t - prevTemp) / dtSec;
  }
  prevTemp = t; prevTempMillis = now;

  sensorData.dhtOk = true;
  sensorData.dhtConfidence = 1.0f;
  sensorData.temperature = t;
  sensorData.humidity = h;
}

void readGasSensors() {
  int raw2 = analogRead(MQ2_PIN);
  int raw135 = analogRead(MQ135_PIN);

  mq2Samples[gasIdx] = raw2;
  mq135Samples[gasIdx] = raw135;
  gasIdx = (gasIdx + 1) % GAS_SAMPLES;
  if (gasCount < GAS_SAMPLES) gasCount++;

  long sum2 = 0, sum135 = 0;
  for (int i = 0; i < gasCount; i++) { sum2 += mq2Samples[i]; sum135 += mq135Samples[i]; }
  sensorData.mq2Raw = sum2 / gasCount;
  sensorData.mq135Raw = sum135 / gasCount;
  sensorData.mq2_pct = constrain((sensorData.mq2Raw / 4095.0f) * 100.0f, 0.0f, 100.0f);
  sensorData.mq135_ppm = map(sensorData.mq135Raw, 0, 4095, 10, 1000);

  unsigned long uptime = millis();
  sensorData.gasWarm = (uptime >= GAS_WARMUP_MS);
  float ratio = constrain((float)uptime / (float)MQ_CONFIDENCE_WINDOW_MS, 0.0f, 1.0f);
  sensorData.mqConfidence = 0.2f + 0.8f * ratio;
}

float voltageToSOCApprox(float v) {
  return constrain((v - SOC_V_LOW) / (SOC_V_HIGH - SOC_V_LOW) * 100.0f, 0.0f, 100.0f);
}

void updateCoulombAndSOC() {
  unsigned long now = millis();
  if (lastCoulombMillis == 0) { lastCoulombMillis = now; return; }
  float dtHours = (now - lastCoulombMillis) / 3600000.0f;
  lastCoulombMillis = now;
  if (dtHours <= 0 || dtHours > 0.05f) return;

  float dAh = (sensorData.current_mA / 1000.0f) * dtHours;
  coulombAh = constrain(coulombAh + dAh, 0.0f, PACK_CAPACITY_AH);
  totalThroughputAh += fabs(dAh);

  float coulombSOC = (coulombAh / PACK_CAPACITY_AH) * 100.0f;
  float ocvSOC = voltageToSOCApprox(sensorData.voltage);

  if (fabs(sensorData.current_mA) < 20.0f) {
    sensorData.soc = 0.3f * coulombSOC + 0.7f * ocvSOC;
    lastIdleVoltage = sensorData.voltage;
    lastIdleValid = true;
  } else {
    sensorData.soc = 0.85f * coulombSOC + 0.15f * ocvSOC;
  }
  sensorData.soc = constrain(sensorData.soc, 0.0f, 100.0f);
}

void updateResistanceAndSOH() {
  if (lastIdleValid && fabs(sensorData.current_mA) > 200.0f) {
    float dV = fabs(lastIdleVoltage - sensorData.voltage);
    float dI_A = fabs(sensorData.current_mA) / 1000.0f;
    if (dI_A > 0.05f) {
      sensorData.resistance = constrain((dV / dI_A) * 1000.0f, 0.0f, 1000.0f);
      float soh = 100.0f - ((sensorData.resistance - R_NOMINAL_MOHM) / (R_EOL_MOHM - R_NOMINAL_MOHM)) * 60.0f;
      sensorData.soh = constrain(soh, 0.0f, 100.0f);
      sensorData.sohValid = true;
    }
  }
}

void updateBHI() {
  float vMid = (SOC_V_HIGH + SOC_V_LOW) / 2.0f;
  float vHalfBand = (SOC_V_HIGH - SOC_V_LOW) / 2.0f;

  float voltageStress   = constrain(fabs(sensorData.voltage - vMid) / vHalfBand * 100.0f, 0.0f, 100.0f);
  float thermalStress    = constrain((sensorData.temperature - 25.0f) / 30.0f * 100.0f, 0.0f, 100.0f);
  float gasStress         = constrain((float)sensorData.mq2Raw / 40.0f, 0.0f, 100.0f);
  float resistanceStress = sensorData.sohValid ? constrain(sensorData.resistance / 2.5f, 0.0f, 100.0f) : 0.0f;

  sensorData.bhi = constrain(0.30f * voltageStress + 0.25f * thermalStress + 0.25f * gasStress + 0.20f * resistanceStress, 0.0f, 100.0f);
}

int evaluateFullSafety(SensorData &sd) {
  int sev = evaluateDeterministicSafety(sd.voltage, sd.temperature, sd.mq2Raw, sd.bhi, sd.inaOk, sd.dhtOk);

  if (sd.resistance > 250.0f)      sev = max(sev, (int)SEV_EMERGENCY);
  else if (sd.resistance > 100.0f) sev = max(sev, (int)SEV_CRITICAL);
  else if (sd.resistance > 50.0f)  sev = max(sev, (int)SEV_WARNING);

  if (sd.sohValid) {
    if (sd.soh < 60.0f)      sev = max(sev, (int)SEV_CRITICAL);
    else if (sd.soh < 80.0f) sev = max(sev, (int)SEV_WARNING);
  }

  if (sd.soc < 10.0f)      sev = max(sev, (int)SEV_CRITICAL);
  else if (sd.soc < 20.0f) sev = max(sev, (int)SEV_WARNING);

  if (sd.inaOk != sd.dhtOk) sev = max(sev, (int)SEV_WARNING);

  return sev;
}

void updateActuatorsAuto(int sev) {
  unsigned long now = millis();
  bool g = false, y = false, r = false;
  BuzzerMode bz = BZ_OFF;

  switch (sev) {
    case SEV_SAFE:
      // Green LED SOLID ON: symbol of system ON and healthy nominal condition
      g = true;
      y = false;
      r = false;
      bz = BZ_OFF;
      break;

    case SEV_CAUTION:
      // Yellow LED SOLID ON: advisory notice, silent buzzer
      g = false;
      y = true;
      r = false;
      bz = BZ_OFF;
      break;

    case SEV_WARNING:
      // Yellow LED BLINK (500ms ON / 500ms OFF), gentle intermittent warning beep
      g = false;
      y = ((now % 1000) < 500);
      r = false;
      bz = BZ_WARNING;
      break;

    case SEV_CRITICAL:
      // Red LED BLINK FAST (250ms ON / 250ms OFF), pulsed alert beep (NOT continuous)
      g = false;
      y = false;
      r = ((now % 500) < 250);
      bz = BZ_CRITICAL;
      break;

    case SEV_EMERGENCY:
      // Red & Yellow RAPID FLASH (100ms ON / 100ms OFF), double-pulse alert (NOT continuous)
      g = false;
      y = ((now % 200) < 100);
      r = ((now % 200) < 100);
      bz = BZ_EMERGENCY;
      break;
  }

  sensorData.greenLed = g;
  sensorData.yellowLed = y;
  sensorData.redLed = r;
  digitalWrite(LED_GREEN, g ? HIGH : LOW);
  digitalWrite(LED_YELLOW, y ? HIGH : LOW);
  digitalWrite(LED_RED, r ? HIGH : LOW);
  activeBuzzerMode = bz;
}

// Clean, pulse-based buzzer cadence — never locks buzzer continuously ON
void updateBuzzerPattern() {
  unsigned long now = millis();
  if (buzzerMuted && currentSeverity < SEV_CRITICAL) {
    digitalWrite(BUZZER_PIN, LOW);
    sensorData.buzzerOn = false;
    return;
  }

  bool bzPin = false;
  switch (activeBuzzerMode) {
    case BZ_OFF:
      bzPin = false;
      break;

    case BZ_WARNING: {
      // 150ms pulse every 2000ms: noticeable reminder, NOT annoying or deafening
      unsigned long phase = now % 2000;
      bzPin = (phase < 150);
      break;
    }

    case BZ_CRITICAL: {
      // Urgent pulse: 200ms ON / 300ms OFF (500ms period) — distinct alarm, NO continuous screech
      unsigned long phase = now % 500;
      bzPin = (phase < 200);
      break;
    }

    case BZ_EMERGENCY: {
      // Double pulse: 100ms ON, 100ms OFF, 100ms ON, 700ms OFF (1000ms period)
      unsigned long phase = now % 1000;
      bzPin = (phase < 100) || (phase >= 200 && phase < 300);
      break;
    }
  }

  digitalWrite(BUZZER_PIN, bzPin ? HIGH : LOW);
  sensorData.buzzerOn = bzPin;
}

// Samples 50 readings over 500ms, per §7.7.
void calibrateZeroCurrent() {
  float sum = 0;
  for (int i = 0; i < 50; i++) { sum += ina219.getCurrent_mA(); delay(10); }
  zeroCurrentOffsetMA = sum / 50.0f;
  prefs.begin("bv14", false);
  prefs.putFloat("zeroOffset", zeroCurrentOffsetMA);
  prefs.end();
  Serial.printf("[CAL] Zero-current offset = %.2f mA\n", zeroCurrentOffsetMA);
}

String buildTelemetryJSON(FirebaseJson &json) {
  json.clear();
  json.set("batteryId", BATTERY_ID);
  json.set("deviceId", DEVICE_ID);
  json.set("firmware", FIRMWARE_VERSION);
  json.set("mac", WiFi.macAddress());
  json.set("voltage", sensorData.voltage);
  json.set("current", sensorData.current_mA);
  json.set("power", sensorData.power_mW);
  json.set("temperature", sensorData.temperature);
  json.set("humidity", sensorData.humidity);
  json.set("mq2", sensorData.mq2Raw);
  json.set("mq2_pct", sensorData.mq2_pct);
  json.set("mq135", sensorData.mq135Raw);
  json.set("mq135_ppm", sensorData.mq135_ppm);
  json.set("soc", sensorData.soc);
  json.set("soh", sensorData.soh);
  json.set("soh_valid", sensorData.sohValid);
  json.set("bhi", sensorData.bhi);
  json.set("resistance", sensorData.resistance);
  json.set("dV_dt", sensorData.dV_dt);
  json.set("dT_dt", sensorData.dT_dt);
  json.set("energyWh", sensorData.energyWh);
  json.set("cycles", sensorData.cycles);
  json.set("errors", (int)sensorData.errors);
  json.set("state", currentStateLabel);
  json.set("op", sensorData.current_mA > 20.0f ? "CHARGE" : (sensorData.current_mA < -20.0f ? "DISCHARGE" : "IDLE"));
  json.set("ina_ok", sensorData.inaOk);
  json.set("dht_ok", sensorData.dhtOk);
  json.set("gas_warm", sensorData.gasWarm);
  json.set("ina_confidence", sensorData.inaConfidence);
  json.set("dht_confidence", sensorData.dhtConfidence);
  json.set("mq_confidence", sensorData.mqConfidence);
  json.set("wifi_rssi", WiFi.RSSI());
  json.set("free_heap", (int)ESP.getFreeHeap());
  json.set("auto_mode", sensorData.autoMode);
  json.set("red_led", sensorData.redLed);
  json.set("yellow_led", sensorData.yellowLed);
  json.set("green_led", sensorData.greenLed);
  json.set("buzzer", sensorData.buzzerOn);
  json.set("timestamp", (int)millis());

  String out;
  json.toString(out, false);
  return out;
}

bool sendToFirebaseRTDB(FirebaseJson &json) {
  if (!firebaseReady || WiFi.status() != WL_CONNECTED) return false;
  String path = String("/live_data/") + BATTERY_ID;
  return Firebase.RTDB.setJSON(&fbdo, path.c_str(), &json);
}

bool sendToGateway(const String &jsonStr) {
  if (strlen(GATEWAY_HOST) == 0 || WiFi.status() != WL_CONNECTED) return false;
  WiFiClientSecure client; client.setInsecure();
  HTTPClient http;
  String url = String("https://") + GATEWAY_HOST + GATEWAY_TELEMETRY_PATH;
  if (!http.begin(client, url)) return false;
  http.addHeader("Content-Type", "application/json");
  int code = http.POST((uint8_t*)jsonStr.c_str(), jsonStr.length());
  http.end();
  return (code == 200 || code == 201 || code == 204);
}

void flushRingBuffer() {
  if (ringCount == 0 || !firebaseReady) return;
  String burstPath = String("/live_data/") + BATTERY_ID + "/history_burst";
  for (int i = 0; i < ringCount; i++) {
    int idx = (ringHead - ringCount + i + RING_SIZE) % RING_SIZE;
    FirebaseJson replay;
    replay.setJsonData(ringBuffer[idx]);
    Firebase.RTDB.push(&fbdo, burstPath.c_str(), &replay);
    esp_task_wdt_reset();
  }
  ringCount = 0; ringHead = 0;
}

void ringPush(const String &payload) {
  ringBuffer[ringHead] = payload;
  ringHead = (ringHead + 1) % RING_SIZE;
  if (ringCount < RING_SIZE) ringCount++;
}

void sendTelemetry() {
  FirebaseJson json;
  String jsonStr = buildTelemetryJSON(json);

  bool ok1 = sendToFirebaseRTDB(json);
  bool ok2 = sendToGateway(jsonStr);

  if (!ok1 && !ok2) ringPush(jsonStr);
  else if (ok1 && ringCount > 0) flushRingBuffer();
}

void pollCommands() {
  if (!firebaseReady || WiFi.status() != WL_CONNECTED) return;
  String path = String("/commands/") + BATTERY_ID;
  if (!Firebase.RTDB.getJSON(&fbdo, path.c_str())) return;

  bool lockout = (currentSeverity >= SEV_CRITICAL);

  FirebaseJson &j = fbdo.jsonObject();
  FirebaseJsonData r;

  if (j.get(r, "command")) {
    String cmd = r.stringValue;
    if (cmd == "CALIBRATE_ZERO") calibrateZeroCurrent();
    else if (cmd == "MANUAL_RESET" && currentSeverity < SEV_CRITICAL) {
      latchedRecovery = false;
      Serial.println("[COMMAND] Recovery latch cleared.");
    }
  }

  if (lockout) return;

  if (j.get(r, "auto_mode")) sensorData.autoMode = r.boolValue;
  if (!sensorData.autoMode) {
    if (j.get(r, "green_led"))  { sensorData.greenLed = r.boolValue;  digitalWrite(LED_GREEN, sensorData.greenLed); }
    if (j.get(r, "yellow_led")) { sensorData.yellowLed = r.boolValue; digitalWrite(LED_YELLOW, sensorData.yellowLed); }
    if (j.get(r, "red_led"))    { sensorData.redLed = r.boolValue;    digitalWrite(LED_RED, sensorData.redLed); }
    if (j.get(r, "buzzer"))     { sensorData.buzzerOn = r.boolValue;  activeBuzzerMode = r.boolValue ? BZ_CRITICAL : BZ_OFF; }
  }

  String clearPath = String("/commands/") + BATTERY_ID + "/command";
  Firebase.RTDB.setString(&fbdo, clearPath.c_str(), "none");
}

void loadPersistentState() {
  prefs.begin("bv14", true);
  coulombAh          = prefs.getFloat("coulombAh", PACK_CAPACITY_AH / 2.0f);
  totalThroughputAh  = prefs.getFloat("throughAh", 0.0f);
  sensorData.energyWh = prefs.getFloat("energyWh", 0.0f);
  sensorData.soh      = prefs.getFloat("soh", 100.0f);
  zeroCurrentOffsetMA = prefs.getFloat("zeroOffset", 0.0f);
  prefs.end();
}

void savePersistentState() {
  prefs.begin("bv14", false);
  prefs.putFloat("coulombAh", coulombAh);
  prefs.putFloat("throughAh", totalThroughputAh);
  prefs.putFloat("energyWh", sensorData.energyWh);
  prefs.putFloat("soh", sensorData.soh);
  prefs.putFloat("zeroOffset", zeroCurrentOffsetMA);
  prefs.end();
}
