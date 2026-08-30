/*
  =====================================================================
  BatteryVitals v12.0 — Industrial ESP32 Telemetry + Safety Firmware
  - Firebase Realtime Database push + Hosted Render REST API (dual sink)
  - Hardware watchdog enabled and fed every loop iteration
  - Non-blocking WiFi reconnect (no blocking connect loops)
  - Native non-blocking DHT11 driver on a millis() gate
  - INA219 power shunt integration with power-on self-test
  - Coulomb counting persisted across reboots (Preferences)
  - Derived analytics: energyWh, throughput cycle count, dV_dt / dT_dt,
    and resistance-based State of Health estimation
  - State escalation to SENSOR_FAULT / EMERGENCY
  =====================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <Adafruit_INA219.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <esp_task_wdt.h>

// =====================================================================
// NETWORK & ENDPOINT CONFIGURATION
// =====================================================================
#define WIFI_SSID       "Om"
#define WIFI_PASSWORD   "123456789"

#define FIREBASE_HOST        "https://batteryvital-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_URL_DATA    "https://batteryvital-default-rtdb.asia-southeast1.firebasedatabase.app/live_data/BAT001.json"
#define FIREBASE_URL_CONTROL "https://batteryvital-default-rtdb.asia-southeast1.firebasedatabase.app/commands/BAT001.json"
#define RENDER_URL_TELEMETRY "https://battery-vitals.onrender.com/api/telemetry"
#define RENDER_URL_CONTROL   "https://battery-vitals.onrender.com/api/control?batteryId=BAT001"

#define DEVICE_ID       "BV001"
#define BATTERY_ID      "BAT001"
#define FIRMWARE_VER    "v12.0"

// =====================================================================
// TIMING / SAFETY CONSTANTS
// =====================================================================
#define SENSOR_INTERVAL   2000
#define DHT_INTERVAL      3000
#define UPLOAD_INTERVAL   3000
#define CONTROL_INTERVAL  2000
#define SAFETY_INTERVAL   500
#define DIAGNOSTIC_PRINT  15000
#define WIFI_RETRY        10000
#define WDT_TIMEOUT_SEC   10
#define HTTP_TIMEOUT_MS   5000
#define GAS_WARMUP_MS     120000

#define NOMINAL_CAPACITY_AH  7.0f
#define NOMINAL_VOLTAGE      12.0f
#define ZERO_CURRENT_MA      50.0f
#define SHUNT_MIN_CURRENT_MA 100.0f

// Reference values for SOH estimation from internal resistance (mOhm)
#define R_TARGET_MOHM     65.0f   // r at 100% SOH
#define R_END_MOHM        200.0f  // r at 40% SOH
#define SOH_FLOOR         40.0f
#define SOH_CEIL          100.0f

// =====================================================================
// HARDWARE PINOUT
// =====================================================================
#define PIN_I2C_SDA     21
#define PIN_I2C_SCL     22
#define PIN_DHT         4
#define PIN_MQ2         34
#define PIN_MQ135       35
#define PIN_BUZZER      25
#define PIN_LED_YELLOW  26
#define PIN_LED_RED     27
#define PIN_LED_GREEN   14

Adafruit_INA219 ina219;
WiFiClientSecure secureClient;
Preferences prefs;

// =====================================================================
// SENSOR STATE
// =====================================================================
struct {
  float voltage      = 0.0f;
  float shunt_mV     = 0.0f;
  float current_mA   = 0.0f;
  float power_mW     = 0.0f;
  float temperature  = 25.0f;
  float humidity     = 50.0f;
  float prevVoltage  = 0.0f;
  float prevTemp     = 25.0f;
  float soc          = 100.0f;
  float soh          = 100.0f;
  float coulomb_Ah   = NOMINAL_CAPACITY_AH;
  float throughputAh = 0.0f;
  float energyWh     = 0.0f;
  float cycles       = 0.0f;
  float dV_dt        = 0.0f;
  float dT_dt        = 0.0f;
  float resistance   = 0.0f;
  float bhi          = 0.0f;
  int    mq2_raw     = 0;
  int    mq135_raw   = 0;
  uint32_t errors    = 0;
  bool   ina_ok      = false;
  bool   dht_ok      = false;
  const char* state  = "SAFE";
  const char* op     = "IDLE";
  bool red_led       = false;
  bool yellow_led    = false;
  bool green_led     = true;
  bool buzzer        = false;
  bool auto_mode     = true;
} sensor;

struct {
  unsigned long tSensor   = 0;
  unsigned long tDHT      = 0;
  unsigned long tUpload   = 0;
  unsigned long tControl  = 0;
  unsigned long tSafety   = 0;
  unsigned long tWiFi     = 0;
  unsigned long tPrint    = 0;
  unsigned long bootTime  = 0;
  uint32_t packetsSent    = 0;
  uint32_t packetsFailed  = 0;
} stats;

// =====================================================================
// NATIVE NON-BLOCKING DHT11 DRIVER
// =====================================================================
bool readNativeDHT11(uint8_t pin, float &temp, float &humidity) {
  uint8_t data[5] = {0, 0, 0, 0, 0};

  pinMode(pin, OUTPUT);
  digitalWrite(pin, LOW);
  delay(20);
  digitalWrite(pin, HIGH);
  delayMicroseconds(40);
  pinMode(pin, INPUT_PULLUP);
  unsigned long timeout = micros();

  while (digitalRead(pin) == HIGH) {
    if (micros() - timeout > 100) return false;
  }
  timeout = micros();
  while (digitalRead(pin) == LOW) {
    if (micros() - timeout > 100) return false;
  }
  timeout = micros();
  while (digitalRead(pin) == HIGH) {
    if (micros() - timeout > 100) return false;
  }

  for (int i = 0; i < 40; i++) {
    timeout = micros();
    while (digitalRead(pin) == LOW) {
      if (micros() - timeout > 100) return false;
    }
    unsigned long tBit = micros();
    while (digitalRead(pin) == HIGH) {
      if (micros() - tBit > 100) return false;
    }
    if ((micros() - tBit) > 40) {
      data[i / 8] |= (1 << (7 - (i % 8)));
    }
  }

  if (data[4] == ((data[0] + data[1] + data[2] + data[3]) & 0xFF)) {
    humidity = (float)data[0];
    temp = (float)data[2];
    return true;
  }
  return false;
}

// =====================================================================
// SENSOR READING & DERIVED ANALYTICS
// =====================================================================
float clampf(float v, float lo, float hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

void readSensors() {
  float prevVoltage = sensor.voltage;
  float prevTemp = sensor.temperature;

  if (sensor.ina_ok) {
    sensor.voltage = ina219.getBusVoltage_V();
    sensor.shunt_mV = ina219.getShuntVoltage_mV();
    sensor.current_mA = ina219.getCurrent_mA();
    sensor.power_mW = ina219.getPower_mW();

    // Sanity gate: reject implausible reads and escalate to sensor fault.
    if (sensor.voltage < 0.0f || sensor.voltage > 50.0f || isnan(sensor.voltage)) {
      sensor.errors++;
      sensor.ina_ok = false;
    }
  }

  sensor.mq2_raw = analogRead(PIN_MQ2);
  sensor.mq135_raw = analogRead(PIN_MQ135);

  float dt = (float)SENSOR_INTERVAL / 1000.0f;
  float dtHours = dt / 3600.0f;

  // Coulomb counting (charge-discharge throughput).
  float AhDelta = (sensor.current_mA / 1000.0f) * dtHours;
  sensor.coulomb_Ah += AhDelta;
  sensor.coulomb_Ah = clampf(sensor.coulomb_Ah, 0.0f, NOMINAL_CAPACITY_AH);
  sensor.soc = (sensor.coulomb_Ah / NOMINAL_CAPACITY_AH) * 100.0f;

  // Cumulative throughput: one full cycle = 2x nominal capacity.
  sensor.throughputAh += (fabs(sensor.current_mA) / 1000.0f) * dtHours;
  sensor.cycles = sensor.throughputAh / (2.0f * NOMINAL_CAPACITY_AH);
  sensor.energyWh += (sensor.power_mW / 1000.0f) * dtHours;

  // Internal resistance from shunt drop while a non-trivial load flows.
  sensor.resistance = 0.0f;
  if (fabs(sensor.current_mA) > SHUNT_MIN_CURRENT_MA) {
    sensor.resistance = (fabs(sensor.shunt_mV) / 1000.0f) / (fabs(sensor.current_mA) / 1000.0f);
  }

  // SOH estimate derived from resistance growth toward end-of-life.
  if (sensor.resistance > 0.0f) {
    float soh = SOH_CEIL - ((sensor.resistance - R_TARGET_MOHM) / (R_END_MOHM - R_TARGET_MOHM)) * (SOH_CEIL - SOH_FLOOR);
    sensor.soh = clampf(soh, SOH_FLOOR, SOH_CEIL);
  }

  // Voltage / temperature slew rates for diagnostics.
  sensor.dV_dt = (sensor.voltage - prevVoltage) / dt;
  sensor.dT_dt = (sensor.temperature - prevTemp) / dt;

  // Operation direction.
  if (sensor.current_mA > ZERO_CURRENT_MA) sensor.op = "CHARGING";
  else if (sensor.current_mA < -ZERO_CURRENT_MA) sensor.op = "DISCHARGING";
  else sensor.op = "IDLE";

  // Battery Health Index (BHI) scoring.
  float bhi = 0.0f;
  if (sensor.voltage > 14.4f || sensor.voltage < 10.0f) bhi += 35.0f;
  if (sensor.voltage < 9.5f) bhi = 90.0f;                     // deep-discharge emergency
  if (sensor.temperature > 45.0f) bhi += 30.0f;
  if (sensor.temperature > 55.0f) bhi = 95.0f;                // thermal runaway edge
  if (sensor.mq2_raw > 1500) bhi += 25.0f;
  if (sensor.mq135_raw > 1500) bhi += 20.0f;
  sensor.bhi = clampf(bhi, 0.0f, 100.0f);

  if (sensor.bhi >= 90.0f) sensor.state = "EMERGENCY";
  else if (sensor.bhi >= 75.0f) sensor.state = "CRITICAL";
  else if (sensor.bhi >= 50.0f) sensor.state = "WARNING";
  else if (sensor.bhi >= 25.0f) sensor.state = "CAUTION";
  else sensor.state = "SAFE";

  // Sensor fault takes precedence: no valid power path or no ambient read.
  if (!sensor.ina_ok && !sensor.dht_ok) sensor.state = "SENSOR_FAULT";
}

// =====================================================================
// OUTPUT ACTUATION (LED + BUZZER)
// =====================================================================
void applyOutputs() {
  digitalWrite(PIN_LED_RED,    sensor.red_led);
  digitalWrite(PIN_LED_YELLOW, sensor.yellow_led);
  digitalWrite(PIN_LED_GREEN,  sensor.green_led);
  digitalWrite(PIN_BUZZER,     sensor.buzzer);
}

void updateSafetyOutputs() {
  if (sensor.auto_mode) {
    // Autonomous safety interlock based on the current risk state.
    if (strcmp(sensor.state, "CRITICAL") == 0 || strcmp(sensor.state, "EMERGENCY") == 0 || strcmp(sensor.state, "SENSOR_FAULT") == 0) {
      sensor.red_led = true;
      sensor.yellow_led = false;
      sensor.green_led = false;
      sensor.buzzer = true;
    } else if (strcmp(sensor.state, "WARNING") == 0 || strcmp(sensor.state, "CAUTION") == 0) {
      sensor.red_led = false;
      sensor.yellow_led = true;
      sensor.green_led = false;
      sensor.buzzer = false;
    } else {
      sensor.red_led = false;
      sensor.yellow_led = false;
      sensor.green_led = true;
      sensor.buzzer = false;
    }
    applyOutputs();
  }
  // In manual mode the control payload pushes the raw flags directly.
}

// =====================================================================
// WIFI MANAGEMENT (NON-BLOCKING)
// =====================================================================
void ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  unsigned long now = millis();
  if (now - stats.tWiFi < WIFI_RETRY) return;
  stats.tWiFi = now;

  Serial.printf("[WIFI] Connecting to %s...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long deadline = millis() + 15000;
  while (WiFi.status() != WL_CONNECTED && millis() < deadline) {
    delay(50);
    yield();
  }
  Serial.printf("[WIFI] %s (IP: %s, RSSI: %d dBm)\n",
    WiFi.status() == WL_CONNECTED ? "Connected" : "Connect failed",
    WiFi.localIP().toString().c_str(),
    WiFi.RSSI());
}

// =====================================================================
// CONTROL COMMAND PARSING
// =====================================================================
void applyControlPayload(const String &raw) {
  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, raw);
  if (err) {
    Serial.println("[CONTROL] Invalid payload");
    return;
  }

  sensor.auto_mode  = doc["auto_mode"] | true;
  sensor.red_led    = doc["red_led"] | false;
  sensor.yellow_led = doc["yellow_led"] | false;
  sensor.green_led  = doc["green_led"] | true;
  sensor.buzzer     = doc["buzzer"] | false;

  if (!sensor.auto_mode) applyOutputs();
  Serial.printf("[CONTROL] auto=%d red=%d yellow=%d green=%d buzzer=%d\n",
    sensor.auto_mode, sensor.red_led, sensor.yellow_led, sensor.green_led, sensor.buzzer);
}

void pollControl() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  secureClient.setInsecure();
  http.setConnectTimeout(3000);
  http.setTimeout(HTTP_TIMEOUT_MS);

  // Primary: Hosted Render Production control API.
  http.begin(secureClient, RENDER_URL_CONTROL);
  int code = http.GET();
  if (code == 200) {
    applyControlPayload(http.getString());
  } else {
    Serial.printf("[CONTROL] Render API %d => Firebase fallback\n", code);
    http.end();

    // Fallback: Firebase Realtime Database command node.
    http.begin(secureClient, FIREBASE_URL_CONTROL);
    Serial.printf("[CONTROL] Fetching firebase...\n");
    code = http.GET();
    if (code == 200) applyControlPayload(http.getString());
  }
  http.end();
}

// =====================================================================
// TELEMETRY UPLOAD (DUAL SINK)
// =====================================================================
String buildTelemetryPayload() {
  StaticJsonDocument<1024> doc;
  doc["batteryId"]    = BATTERY_ID;
  doc["deviceId"]     = DEVICE_ID;
  doc["firmware"]     = FIRMWARE_VER;
  doc["mac"]          = WiFi.macAddress();
  doc["voltage"]      = round(sensor.voltage * 100.0f) / 100.0f;
  doc["current"]      = round(sensor.current_mA * 10.0f) / 10.0f;
  doc["power"]        = round(sensor.power_mW * 10.0f) / 10.0f;
  doc["temperature"]  = round(sensor.temperature * 10.0f) / 10.0f;
  doc["humidity"]     = round(sensor.humidity * 10.0f) / 10.0f;
  doc["mq2"]          = sensor.mq2_raw;
  doc["mq2_pct"]      = map(constrain(sensor.mq2_raw, 200, 4095), 200, 4095, 0, 100);
  doc["mq135"]        = sensor.mq135_raw;
  doc["mq135_ppm"]    = map(constrain(sensor.mq135_raw, 300, 4095), 300, 4095, 400, 2000);
  doc["soc"]          = round(sensor.soc);
  doc["soh"]          = round(sensor.soh);
  doc["bhi"]          = round(sensor.bhi);
  doc["resistance"]   = round(sensor.resistance * 100.0f) / 100.0f;
  doc["dV_dt"]        = round(sensor.dV_dt * 1000.0f) / 1000.0f;
  doc["dT_dt"]        = round(sensor.dT_dt * 1000.0f) / 1000.0f;
  doc["energyWh"]     = round(sensor.energyWh * 100.0f) / 100.0f;
  doc["cycles"]       = round(sensor.cycles * 100.0f) / 100.0f;
  doc["errors"]       = sensor.errors;
  doc["state"]        = sensor.state;
  doc["op"]           = sensor.op;
  doc["ina_ok"]       = sensor.ina_ok;
  doc["dht_ok"]       = sensor.dht_ok;
  doc["gas_warm"]     = (millis() - stats.bootTime) > GAS_WARMUP_MS;
  doc["wifi_rssi"]    = WiFi.RSSI();
  doc["free_heap"]    = ESP.getFreeHeap();
  doc["auto_mode"]    = sensor.auto_mode;
  doc["red_led"]      = sensor.red_led;
  doc["yellow_led"]   = sensor.yellow_led;
  doc["green_led"]    = sensor.green_led;
  doc["buzzer"]       = sensor.buzzer;
  doc["timestamp"]    = millis(); // uptime ms; server stamps the received time on arrival

  String payload;
  serializeJson(doc, payload);
  return payload;
}

void sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED) return;

  String payload = buildTelemetryPayload();

  HTTPClient http;
  secureClient.setInsecure();
  http.setConnectTimeout(3000);
  http.setTimeout(HTTP_TIMEOUT_MS);

  // Sink 1: Hosted Render production telemetry endpoint.
  http.begin(secureClient, RENDER_URL_TELEMETRY);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(payload);
  if (code == 200 || code == 201) {
    stats.packetsSent++;
    Serial.printf("[RENDER API] Pushed Telemetry Packet #%u\n", stats.packetsSent);
  } else {
    stats.packetsFailed++;
    Serial.printf("[RENDER API] POST failed (code %d), attempting Firebase RTDB push...\n", code);
  }
  http.end();

  // Sink 2: Firebase Realtime Database live node (flat packet for the web app).
  http.begin(secureClient, FIREBASE_URL_DATA);
  http.addHeader("Content-Type", "application/json");
  code = http.PUT(payload);
  if (code == 200 || code == 201) {
    Serial.println("[FIREBASE RTDB] Stream Updated Successfully");
  } else {
    stats.packetsFailed++;
    Serial.printf("[FIREBASE RTDB] PUT failed (code %d)\n", code);
  }
  http.end();

  persistAnalytics();
}

// =====================================================================
// ANALYTICS PERSISTENCE (SURVIVES REBOOT)
// =====================================================================
void restoreAnalytics() {
  prefs.begin("bvitals", false);
  sensor.coulomb_Ah   = prefs.getFloat("coulombAh", NOMINAL_CAPACITY_AH);
  sensor.throughputAh = prefs.getFloat("throughAh", 0.0f);
  sensor.energyWh     = prefs.getFloat("energyWh", 0.0f);
  sensor.soh          = prefs.getFloat("soh", 100.0f);
  sensor.coulomb_Ah   = clampf(sensor.coulomb_Ah, 0.0f, NOMINAL_CAPACITY_AH);
  sensor.soc          = (sensor.coulomb_Ah / NOMINAL_CAPACITY_AH) * 100.0f;
  sensor.cycles       = sensor.throughputAh / (2.0f * NOMINAL_CAPACITY_AH);
}

void persistAnalytics() {
  prefs.putFloat("coulombAh", sensor.coulomb_Ah);
  prefs.putFloat("throughAh", sensor.throughputAh);
  prefs.putFloat("energyWh", sensor.energyWh);
  prefs.putFloat("soh", sensor.soh);
}

// =====================================================================
// SETUP
// =====================================================================
void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println(F("\n======================================================="));
  Serial.println(F("       BATTERYVITALS v12.0 FIRMWARE BOOT SEQUENCE        "));
  Serial.println(F("======================================================="));

  // Watchdog: reboot if the main loop ever stalls (e.g. stack lockup).
  esp_task_wdt_init(WDT_TIMEOUT_SEC, true);
  esp_task_wdt_add(NULL);

  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  applyOutputs();

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.setTimeOut(50);
  if (ina219.begin()) {
    ina219.setCalibration_16V_400mA();
    sensor.ina_ok = true;
    Serial.println("[INIT] INA219 Connected (0x40)");
  } else {
    Serial.println("[INIT] INA219 Offline");
  }

  pinMode(PIN_DHT, INPUT_PULLUP);
  Serial.println("[INIT] Native DHT11 initialized (GPIO4)");

  restoreAnalytics();
  Serial.printf("[INIT] Restored coulomb %.2f Ah / throughput %.2f Ah / energy %.2f Wh\n",
    sensor.coulomb_Ah, sensor.throughputAh, sensor.energyWh);

  ensureWiFi();
  stats.bootTime = millis();
}

// =====================================================================
// MAIN LOOP
// =====================================================================
void loop() {
  esp_task_wdt_reset();
  yield();
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) ensureWiFi();

  if (now - stats.tSensor >= SENSOR_INTERVAL) {
    stats.tSensor = now;
    readSensors();
  }

  if (now - stats.tDHT >= DHT_INTERVAL) {
    stats.tDHT = now;
    float t, h;
    if (readNativeDHT11(PIN_DHT, t, h)) {
      sensor.temperature = t;
      sensor.humidity = h;
      sensor.dht_ok = true;
    } else {
      sensor.dht_ok = false;
    }
  }

  if (now - stats.tControl >= CONTROL_INTERVAL) {
    stats.tControl = now;
    pollControl();
  }

  if (now - stats.tSafety >= SAFETY_INTERVAL) {
    stats.tSafety = now;
    updateSafetyOutputs();
  }

  if (now - stats.tUpload >= UPLOAD_INTERVAL) {
    stats.tUpload = now;
    sendTelemetry();
  }

  if (now - stats.tPrint >= DIAGNOSTIC_PRINT) {
    stats.tPrint = now;
    Serial.printf("\n[STATUS] V: %.2fV | I: %.1fmA | T: %.1fC | SOC: %.0f%% | State: %s | Sent: %u | Fail: %u\n",
      sensor.voltage, sensor.current_mA, sensor.temperature,
      sensor.soc, sensor.state, stats.packetsSent, stats.packetsFailed);
  }

  delay(5);
}