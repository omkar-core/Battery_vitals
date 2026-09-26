import 'server-only'
import { getDB } from './mongodb'
import { GUEST_USER_ID, DEMO_BATTERY_ID, getBatteryById } from './batteryRegistry'

/**
 * Fetch and build chronological timeline events for a given battery.
 */
export async function getBatteryTimeline(userId, batteryId) {
  const effectiveBattery = batteryId || DEMO_BATTERY_ID
  const battery = await getBatteryById(effectiveBattery)

  const events = []

  // 1. Battery Created event
  if (battery) {
    events.push({
      id: `evt_creation_${effectiveBattery}`,
      type: 'CREATION',
      title: 'Battery Profile Created',
      description: `Battery registered with profile ${battery.profileId || 'LiFePO4'}. Nominal voltage: ${battery.nominalVoltage || 12.8}V.`,
      severity: 'INFO',
      timestamp: battery.createdAt || new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
      icon: '🔋',
    })
  }

  try {
    const db = await getDB()

    // 2. Connection Events
    const connEvents = await db
      .collection('connection_events')
      .find({ batteryId: effectiveBattery })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray()

    connEvents.forEach((ce) => {
      events.push({
        id: ce._id.toString(),
        type: 'CONNECTION',
        title: ce.eventType === 'CONNECTED' ? 'BMS Connected' : 'BMS Disconnected',
        description: `ESP32 telemetry stream ${ce.eventType.toLowerCase()}. Session ID: ${ce.sessionId || 'N/A'}.`,
        severity: 'INFO',
        timestamp: ce.timestamp || ce.createdAt || new Date().toISOString(),
        icon: ce.eventType === 'CONNECTED' ? '🔌' : '⚡',
      })
    })

    // 3. Alerts & Protection Events
    const alerts = await db
      .collection('alerts')
      .find({ $or: [{ batteryId: effectiveBattery }, { deviceId: effectiveBattery }] })
      .sort({ timestamp: -1 })
      .limit(15)
      .toArray()

    alerts.forEach((alt) => {
      const isCritical = alt.severity === 'CRITICAL' || alt.severity === 'EMERGENCY'
      events.push({
        id: alt._id.toString(),
        type: isCritical ? 'PROTECTION' : 'WARNING',
        title: alt.title || `${alt.severity || 'WARNING'} Alert: ${alt.field || 'Battery'}`,
        description: alt.message || `Value ${alt.value} triggered threshold ${alt.threshold}.`,
        severity: alt.severity || 'WARNING',
        timestamp: alt.timestamp || new Date().toISOString(),
        icon: isCritical ? '🛑' : '⚠️',
      })
    })

    // Sort chronologically descending (newest first)
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    return events
  } catch (error) {
    console.warn('[batteryTimeline] Failed to load DB timeline events:', error.message)
    return events
  }
}
