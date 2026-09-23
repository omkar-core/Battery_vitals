// ============================================================================
// Battery Vital v13.1 — Multi-Sensor Battery & Environmental Safety Node
// Architecture: INA219 + DHT11 + MQ-2 + MQ-135 -> ESP32 -> Firebase RTDB
// SAME hardware as v13.0 (no new pins). Edge autonomy: safety loop runs
// locally every 1.5s even with Wi-Fi down; actuators use millis() cadence.
// ============================================================================

#include <Arduino.h>
#include "config.h"
#include "sensors.h"
#include "led_control.h"
#include "selftest.h"
#include "firebase_ops.h"

unsigned long lastTelemetryTime = 0;
unsigned long lastCommandPollTime = 0;
unsigned long lastSensorTime = 0;
SensorData cached = {};
bool hasCached = false;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("=================================================="));
  Serial.println(F(" Battery Vital v13.1 — Safety & Telemetry Node   "));
  Serial.println(F("=================================================="));

  initActuators();
  initSensors();
  initWiFiAndFirebase();

  // Layer 0 Boot Hardware Self-Test
  runHardwareSelfTest();

  cached = readAllSensors();
  hasCached = true;
  lastSensorTime = millis();

  Serial.println(F("[Setup] Battery Vital node ready and listening."));
}

void loop() {
  unsigned long now = millis();

  // 1. Sample sensors locally every SENSOR_READ_MS (DHT-safe, WDT-safe).
  if (!hasCached || (now - lastSensorTime >= SENSOR_READ_MS)) {
    lastSensorTime = now;
    cached = readAllSensors();
    hasCached = true;
  }

  // 2. Drive actuators every iteration from the cached trip state.
  updateActuators(cached.safetyState, autoMode);

  // 3. Publish Telemetry to Firebase RTDB periodically (flat Format A).
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL) {
    lastTelemetryTime = now;
    publishTelemetry(cached);
  }

  // 4. Poll for Remote Commands (lockout enforced inside on trip).
  if (now - lastCommandPollTime >= COMMAND_POLL_MS) {
    lastCommandPollTime = now;
    pollCommands();
  }

  delay(5);
}
