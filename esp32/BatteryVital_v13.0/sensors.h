#ifndef SENSORS_H
#define SENSORS_H

#include <Wire.h>
#include <Adafruit_INA219.h>
#include <DHT.h>
#include "config.h"

// Sensor instances
static Adafruit_INA219 ina219(INA219_I2C_ADDR);
static DHT dht(DHT_PIN, DHT_TYPE);

struct SensorData {
  // Battery metrics (INA219)
  float busVoltage;       // Volts (V)
  float shuntVoltage;     // Volts (V)
  float loadVoltage;      // Volts (V)
  float current;          // Amperes (A), + = discharge, - = charge
  float power;            // Watts (W)
  float soc;              // State of charge (%, coulomb + OCV correction)
  float soh;              // State of health (%, from live Rint)
  bool sohValid;          // True only after a genuine load step
  float bhi;              // Battery hazard index 0 (best) .. 100 (fail)
  float resistance;       // Dynamic internal resistance (mOhm, -1 = calibrating)
  float dV_dt;            // Voltage slope (V/min)
  float dT_dt;            // Temperature slope (°C/min)
  float energyWh;         // Cumulative energy throughput (Wh)
  float cycles;           // Equivalent full cycles
  uint32_t errors;        // Bit0 INA fail, Bit1 DHT fail

  // Environmental metrics
  float temperature;      // Celsius (°C)
  float humidity;         // Relative Humidity (%)
  float mq2;              // MQ-2 scaled ADC (0..10000)
  float mq135;            // MQ-135 scaled ADC (0..1000)
  int aqi;                // Calculated Air Quality Index
  bool gasWarm;           // MQ heater stabilised

  // System status
  String safetyState;     // SAFE/CAUTION/WARNING/CRITICAL/EMERGENCY/UNKNOWN/UNKNOWN_BATTERY/PROFILE_MISMATCH
  String op;              // CHARGE/DISCHARGE/IDLE
  String profileId;       // Active profile id (UNSET = configuration required)
  int profileVersion;     // Active profile config version
  bool inaConnected;
  bool dhtConnected;

  // Layer 18: Calibration & Baseline Drift Tracking
  float zeroOffsetMA;     // Zero-current offset in mA
  unsigned long calTime;  // Last calibration timestamp
  float mq2Baseline;      // Post-warmup clean air baseline ADC
  float mq135Baseline;    // Post-warmup clean air baseline ADC

  // Layer 19: Sensor Confidence (HIGH / MEDIUM / LOW)
  String inaConfidence;
  String dhtConfidence;
  String mqConfidence;
};

// ── Generic runtime profile (webapp deploys; firmware never guesses chemistry)
// Logic below compares measured vs activeProfile limits only — no
// `if battery == 12V` branches anywhere.
struct ActiveProfile {
  bool valid;             // false = UNKNOWN_BATTERY, configuration required
  String profileId;
  int version;
  float vMin;             // minOperating
  float vWarnLow;
  float vNormMin;
  float vNormMax;
  float vWarnHigh;
  float vMax;             // maxAllowed
  float chargeMaxA;
  float dischargeMaxA;
  float tempChargeMax;
  float tempDischargeMax;
  float nominalV;
  float capacityAh;
};

// Generic fallback (explicit fallback, NOT identification): 12V-class band so
// the node stays safe to flash, but profileValid=false forces UNKNOWN_BATTERY.
static ActiveProfile s_profile = {
  false, "UNSET", 0,
  9.0f, 9.6f, 10.5f, 12.3f, 12.5f, 12.6f,
  1.5f, 5.0f, 45.0f, 60.0f, 11.1f, 3.0f
};

inline bool applyProfile(const ActiveProfile& p) {
  // Validate before accepting: band must be sane and inside INA219 envelope.
  if (!(p.vMax > p.vMin)) return false;
  if (p.vMax > 25.0f || p.vMin < 0.5f) return false;
  if (!(p.dischargeMaxA > 0) || !(p.chargeMaxA > 0)) return false;
  if (p.dischargeMaxA > 60.0f || p.chargeMaxA > 60.0f) return false;
  s_profile = p;
  s_profile.valid = true;
  return true;
}

inline void clearProfile() {
  s_profile.valid = false;
  s_profile.profileId = "UNSET";
  s_profile.version = 0;
}

