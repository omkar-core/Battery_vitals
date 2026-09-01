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

inline void updateActuators(const String& safetyState, bool autoMode) {
  if (autoMode) {
    if (safetyState == "CRITICAL") {
      setLEDs(false, false, true); // Red LED
      setBuzzerMode(BUZZER_CONTINUOUS);
    } else if (safetyState == "WARNING") {
      setLEDs(false, true, false); // Yellow LED
      setBuzzerMode(BUZZER_FAST_BEEP);
    } else {
      setLEDs(true, false, false); // Green LED
      setBuzzerMode(BUZZER_OFF);
    }
  }

  // Handle Beep timing
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
}

#endif // LED_CONTROL_H
