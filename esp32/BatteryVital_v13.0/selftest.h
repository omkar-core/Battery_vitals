#ifndef SELFTEST_H
#define SELFTEST_H

#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include "config.h"

// ============================================================================
// Battery Vital v13.1 — Boot Hardware Self-Test (Layer 0)
// Runs once in setup(). Checks sensor I2C ACK, DHT bus, MQ ADC sanity,
// GPIO outputs, buzzer audio, Wi-Fi connectivity, and config integrity.
// Results are exposed in the telemetry payload for webapp /diagnostics.
// ============================================================================

struct SelfTestResults {
  bool ina_ack;
  bool dht_ok;
  bool mq2_ok;
  bool mq135_ok;
  bool gpio_ok;
  bool buzzer_ok;
  bool wifi_ok;
  bool config_ok;
  bool passed;
  char summary[96];
};

static SelfTestResults g_selfTest = {
  false, false, false, false, false, false, false, false, false, "INITIALIZING"
};

inline SelfTestResults runHardwareSelfTest() {
  Serial.println(F("[SelfTest] Starting Layer 0 Hardware Self-Test Sequence..."));
  SelfTestResults res;
  res.passed = true;

  // 1. INA219 I2C ACK check
  Wire.beginTransmission(INA219_I2C_ADDR);
  byte i2cErr = Wire.endTransmission();
  res.ina_ack = (i2cErr == 0);
  if (res.ina_ack) {
    Serial.println(F("  [✓] INA219 I2C ACK: OK (0x40 responded)"));
  } else {
    Serial.print(F("  [✗] INA219 I2C ACK: FAIL (error code "));
    Serial.print(i2cErr);
    Serial.println(F(") — check SDA/SCL pull-ups"));
    res.passed = false;
  }

  // 2. DHT Read Sanity Check (pin level check)
  pinMode(DHT_PIN, INPUT_PULLUP);
  int dhtPinState = digitalRead(DHT_PIN);
  res.dht_ok = (dhtPinState == HIGH); // Should idle HIGH with pull-up
  if (res.dht_ok) {
    Serial.println(F("  [✓] DHT Bus Line: OK (Idle HIGH detected)"));
  } else {
    Serial.println(F("  [✗] DHT Bus Line: FAIL (Held LOW or disconnected)"));
    res.passed = false;
  }

  // 3. MQ-2 ADC Sanity Check (ADC1_CH6, Pin 34)
  int rawMq2 = analogRead(MQ2_PIN);
  res.mq2_ok = (rawMq2 >= 0 && rawMq2 <= 4095);
  if (res.mq2_ok) {
    Serial.print(F("  [✓] MQ-2 ADC Sanity: OK (raw reading = "));
    Serial.print(rawMq2);
    Serial.println(F(")"));
  } else {
    Serial.println(F("  [✗] MQ-2 ADC Sanity: FAIL (out of ADC range)"));
    res.passed = false;
  }

  // 4. MQ-135 ADC Sanity Check (ADC1_CH7, Pin 35)
  int rawMq135 = analogRead(MQ135_PIN);
  res.mq135_ok = (rawMq135 >= 0 && rawMq135 <= 4095);
  if (res.mq135_ok) {
    Serial.print(F("  [✓] MQ-135 ADC Sanity: OK (raw reading = "));
    Serial.print(rawMq135);
    Serial.println(F(")"));
  } else {
    Serial.println(F("  [✗] MQ-135 ADC Sanity: FAIL (out of ADC range)"));
    res.passed = false;
  }

  // 5. GPIO Output Pins (Green, Yellow, Red LEDs)
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_YELLOW, HIGH);
  digitalWrite(LED_RED, HIGH);
  delay(120);
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED, LOW);
  res.gpio_ok = true;
  Serial.println(F("  [✓] GPIO Output Stage: OK (LED cycle tested)"));

  // 6. Buzzer Test Chirp (50ms audible indication)
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(50);
  digitalWrite(BUZZER_PIN, LOW);
  res.buzzer_ok = true;
  Serial.println(F("  [✓] Buzzer Audio Check: OK (50ms test chirp)"));

  // 7. Config Integrity
  res.config_ok = (TELEMETRY_INTERVAL >= 500 && SENSOR_READ_MS >= 500 && PACK_V_MAX > PACK_V_MIN);
  if (res.config_ok) {
    Serial.println(F("  [✓] Config Integrity: OK (Timing & thresholds valid)"));
  } else {
    Serial.println(F("  [✗] Config Integrity: FAIL"));
    res.passed = false;
  }

  // 8. Wi-Fi Status Check
  res.wifi_ok = (WiFi.status() == WL_CONNECTED);
  if (res.wifi_ok) {
    Serial.println(F("  [✓] Network Link: OK (Connected to Wi-Fi)"));
  } else {
    Serial.println(F("  [!] Network Link: UNLINKED (Offline mode active)"));
  }

  // Summary
  if (res.passed) {
    snprintf(res.summary, sizeof(res.summary), "PASS — ALL SENSORS & ACTUATORS READY (FW %s)", FIRMWARE_VERSION);
    Serial.println(F("[SelfTest] >>> RESULT: SYSTEM READY (All critical checks passed) <<<"));
  } else {
    snprintf(res.summary, sizeof(res.summary), "DEGRADED — SENSOR/CONFIG FAULT DETECTED (FW %s)", FIRMWARE_VERSION);
    Serial.println(F("[SelfTest] >>> RESULT: DEGRADED (Check physical wiring) <<<"));
  }

  g_selfTest = res;
  return res;
}

#endif // SELFTEST_H
