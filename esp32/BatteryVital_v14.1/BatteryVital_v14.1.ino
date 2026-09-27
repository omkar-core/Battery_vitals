// ============================================================================
// Battery Vital — ESP32 Firmware v14.1.2
// Production Hardened Firmware for Intelligent Battery Safety & Cloud Monitoring
// Compliant with ESP32_RULES.md v2.0.0 & Next.js Web Dashboard
//
// Features & Fixes:
// 1. Safe dual ESP32 Core 2.x and 3.x Watchdog Timer with twdtEnrolled guard
//    (Eliminates "task_wdt: esp_task_wdt_reset: task not found" panic)
// 2. Hardened DHT11 bus state pre-check and >=2.5s rate-limit
//    (Prevents CPU1 Interrupt Watchdog IWDT timeouts during bit-banging)
// 3. Exact Firebase RTDB URL without trailing slashes or corrupt suffixes
// 4. Single 100ms startup beep + Solid Green LED on healthy boot
// 5. Cadence-based non-blocking buzzer alerts (NO continuous screeching)
// 6. Direct real-time telemetry streaming to /live_data/BAT001 (Zero-login dashboard)
// 7. Full bidirectional actuator synchronization with /commands/BAT001
// 8. Informative Serial Monitor telemetry logs for instant edge troubleshooting
//
// Hardware Pinout:
// - SDA: GPIO 21 (INA219 I2C)
// - SCL: GPIO 22 (INA219 I2C)
// - DHT: GPIO 4  (DHT11 / DHT22, requires 4.7k-10k pull-up to 3.3V)
// - MQ2: GPIO 34 (ADC1_CH6, analog input only)
// - MQ135: GPIO 35 (ADC1_CH7, analog input only)
// - Buzzer: GPIO 25 (Active Piezo Buzzer)
// - Yellow LED: GPIO 26 (Warning Indicator)
// - Red LED: GPIO 27 (Critical Alarm Indicator)
// - Green LED: GPIO 14 (Normal / System ON Indicator)
// ============================================================================

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

// ── 1. CONFIGURATION (VERIFY BEFORE FLASHING) ──
#define WIFI_SSID            "Om"
#define WIFI_PASSWORD        "123456789"

#define FIREBASE_API_KEY     "AIzaSyDHbJaTX83jCa1w7jhEb29ZmPBkTEXanxY"
// IMPORTANT: Exact URL without trailing slash or path suffix
#define FIREBASE_DB_URL      "https://batteryvital-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_USER_EMAIL  "esp32@batteryvital.local"
#define FIREBASE_USER_PASS   "Esp32SecurePass2026omkar@12345"

// Optional Sink 2 fallback (REST gateway). Leave GATEWAY_HOST empty ("") to disable.
#define GATEWAY_HOST          ""
#define GATEWAY_TELEMETRY_PATH "/api/telemetry"

#define BATTERY_ID           "BAT001"
#define DEVICE_ID             "BV001"
#define FIRMWARE_VERSION      "14.1.2"

// ── 2. PIN DEFINITIONS ──
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

// ── 3. TIMING CONSTANTS (NON-BLOCKING) ──
const unsigned long SENSOR_INTERVAL_MS      = 1500;
const unsigned long DHT_MIN_INTERVAL_MS     = 2500; // DHT11 strictly requires >= 2.0s
const unsigned long TELEMETRY_INTERVAL_MS   = 2000;
const unsigned long COMMAND_POLL_MS         = 1000;
const unsigned long WIFI_RETRY_MS           = 10000;
const unsigned long NVS_SAVE_MS             = 60000;
const unsigned long GAS_WARMUP_MS           = 120000;
const unsigned long MQ_CONFIDENCE_WINDOW_MS = 180000;
const uint8_t        WDT_TIMEOUT_S          = 15;

// ── 4. BATTERY PHYSICS CONSTANTS ──
const float PACK_CAPACITY_AH = 7.0f;
const float R_NOMINAL_MOHM   = 20.0f;
const float R_EOL_MOHM       = 150.0f;
const float SOC_V_LOW        = 10.5f;
const float SOC_V_HIGH       = 14.4f;

// ── 5. SEVERITY HIERARCHY ──
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

