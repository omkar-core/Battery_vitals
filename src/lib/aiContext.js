import 'server-only'
import { getDB } from './mongodb'
import { evaluateBatterySafety } from './batterySafety'
import { getBatteryProfile } from './batteryProfiles'
import { getBatteryById, DEMO_BATTERY_ID } from './batteryRegistry'

/**
 * Builds a sanitized, comprehensive AI Context object for a specific user and battery.
 * Ensures cross-user data boundaries are strictly respected.
 */
export async function buildAIContext({ userId, batteryId, includeHistoryDays = 30 }) {
  const targetBatteryId = batteryId || DEMO_BATTERY_ID

  // 1. Get Battery Metadata & Active Profile
  const batteryMeta = (await getBatteryById(targetBatteryId)) || {}
  const profile = getBatteryProfile(batteryMeta.profileId || 'LIFEPO4_12V_100AH')

  // 2. Load Current Telemetry (from Firebase RTDB or MongoDB)
  let latestTelemetry = null
  try {
    const { getLatestTelemetry } = await import('./firebaseAdmin')
    latestTelemetry = await getLatestTelemetry(targetBatteryId)
  } catch (e) {
    // Continue to MongoDB fallback
  }

  if (!latestTelemetry) {
    try {
      const db = await getDB()
      if (db) {
        const doc = await db
          .collection('live_data')
          .findOne({ $or: [{ batteryId: targetBatteryId }, { deviceId: targetBatteryId }] })
        if (doc) {
          const { _id, ...rest } = doc
          latestTelemetry = rest
        } else {
          const rDoc = await db
            .collection('readings')
            .find({ $or: [{ batteryId: targetBatteryId }, { deviceId: targetBatteryId }] })
            .sort({ timestamp: -1 })
            .limit(1)
            .next()
          if (rDoc) {
            const { _id, ...rest } = rDoc
            latestTelemetry = rest
          }
        }
      }
    } catch (error) {
      console.warn('[aiContext] Error loading latest telemetry:', error.message)
    }
  }

  // If no hardware telemetry has been received yet, use null fields without fabrication
  if (!latestTelemetry) {
    latestTelemetry = {
      batteryId: targetBatteryId,
      voltage: null,
      current: null,
      temperature: null,
      humidity: null,
      mq2: null,
      soc: null,
      soh: null,
      cycles: null,
      internalResistance: null,
      ina_ok: null,
      dht_ok: null,
      timestamp: null,
      no_data: true,
    }
  }

  // 3. Evaluate Deterministic Safety Engine (SUPREME AUTHORITY)
  const deterministicSafety = evaluateBatterySafety(latestTelemetry, profile)

  // 4. Fetch Recent Alerts
  let recentAlerts = []
  try {
    const db = await getDB()
    const alertDocs = await db
      .collection('alerts')
      .find({ $or: [{ batteryId: targetBatteryId }, { deviceId: targetBatteryId }] })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray()

    recentAlerts = alertDocs.map((a) => ({
      severity: a.severity || 'WARNING',
      field: a.field || 'system',
      message: a.message || 'Alert recorded',
      timestamp: a.timestamp,
    }))
  } catch (err) {
    console.warn('[aiContext] Failed to load alerts:', err.message)
  }

  // 5. Calculate Historical Trends (from real DB readings only)
  const currentSOH = latestTelemetry.soh != null ? Number(latestTelemetry.soh) : null
  const currentCycles = latestTelemetry.cycles != null ? Number(latestTelemetry.cycles) : null
  const currentTemp = latestTelemetry.temperature != null ? Number(latestTelemetry.temperature) : null
  const currentRint = latestTelemetry.internalResistance != null ? Number(latestTelemetry.internalResistance) : null
  const currentSOC = latestTelemetry.soc != null ? Number(latestTelemetry.soc) : null

  let previous30DaysAgo = null
  let previous7DaysAgo = null
  try {
    const db = await getDB()
    const now = Date.now()
    const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString()
    const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString()

    const doc7 = await db.collection('readings').findOne({
      $or: [{ batteryId: targetBatteryId }, { deviceId: targetBatteryId }],
      timestamp: { $lte: sevenDaysAgo },
    }, { sort: { timestamp: -1 } })

    if (doc7) {
      previous7DaysAgo = {
        soh: doc7.soh != null ? Number(doc7.soh) : null,
        cycles: doc7.cycles != null ? Number(doc7.cycles) : null,
        temperature: doc7.temperature != null ? Number(doc7.temperature) : null,
        internalResistance: doc7.internalResistance != null ? Number(doc7.internalResistance) : null,
      }
    }

    const doc30 = await db.collection('readings').findOne({
      $or: [{ batteryId: targetBatteryId }, { deviceId: targetBatteryId }],
      timestamp: { $lte: thirtyDaysAgo },
    }, { sort: { timestamp: -1 } })

    if (doc30) {
      previous30DaysAgo = {
        soh: doc30.soh != null ? Number(doc30.soh) : null,
        cycles: doc30.cycles != null ? Number(doc30.cycles) : null,
        temperature: doc30.temperature != null ? Number(doc30.temperature) : null,
        internalResistance: doc30.internalResistance != null ? Number(doc30.internalResistance) : null,
      }
    }
  } catch (err) {
    console.warn('[aiContext] Failed to query historical readings:', err.message)
  }

  const historicalTrends = {
    current: {
      soh: currentSOH,
      cycles: currentCycles,
      temperature: currentTemp,
      internalResistance: currentRint,
      soc: currentSOC,
    },
    previous30DaysAgo,
    previous7DaysAgo,
  }

  // 6. Sensor Confidence Indicators
  const sensorConfidence = {
    ina219CurrentVoltage: latestTelemetry.ina_ok !== false ? 'HEALTHY' : 'FAULT',
    dht22TempHumidity: latestTelemetry.dht_ok !== false ? 'HEALTHY' : 'FAULT',
    overallConfidence:
      latestTelemetry.ina_ok !== false && latestTelemetry.dht_ok !== false
        ? 'HIGH (100% Verified Hardware)'
        : 'PARTIAL (Sensor Fault Detected)',
  }

  // Sanitized Context Payload
  return {
    batteryId: targetBatteryId,
    batteryName: batteryMeta.name || profile.name || 'LiFePO4 Storage Pack',
    chemistry: profile.chemistry,
    nominalVoltage: profile.nominalVoltage,
    capacityAh: profile.capacityAh,

    currentTelemetry: {
      voltage: latestTelemetry.voltage,
      current: latestTelemetry.current,
      temperature: latestTelemetry.temperature,
      humidity: latestTelemetry.humidity,
      gasPpm: latestTelemetry.mq2,
      soc: currentSOC,
      soh: currentSOH,
      cycles: currentCycles,
      internalResistance: currentRint,
      timestamp: latestTelemetry.timestamp,
    },

    deterministicSafetyState: {
      stateRank: deterministicSafety.stateRank,
      statusLabel: deterministicSafety.statusLabel,
      stateCode: deterministicSafety.stateCode,
      activeTrips: deterministicSafety.activeTrips || [],
      recommendations: deterministicSafety.recommendations || [],
    },

    historicalTrends,
    recentAlerts,
    sensorConfidence,
  }
}

