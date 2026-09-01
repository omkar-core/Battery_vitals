#ifndef CONFIG_H
#define CONFIG_H

// ============================================================================
// Battery Vital v13.0 — Hardware Configuration & Pin Mappings
// ============================================================================

// ── Device Identification ──
#define DEVICE_ID           "BAT001"
#define FIRMWARE_VERSION    "13.0.0"
#define TELEMETRY_INTERVAL  1500     // Telemetry publish interval (ms)
#define COMMAND_POLL_MS     1000     // Command poll interval (ms)

// ── WiFi Credentials ──
#define WIFI_SSID           "YOUR_WIFI_SSID"
#define WIFI_PASSWORD       "YOUR_WIFI_PASSWORD"

// ── Firebase Realtime Database ──
#define FIREBASE_HOST       "https://your-project-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH       "YOUR_FIREBASE_DATABASE_SECRET_OR_API_KEY"

// ── I2C Sensor Pins (INA219) ──
#define SDA_PIN             21       // I2C Data
#define SCL_PIN             22       // I2C Clock
#define INA219_I2C_ADDR     0x40

// ── Digital Sensor Pins ──
#define DHT_PIN             4        // DHT11 Temperature & Humidity Sensor
#define DHT_TYPE            DHT11

// ── Analog Sensor Pins ──
#define MQ2_PIN             34       // MQ-2 LPG / Smoke Sensor (ADC1_CH6)
#define MQ135_PIN           35       // MQ-135 Air Quality / CO2 Sensor (ADC1_CH7)

// ── Hardware Actuator Outputs ──
#define BUZZER_PIN          25       // Active Buzzer
#define LED_GREEN           14       // Normal Status Indicator
#define LED_YELLOW          26       // Warning Status Indicator
#define LED_RED             27       // Critical Status Indicator

// ── Default Battery Safety Thresholds ──
#define V_NOMINAL           12.6f
#define V_MAX_CRITICAL      14.6f
#define V_MIN_CRITICAL      10.5f
#define I_MAX_CRITICAL      15.0f
#define TEMP_MAX_CRITICAL   45.0f
#define MQ2_MAX_CRITICAL    800.0f
#define MQ135_MAX_CRITICAL  500.0f

#endif // CONFIG_H
