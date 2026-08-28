import mqtt from 'mqtt'
import { getDB } from './mongodb'

let mqttClient = null

function buildBrokerUrl() {
  const broker = process.env.MQTT_BROKER || process.env.NEXT_PUBLIC_MQTT_BROKER || 'localhost'
  if (broker.startsWith('mqtt://') || broker.startsWith('mqtts://') || broker.startsWith('ws://') || broker.startsWith('wss://')) {
    return broker
  }
  // Default to MQTT over TLS (8883) for HiveMQ Cloud
  return `mqtts://${broker}:8883`
}

export async function initMQTTBridge() {
  if (mqttClient) return mqttClient

  const url = buildBrokerUrl()
  const client = mqtt.connect(url, {
    username: process.env.MQTT_USERNAME || process.env.NEXT_PUBLIC_MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD || process.env.NEXT_PUBLIC_MQTT_PASSWORD,
    clientId: 'vercel_bridge_' + Math.random().toString(16).substr(2, 8),
    reconnectPeriod: 3000,
    connectTimeout: 10000,
  })

  client.on('connect', () => {
    console.log('MQTT Bridge connected:', url)
    client.subscribe('batteryvitals/+/data', (err) => {
      if (err) console.error('MQTT subscribe error (data):', err)
    })
    client.subscribe('batteryvitals/+/alerts', (err) => {
      if (err) console.error('MQTT subscribe error (alerts):', err)
    })
  })

  client.on('message', async (topic, message) => {
    try {
      const data = JSON.parse(message.toString())
      const db = await getDB()

      // Alerts topic: persist a safety alert
      if (topic.includes('/alerts')) {
        const now = new Date()
        await db.collection('alerts').insertOne({
          batteryId: data.batteryId || 'BAT001',
          severity: (data.severity || data.state || 'INFO').toUpperCase(),
          type: data.type || data.state || 'MQTT_ALERT',
          message: data.message || 'Alert received over MQTT',
          bhi: data.bhi ?? data.risk?.bhi,
          sensorData: data,
          acknowledged: false,
          timestamp: now,
        })
        console.log('MQTT alert saved:', data.batteryId, data.state || data.severity)
        return
      }

      // Data topic: persist reading + update live data
      const document = {
        ...normalizeReading(data),
        receivedAt: new Date(),
        timestamp: Date.now(),
      }

      await db.collection('readings').insertOne(document)

      await db.collection('live_data').updateOne(
        { batteryId: document.batteryId },
        { $set: document },
        { upsert: true }
      )

      console.log('MQTT saved:', document.batteryId, 'V=' + document.voltage + 'V')
    } catch (error) {
      console.error('MQTT message error:', error)
    }
  })

  client.on('error', (err) => {
    console.error('MQTT bridge error:', err.message)
  })

  client.on('close', () => {
    console.log('MQTT bridge disconnected')
  })

  mqttClient = client
  return client
}

export function getMQTTClient() {
  return mqttClient
}

// Publish a control command back to the device over MQTT.
// The device subscribes to batteryvitals/<id>/control.
export function publishControl(batteryId, command) {
  if (!mqttClient || !mqttClient.connected) {
    console.log('MQTT not connected - control not published:', command)
    return false
  }
  const id = batteryId || 'BAT001'
  const payload =
    typeof command === 'string'
      ? command
      : JSON.stringify({ command, ts: Date.now() })
  mqttClient.publish(`batteryvitals/${id}/control`, payload, { qos: 1 })
  console.log('MQTT control published to', id, ':', payload)
  return true
}

// Publish the full control state (auto_mode, LEDs, buzzer) to the device.
export function publishControlState(state, batteryId) {
  const id = batteryId || 'BAT001'
  return publishControl(id, state)
}

function normalizeReading(d) {
  const b = d.battery || d
  const g = d.gas || {}
  const e = d.environment || {}
  const n = d.network || {}
  const safetyMap = { SAFE: 'SAFE', CAUTION: 'CAUTION', WARNING: 'WARNING', CRITICAL: 'CRITICAL', SENSOR_FAULT: 'SAFE', EMERGENCY: 'EMERGENCY' }
  const safety = safetyMap[(b.safety ? String(b.safety).toUpperCase() : (d.state || 'SAFE'))] || 'SAFE'
  return {
    batteryId: d.batteryId || 'BAT001',
    voltage: b.voltage != null ? Number(b.voltage) : null,
    current: b.current != null ? Number(b.current) : null,
    power: b.power != null ? Number(b.power) : null,
    soc: b.soc != null ? Number(b.soc) : null,
    soh: b.soh != null ? Number(b.soh) : null,
    temperature: e.temperature != null ? Number(e.temperature) : Number(d.temperature) || null,
    humidity: e.humidity != null ? Number(e.humidity) : Number(d.humidity) || null,
    gasIndex: {
      mq2: g.index_mq2 != null ? Number(g.index_mq2) : Number(d.mq2) || null,
      mq135: g.index_mq135 != null ? Number(g.index_mq135) : Number(d.mq135) || null,
    },
    safety,
    bhi: d.risk?.bhi != null ? Number(d.risk.bhi) : Number(d.bhi) || null,
    opDirection: (b.op || d.opDirection || 'IDLE').toUpperCase(),
    resistance: b.resistance != null ? Number(b.resistance) : null,
    outputs: d.outputs || {
      auto: d.auto_mode,
      red: d.red_led,
      yellow: d.yellow_led,
      green: d.green_led,
      buzzer: d.buzzer,
    },
    network: {
      rssi: n.rssi != null ? Number(n.rssi) : Number(d.wifi_rssi) || null,
      ip: n.ip || d.ip || null,
      heap: n.heap != null ? Number(n.heap) : Number(d.free_heap) || null,
    },
  }
}
