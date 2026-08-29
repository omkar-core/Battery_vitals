/*
  =====================================================================
  BatteryVitals v11.3 — Firebase Realtime Database Industrial Firmware
  - Direct Firebase Realtime Database Push via HTTPS REST API
  - Zero Broker Message Limit Capping
  - Non-blocking Native DHT Reader & INA219 Power Shunt Integration
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

#define WIFI_SSID       "Om"
#define WIFI_PASSWORD   "123456789"

// Hosted Render Production & Firebase Realtime Database Configuration
#define FIREBASE_HOST       "https://batteryvital-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_URL_DATA   "https://batteryvital-default-rtdb.asia-southeast1.firebasedatabase.app/live_data/BAT001.json"
#define FIREBASE_URL_CONTROL "https://batteryvital-default-rtdb.asia-southeast1.firebasedatabase.app/commands/BAT001.json"
#define RENDER_URL_TELEMETRY "https://battery-vitals.onrender.com/api/telemetry"
#define RENDER_URL_DATA      "https://battery-vitals.onrender.com/api/data"
#define RENDER_URL_CONTROL   "https://battery-vitals.onrender.com/api/control?batteryId=BAT001"

#define ESP32_EMAIL     "esp32@batteryvital.local"
#define ESP32_PASS      "Esp32SecurePass2026omkar@12345"

#define DEVICE_ID       "BV001"
#define BATTERY_ID      "BAT001"
#define FIRMWARE_VER    "v11.3-firebase"

#define SENSOR_INTERVAL   2000
#define DHT_INTERVAL      3000
#define UPLOAD_INTERVAL   3000
#define CONTROL_INTERVAL  2000
#define SAFETY_INTERVAL   1000
#define DIAGNOSTIC_PRINT  15000
#define WIFI_RETRY        10000
#define WDT_TIMEOUT_S     30

#define NOMINAL_CAPACITY_AH  7.0f
#define NOMINAL_VOLTAGE      12.0f

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

struct {
  float voltage       = 0.0f;
  float shunt_mV      = 0.0f;
  float current_mA    = 0.0f;
  float power_mW      = 0.0f;
  float temperature   = 25.0f;
  float humidity      = 50.0f;
  int mq2_raw         = 0;
  int mq135_raw       = 0;
  bool ina_ok         = false;
  bool dht_ok         = false;
  float soc           = 100.0f;
  float soh           = 100.0f;
  float coulomb_Ah    = NOMINAL_CAPACITY_AH;
  float dV_dt         = 0.0f;
  float dT_dt         = 0.0f;
  float resistance    = 0.0f;
  float bhi           = 0.0f;
  const char* state   = "SAFE";
  const char* op      = "IDLE";
  bool red_led        = false;
  bool yellow_led     = false;
  bool green_led      = true;
  bool buzzer         = false;
  bool auto_mode      = true;
} sensor;

struct {
  unsigned long tSensor = 0;
  unsigned long tDHT = 0;
  unsigned long tUpload = 0;
  unsigned long tControl = 0;
  unsigned long tSafety = 0;
  unsigned long tWiFi = 0;
  unsigned long tPrint = 0;
  unsigned long bootTime = 0;
  uint32_t packetsSent = 0;
  uint32_t packetsFailed = 0;
} stats;

// =====================================================================
// NATIVE NON-BLOCKING DHT11 DRIVER (NO INTERRUPT LOCKUPS)
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

void readSensors() {
  if (sensor.ina_ok) {
    sensor.voltage = ina219.getBusVoltage_V();
    sensor.shunt_mV = ina219.getShuntVoltage_mV();
    sensor.current_mA = ina219.getCurrent_mA();
    sensor.power_mW = ina219.getPower_mW();
  }

  sensor.mq2_raw = analogRead(PIN_MQ2);
  sensor.mq135_raw = analogRead(PIN_MQ135);

  // Coulomb Counting for SOC
  float dt = (float)SENSOR_INTERVAL / 1000.0f;
  float Ah_delta = (sensor.current_mA / 1000.0f) * (dt / 3600.0f);
  sensor.coulomb_Ah += Ah_delta;
  if (sensor.coulomb_Ah > NOMINAL_CAPACITY_AH) sensor.coulomb_Ah = NOMINAL_CAPACITY_AH;
  if (sensor.coulomb_Ah < 0.0f) sensor.coulomb_Ah = 0.0f;
  sensor.soc = (sensor.coulomb_Ah / NOMINAL_CAPACITY_AH) * 100.0f;

  // Internal Resistance Estimation
  if (abs(sensor.current_mA) > 100.0f) {
    sensor.resistance = (abs(sensor.shunt_mV) / 1000.0f) / (abs(sensor.current_mA) / 1000.0f);
  }

  // Operation Direction
  if (sensor.current_mA > 50.0f) sensor.op = "CHARGING";
  else if (sensor.current_mA < -50.0f) sensor.op = "DISCHARGING";
  else sensor.op = "IDLE";

  // BHI Calculation
  float bhi = 0.0f;
  if (sensor.voltage > 14.4f || sensor.voltage < 10.0f) bhi += 35.0f;
  if (sensor.temperature > 45.0f) bhi += 30.0f;
  if (sensor.mq2_raw > 1500) bhi += 25.0f;
  if (sensor.mq135_raw > 1500) bhi += 20.0f;
  sensor.bhi = min(bhi, 100.0f);

  if (sensor.bhi >= 75.0f) sensor.state = "CRITICAL";
  else if (sensor.bhi >= 50.0f) sensor.state = "WARNING";
  else if (sensor.bhi >= 25.0f) sensor.state = "CAUTION";
  else sensor.state = "SAFE";
}

void updateLEDs() {
  if (!sensor.auto_mode) return;

  if (strcmp(sensor.state, "CRITICAL") == 0 || strcmp(sensor.state, "EMERGENCY") == 0) {
    digitalWrite(PIN_LED_RED, HIGH);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_BUZZER, HIGH);
  } else if (strcmp(sensor.state, "WARNING") == 0 || strcmp(sensor.state, "CAUTION") == 0) {
    digitalWrite(PIN_LED_RED, LOW);
    digitalWrite(PIN_LED_YELLOW, HIGH);
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_BUZZER, LOW);
  } else {
    digitalWrite(PIN_LED_RED, LOW);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_BUZZER, LOW);
  }
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  unsigned long now = millis();
  if (now - stats.tWiFi < WIFI_RETRY) return;
  stats.tWiFi = now;

  Serial.printf("[WIFI] Connecting to %s...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int i = 0;
  while (WiFi.status() != WL_CONNECTED && i < 20) {
    delay(500);
    Serial.print(".");
    i++;
    yield();
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WIFI] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WIFI] Connect failed.");
  }
}

void pollControl() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  secureClient.setInsecure();

  // 1. Fetch command payload directly from Render Production Host API
  http.begin(secureClient, RENDER_URL_CONTROL);
  http.setTimeout(3500);

  int code = http.GET();
  if (code == 200) {
    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, http.getString()) == DeserializationOk) {
      sensor.auto_mode = doc["auto_mode"] | true;
      sensor.red_led   = doc["red_led"] | false;
      sensor.yellow_led= doc["yellow_led"]| false;
      sensor.green_led = doc["green_led"] | true;
      sensor.buzzer    = doc["buzzer"]    | false;

      if (!sensor.auto_mode) {
        digitalWrite(PIN_LED_RED,    sensor.red_led);
        digitalWrite(PIN_LED_YELLOW, sensor.yellow_led);
        digitalWrite(PIN_LED_GREEN,  sensor.green_led);
        digitalWrite(PIN_BUZZER,     sensor.buzzer);
      }
    }
  } else {
    // 2. Secondary fallback poll from Firebase Realtime Database
    http.end();
    http.begin(secureClient, FIREBASE_URL_CONTROL);
    http.setTimeout(3500);
    int fbCode = http.GET();
    if (fbCode == 200) {
      StaticJsonDocument<256> doc;
      if (deserializeJson(doc, http.getString()) == DeserializationOk) {
        sensor.auto_mode = doc["auto_mode"] | true;
        sensor.red_led   = doc["red_led"] | false;
        sensor.yellow_led= doc["yellow_led"]| false;
        sensor.green_led = doc["green_led"] | true;
        sensor.buzzer    = doc["buzzer"]    | false;

        if (!sensor.auto_mode) {
          digitalWrite(PIN_LED_RED,    sensor.red_led);
          digitalWrite(PIN_LED_YELLOW, sensor.yellow_led);
          digitalWrite(PIN_LED_GREEN,  sensor.green_led);
          digitalWrite(PIN_BUZZER,     sensor.buzzer);
        }
      }
    }
  }
  http.end();
}

void sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  secureClient.setInsecure();

  StaticJsonDocument<1024> doc;
  doc["batteryId"]    = BATTERY_ID;
  doc["deviceId"]     = DEVICE_ID;
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
  doc["state"]        = sensor.state;
  doc["op"]           = sensor.op;
  doc["ina_ok"]       = sensor.ina_ok;
  doc["dht_ok"]       = sensor.dht_ok;
  doc["wifi_rssi"]    = WiFi.RSSI();
  doc["free_heap"]    = ESP.getFreeHeap();
  doc["timestamp"]    = millis();

  String payload;
  serializeJson(doc, payload);

  // 1. Push Telemetry to Hosted Render Production API Endpoint
  http.begin(secureClient, RENDER_URL_TELEMETRY);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);

  int code = http.POST(payload);
  if (code == 200 || code == 201) {
    stats.packetsSent++;
    Serial.printf("[RENDER API] Pushed Telemetry Packet #%u\n", stats.packetsSent);
  } else {
    Serial.printf("[RENDER API] POST failed (code %d), attempting Firebase RTDB push...\n", code);
  }
  http.end();

  // 2. Push Real-time State to Firebase Realtime Database
  http.begin(secureClient, FIREBASE_URL_DATA);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(4000);
  int fbCode = http.PUT(payload);
  if (fbCode == 200 || fbCode == 201) {
    Serial.println(F("[FIREBASE RTDB] Stream Updated Successfully"));
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println(F("\n======================================================="));
  Serial.println(F("   BATTERYVITALS v11.3 FIREBASE REALTIME DATABASE BOOT   "));
  Serial.println(F("======================================================="));

  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);

  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_LED_YELLOW, LOW);
  digitalWrite(PIN_LED_GREEN, HIGH);

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.setTimeOut(50);
  if (ina219.begin()) {
    ina219.setCalibration_16V_400mA();
    sensor.ina_ok = true;
    Serial.println(F("[INIT] INA219 Connected (0x40)"));
  } else {
    Serial.println(F("[INIT] INA219 Offline"));
  }

  pinMode(PIN_DHT, INPUT_PULLUP);
  Serial.println(F("[INIT] Native Safe DHT11 Initialized (GPIO4)"));

  connectWiFi();
  stats.bootTime = millis();
}

void loop() {
  yield();
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

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
    }
  }

  if (now - stats.tControl >= CONTROL_INTERVAL) {
    stats.tControl = now;
    pollControl();
  }

  if (now - stats.tSafety >= SAFETY_INTERVAL) {
    stats.tSafety = now;
    updateLEDs();
  }

  if (now - stats.tUpload >= UPLOAD_INTERVAL) {
    stats.tUpload = now;
    sendTelemetry();
  }

  if (now - stats.tPrint >= DIAGNOSTIC_PRINT) {
    stats.tPrint = now;
    Serial.printf("\n[STATUS] V: %.2fV | I: %.1fmA | T: %.1fC | MQ2: %d | State: %s | Sent: %u\n",
      sensor.voltage, sensor.current_mA, sensor.temperature, sensor.mq2_raw, sensor.state, stats.packetsSent);
  }

  delay(5);
}
