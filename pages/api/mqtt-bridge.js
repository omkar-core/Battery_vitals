import { initMQTTBridge, getMQTTClient } from '../../src/lib/mqtt'

let initialized = false

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    if (!initialized) {
      await initMQTTBridge()
      initialized = true
    }

    const client = getMQTTClient()
    return res.status(200).json({
      status: client ? 'connected' : 'connecting',
      mqtt: true,
      broker: process.env.MQTT_BROKER || process.env.NEXT_PUBLIC_MQTT_BROKER || 'not-set',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('mqtt-bridge error:', error)
    return res.status(500).json({
      status: 'error',
      mqtt: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
  }
}
