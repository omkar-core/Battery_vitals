#ifndef FIREBASE_OPS_H
#define FIREBASE_OPS_H

#include <WiFi.h>
#include <FirebaseESP32.h>
#include <ArduinoJson.h>
#include "config.h"
#include "sensors.h"
#include "led_control.h"
#include "selftest.h"

static FirebaseData fbdo;
static FirebaseAuth fbAuth;
static FirebaseConfig fbConfig;
static bool autoMode = true;
static String lastSafetyState = "UNKNOWN";
static unsigned long lastWifiRetry = 0;

inline void initWiFiAndFirebase() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print(F("Connecting to WiFi"));
  // Bounded wait at boot only; loop() reconnects non-blocking afterwards.
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(F("."));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(F("\nWiFi Connected! IP: "));
    Serial.println(WiFi.localIP());
  } else {
    Serial.println(F("\nWiFi connection timed out. Proceeding in offline mode."));
  }

  fbConfig.host = FIREBASE_HOST;
  fbConfig.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);
}

inline void maintainWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  unsigned long now = millis();
  if (now - lastWifiRetry < WIFI_RETRY_MS) return;
  lastWifiRetry = now;
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

// Format A flat packet (ESP32_RULES §3.2): current in mA, power in mW,
// millis() uptime, soh_valid gating, dV_dt/dT_dt, energyWh/cycles.
inline void publishTelemetry(const SensorData& data) {
  lastSafetyState = data.safetyState;
  maintainWiFi();
  if (WiFi.status() != WL_CONNECTED) return;

  StaticJsonDocument<1024> doc;
  doc["batteryId"] = DEVICE_ID;
  doc["deviceId"] = DEVICE_ID;
  doc["firmware"] = FIRMWARE_VERSION;
  doc["voltage"] = data.busVoltage;
  doc["current"] = data.current * 1000.0f;  // mA
  doc["power"] = data.power * 1000.0f;      // mW
  doc["temperature"] = data.temperature;
  doc["humidity"] = data.humidity;
  doc["mq2"] = (int)data.mq2;
  doc["mq135"] = (int)data.mq135;
  doc["soc"] = data.soc;
  doc["soh"] = data.soh;
  doc["soh_valid"] = data.sohValid;
  doc["bhi"] = data.bhi;
  doc["resistance"] = data.resistance;
  doc["dV_dt"] = data.dV_dt;
  doc["dT_dt"] = data.dT_dt;
  doc["energyWh"] = data.energyWh;
  doc["cycles"] = data.cycles;
  doc["errors"] = data.errors;
  doc["state"] = data.safetyState;
  doc["op"] = data.op;
  doc["ina_ok"] = data.inaConnected;
  doc["dht_ok"] = data.dhtConnected;
  doc["gas_warm"] = data.gasWarm;
  doc["wifi_rssi"] = (int)WiFi.RSSI();
  doc["free_heap"] = (int)ESP.getFreeHeap();
  doc["auto_mode"] = autoMode;
  doc["red_led"] = (digitalRead(LED_RED) == HIGH);
  doc["yellow_led"] = (digitalRead(LED_YELLOW) == HIGH);
  doc["green_led"] = (digitalRead(LED_GREEN) == HIGH);
  doc["buzzer"] = (digitalRead(BUZZER_PIN) == HIGH);
  doc["profile_id"] = data.profileId;
  doc["config_version"] = data.profileVersion;
  doc["applied_config_version"] = data.profileVersion;
  doc["timestamp"] = millis();

  // Layer 21: Device Token
  doc["device_token"] = DEVICE_AUTH_TOKEN;

  // Layer 0: Self-Test
  JsonObject selfTestObj = doc.createNestedObject("self_test");
  selfTestObj["ina_ack"] = g_selfTest.ina_ack;
  selfTestObj["dht_ok"] = g_selfTest.dht_ok;
  selfTestObj["mq2_ok"] = g_selfTest.mq2_ok;
  selfTestObj["mq135_ok"] = g_selfTest.mq135_ok;
  selfTestObj["gpio_ok"] = g_selfTest.gpio_ok;
  selfTestObj["buzzer_ok"] = g_selfTest.buzzer_ok;
  selfTestObj["wifi_ok"] = g_selfTest.wifi_ok;
  selfTestObj["config_ok"] = g_selfTest.config_ok;
  selfTestObj["passed"] = g_selfTest.passed;
  selfTestObj["summary"] = g_selfTest.summary;

  // Layer 18: Calibration & Drift Baseline
  JsonObject calObj = doc.createNestedObject("calibration");
  calObj["zero_offset_mA"] = data.zeroOffsetMA;
  calObj["last_cal_ms"] = data.calTime;
  calObj["mq2_baseline"] = data.mq2Baseline;
  calObj["mq135_baseline"] = data.mq135Baseline;

  // Layer 19: Sensor Confidence
  JsonObject confObj = doc.createNestedObject("sensor_confidence");
  confObj["ina"] = data.inaConfidence;
  confObj["dht"] = data.dhtConfidence;
  confObj["mq"] = data.mqConfidence;

  String jsonStr;
  serializeJson(doc, jsonStr);

  String path = "/live_data/" + String(DEVICE_ID);
  if (Firebase.setJSON(fbdo, path, jsonStr)) {
    Serial.println(F("[Firebase] Telemetry frame pushed successfully."));
  } else {
    Serial.print(F("[Firebase] Push error: "));
    Serial.println(fbdo.errorReason());
  }
}

