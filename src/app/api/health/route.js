import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = await getDB()
    await db.command({ ping: 1 })

    const readingsCount = await db.collection('readings').countDocuments()
    const liveDataCount = await db.collection('live_data').countDocuments()

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      collections: {
        readings: readingsCount,
        live_data: liveDataCount,
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('health error:', error)
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