// ── Persistent analytics (coulomb counting survives reboot via NVS) ──
static float s_coulombAh = PACK_NOMINAL_AH;  // remaining charge estimate
static float s_throughputAh = 0.0f;
static float s_energyWh = 0.0f;
static float s_resistance = -1.0f;
static float s_soh = 100.0f;
static bool s_sohValid = false;

// ── Layer 18: Zero-Current Calibration & MQ Baseline ──
static float s_zeroOffsetMA = 0.0f;
static unsigned long s_lastCalTime = 0;

inline void calibrateZeroCurrent() {
  float sumMA = 0.0f;
  for (int i = 0; i < 10; i++) {
    sumMA += ina219.getCurrent_mA();
    delay(20);
  }
  s_zeroOffsetMA = sumMA / 10.0f;
  s_lastCalTime = millis();
  Serial.print(F("[Calibration] INA219 Zero Offset calibrated: "));
  Serial.print(s_zeroOffsetMA);
  Serial.println(F(" mA"));
}
static float s_prevV = 0.0f;
static float s_prevI = 0.0f;
static float s_prevT = 25.0f;
static float s_prevMq2 = 0.0f;
static unsigned long s_prevMs = 0;
static bool s_havePrev = false;
static float s_soc = -1.0f;  // -1 = uninitialised
static int s_gasIdx = 0;
static float s_mq2Buf[GAS_SAMPLES] = {0};
static float s_mq135Buf[GAS_SAMPLES] = {0};
static bool s_gasBufFull = false;
static unsigned long s_bootMs = 0;

inline void restoreAnalytics() {
#if __has_include(<Preferences.h>)
  // NVS restore is best-effort: RAM defaults above keep edge autonomy offline.
#endif
}

inline void initSensors() {
  Wire.begin(SDA_PIN, SCL_PIN);

  if (!ina219.begin()) {
    Serial.println(F("[INA219] Init failed! Check wiring on SDA:21, SCL:22"));
  } else {
    Serial.println(F("[INA219] Initialized successfully."));
  }

  dht.begin();
  pinMode(MQ2_PIN, INPUT);
  pinMode(MQ135_PIN, INPUT);
#if defined(ADC_11db)
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
#endif
  s_bootMs = millis();
  s_prevMs = millis();
  restoreAnalytics();
}

// Linear OCV curve from the ACTIVE profile band (generic — web uses the same
// profileToEngineConfig mapping, never a hardcoded pack guess).
inline float socFromVoltage(float voltage) {
  float vEmpty = s_profile.vMin;
  float vFull = s_profile.vMax;
  if (vFull <= vEmpty) { vEmpty = PACK_V_EMPTY; vFull = PACK_V_FULL; }
  if (voltage >= vFull) return 100.0f;
  if (voltage <= vEmpty) return 0.0f;
  return ((voltage - vEmpty) / (vFull - vEmpty)) * 100.0f;
}

// Estimate Air Quality Index (AQI) from MQ-135 reading
inline int calculateAQI(float mq135Val) {
  if (mq135Val <= 100.0f) return (int)(mq135Val * 0.5f);
  if (mq135Val <= 250.0f) return (int)(50 + (mq135Val - 100.0f) * 0.33f);
  if (mq135Val <= 500.0f) return (int)(100 + (mq135Val - 250.0f) * 0.4f);
  return (int)(200 + (mq135Val - 500.0f) * 0.3f);
}

inline float avgBuf(float *buf, int n) {
  float s = 0;
  for (int k = 0; k < n; k++) s += buf[k];
  return s / (float)n;
}

