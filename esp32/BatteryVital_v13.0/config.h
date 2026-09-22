#ifndef CONFIG_H
#define CONFIG_H

// ============================================================================
// Battery Vital v13.1 — Hardware Configuration & Pin Mappings
// SAME hardware: INA219 + DHT11 + MQ-2 + MQ-135 + LEDs + buzzer. No new pins.
// Thresholds mirror src/lib/batterySafety.js + ESP32_RULES.md §5.1.
// ============================================================================

// ── Device Identification ──
#define DEVICE_ID           "BAT001"
#define FIRMWARE_VERSION    "13.1.0"
#define TELEMETRY_INTERVAL  1500     // Telemetry publish interval (ms)
#define COMMAND_POLL_MS     1000     // Command poll interval (ms)
#define SENSOR_READ_MS      1500     // Local safety sampling interval (ms)
#define GAS_WARMUP_MS       120000UL // MQ heater stabilisation (ms)
#define WIFI_RETRY_MS       10000UL  // Non-blocking WiFi reconnect (ms)

// ── WiFi Credentials ──
#define WIFI_SSID           "YOUR_WIFI_SSID"
#define WIFI_PASSWORD       "YOUR_WIFI_PASSWORD"

// ── Firebase Realtime Database ──
#define FIREBASE_HOST       "https://your-project-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH       "YOUR_FIREBASE_DATABASE_SECRET_OR_API_KEY"

// ── I2C Sensor Pins (INA219) ──
#define SDA_PIN             21       // I2C Data (4.7k pull-up to 3V3)
#define SCL_PIN             22       // I2C Clock (4.7k pull-up to 3V3)
#define INA219_I2C_ADDR     0x40

// ── Digital Sensor Pins ──
#define DHT_PIN             4        // DHT11 Temperature & Humidity Sensor
#define DHT_TYPE            DHT11

// ── Analog Sensor Pins (ADC1 ONLY — ADC2 fails with Wi-Fi active) ──
#define MQ2_PIN             34       // MQ-2 LPG / Smoke Sensor (ADC1_CH6)
#define MQ135_PIN           35       // MQ-135 Air Quality / CO2 Sensor (ADC1_CH7)
#define GAS_SAMPLES         10       // Rolling-average window per ESP32_RULES §7.4

// ── Hardware Actuator Outputs ──
#define BUZZER_PIN          25       // Active Buzzer
#define LED_GREEN           14       // Normal Status Indicator
#define LED_YELLOW          26       // Warning Status Indicator
#define LED_RED             27       // Critical Status Indicator

// ── Battery model (generic fallback only — active profile overrides at runtime)
// Firmware NEVER guesses chemistry from voltage; deploy a profile first.
#define PACK_V_EMPTY        10.5f
#define PACK_V_FULL         12.6f
#define PACK_V_MIN          9.0f
#define PACK_V_MAX          14.6f
#define PACK_NOMINAL_AH     7.0f
#define PROFILE_TOLERANCE_V 1.0f     // Pre-connection mismatch band (±V)
#define DEVICE_AUTH_TOKEN   "BV_DEVICE_SECRET_TOKEN_V13" // Layer 21 Device Auth

// ── Deterministic trip thresholds (mirror batterySafety.js defaults) ──
#define V_WARN_LOW          10.5f
#define V_CRIT_LOW          10.0f
#define V_EMERG_LOW         9.5f
#define V_WARN_HIGH         14.2f
#define V_CRIT_HIGH         14.4f
#define V_EMERG_HIGH        14.8f
#define V_MAX_CRITICAL      14.6f
#define V_MIN_CRITICAL      10.5f
#define I_CHARGE_MAX        10.0f    // |charge| beyond => CRITICAL
#define I_DISCHARGE_MAX     15.0f    // discharge beyond => CRITICAL
#define I_SHORT_CIRCUIT     30.0f    // |I| beyond => EMERGENCY
#define P_WARN              150.0f
#define P_CRIT              200.0f
#define I_MAX_CRITICAL      15.0f
#define TEMP_WARN           40.0f
#define TEMP_CRIT           45.0f
#define TEMP_EMERG          55.0f
#define TEMP_MAX_CRITICAL   45.0f
#define MQ2_WARN            1500.0f
#define MQ2_CRIT            3000.0f
#define MQ2_EMERG           4000.0f
#define MQ2_MAX_CRITICAL    800.0f
#define MQ135_WARN          300.0f
#define MQ135_CRIT          500.0f
#define MQ135_MAX_CRITICAL  500.0f

// ── Predictive rate thresholds (per minute) ──
#define DVDT_WARN           0.5f     // V/min
#define DVDT_CRIT           1.5f
#define DTDT_WARN           2.0f     // °C/min
#define DTDT_CRIT           5.0f
#define GAS_RISE_WARN       400.0f   // ADC/min
#define GAS_RISE_CRIT       1000.0f

// ── Resistance / SOH curve (load-step Rint, mΩ) ──
#define R_NOMINAL_MOHM      14.0f
#define R_WARN_MOHM         50.0f
#define R_CRIT_MOHM         100.0f
#define R_EOL_MOHM          250.0f

#endif // CONFIG_H