// Deterministic safety evaluation matching src/lib/batterySafety.js
int evaluateDeterministicSafety(float v, float t, int mq2, float bhi, bool inaOk, bool dhtOk) {
  if (!inaOk && !dhtOk) return SEV_CRITICAL;
  if (v < 9.5f || t > 55.0f || bhi >= 90.0f) return SEV_EMERGENCY;
  if (v < 10.0f || v > 14.4f || t > 45.0f || mq2 > 3000 || bhi >= 75.0f) return SEV_CRITICAL;
  if (v < 10.5f || v > 14.2f || t > 40.0f || mq2 > 1500 || bhi >= 50.0f) return SEV_WARNING;
  if (bhi >= 25.0f) return SEV_CAUTION;
  return SEV_SAFE;
}

enum BuzzerMode { BZ_OFF, BZ_WARNING, BZ_CRITICAL, BZ_EMERGENCY };

// ── 6. STATE & TELEMETRY STRUCTS ──
struct SensorData {
  float voltage = 12.0f, current_mA = 0.0f, power_mW = 0.0f, shuntVoltage_mV = 0.0f;
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

// ── 7. GLOBAL INSTANCES ──
Adafruit_INA219 ina219(INA219_ADDR);
DHT dht(DHT_PIN, DHT_TYPE);
Preferences prefs;
FirebaseData fbdo;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;
SensorData sensorData;
SelfTest selfTest;

int    currentSeverity = SEV_SAFE;
String currentStateLabel = "SAFE";
bool   latchedRecovery = false;

BuzzerMode activeBuzzerMode = BZ_OFF;
bool buzzerMuted = false;
unsigned long buzzerMuteUntil = 0;

unsigned long lastSensorMillis = 0, lastDhtMillis = 0, lastTelemetryMillis = 0;
unsigned long lastCommandMillis = 0, lastNvsMillis = 0, lastWifiAttempt = 0;

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

static bool twdtEnrolled = false;

// ── 8. FUNCTION FORWARD DECLARATIONS ──
void initWatchdog();
inline void feedWatchdog();
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

// ── 9. WATCHDOG HARDENING ──
void initWatchdog() {
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
  esp_task_wdt_config_t wdtConfig = {
    .timeout_ms = (uint32_t)WDT_TIMEOUT_S * 1000,
    .idle_core_mask = 0,
    .trigger_panic = true
  };
  esp_err_t err = esp_task_wdt_reconfigure(&wdtConfig);
  if (err != ESP_OK) {
    esp_task_wdt_init(&wdtConfig);
  }
#else
  esp_task_wdt_init(WDT_TIMEOUT_S, true);
#endif

  esp_err_t addErr = esp_task_wdt_add(NULL);
  if (addErr == ESP_OK || addErr == ESP_ERR_INVALID_STATE) {
    twdtEnrolled = true;
  }
}

inline void feedWatchdog() {
  if (twdtEnrolled) {
    esp_task_wdt_reset();
  }
}

// ── 10. SETUP ROUTINE ──
void setup() {
  Serial.begin(115200);
  delay(300);

  Serial.println("\n==================================================");
  Serial.printf(" Battery Vital ESP32 Firmware v%s\n", FIRMWARE_VERSION);
  Serial.printf(" Node: %s | Device: %s\n", BATTERY_ID, DEVICE_ID);
  Serial.println("==================================================");

  // Initialize Watchdog FIRST so subsequent functions can safely feed it
  initWatchdog();

  // Pin modes
  pinMode(BUZZER_PIN, OUTPUT); digitalWrite(BUZZER_PIN, LOW);
  pinMode(LED_GREEN, OUTPUT); pinMode(LED_YELLOW, OUTPUT); pinMode(LED_RED, OUTPUT);
  digitalWrite(LED_GREEN, LOW); digitalWrite(LED_YELLOW, LOW); digitalWrite(LED_RED, LOW);

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

  // Configure Firebase Realtime Database Client
  fbConfig.api_key = FIREBASE_API_KEY;
  fbConfig.database_url = FIREBASE_DB_URL;
  fbAuth.user.email = FIREBASE_USER_EMAIL;
  fbAuth.user.password = FIREBASE_USER_PASS;
  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);

  // Requirement: Single crisp beep on startup (100ms)
  digitalWrite(BUZZER_PIN, HIGH);
  delay(100);
  digitalWrite(BUZZER_PIN, LOW);