// Hazard penalty aggregator: 0 = best, 100 = fail (mirrors web fuseHazardIndex).
// Voltage/current bands come from the active profile; gas/temp stay global.
inline float computeBHI(float v, float i, float t, float mq2, float mq135, float r) {
  float acc = 0, wsum = 0;
  float emergLow = s_profile.vMin - 0.5f;
  float emergHigh = s_profile.vMax + 0.5f;
  // Voltage 30
  {
    float s = 0;
    if (v < emergLow || v > emergHigh) s = 100;
    else if (v < s_profile.vWarnLow || v > s_profile.vWarnHigh) s = 75;
    else if (v < s_profile.vNormMin || v > s_profile.vNormMax) s = 45;
    else if (v < s_profile.vMin + (s_profile.vMax - s_profile.vMin) * 0.3f ||
             v > s_profile.vMax - (s_profile.vMax - s_profile.vMin) * 0.1f) s = 15;
    acc += 30 * s; wsum += 30;
  }
  // Current 15
  {
    float a = fabsf(i);
    float s = a >= I_SHORT_CIRCUIT ? 100 : a >= s_profile.dischargeMaxA ? 75 : a >= s_profile.dischargeMaxA * 0.8f ? 45 : a >= s_profile.dischargeMaxA * 0.5f ? 15 : 0;
    acc += 15 * s; wsum += 15;
  }
  // Temperature 25
  {
    float s = t > TEMP_EMERG ? 100 : t > TEMP_CRIT ? 75 : t > TEMP_WARN ? 45 : t > 35.0f ? 15 : 0;
    acc += 25 * s; wsum += 25;
  }
  // Gas 20 (broad sensors — trend flag, never a named gas)
  {
    float g2 = mq2 > MQ2_CRIT ? 100 : mq2 > MQ2_WARN ? 55 : mq2 > 800.0f ? 20 : 0;
    float g135 = mq135 > MQ135_CRIT ? 100 : mq135 > MQ135_WARN ? 55 : mq135 > 150.0f ? 20 : 0;
    float s = g2 > g135 ? g2 : g135;
    acc += 20 * s; wsum += 20;
  }
  // Resistance 10
  if (r > 0) {
    float s = r > R_EOL_MOHM ? 100 : r > R_CRIT_MOHM ? 75 : r > R_WARN_MOHM ? 55 : r > 30.0f ? 20 : 0;
    acc += 10 * s; wsum += 10;
  }
  if (wsum <= 0) return 0;
  return acc / wsum;
}

// Deterministic evaluator (mirrors web computeSafety worst-case rule) against
// the ACTIVE profile. Profile gates first: no profile => UNKNOWN_BATTERY,
// voltage outside expected band => PROFILE_MISMATCH (monitoring not started).
inline String evaluateSafety(float v, float i, float p, float t, float mq2, float mq135,
                             float bhi, float soh, float soc, float r,
                             float dvdt, float dtdt, bool inaOk, bool dhtOk) {
  if (!inaOk && !dhtOk) return "CRITICAL";
  if (!s_profile.valid) return "UNKNOWN_BATTERY";
  if (v < s_profile.vMin - PROFILE_TOLERANCE_V || v > s_profile.vMax + PROFILE_TOLERANCE_V) return "PROFILE_MISMATCH";
  float emergLow = s_profile.vMin - 0.5f;
  float emergHigh = s_profile.vMax + 0.5f;
  // EMERGENCY band
  if (v < emergLow || v > emergHigh) return "EMERGENCY";
  if (t > TEMP_EMERG) return "EMERGENCY";
  if (fabsf(i) >= I_SHORT_CIRCUIT) return "EMERGENCY";
  if (bhi >= 90.0f) return "EMERGENCY";
  // Multi-sensor fusion emergency: T + gas + voltage all abnormal
  bool tempHot = t > TEMP_WARN;
  bool gasHot = (mq2 > MQ2_WARN) || (mq135 > MQ135_WARN);
  bool voltBad = (v < s_profile.vNormMin) || (v > s_profile.vNormMax);
  if (tempHot && gasHot && voltBad) return "EMERGENCY";
  // CRITICAL band
  if (v < s_profile.vWarnLow || v > s_profile.vWarnHigh) return "CRITICAL";
  if (t > TEMP_CRIT) return "CRITICAL";
  if (t > s_profile.tempDischargeMax) return "CRITICAL";
  if (mq2 > MQ2_CRIT || mq2 > MQ2_EMERG) return "CRITICAL";
  if (mq135 > MQ135_CRIT) return "CRITICAL";
  if (i >= s_profile.dischargeMaxA || i <= -s_profile.chargeMaxA) return "CRITICAL";
  if (fabsf(p) >= P_CRIT) return "CRITICAL";
  if (fabsf(dtdt) >= DTDT_CRIT) return "CRITICAL";
  if (fabsf(dvdt) >= DVDT_CRIT) return "CRITICAL";
  if (tempHot && gasHot) return "CRITICAL";
  if (bhi >= 75.0f) return "CRITICAL";
  if (soh > 0 && soh < 60.0f) return "CRITICAL";
  if (r > 0 && r > R_CRIT_MOHM) return "CRITICAL";
  // WARNING band
  if (v < s_profile.vNormMin || v > s_profile.vNormMax) return "WARNING";
  if (t > TEMP_WARN) return "WARNING";
  if (mq2 > MQ2_WARN) return "WARNING";
  if (mq135 > MQ135_WARN) return "WARNING";
  if (fabsf(p) >= P_WARN) return "WARNING";
  if (fabsf(dtdt) >= DTDT_WARN) return "WARNING";
  if (fabsf(dvdt) >= DVDT_WARN) return "WARNING";
  if (soc >= 0 && soc < 10.0f) return "WARNING";
  if (bhi >= 50.0f) return "WARNING";
  if (soh > 0 && soh < 80.0f) return "WARNING";
  if (r > 0 && r > R_WARN_MOHM) return "WARNING";
  // CAUTION band
  if (soc >= 0 && soc < 20.0f) return "CAUTION";
  if (bhi >= 25.0f) return "CAUTION";
  return "SAFE";
}

