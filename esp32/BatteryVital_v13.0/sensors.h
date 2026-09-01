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
  float current;          // Amperes (A)
  float power;            // Watts (W)
  float soc;              // State of charge (%)
  float soh;              // State of health (%)
  float bhi;              // Battery health index (0-100)

  // Environmental metrics
  float temperature;      // Celsius (°C)
  float humidity;         // Relative Humidity (%)
  float mq2;              // LPG/Smoke (PPM / raw)
  float mq135;            // Air quality / CO2 (PPM / raw)
  int aqi;                // Calculated Air Quality Index

  // System status
  String safetyState;     // "SAFE", "WARNING", "CRITICAL"
  bool inaConnected;
  bool dhtConnected;
};

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
}

// Estimate State of Charge (SOC) from open circuit / load voltage
inline float calculateSOC(float voltage) {
  // Linear-interpolation for 12V Lead-Acid / 3S Li-ion pack
  if (voltage >= 12.6f) return 100.0f;
  if (voltage <= 10.5f) return 0.0f;
  return ((voltage - 10.5f) / (12.6f - 10.5f)) * 100.0f;
}

// Estimate Air Quality Index (AQI) from MQ-135 reading
inline int calculateAQI(float mq135Val) {
  if (mq135Val <= 100.0f) return (int)(mq135Val * 0.5f);
  if (mq135Val <= 250.0f) return (int)(50 + (mq135Val - 100.0f) * 0.33f);
  if (mq135Val <= 500.0f) return (int)(100 + (mq135Val - 250.0f) * 0.4f);
  return (int)(200 + (mq135Val - 500.0f) * 0.3f);
}

inline SensorData readAllSensors() {
  SensorData data;

  // 1. Read INA219
  float shuntVoltage_mV = ina219.getShuntVoltage_mV();
  float busVoltage_V = ina219.getBusVoltage_V();
  float current_mA = ina219.getCurrent_mA();
  float power_mW = ina219.getPower_mW();

  data.shuntVoltage = shuntVoltage_mV / 1000.0f;
  data.busVoltage = busVoltage_V;
  data.loadVoltage = busVoltage_V + data.shuntVoltage;
  data.current = current_mA / 1000.0f;
  data.power = power_mW / 1000.0f;
  data.inaConnected = (busVoltage_V > 0.1f);

  data.soc = calculateSOC(data.busVoltage);
  data.soh = 98.0f; // Degradation baseline

  // 2. Read DHT11
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  data.temperature = isnan(t) ? 25.0f : t;
  data.humidity = isnan(h) ? 50.0f : h;
  data.dhtConnected = !isnan(t) && !isnan(h);

  // 3. Read Analog Gas Sensors
  int mq2Raw = analogRead(MQ2_PIN);
  int mq135Raw = analogRead(MQ135_PIN);
  data.mq2 = (float)mq2Raw * (10000.0f / 4095.0f);
  data.mq135 = (float)mq135Raw * (1000.0f / 4095.0f);
  data.aqi = calculateAQI(data.mq135);

  // 4. Compute Battery Health Index (BHI)
  float tempScore = (data.temperature > 40.0f) ? 50.0f : (100.0f - (data.temperature - 25.0f) * 2.0f);
  if (tempScore < 0.0f) tempScore = 0.0f;
  if (tempScore > 100.0f) tempScore = 100.0f;

  float vScore = (data.busVoltage < 11.0f || data.busVoltage > 14.0f) ? 60.0f : 100.0f;
  data.bhi = (tempScore * 0.4f) + (vScore * 0.6f);

  // 5. Determine Safety State
  if (data.busVoltage > V_MAX_CRITICAL || data.busVoltage < V_MIN_CRITICAL ||
      data.temperature > TEMP_MAX_CRITICAL || data.mq2 > MQ2_MAX_CRITICAL) {
    data.safetyState = "CRITICAL";
  } else if (data.temperature > 38.0f || data.mq2 > 500.0f || data.mq135 > 300.0f || data.soc < 15.0f) {
    data.safetyState = "WARNING";
  } else {
    data.safetyState = "SAFE";
  }

  return data;
}

#endif // SENSORS_H
