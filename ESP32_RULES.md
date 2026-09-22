# ESP32 Firmware Engineering Rules & Compatibility Specification (ESP32_RULES.md)

> **Document Version**: 2.0.0  
> **Target Firmware**: Battery Vital v12.x / v13.x / v14.x+  
> **Status**: Mandatory & Non-Negotiable Specification  
> **Last Updated**: September 2026  
> **Maintainer**: Battery Vital Core Hardware & Cloud Engineering Team  

---

## Table of Contents

1. [Executive Summary & Purpose](#1-executive-summary--purpose)
2. [Hardware Pinout & Circuit Architecture](#2-hardware-pinout--circuit-architecture)
3. [Telemetry Payload Contracts & Data Formats](#3-telemetry-payload-contracts--data-formats)
   - 3.1 [Dual Telemetry Sinks](#31-dual-telemetry-sinks)
   - 3.2 [Format A: Raw Flat Packet (Recommended for Direct RTDB Push)](#32-format-a-raw-flat-packet-recommended-for-direct-rtdb-push)
   - 3.3 [Format B: REST API Gateway Ingest (`POST /api/telemetry`)](#33-format-b-rest-api-gateway-ingest-post-apitelemetry)
   - 3.4 [Format C: Modular Nested RTDB Document](#34-format-c-modular-nested-rtdb-document)
4. [Comprehensive Parameter & Metric Dictionary](#4-comprehensive-parameter--metric-dictionary)
5. [Deterministic Safety Engine & Trip Invariants](#5-deterministic-safety-engine--trip-invariants)
   - 5.1 [Trip Thresholds & Severity Hierarchy](#51-trip-thresholds--severity-hierarchy)
   - 5.2 [Hardware Safety Lockout Rule](#52-hardware-safety-lockout-rule)
   - 5.3 [Edge Autonomy & Offline Fallback](#53-edge-autonomy--offline-fallback)
6. [Bidirectional Actuator & Command Protocol](#6-bidirectional-actuator--command-protocol)
   - 6.1 [Command Schema (`/commands/{batteryId}`)](#61-command-schema-commandsbatteryid)
   - 6.2 [LED Actuator Behavior (GPIO 14, 26, 27)](#62-led-actuator-behavior-gpio-14-26-27)
   - 6.3 [Buzzer Pattern Generator (GPIO 25)](#63-buzzer-pattern-generator-gpio-25)
   - 6.4 [Auto Mode vs Manual Override](#64-auto-mode-vs-manual-override)
7. [Advanced Firmware Features & Coding Standards](#7-advanced-firmware-features--coding-standards)
   - 7.1 [Non-Blocking Scheduling & Watchdog (WDT)](#71-non-blocking-scheduling--watchdog-wdt)
   - 7.2 [Coulomb Counting & Non-Volatile Memory (NVS)](#72-coulomb-counting--non-volatile-memory-nvs)
   - 7.3 [Internal Resistance ($R_{int}$) & SOH Estimation](#73-internal-resistance-r_int--soh-estimation)
   - 7.4 [ADC Calibration & Gas Sensor Warming](#74-adc-calibration--gas-sensor-warming)
   - 7.5 [Robust WiFi & Dual-Sink Failover](#75-robust-wifi--dual-sink-failover)
8. [CI/CD Pipeline & Automated Firmware Verification](#8-cicd-pipeline--automated-firmware-verification)
   - 8.1 [GitHub Actions CI Workflow Architecture](#81-github-actions-ci-workflow-architecture)
   - 8.2 [Automated Schema Validation Tests](#82-automated-schema-validation-tests)
   - 8.3 [Static Analysis (`cppcheck` / `clang-format`)](#83-static-analysis-cppcheck--clang-format)
   - 8.4 [Semantic Versioning & OTA Strategy](#84-semantic-versioning--ota-strategy)
9. [Troubleshooting & Diagnostics Matrix](#9-troubleshooting--diagnostics-matrix)
10. [Future Upgrades & Revision Log](#10-future-upgrades--revision-log)

---

## 1. Executive Summary & Purpose

This document is the **definitive engineering handbook and rulebook** governing all ESP32 embedded firmware running in the Battery Vital ecosystem. 

Its primary mission is to guarantee **100% interoperability, zero data drift, and absolute safety synchronization** between physical edge microcontroller nodes and the Battery Vital Next.js web application, Firebase Realtime Database (RTDB), MongoDB Atlas historical archives, and Google Gemini AI diagnostics.

### Core Mandates:
1. **Zero Silent Failures**: All telemetry packets must strictly adhere to the schemas, unit multipliers, and physical ranges expected by the website's gateway.
2. **Deterministic Precedence**: Actuator outputs and safety classifications computed at the edge must match the physics engine in [`src/lib/batterySafety.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/batterySafety.js). Remote software overrides can never silence emergency trips.
3. **Continuous Verification**: Any firmware changes must pass automated CI/CD compilation and payload compatibility testing before deployment.

---

## 2. Hardware Pinout & Circuit Architecture

The standard Battery Vital hardware platform utilizes the **ESP32-WROOM-32 (30-pin / 38-pin DevKit)**. All firmware implementations must respect the physical constraints of the ESP32 hardware multiplexing:

```
                          ┌─────────────────────────┐
                          │     ESP32 DEVKIT V1     │
                          │                         │
     [I2C SDA]  GPIO 21 ──┤ SDA                 3V3 ├── [3.3V Rail: INA219, DHT11]
     [I2C SCL]  GPIO 22 ──┤ SCL                 GND ├── [Common Ground]
     [DHT Data] GPIO  4 ──┤ D4                  VIN ├── [5.0V External Power Input]
     [MQ-2 ADC] GPIO 34 ──┤ D34 (ADC1_CH6)      D25 ├── [Active Buzzer]
   [MQ-135 ADC] GPIO 35 ──┤ D35 (ADC1_CH7)      D26 ├── [Yellow Warning LED]
                          │                     D27 ├── [Red Critical LED]
                          │                     D14 ├── [Green Normal LED]
                          └─────────────────────────┘
```

### 2.1 Hardware Pin Assignment Table

| Pin Name | ESP32 GPIO | Mode / Type | Connected Device / Function | Electrical Specification |
|:---|:---:|:---:|:---|:---|
| **I2C SDA** | `GPIO 21` | Digital Bidirectional | INA219 High-Side Power Monitor | Requires 4.7 kΩ pull-up resistor to 3.3V |
| **I2C SCL** | `GPIO 22` | Digital Output (Clock) | INA219 I2C Clock (100–400 kHz) | Requires 4.7 kΩ pull-up resistor to 3.3V |
| **DHT DATA**| `GPIO 4` | Digital Bidirectional | DHT11 / DHT22 Ambient Temp/Hum | 10 kΩ pull-up to 3.3V; non-blocking timing |
| **MQ2 SENSE**| `GPIO 34` | Analog Input (`ADC1_CH6`)| MQ-2 Combustible Gas & Smoke | Input-only pin. 0–3.3V via voltage divider |
| **MQ135 SENSE**| `GPIO 35` | Analog Input (`ADC1_CH7`)| MQ-135 Air Quality / CO2 / VOCs | Input-only pin. 0–3.3V via voltage divider |
| **BUZZER** | `GPIO 25` | Digital Output | Active Piezo Buzzer (2.4 kHz) | Driven via NPN/MOSFET buffer (30 mA max) |
| **LED YELLOW**| `GPIO 26` | Digital Output | Warning Status Indicator LED | 330 Ω current-limiting resistor (5–10 mA) |
| **LED RED** | `GPIO 27` | Digital Output | Critical Alarm / Trip LED | 330 Ω current-limiting resistor (5–10 mA) |
| **LED GREEN** | `GPIO 14` | Digital Output | Normal Nominal Indicator LED | 330 Ω current-limiting resistor (5–10 mA) |

> [!CAUTION]
> **ADC Pin Rule**: Analog sensors (MQ-2, MQ-135) **MUST ONLY** be connected to **ADC1** (GPIOs 32–39). **ADC2** (GPIOs 0, 2, 4, 12–15, 25–27) is shared with the Wi-Fi baseband driver; reading analog values from ADC2 while Wi-Fi is active will fail or return corrupt zero readings.

---

## 3. Telemetry Payload Contracts & Data Formats

The Battery Vital cloud infrastructure accepts telemetry through two primary channels. Firmware must implement at least one (ideally both as failover dual sinks):

```
                   ┌──────────────────────────────────────┐
                   │           ESP32 Firmware             │
                   └──────┬───────────────────────┬───────┘
                          │                       │
         Format A (Flat JSON)          Format B (REST API JSON)
         HTTPS PUT / WebSocket        HTTPS POST
                          │                       │
                          ▼                       ▼
            Firebase Realtime DB         Next.js Route Gateway
          `live_data/{batteryId}`        `/api/telemetry`
                          │                       │
                          │                       ├─► Zod Validation
                          ▼                       │
               `normalizeEsp32Packet()`           ├─► Deterministic Safety
                          │                       │
                          └───────────┬───────────┘
                                      │
                                      ▼
                             Web UI & MongoDB Atlas
```

---

### 3.1 Dual Telemetry Sinks

1. **Sink 1 (Primary RTDB Stream)**: Direct HTTPS `PUT` or Firebase SDK set operation on `live_data/{batteryId}`. Latency is <300 ms.
2. **Sink 2 (REST Gateway Fallback)**: HTTPS `POST` to `https://{APP_HOST}/api/telemetry`. Ideal when Firebase credentials fail or during proxy forwarding.

---

### 3.2 Format A: Raw Flat Packet (Recommended for Direct RTDB Push)

When pushing directly to Firebase RTDB at `live_data/BAT001`, the web platform's [`src/lib/esp32.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/esp32.js) normalizer intercepts and unifies this payload:

```json
{
  "batteryId": "BAT001",
  "deviceId": "BV001",
  "firmware": "v13.0",
  "mac": "24:6F:28:XX:XX:XX",
  "voltage": 12.64,
  "current": 2450.0,
  "power": 30968.0,
  "temperature": 26.4,
  "humidity": 52.0,
  "mq2": 320,
  "mq2_pct": 3,
  "mq135": 110,
  "mq135_ppm": 420,
  "soc": 85,
  "soh": 98,
  "soh_valid": true,
  "bhi": 8,
  "resistance": 14.2,
  "dV_dt": -0.002,
  "dT_dt": 0.001,
  "energyWh": 42.15,
  "cycles": 6.2,
  "errors": 0,
  "state": "SAFE",
  "op": "DISCHARGE",
  "ina_ok": true,
  "dht_ok": true,
  "gas_warm": true,
  "wifi_rssi": -64,
  "free_heap": 218450,
  "auto_mode": true,
  "red_led": false,
  "yellow_led": false,
  "green_led": true,
  "buzzer": false,
  "timestamp": 128450
}
```

> [!IMPORTANT]
> **Units in Format A**:
> - `current`: Transmitted in **milliamps (mA)** (e.g. `2450.0` = 2.45 A). The web app divides by 1000.
> - `power`: Transmitted in **milliwatts (mW)** (e.g. `30968.0` = 30.968 W). The web app divides by 1000.
> - `timestamp`: ESP32 `millis()` uptime. The web application records reception time as an authentic ISO timestamp.
> - `soh_valid`: Set to `true` **only** after internal resistance is computed from live discharge. Never claim 100% SOH without measurement!

---

### 3.3 Format B: REST API Gateway Ingest (`POST /api/telemetry`)

Validated strictly by Zod [`src/lib/schemas.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/schemas.js):

```json
{
  "batteryId": "BAT001",
  "deviceId": "BAT001",
  "voltage": 12.64,
  "current": 2.45,
  "temperature": 26.4,
  "humidity": 52.0,
  "mq2": 320,
  "mq135": 110,
  "ina_ok": true,
  "dht_ok": true,
  "timestamp": 1725900000000
}
```

> [!WARNING]
> **Zod Gateway Ingest Rules**:
> - `deviceId`: 3–10 chars, regex `^[A-Z0-9_-]+$`
> - `voltage`: Float, **0.5 V to 100.0 V**. Values below 0.5 V are rejected as invalid/disconnected probe!
> - `current`: Float, **-500.0 A to +500.0 A** (Amperes, not mA).
> - `temperature`: Float, **-40.0 °C to +150.0 °C**.
> - `timestamp`: Optional, positive integer (epoch ms, not millis uptime).

---

### 3.4 Format C: Modular Nested RTDB Document

Used in `esp32/BatteryVital_v13.0/firebase_ops.h`:

```json
{
  "timestamp": 1725900000,
  "deviceId": "BAT001",
  "firmware": "13.0.0",
  "device_token": "secret_edge_token_12345",
  "battery": {
    "voltage": 12.64,
    "shuntVoltage": 0.0245,
    "loadVoltage": 12.6645,
    "current": 2.45,
    "power": 30.97,
    "soc": 85.0,
    "soh": 98.0,
    "bhi": 8.0,
    "safety": "SAFE"
  },
  "environmental": {
    "temperature": 26.4,
    "humidity": 52.0,
    "mq2": 320.0,
    "mq135": 110.0,
    "aqi": 38
  },
  "hardware": {
    "auto_mode": true,
    "led_green": true,
    "led_yellow": false,
    "led_red": false,
    "buzzer": false
  },
  "self_test": {
    "passed": true,
    "ina_ack": true,
    "dht_ok": true,
    "mq2_ok": true,
    "mq135_ok": true,
    "gpio_ok": true,
    "buzzer_ok": true,
    "wifi_ok": true,
    "config_ok": true,
    "timestamp": 1725899990
  },
  "calibration": {
    "zero_current_offset": 0.012,
    "calibrated_at": 1725899000
  },
  "sensor_confidence": {
    "inaConfidence": 1.0,
    "dhtConfidence": 1.0,
    "mqConfidence": 1.0,
    "overallConfidence": 1.0
  }
}
```

---

## 4. Comprehensive Parameter & Metric Dictionary

Every measurement sent by the ESP32 must conform to this exhaustive specification:

| Field Key | Type | Unit | Plausible Window | Resolution | Sensor / Derivation | Description |
|:---|:---:|:---:|:---:|:---:|:---|:---|
| `batteryId` | string | — | 3–20 chars | — | Firmware Config (`config.h`) | Unique battery pack identifier (e.g. `BAT001`) |
| `deviceId` | string | — | 3–10 chars | — | Firmware Config | Node hardware tag (e.g. `BV001`) |
| `firmware` | string | — | SemVer | — | Hardcoded | Firmware version string (e.g. `13.0.0`) |
| `mac` | string | — | 17 chars | — | `WiFi.macAddress()` | ESP32 physical Wi-Fi MAC address |
| `voltage` | float | V | 0.5 – 100.0 | 0.01 V | INA219 Bus Voltage | Total pack terminal voltage |
| `shunt_mV` / `shuntVoltage` | float | mV / V | -320 – +320 mV | 0.01 mV | INA219 Shunt Drop | High-side precision shunt drop |
| `loadVoltage` | float | V | 0.5 – 100.0 | 0.01 V | $V_{bus} + V_{shunt}$ | Effective battery load voltage |
| `current` (Format A) | float | mA | -500,000 – 500,000 | 0.1 mA | INA219 Current Register | Continuous pack current in mA |
| `current` (Format B/C) | float | A | -500.0 – +500.0 | 0.01 A | INA219 Current / 1000 | Positive = Charge, Negative = Discharge |
| `power` (Format A) | float | mW | -5,000,000 – 5,000,000| 0.1 mW | INA219 Power Register | Pack electrical power in mW |
| `power` (Format B/C) | float | W | -5,000.0 – 5,000.0 | 0.01 W | $V \times I$ | Real electrical power in Watts |
| `temperature` | float | °C | -40.0 – 150.0 | 0.1 °C | DHT11 / DHT22 | Ambient / cell exterior temperature |
| `humidity` | float | %RH | 0.0 – 100.0 | 1.0 % | DHT11 / DHT22 | Relative atmospheric humidity |
| `mq2` | int/float| ADC/ppm | 0 – 10,000 | 1 ADC | MQ-2 Sensor (GPIO 34) | Combustible gas / smoke raw ADC or ppm |
| `mq2_pct` | int | % | 0 – 100 | 1 % | Clamped mapping | $0\%\ (\text{clean}) \to 100\%\ (\text{saturated})$ |
| `mq135` | int/float| ADC/ppm | 0 – 10,000 | 1 ADC | MQ-135 Sensor (GPIO 35)| Air quality, CO2, ammonia, alcohol |
| `aqi` | int | AQI | 0 – 500 | 1 | Standard AQI piecewise | Calculated Air Quality Index |
| `soc` | float | % | 0.0 – 100.0 | 1.0 % | Coulomb Integration + OCV | State of Charge capacity estimate |
| `soh` | float | % | 0.0 – 100.0 | 1.0 % | Resistance degradation curve| State of Health relative to nominal |
| `soh_valid` | boolean | — | `true` / `false` | — | Internal $R$ valid check | True only after live load step test |
| `bhi` | float | Index | 0.0 – 100.0 | 1.0 | Physics Penalty Aggregator | Battery Health Index ($0=\text{best}, 100=\text{fail}$) |
| `resistance` | float | mΩ | 0.0 – 1,000.0 | 0.1 mΩ | $\frac{\Delta V}{\Delta I}$ under load step | Calculated dynamic internal resistance |
| `dV_dt` | float | V/s | -10.0 – 10.0 | 0.001 | Voltage slope per second | Thermal & electrical runaway derivative |
| `dT_dt` | float | °C/s | -5.0 – 5.0 | 0.001 | Temperature slope per sec | Thermal surge indicator |
| `energyWh` | float | Wh | $\ge 0.0$ | 0.01 Wh | Cumulative $\int P\,dt$ | Lifetime energy throughput |
| `cycles` | float | cycles | $\ge 0.0$ | 0.01 | $\frac{\text{Throughput Ah}}{2 \times C_{nom}}$ | Equivalent full charge/discharge cycles |
| `errors` | uint32 | bitmask | 0 – 0xFFFFFFFF | 1 | Self-test error register | Bit 0: INA fail, Bit 1: DHT fail, etc. |
| `state` / `safety` | string | — | Enum | — | Edge Safety Evaluator | `"SAFE"`, `"CAUTION"`, `"WARNING"`, `"CRITICAL"`, `"EMERGENCY"` |
| `op` / `opDirection`| string | — | Enum | — | Current sign check | `"CHARGE"`, `"DISCHARGE"`, `"IDLE"` |
| `ina_ok` | boolean | — | `true` / `false` | — | INA219 I2C ACK test | Bus health status |
| `dht_ok` | boolean | — | `true` / `false` | — | Checksum verification | Digital humidity probe health status |
| `gas_warm` | boolean | — | `true` / `false` | — | Uptime > 120,000 ms | MQ heater element thermal equilibrium |
| `wifi_rssi` | int | dBm | -120 – 0 | 1 dBm | `WiFi.RSSI()` | Received Wi-Fi signal strength |
| `free_heap` | int | bytes | 10,000 – 350,000 | 1 byte | `ESP.getFreeHeap()` | Dynamic RAM availability (leak check) |
| `auto_mode` | boolean | — | `true` / `false` | — | Safety Control State | True = firmware handles actuators |
| `green_led` | boolean | — | `true` / `false` | — | `digitalRead(LED_GREEN)` | GPIO 14 physical output state |
| `yellow_led`| boolean | — | `true` / `false` | — | `digitalRead(LED_YELLOW)`| GPIO 26 physical output state |
| `red_led` | boolean | — | `true` / `false` | — | `digitalRead(LED_RED)` | GPIO 27 physical output state |
| `buzzer` | boolean | — | `true` / `false` | — | `digitalRead(BUZZER_PIN)`| GPIO 25 physical alarm state |
| `timestamp` | uint64 | ms | $\ge 0$ | 1 ms | `millis()` or Epoch ms | Packet generation time |

---

## 5. Deterministic Safety Engine & Trip Invariants

Firmware must implement the **exact deterministic threshold logic** defined in the web app's [`src/lib/batterySafety.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/batterySafety.js).

### 5.1 Trip Thresholds & Severity Hierarchy

The system follows a strict hierarchical safety order:
$$\text{SAFE}\ (0) < \text{CAUTION}\ (1) < \text{WARNING}\ (2) < \text{CRITICAL}\ (3) < \text{EMERGENCY}\ (4)$$

The overall state is always the **worst-case state** triggered by any metric:

```
                                 CRITICAL TRIP TABLE
┌─────────────────────────┬──────────────┬──────────────┬──────────────────────────────┐
│ Metric                  │ Warning      │ Critical     │ Emergency                    │
├─────────────────────────┼──────────────┼──────────────┼──────────────────────────────┤
│ Voltage (12V Nominal)   │ < 10.5V      │ < 10.0V      │ < 9.5V (Deep Discharge)      │
│                         │ > 14.2V      │ > 14.4V      │ > 14.8V (Over-voltage Trip)  │
│ Cell Temperature        │ > 40.0 °C    │ > 45.0 °C    │ > 55.0 °C (Thermal Runaway)  │
│ MQ-2 Combustible Gas    │ > 1,500 ADC  │ > 3,000 ADC  │ > 4,000 ADC (Gas Breach)     │
│ Battery Health Index    │ BHI ≥ 50     │ BHI ≥ 75     │ BHI ≥ 90 (Pack Failure)      │
│ State of Health (SOH)   │ < 80 %       │ < 60 %       │ —                            │
│ State of Charge (SOC)   │ < 20 %       │ < 10 %       │ —                            │
│ Internal Resistance ($R$)│ > 50 mΩ      │ > 100 mΩ     │ > 250 mΩ                     │
│ Hardware Probes         │ 1 offline    │ Both offline │ —                            │
└─────────────────────────┴──────────────┴──────────────┴──────────────────────────────┘
```

```cpp
// Mandatory Safety Evaluation C++ snippet:
inline const char* evaluateDeterministicSafety(float v, float t, int mq2, float bhi, bool inaOk, bool dhtOk) {
  if (!inaOk && !dhtOk) return "CRITICAL"; // Hardware probe fault
  if (v < 9.5f || t > 55.0f || bhi >= 90.0f) return "EMERGENCY";
  if (v < 10.0f || v > 14.4f || t > 45.0f || mq2 > 3000 || bhi >= 75.0f) return "CRITICAL";
  if (v < 10.5f || v > 14.2f || t > 40.0f || mq2 > 1500 || bhi >= 50.0f) return "WARNING";
  if (bhi >= 25.0f) return "CAUTION";
  return "SAFE";
}
```

---

### 5.2 Hardware Safety Lockout Rule

> [!CAUTION]
> **Supreme Hardware Authority Rule**:
> If physical sensors register a `CRITICAL` or `EMERGENCY` condition:
> 1. ESP32 firmware **MUST** force `Red LED = HIGH` and `Buzzer = CONTINUOUS`.
> 2. ESP32 firmware **MUST REJECT** any remote command from Firebase (`commands/{batteryId}`) that attempts to:
>    - Set `green_led = true`
>    - Set `buzzer = false` (or `buzzer_mode = "off"`)
>    - Force `auto_mode = false` without local physical reset
> 3. The web API returns HTTP `422 Unprocessable Entity` for unauthorized override attempts.

---

### 5.3 Edge Autonomy & Offline Fallback

- The sensor sampling, threshold evaluation, and actuator driving routines **MUST RUN LOCALLY** every 1.5 seconds regardless of Wi-Fi or Internet connectivity.
- If Wi-Fi disconnects:
  - Do **NOT** execute blocking `while (WiFi.status() != WL_CONNECTED)` loops.
  - Continue local loop execution.
  - Attempt non-blocking reconnection every 10 seconds.
  - Buffer the last 30 telemetry frames in an in-memory ring buffer to burst transmit when Wi-Fi recovers.

---

## 6. Bidirectional Actuator & Command Protocol

The web application dispatches actuator control commands through Firebase RTDB at `/commands/{batteryId}` and REST endpoints (`/api/commands`, `/api/control/led`, `/api/control/buzzer`).

### 6.1 Command Schema (`/commands/{batteryId}`)

```json
{
  "command": "RED_ON",
  "auto_mode": false,
  "green_led": false,
  "yellow_led": false,
  "red_led": true,
  "buzzer": true,
  "buzzer_mode": "continuous",
  "requestId": "req_a1b2c3d4",
  "updatedAt": 1725900000000
}
```

### 6.2 LED Actuator Behavior (GPIO 14, 26, 27)

| State | Green LED (GPIO 14) | Yellow LED (GPIO 26) | Red LED (GPIO 27) | Description |
|:---|:---:|:---:|:---:|:---|
| **Normal / SAFE** | **ON** | OFF | OFF | All electrical and atmospheric metrics nominal |
| **CAUTION / WARNING** | OFF | **ON** (Solid/Blink) | OFF | Voltage drift, elevated temp (>40°C), low SOC |
| **CRITICAL / EMERGENCY**| OFF | OFF | **ON** (Rapid Flash/Solid)| Safety trip active. Actuator lockout enforced |
| **Sensor Fault** | OFF | **ON** | **ON** | INA219 or DHT11 disconnected |

---

### 6.3 Buzzer Pattern Generator (GPIO 25)

The active buzzer is driven using non-blocking state cadence on `millis()`:

```cpp
enum BuzzerMode {
  BUZZER_OFF,          // Silent
  BUZZER_CONTINUOUS,   // Solid 2.4 kHz alarm (Emergency / Critical)
  BUZZER_FAST_BEEP,    // 500ms ON / 500ms OFF (Warning / Gas trip)
  BUZZER_SLOW_BEEP     // 2000ms ON / 2000ms OFF (Caution / Alert Acknowledged)
};
```

---

### 6.4 Auto Mode vs Manual Override

1. **Auto Mode (`auto_mode: true`)**:
   - Firmware automatically binds actuator pins to the deterministic safety state.
   - User commands in the dashboard to toggle individual LEDs are locked.
2. **Manual Override (`auto_mode: false`)**:
   - Operator has taken manual control of the actuators (e.g. for testing or routine maintenance).
   - **Safety Override Limit**: If a physical metric breaches a `CRITICAL` limit, firmware **immediately reverts to Auto Mode** and triggers the physical alarm.

---

## 7. Advanced Firmware Features & Coding Standards

### 7.1 Non-Blocking Scheduling & Watchdog (WDT)

The firmware main loop **MUST NEVER** call blocking `delay()` statements longer than 10 ms. All intervals must use `millis()` gating:

```cpp
#include <esp_task_wdt.h>
#define WDT_TIMEOUT_SEC 10

void setup() {
  // Initialize Hardware Watchdog
  esp_task_wdt_init(WDT_TIMEOUT_SEC, true);
  esp_task_wdt_add(NULL); // Add current thread to WDT watch
}

void loop() {
  esp_task_wdt_reset(); // Feed Watchdog every iteration
  unsigned long now = millis();

  if (now - lastSensorRead >= 1500) {
    lastSensorRead = now;
    readSensors();
  }
  if (now - lastTelemetrySend >= 2000) {
    lastTelemetrySend = now;
    sendTelemetry();
  }
  if (now - lastCommandPoll >= 1000) {
    lastCommandPoll = now;
    pollCommands();
  }
  delay(5);
}
```

---

### 7.2 Coulomb Counting & Non-Volatile Memory (NVS)

To survive power cuts and reboots without losing state-of-charge (SOC), cycle counts, and lifetime energy, firmware must utilize `Preferences.h`:

```cpp
#include <Preferences.h>
Preferences prefs;

void persistAnalytics(float coulombAh, float throughputAh, float energyWh, float soh) {
  prefs.begin("bvitals", false);
  prefs.putFloat("coulombAh", coulombAh);
  prefs.putFloat("throughAh", throughputAh);
  prefs.putFloat("energyWh", energyWh);
  prefs.putFloat("soh", soh);
  prefs.end();
}

void restoreAnalytics(float &coulombAh, float &throughputAh, float &energyWh, float &soh) {
  prefs.begin("bvitals", true);
  coulombAh   = prefs.getFloat("coulombAh", 7.0f);  // Default nominal 7Ah
  throughputAh = prefs.getFloat("throughAh", 0.0f);
  energyWh    = prefs.getFloat("energyWh", 0.0f);
  soh         = prefs.getFloat("soh", 100.0f);
  prefs.end();
}
```

---

### 7.3 Internal Resistance ($R_{int}$) & SOH Estimation

Real-time State of Health cannot be faked or hardcoded to 100%. Firmware must estimate dynamic internal resistance during load current steps:

$$R_{int} = \frac{|V_{open} - V_{load}|}{|I_{load}|}$$

$$\text{SOH}\% = 100 - \left(\frac{R_{measured} - R_{nominal}}{R_{end\_of\_life} - R_{nominal}}\right) \times 60$$

- Once a genuine load step is recorded ($I > 200\text{ mA}$), set `soh_valid = true`.
- Before a genuine step occurs, set `soh_valid = false` so the web dashboard displays `"Calibrating SOH"`.

---

### 7.4 ADC Calibration & Gas Sensor Warming

1. **ADC Configuration**:
   ```cpp
   analogReadResolution(12);       // 0 to 4095
   analogSetAttenuation(ADC_11db); // Full-scale 0 to 3.3V
   ```
2. **Moving Average Filter**: Gas sensor analog pins (MQ-2, MQ-135) must be sampled with a 10-sample rolling average to filter high-frequency switching noise.
3. **Warm-up Grace Period**: For the first 120 seconds after boot (`GAS_WARMUP_MS`), MQ heaters are stabilizing. Firmware must report `gas_warm: false` so the web platform does not fire false alarms.

---

### 7.5 Robust WiFi & Dual-Sink Failover

```cpp
void sendTelemetryDualSink(const String& flatJson) {
  if (WiFi.status() != WL_CONNECTED) return;

  // Primary: Firebase Realtime Database
  HTTPClient http;
  http.begin(FIREBASE_URL_DATA);
  http.addHeader("Content-Type", "application/json");
  int code = http.PUT(flatJson);
  http.end();

  // If Firebase fails (e.g. HTTP != 200), fall back to REST API
  if (code != 200 && code != 204) {
    http.begin(RENDER_URL_TELEMETRY);
    http.addHeader("Content-Type", "application/json");
    http.POST(flatJson);
    http.end();
  }
}
```

---

### 7.6 Hardware Boot Self-Test (`selftest.h`)

At system power-on, the ESP32 must execute an automated 8-point hardware verification sweep before entering the primary loop:

```cpp
struct BootSelfTestResult {
  bool ina_ack;     // I2C ping acknowledgment to INA219 at 0x40
  bool dht_ok;      // Initial temperature & humidity read verification
  bool mq2_ok;      // ADC raw count > 50 (validates sensor presence & circuit continuity)
  bool mq135_ok;    // ADC raw count > 50
  bool gpio_ok;     // Output latch test on status GPIO registers
  bool buzzer_ok;   // Audible confirmation chirp (50ms) on GPIO 25
  bool wifi_ok;     // Successful Wi-Fi association & DHCP assignment
  bool config_ok;   // Valid NVS configuration parameters
  bool passed;      // True if all 8 checks succeed
};
```
- Results are published immediately to Firebase RTDB at `live_data/{batteryId}/self_test`.
- If critical sensors fail (`!ina_ack`), the firmware latches an amber caution blink to warn on-site technicians before telemetry transmission starts.

---

### 7.7 Shunt Zero-Current Offset Calibration & Clean-Air Baselines

1. **Zero-Current Calibration (`calibrateZeroCurrent()`)**:
   - Small analog offsets in the INA219 internal PGA or PCB traces can register phantom currents ($5–25\text{ mA}$) when no load is attached.
   - Upon receiving the `CALIBRATE_ZERO` command from `/commands/{batteryId}` (dispatched via `/api/battery/calibrate`), the firmware:
     1. Disables momentary load current processing.
     2. Samples 50 consecutive shunt voltage measurements over 500 ms.
     3. Computes the mean offset $\Delta V_{\text{shunt\_zero}}$.
     4. Saves the offset to non-volatile flash memory (`Preferences.h`).
     5. Subtracts this offset from all future current and power calculations.
     6. Publishes the calibrated offset to `live_data/{batteryId}/calibration/zero_current_offset`.

2. **Clean-Air Baseline Drift Compensation**:
   - Following the 180-second heater warmup cycle, the firmware records clean-air analog baseline readings: `mq2Baseline` and `mq135Baseline`.
   - Subsequent gas concentrations are calculated relative to this stabilized clean-air resistance ratio ($R_s / R_0$).

---

### 7.8 Dynamic Sensor Confidence Gating

To prevent premature safety trips and false alarms during startup or intermittent wiring disconnects:
- **`inaConfidence`**: Initialized to `1.0`. Set to `0.0` if I2C bus transactions fail or if bus voltage reads $>26.0\text{ V}$.
- **`dhtConfidence`**: Initialized to `1.0`. Degrades if checksum verification fails.
- **`mqConfidence`**: Computed dynamically during the first 180 seconds of heater operation:
  $$\text{mqConfidence} = \min\left(1.0, 0.2 + 0.8 \times \frac{\text{uptimeMs}}{180000}\right)$$
- The Next.js safety engine weights gas thresholds by `mqConfidence`. If `mqConfidence < 0.5`, gas readings are logged as diagnostic info but do not trigger full emergency contactor trips.

---

## 8. CI/CD Pipeline & Automated Firmware Verification

Firmware engineering in Battery Vital is governed by automated CI/CD to prevent breaking changes from reaching production hardware.

### 8.1 GitHub Actions CI Workflow Architecture

All commits and pull requests touching `esp32/**` trigger the GitHub Actions workflow located at [`.github/workflows/esp32-ci.yml`](file:///d:/Webapp/Working_webapps/Battery_vitals/.github/workflows/esp32-ci.yml):

```
                       GitHub Push / PR (`esp32/**`)
                                    │
            ┌───────────────────────┴───────────────────────┐
            ▼                                               ▼
   [Job 1: Schema & Unit Tests]               [Job 2: Firmware Build Matrix]
   - Node 20 / Vitest                         - Setup Arduino CLI
   - Validate JSON payloads vs Zod            - Install ESP32 Core (v2.0.14)
   - Verify normalizeEsp32Packet()            - Install INA219, DHT, ArduinoJson
   - Test Safety State Derivation             - Compile BatteryVital_v13.0.ino
            │                                               │
            └───────────────────────┬───────────────────────┘
                                    │
                                    ▼
                         [Job 3: Static Analysis]
                         - cppcheck syntax check
                         - clang-format style check
                                    │
                                    ▼
                          Build Green & Deploy
```

---

### 8.2 Automated Schema Validation Tests

Vitest runs automated compatibility tests in [`src/lib/esp32Payload.test.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/esp32Payload.test.js):
- **Test 1**: Verify raw ESP32 packet correctly maps `current_mA` $\to$ `current` (A) and `power_mW` $\to$ `power` (W).
- **Test 2**: Verify numeric clamping against Zod `TelemetryPayloadSchema`.
- **Test 3**: Verify that `soh_valid = false` prevents artificial 100% SOH presentation.
- **Test 4**: Verify that deterministic trip thresholds trip `CRITICAL` on voltage < 10.0V and `EMERGENCY` on temp > 55°C.

---

### 8.3 Static Analysis (`cppcheck` / `clang-format`)

- No memory allocations (`malloc` / `new`) in high-frequency loops.
- `StaticJsonDocument` used over `DynamicJsonDocument` to prevent heap fragmentation.
- Strings used with `.reserve()` or fixed char arrays.

---

### 8.4 Semantic Versioning & OTA Strategy

1. **Version Format**: `MAJOR.MINOR.PATCH` (e.g. `13.1.0`).
   - `MAJOR`: Breaking changes to JSON telemetry schema or pinouts.
   - `MINOR`: New sensor features, analytics derivations, or control commands.
   - `PATCH`: Bug fixes, filter tuning, or timing optimizations.
2. **OTA Updates**: Future firmware releases will query `/firmware/latest` and download signed binaries via `Update.h` over HTTPS.

---

## 9. Troubleshooting & Diagnostics Matrix

| Symptom | Probable Cause | Diagnostic Command / Check | Resolution |
|:---|:---|:---|:---|
| **Website shows "No Data Yet"** | WiFi offline or wrong Firebase URL | Check Serial output at 115200 baud | Verify `WIFI_SSID` and `FIREBASE_HOST` in `config.h` |
| **Voltage reads 0.0V or constant** | INA219 disconnected or wrong I2C address | I2C Scanner sketch; check SDA 21, SCL 22 | Verify 4.7kΩ pull-up resistors and 0x40 address |
| **Temperature reads NaN or 25°C fixed**| DHT11 timing timeout or missing pull-up | Check `dht_ok` in telemetry payload | Verify 10kΩ pull-up on GPIO 4; check non-blocking timing |
| **MQ-2 reads 0 ADC or 4095 saturated** | Connected to ADC2 or heater unpowered | Verify MQ-2 VCC is 5V, output on GPIO 34 | Never use ADC2 with Wi-Fi; check voltage divider |
| **Current / Power shows inverted signs**| INA219 Vin+ and Vin- wired backwards | Check `current_mA` sign when charging | Swap Vin+ and Vin- terminal leads |
| **ESP32 reboots continuously** | Watchdog timeout or power brownout | Check boot message `rst:0x10 (RTCWDT)` | Add 470µF bulk capacitor across 5V/GND; feed WDT in loop |
| **Commands from UI not acting on LEDs**| ESP32 in Auto Mode or polling stopped | Check `auto_mode` in `/commands/BAT001` | Set `auto_mode: false` in controls or check `pollCommands()` |

---

## 10. Future Upgrades & Revision Log

| Version | Date | Changes & Upgrades |
|:---|:---:|:---|
| **v12.0** | May 2026 | Legacy monolithic firmware with dual-sink HTTP POST, native DHT11, and Coulomb counting. |
| **v13.0** | Sep 2026 | Modular firmware architecture (`config.h`, `sensors.h`, `led_control.h`, `firebase_ops.h`). INA219 + MQ-2 + MQ-135 + DHT11 integration. |
| **v13.1** | Sep 2026 | Synchronized with `ESP32_RULES.md`. Strict Zod gateway compatibility, SOH validity verification, and automated GitHub Actions CI. |
| **v14.0** *(Planned)* | Q1 2027 | BLE local commissioning, HTTPS OTA binary updates, and MQTT 5.0 broker dual-homing. |

---

> [!NOTE]
> **Document Maintenance**: When updating the ESP32 firmware or the web application's ingestion endpoints, this document (`ESP32_RULES.md`) must be reviewed and updated to preserve full-stack compatibility.