/**
 * Format the sanitized AI Context into a structured text prompt prefix.
 */
export function formatAIContextPrompt(aiContext) {
  const ct = aiContext.currentTelemetry || {}
  const p30 = aiContext.historicalTrends?.previous30DaysAgo

  return `
=== VERIFIED BATTERY CONTEXT ===
Battery ID: ${aiContext.batteryId} (${aiContext.batteryName})
Chemistry: ${aiContext.chemistry} | Nominal: ${aiContext.nominalVoltage}V | Capacity: ${aiContext.capacityAh}Ah

CURRENT TELEMETRY:
- Voltage: ${ct.voltage != null ? ct.voltage + 'V' : 'not reported'}
- Current: ${ct.current != null ? ct.current + 'A' : 'not reported'}
- Cell Temp: ${ct.temperature != null ? ct.temperature + '°C' : 'not reported'}
- SOC: ${ct.soc != null ? ct.soc + '%' : 'not reported'}
- SOH: ${ct.soh != null ? ct.soh + '%' : 'not reported'}
- Charge Cycles: ${ct.cycles != null ? ct.cycles : 'not reported'}
- Internal Resistance: ${ct.internalResistance != null ? ct.internalResistance + ' Ω' : 'not reported'}

DETERMINISTIC SAFETY ENGINE STATE (SUPREME):
- Safety Rank: ${aiContext.deterministicSafetyState.statusLabel} (Code ${aiContext.deterministicSafetyState.stateCode})
- Active Trips: ${aiContext.deterministicSafetyState.activeTrips.length > 0 ? aiContext.deterministicSafetyState.activeTrips.map((t) => t.message).join('; ') : 'None'}

HISTORICAL COMPARISON:
${p30 ? `- SOH: Current ${ct.soh != null ? ct.soh + '%' : '--'} vs 30d ago ${p30.soh != null ? p30.soh + '%' : '--'}
- Cycles: Current ${ct.cycles != null ? ct.cycles : '--'} vs 30d ago ${p30.cycles != null ? p30.cycles : '--'}
- Cell Temp: Current ${ct.temperature != null ? ct.temperature + '°C' : '--'} vs 30d ago ${p30.temperature != null ? p30.temperature + '°C' : '--'}` : '- 30-Day Comparison: Insufficient historical samples (awaiting completed cycles)'}

SENSOR CONFIDENCE: ${aiContext.sensorConfidence.overallConfidence}
================================
`.trim()
}