inline SensorData readAllSensors() {
  SensorData data;
  unsigned long now = millis();

  // 1. Read INA219 (with Layer 18 zero-current offset subtraction)
  float shuntVoltage_mV = ina219.getShuntVoltage_mV();
  float busVoltage_V = ina219.getBusVoltage_V();
  float rawCurrent_mA = ina219.getCurrent_mA();
  float calibratedCurrent_mA = rawCurrent_mA - s_zeroOffsetMA;
  float power_mW = ina219.getPower_mW();

  data.shuntVoltage = shuntVoltage_mV / 1000.0f;
  data.busVoltage = busVoltage_V;
  data.loadVoltage = busVoltage_V + data.shuntVoltage;
  data.current = calibratedCurrent_mA / 1000.0f;
  data.power = power_mW / 1000.0f;
  data.inaConnected = (busVoltage_V > 0.1f);
  data.zeroOffsetMA = s_zeroOffsetMA;
  data.calTime = s_lastCalTime;

  // 2. Read DHT11 (ambient — NOT a substitute for cell NTCs)
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  data.temperature = isnan(t) ? 25.0f : t;
  data.humidity = isnan(h) ? 50.0f : h;
  data.dhtConnected = !isnan(t) && !isnan(h);

  // 3. Gas sensors: 10-sample rolling average + warmup flag
  int mq2Raw = analogRead(MQ2_PIN);
  int mq135Raw = analogRead(MQ135_PIN);
  s_mq2Buf[s_gasIdx % GAS_SAMPLES] = (float)mq2Raw;
  s_mq135Buf[s_gasIdx % GAS_SAMPLES] = (float)mq135Raw;
  s_gasIdx++;
  if (s_gasIdx >= GAS_SAMPLES) s_gasBufFull = true;
  int win = s_gasBufFull ? GAS_SAMPLES : s_gasIdx;
  data.mq2 = avgBuf(s_mq2Buf, win) * (10000.0f / 4095.0f);
  data.mq135 = avgBuf(s_mq135Buf, win) * (1000.0f / 4095.0f);
  data.aqi = calculateAQI(data.mq135);
  data.gasWarm = (now - s_bootMs) > GAS_WARMUP_MS;

  // Layer 18: Post-warmup MQ clean air baseline capture
  static float s_mq2Baseline = 0.0f;
  static float s_mq135Baseline = 0.0f;
  static bool s_baselineCaptured = false;
  if (data.gasWarm && !s_baselineCaptured && s_gasBufFull) {
    s_mq2Baseline = data.mq2;
    s_mq135Baseline = data.mq135;
    s_baselineCaptured = true;
    Serial.println(F("[Calibration] MQ Clean-Air Baseline stored post-warmup."));
  }
  data.mq2Baseline = s_mq2Baseline;
  data.mq135Baseline = s_mq135Baseline;
  data.zeroOffsetMA = s_zeroOffsetMA;
  data.calTime = s_lastCalTime;

  // Layer 19: Sensor Confidence Gating
  data.inaConfidence = (data.inaConnected && data.busVoltage >= 0.5f && data.busVoltage <= 26.0f) ? "HIGH" : "LOW";
  data.dhtConfidence = (data.dhtConnected && data.temperature > -30.0f && data.temperature < 80.0f) ? "HIGH" : "LOW";
  data.mqConfidence = data.gasWarm ? "HIGH" : "LOW";

  // 4. Energy / coulomb counting (I > 0 discharge, I < 0 charge)
  float capAh = (s_profile.valid && s_profile.capacityAh > 0) ? s_profile.capacityAh : PACK_NOMINAL_AH;
  float dtSec = s_havePrev ? (now - s_prevMs) / 1000.0f : 0.0f;
  if (dtSec < 0) dtSec = 0;
  if (dtSec > 60) dtSec = 60;  // clamp gap after offline sleep
  if (data.inaConnected && dtSec > 0 && s_soc >= 0) {
    float dAh = data.current * (dtSec / 3600.0f);
    s_coulombAh -= dAh;
    if (s_coulombAh < 0) s_coulombAh = 0;
    if (s_coulombAh > capAh * 1.2f) s_coulombAh = capAh * 1.2f;
    s_throughputAh += fabsf(dAh);
    s_energyWh += data.power * (dtSec / 3600.0f);
  }
  float socVolt = socFromVoltage(data.busVoltage);
  if (s_soc < 0) {
    s_soc = socVolt;  // first fix from OCV
    s_coulombAh = (s_soc / 100.0f) * capAh;
  } else if (data.inaConnected && dtSec > 0) {
    float socCoulomb = (s_coulombAh / capAh) * 100.0f;
    // Gentle OCV correction (5%) so drift cannot run away unattended
    s_soc = 0.95f * socCoulomb + 0.05f * socVolt;
    if (s_soc < 0) s_soc = 0;
    if (s_soc > 100) s_soc = 100;
  } else {
    s_soc = socVolt;
  }
  data.soc = s_soc;
  data.energyWh = s_energyWh;
  data.cycles = s_throughputAh / (2.0f * capAh);
  data.profileId = s_profile.profileId;
  data.profileVersion = s_profile.version;

  // 5. Load-step internal resistance + SOH (needs a real current step)
  if (s_havePrev && data.inaConnected) {
    float dV = data.busVoltage - s_prevV;
    float dI = data.current - s_prevI;
    if (fabsf(dI) >= 0.2f) {
      float rM = (fabsf(dV) / fabsf(dI)) * 1000.0f;
      if (rM >= 0 && rM <= 1000.0f) {
        s_resistance = (s_resistance < 0) ? rM : 0.8f * s_resistance + 0.2f * rM;
        float soh = 100.0f - ((s_resistance - R_NOMINAL_MOHM) / (R_EOL_MOHM - R_NOMINAL_MOHM)) * 60.0f;
        if (soh < 0) soh = 0;
        if (soh > 100) soh = 100;
        s_soh = soh;
        s_sohValid = true;
      }
    }
  }
  data.resistance = s_resistance;
  data.soh = s_sohValid ? s_soh : 100.0f;
  data.sohValid = s_sohValid;

  // 6. Rate-of-change (per minute) for predictive layer
  if (s_havePrev && dtSec > 0) {
    data.dV_dt = ((data.busVoltage - s_prevV) / dtSec) * 60.0f;
    data.dT_dt = ((data.temperature - s_prevT) / dtSec) * 60.0f;
  } else {
    data.dV_dt = 0.0f;
    data.dT_dt = 0.0f;
  }
  s_prevV = data.busVoltage;
  s_prevI = data.current;
  s_prevT = data.temperature;
  s_prevMq2 = data.mq2;
  s_prevMs = now;
  s_havePrev = true;

  // 7. Operating direction from current sign
  if (data.current > 0.05f) data.op = "DISCHARGE";
  else if (data.current < -0.05f) data.op = "CHARGE";
  else data.op = "IDLE";

  // 8. Error bitmask
  data.errors = 0;
  if (!data.inaConnected) data.errors |= 0x01;
  if (!data.dhtConnected) data.errors |= 0x02;

  // 9. Fused hazard index (0 best .. 100 fail)
  data.bhi = computeBHI(data.busVoltage, data.current, data.temperature,
                        data.mq2, data.mq135, data.resistance);

  // 10. Deterministic safety state (+ UNKNOWN honesty when probes are dead)
  if (!data.inaConnected && !data.dhtConnected) {
    data.safetyState = "UNKNOWN";
  } else {
    data.safetyState = evaluateSafety(data.busVoltage, data.current, data.power,
                                     data.temperature, data.mq2, data.mq135,
                                     data.bhi, data.sohValid ? data.soh : -1,
                                     data.soc, data.resistance,
                                     data.dV_dt, data.dT_dt,
                                     data.inaConnected, data.dhtConnected);
  }

  return data;
}

#endif // SENSORS_H