  // Requirement: Light up Green LED as symbol that system is powered ON & SAFE
  digitalWrite(LED_GREEN, HIGH);
  sensorData.greenLed = true;

  lastSensorMillis = lastTelemetryMillis = lastCommandMillis = lastNvsMillis = millis();
  lastDhtMillis = millis() - DHT_MIN_INTERVAL_MS;
  Serial.println("[BOOT] Initialized successfully. Green LED lit (Normal/SAFE).");
}

// ── 11. MAIN NON-BLOCKING SUPER-LOOP ──
void loop() {
  feedWatchdog();
  unsigned long now = millis();

  // 1. Read sensors & evaluate safety
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

  // 2. Drive LEDs and Buzzer continuously (non-blocking millis phase)
  if (sensorData.autoMode) {
    updateActuatorsAuto(currentSeverity);
  }
  updateBuzzerPattern();

  // 3. Telemetry broadcast to Firebase RTDB
  if (now - lastTelemetryMillis >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMillis = now;
    sendTelemetry();
  }

  // 4. Poll incoming commands from web dashboard
  if (now - lastCommandMillis >= COMMAND_POLL_MS) {
    lastCommandMillis = now;
    pollCommands();
  }

  // 5. Periodic NVS checkpoint save
  if (now - lastNvsMillis >= NVS_SAVE_MS) {
    lastNvsMillis = now;
    savePersistentState();
  }

  if (buzzerMuted && now >= buzzerMuteUntil) buzzerMuted = false;

  maintainWiFi();
  yield();
}

// ── 12. WIFI MANAGEMENT ──
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[WIFI] Connecting to SSID: '%s'", WIFI_SSID);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(300);
    Serial.print(".");
    feedWatchdog();
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[WIFI] Connected! Local IP: %s (RSSI: %d dBm)\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println("[WIFI] Initial connection timed out. System operating in autonomous offline mode.");
  }
}

void maintainWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  unsigned long now = millis();
  if (now - lastWifiAttempt < WIFI_RETRY_MS) return;
  lastWifiAttempt = now;
  Serial.println("[WIFI] Connection lost. Attempting non-blocking reconnect...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

// ── 13. BOOT SELF TEST ──
void runBootSelfTest() {
  Wire.beginTransmission(INA219_ADDR);
  selfTest.ina_ack = (Wire.endTransmission() == 0);

  pinMode(DHT_PIN, INPUT_PULLUP);
  if (digitalRead(DHT_PIN) == HIGH) {
    float t = dht.readTemperature();
    selfTest.dht_ok = !isnan(t);
  } else {
    selfTest.dht_ok = false;
    Serial.println("[WARN] DHT data line held LOW or missing pull-up resistor.");
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

  Serial.printf("[SELFTEST] INA=%d DHT=%d MQ2=%d MQ135=%d GPIO=%d Buzzer=%d WiFi=%d -> Overall=%s\n",
                selfTest.ina_ack, selfTest.dht_ok, selfTest.mq2_ok, selfTest.mq135_ok,
                selfTest.gpio_ok, selfTest.buzzer_ok, selfTest.wifi_ok,
                selfTest.passed ? "PASSED" : "DEGRADED");
}

// ── 14. SENSOR ACQUISITION ──
void readINA219Sensor() {
  if (!sensorData.inaOk) {
    if (ina219.begin()) { ina219.setCalibration_32V_2A(); sensorData.inaOk = true; }
    else { sensorData.inaConfidence = 0.0f; return; }
  }

  float busV = ina219.getBusVoltage_V();
  float shuntV = ina219.getShuntVoltage_mV();
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
  sensorData.shuntVoltage_mV = shuntV;
  sensorData.current_mA = rawCurrent_mA;
  sensorData.power_mW = busV * (rawCurrent_mA / 1000.0f) * 1000.0f;
  sensorData.inaOk = true;
  sensorData.inaConfidence = (busV > 26.0f) ? 0.0f : 1.0f;
}

void readDHTSensor() {
  unsigned long now = millis();
  if (now - lastDhtMillis < DHT_MIN_INTERVAL_MS) {
    return;
  }
  lastDhtMillis = now;

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
  if (isnan(h)) h = 50.0f;

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

// ── 15. ALGORITHMS: SOC, SOH & BHI ──
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

// ── 16. ACTUATOR & CADENCE CONTROLLERS ──
void updateActuatorsAuto(int sev) {
  unsigned long now = millis();
  bool g = false, y = false, r = false;
  BuzzerMode bz = BZ_OFF;

  switch (sev) {
    case SEV_SAFE:
      // Green LED SOLID ON: symbol of system ON and healthy
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
      // Yellow LED BLINK (500ms ON / 500ms OFF), gentle reminder alert
      g = false;
      y = ((now % 1000) < 500);
      r = false;
      bz = BZ_WARNING;
      break;

    case SEV_CRITICAL:
      // Red LED BLINK FAST (250ms ON / 250ms OFF), distinct pulsed tone
      g = false;
      y = false;
      r = ((now % 500) < 250);
      bz = BZ_CRITICAL;
      break;

    case SEV_EMERGENCY:
      // Red & Yellow RAPID FLASH (100ms ON / 100ms OFF), fast double-pulse tone
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

void calibrateZeroCurrent() {
  float sum = 0;
  for (int i = 0; i < 50; i++) { sum += ina219.getCurrent_mA(); delay(10); }
  zeroCurrentOffsetMA = sum / 50.0f;
  prefs.begin("bv14", false);
  prefs.putFloat("zeroOffset", zeroCurrentOffsetMA);
  prefs.end();
  Serial.printf("[CAL] Zero-current offset = %.2f mA\n", zeroCurrentOffsetMA);
}

// ── 17. TELEMETRY SERIALIZATION & TRANSMISSION ──
String buildTelemetryJSON(FirebaseJson &json) {
  json.clear();
  json.set("batteryId", BATTERY_ID);
  json.set("deviceId", DEVICE_ID);
  json.set("firmware", FIRMWARE_VERSION);
  json.set("mac", WiFi.macAddress());
  json.set("voltage", sensorData.voltage);
  json.set("current", sensorData.current_mA);
  json.set("power", sensorData.power_mW);
  json.set("shuntVoltage", sensorData.shuntVoltage_mV / 1000.0f);
  json.set("loadVoltage", sensorData.voltage + (sensorData.shuntVoltage_mV / 1000.0f));
  json.set("temperature", sensorData.temperature);
  json.set("humidity", sensorData.humidity);
  json.set("mq2", sensorData.mq2Raw);
  json.set("mq2_pct", sensorData.mq2_pct);
  json.set("mq135", sensorData.mq135Raw);
  json.set("mq135_ppm", sensorData.mq135_ppm);
  int aqi = map(constrain(sensorData.mq135Raw, 0, 4095), 0, 4095, 10, 500);
  json.set("aqi", aqi);
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
  if (WiFi.status() != WL_CONNECTED) return false;
  if (!Firebase.ready()) return false;
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
  if (ringCount == 0 || !Firebase.ready()) return;
  String burstPath = String("/live_data/") + BATTERY_ID + "/history_burst";
  for (int i = 0; i < ringCount; i++) {
    int idx = (ringHead - ringCount + i + RING_SIZE) % RING_SIZE;
    FirebaseJson replay;
    replay.setJsonData(ringBuffer[idx]);
    Firebase.RTDB.push(&fbdo, burstPath.c_str(), &replay);
    feedWatchdog();
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

  if (ok1) {
    Serial.printf("[TELEMETRY] Sent to /live_data/%s | V=%.2fV I=%.1fmA T=%.1fC SOC=%.0f%% State=%s\n",
                  BATTERY_ID, sensorData.voltage, sensorData.current_mA, sensorData.temperature,
                  sensorData.soc, currentStateLabel.c_str());
  } else {
    Serial.printf("[TELEMETRY] Push failed: %s (WiFi=%s, FirebaseReady=%d)\n",
                  fbdo.errorReason().c_str(),
                  WiFi.status() == WL_CONNECTED ? "OK" : "NO_WIFI",
                  Firebase.ready());
  }

  if (!ok1 && !ok2) {
    ringPush(jsonStr);
  } else if (ok1 && ringCount > 0) {
    flushRingBuffer();
  }
}

// ── 18. COMMAND INGEST & ACTUATOR SYNCHRONIZATION ──
void pollCommands() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (!Firebase.ready()) return;
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

// ── 19. PERSISTENT NVS STORAGE ──
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