inline bool safetyTripActive() {
  return lastSafetyState == "CRITICAL" || lastSafetyState == "EMERGENCY" || lastSafetyState == "PROFILE_MISMATCH";
}

// Generic profile intake: validates the webapp payload, then applies it as
// the runtime limits. Rejects insane bands (never bricks the node).
inline bool applyProfilePayload(JsonObject profile) {
  ActiveProfile p = {};
  p.profileId = profile["profile_id"] | "UNSET";
  p.version = profile["config_version"] | 0;
  p.vMax = profile["voltage_max"] | -1.0f;
  p.vMin = profile["voltage_min"] | -1.0f;
  p.chargeMaxA = profile["charge_current_max"] | -1.0f;
  p.dischargeMaxA = profile["discharge_current_max"] | -1.0f;
  p.tempChargeMax = profile["temp_charge_max"] | 45.0f;
  p.tempDischargeMax = profile["temp_discharge_max"] | 60.0f;
  p.nominalV = profile["nominal_voltage"] | ((p.vMax + p.vMin) / 2.0f);
  p.capacityAh = profile["capacity_ah"] | PACK_NOMINAL_AH;
  // Derive operating bands with the same guard margins as the web builder
  // when the deploy payload carries only floor/ceiling + currents.
  float span = p.vMax - p.vMin;
  p.vWarnLow = p.vMin + span * 0.12f;
  p.vNormMin = p.vMin + span * 0.25f;
  p.vNormMax = p.vMax - span * 0.10f;
  p.vWarnHigh = p.vMax - span * 0.03f;
  p.valid = false;
  return applyProfile(p);
}

inline void pollCommands() {
  maintainWiFi();
  if (WiFi.status() != WL_CONNECTED) return;

  String path = "/commands/" + String(DEVICE_ID);
  if (Firebase.getJSON(fbdo, path)) {
    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, fbdo.jsonString());
    if (!err) {
      // Layer 18: Calibration command
      if (doc.containsKey("command")) {
        String cmd = doc["command"].as<String>();
        if (cmd == "CALIBRATE_ZERO") {
          calibrateZeroCurrent();
        }
      }
      // Runtime profile first: DEPLOY TO ESP32 lands here.
      if (doc.containsKey("profile")) {
        applyProfilePayload(doc["profile"].as<JsonObject>());
      } else if (doc.containsKey("profile_id") && doc.containsKey("voltage_max")) {
        applyProfilePayload(doc.as<JsonObject>());
      }
      if (doc.containsKey("auto_mode")) {
        autoMode = doc["auto_mode"].as<bool>();
      }
      // Hardware lockout: a trip forces auto mode and rejects silencing.
      if (safetyTripActive()) {
        autoMode = true;
        return;
      }
      if (!autoMode) {
        bool g = doc["led_green"] | false;
        bool y = doc["led_yellow"] | false;
        bool r = doc["led_red"] | false;
        setLEDs(g, y, r);

        if (doc.containsKey("buzzer_mode")) {
          String bMode = doc["buzzer_mode"].as<String>();
          if (bMode == "continuous") setBuzzerMode(BUZZER_CONTINUOUS);
          else if (bMode == "fast_beep") setBuzzerMode(BUZZER_FAST_BEEP);
          else if (bMode == "slow_beep") setBuzzerMode(BUZZER_SLOW_BEEP);
          else setBuzzerMode(BUZZER_OFF);
        } else if (doc.containsKey("buzzer")) {
          setBuzzerMode(doc["buzzer"].as<bool>() ? BUZZER_CONTINUOUS : BUZZER_OFF);
        }
      }
    }
  }
}

#endif // FIREBASE_OPS_H
