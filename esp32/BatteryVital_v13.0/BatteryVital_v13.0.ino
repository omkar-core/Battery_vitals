// ============================================================================
// Battery Vital v13.0 — Multi-Sensor Battery & Environmental Safety Node
// Architecture: INA219 + DHT11 + MQ-2 + MQ-135 -> ESP32 -> Firebase RTDB
// ============================================================================

#include <Arduino.h>
#include "config.h"
#include "sensors.h"
#include "led_control.h"
#include "firebase_ops.h"

unsigned long lastTelemetryTime = 0;
unsigned long lastCommandPollTime = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("=================================================="));
  Serial.println(F(" Battery Vital v13.0 — Safety & Telemetry Node   "));
  Serial.println(F("=================================================="));

  initActuators();
  initSensors();
  initWiFiAndFirebase();

  Serial.println(F("[Setup] Battery Vital node ready and listening."));
}

void loop() {
  unsigned long now = millis();

  // 1. Read all sensors
  SensorData data = readAllSensors();

  // 2. Update actuators (LEDs & Buzzer) based on safety state
  updateActuators(data.safetyState, autoMode);

  // 3. Publish Telemetry to Firebase RTDB periodically
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL) {
    lastTelemetryTime = now;
    publishTelemetry(data);
  }

  // 4. Poll for Remote Commands from Web Dashboard
  if (now - lastCommandPollTime >= COMMAND_POLL_MS) {
    lastCommandPollTime = now;
    pollCommands();
  }

  delay(10);
}
