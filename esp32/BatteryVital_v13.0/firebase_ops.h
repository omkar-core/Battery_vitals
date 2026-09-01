#ifndef FIREBASE_OPS_H
#define FIREBASE_OPS_H

#include <WiFi.h>
#include <FirebaseESP32.h>
#include <ArduinoJson.h>
#include "config.h"
#include "sensors.h"
#include "led_control.h"

static FirebaseData fbdo;
static FirebaseAuth auth;
static FirebaseConfig config;
static bool autoMode = true;

inline void initWiFiAndFirebase() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print(F("Connecting to WiFi"));
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

  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

inline void publishTelemetry(const SensorData& data) {
  if (WiFi.status() != WL_CONNECTED) return;

  StaticJsonDocument<512> doc;
  doc["timestamp"] = (unsigned long)time(nullptr);
  doc["deviceId"] = DEVICE_ID;
  doc["firmware"] = FIRMWARE_VERSION;

  JsonObject battery = doc.createNestedObject("battery");
  battery["voltage"] = data.busVoltage;
  battery["shuntVoltage"] = data.shuntVoltage;
  battery["loadVoltage"] = data.loadVoltage;
  battery["current"] = data.current;
  battery["power"] = data.power;
  battery["soc"] = data.soc;
  battery["soh"] = data.soh;
  battery["bhi"] = data.bhi;
  battery["safety"] = data.safetyState;

  JsonObject env = doc.createNestedObject("environmental");
  env["temperature"] = data.temperature;
  env["humidity"] = data.humidity;
  env["mq2"] = data.mq2;
  env["mq135"] = data.mq135;
  env["aqi"] = data.aqi;

  JsonObject hw = doc.createNestedObject("hardware");
  hw["auto_mode"] = autoMode;
  hw["led_green"] = (digitalRead(LED_GREEN) == HIGH);
  hw["led_yellow"] = (digitalRead(LED_YELLOW) == HIGH);
  hw["led_red"] = (digitalRead(LED_RED) == HIGH);
  hw["buzzer"] = (digitalRead(BUZZER_PIN) == HIGH);

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

inline void pollCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  String path = "/commands/" + String(DEVICE_ID);
  if (Firebase.getJSON(fbdo, path)) {
    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, fbdo.jsonString());
    if (!err) {
      if (doc.containsKey("auto_mode")) {
        autoMode = doc["auto_mode"].as<bool>();
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
