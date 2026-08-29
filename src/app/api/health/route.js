import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Test MongoDB connection
    const db = await getDB()
    await db.command({ ping: 1 })

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: 'render',
    })
  } catch (error) {
    console.error('health error:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}

// Support HEAD requests for health checks
export async function HEAD() {
  return new Response(null, { status: 200 })
}