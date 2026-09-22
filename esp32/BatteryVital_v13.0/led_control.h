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
static unsigned long lastLedToggle = 0;
static bool ledBlinkState = false;

inline void initActuators() {
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED, LOW);
  digitalWrite(BUZZER_PIN, LOW);
}

inline void setLEDs(bool green, bool yellow, bool red) {
  digitalWrite(LED_GREEN, green ? HIGH : LOW);
  digitalWrite(LED_YELLOW, yellow ? HIGH : LOW);
  digitalWrite(LED_RED, red ? HIGH : LOW);
}

inline void setBuzzerMode(BuzzerMode mode) {
  currentBuzzerMode = mode;
  if (mode == BUZZER_OFF) {
    digitalWrite(BUZZER_PIN, LOW);
    buzzerState = false;
  } else if (mode == BUZZER_CONTINUOUS) {
    digitalWrite(BUZZER_PIN, HIGH);
    buzzerState = true;
  }
}

// Graded response levels mirror web gradedResponse():
// L0 MONITOR green → L1 WARNING yellow → L2 ALARM yellow+buzzer →
// L3 CRITICAL red+buzzer+disconnect advisory → L4 EMERGENCY red+continuous.
inline void applyGradedLevel(const String& safetyState) {
  if (safetyState == "EMERGENCY") {
    setLEDs(false, false, true);
    setBuzzerMode(BUZZER_CONTINUOUS);
  } else if (safetyState == "CRITICAL") {
    setLEDs(false, false, true);
    setBuzzerMode(BUZZER_FAST_BEEP);
  } else if (safetyState == "WARNING") {
    setLEDs(false, true, false);
    setBuzzerMode(BUZZER_FAST_BEEP);
  } else if (safetyState == "CAUTION") {
    setLEDs(false, true, false);
    setBuzzerMode(BUZZER_SLOW_BEEP);
  } else if (safetyState == "UNKNOWN" || safetyState == "UNKNOWN_BATTERY" || safetyState == "PROFILE_MISMATCH") {
    // Configuration honesty: blink yellow+red slowly, quiet beep — never SAFE.
    setBuzzerMode(BUZZER_SLOW_BEEP);
  } else {
    setLEDs(true, false, false);
    setBuzzerMode(BUZZER_OFF);
  }
}

inline void updateActuators(const String& safetyState, bool autoMode) {
  if (autoMode) {
    applyGradedLevel(safetyState);
  }

  // Non-blocking buzzer cadence (no delay() — edge autonomy invariant).
  unsigned long now = millis();
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

  // UNKNOWN / config honesty blink: alternate yellow/red every 1s.
  if (safetyState == "UNKNOWN" || safetyState == "UNKNOWN_BATTERY" || safetyState == "PROFILE_MISMATCH") {
    if (now - lastLedToggle >= 1000) {
      lastLedToggle = now;
      ledBlinkState = !ledBlinkState;
      setLEDs(false, ledBlinkState, !ledBlinkState);
    }
  }
}

#endif // LED_CONTROL_H
