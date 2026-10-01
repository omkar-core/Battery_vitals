#ifndef LED_CONTROL_H
#define LED_CONTROL_H

#include <Arduino.h>
#include "config.h"

enum BuzzerMode {
  BUZZER_OFF,
  BUZZER_CONTINUOUS,
  BUZZER_FAST_BEEP,
  BUZZER_SLOW_BEEP
};

static BuzzerMode currentBuzzerMode = BUZZER_OFF;
static unsigned long lastBuzzerToggle = 0;
static bool buzzerState = false;
static unsigned long txPulseStart = 0;
static bool txActive = false;

inline void initActuators() {
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // Green LED ON continuously: power/system ON indicator
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED, LOW);
  digitalWrite(BUZZER_PIN, LOW);
}

inline void setLEDs(bool green, bool yellow, bool red) {
  digitalWrite(LED_GREEN, green ? HIGH : LOW);
  digitalWrite(LED_YELLOW, yellow ? HIGH : LOW);
  digitalWrite(LED_RED, red ? HIGH : LOW);
}

inline void triggerTxBlinkAndBeep() {
  txActive = true;
  txPulseStart = millis();
  digitalWrite(LED_YELLOW, HIGH);
  digitalWrite(BUZZER_PIN, HIGH);
}

inline void setBuzzerMode(BuzzerMode mode) {
  currentBuzzerMode = mode;
  if (mode == BUZZER_OFF && !txActive) {
    digitalWrite(BUZZER_PIN, LOW);
    buzzerState = false;
  } else if (mode == BUZZER_CONTINUOUS) {
    digitalWrite(BUZZER_PIN, HIGH);
    buzzerState = true;
  }
}

// Redesigned response:
// - Green LED: Continuous ON (System ON & Active)
// - Yellow LED: Blinks on telemetry transmission with single beep
// - Red LED: Active ONLY during danger (WARNING, CRITICAL, EMERGENCY, or fault)
inline void applyGradedLevel(const String& safetyState) {
  // Green is always continuous ON
  digitalWrite(LED_GREEN, HIGH);

  if (safetyState == "EMERGENCY") {
    digitalWrite(LED_RED, HIGH);
    setBuzzerMode(BUZZER_CONTINUOUS);
  } else if (safetyState == "CRITICAL") {
    digitalWrite(LED_RED, HIGH);
    setBuzzerMode(BUZZER_FAST_BEEP);
  } else if (safetyState == "WARNING") {
    digitalWrite(LED_RED, HIGH);
    setBuzzerMode(BUZZER_SLOW_BEEP);
  } else {
    // SAFE, CAUTION, or Normal: Red LED is OFF
    digitalWrite(LED_RED, LOW);
    setBuzzerMode(BUZZER_OFF);
  }
}

inline void updateActuators(const String& safetyState, bool autoMode) {
  if (autoMode) {
    applyGradedLevel(safetyState);
  }

  unsigned long now = millis();

  // Handle Yellow Tx pulse and single beep completion (100ms)
  if (txActive) {
    if (now - txPulseStart >= 100) {
      txActive = false;
      digitalWrite(LED_YELLOW, LOW);
      if (currentBuzzerMode == BUZZER_OFF) {
        digitalWrite(BUZZER_PIN, LOW);
      }
    }
    return;
  }

  // Non-blocking buzzer cadence for danger alarms
  if (currentBuzzerMode == BUZZER_FAST_BEEP) {
    if (now - lastBuzzerToggle >= 500) {
      lastBuzzerToggle = now;
      buzzerState = !buzzerState;
      digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
    }
  } else if (currentBuzzerMode == BUZZER_SLOW_BEEP) {
    if (now - lastBuzzerToggle >= 2000) {
      lastBuzzerToggle = now;
      buzzerState = !buzzerState;
      digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
    }
  }
}

#endif // LED_CONTROL_H
