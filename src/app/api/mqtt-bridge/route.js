import { NextResponse } from 'next/server'
import { initMQTTBridge, getMQTTClient } from '../../../lib/mqtt'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function GET() {
  try {
    await initMQTTBridge()

    const client = getMQTTClient()
    return NextResponse.json({
      status: client ? 'connected' : 'connecting',
      mqtt: true,
      broker: process.env.MQTT_BROKER || process.env.NEXT_PUBLIC_MQTT_BROKER || 'not-set',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('mqtt-bridge error:', error)
    return NextResponse.json({
      status: 'error',
      mqtt: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}

export { GET as POST }
