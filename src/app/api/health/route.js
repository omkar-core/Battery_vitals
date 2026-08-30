import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { adminDb } from '../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const ip = getClientIp(request)
  const rateCheck = checkRateLimit(`health_get_${ip}`, 60, 60000)
  if (!rateCheck.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  let mongoStatus = 'disconnected'
  let firebaseStatus = 'disconnected'

  try {
    const db = await getDB()
    await db.command({ ping: 1 })
    mongoStatus = 'connected'
  } catch (e) {
    mongoStatus = 'disconnected'
  }

  if (adminDb) {
    try {
      await adminDb.ref('.info/connected').once('value')
      firebaseStatus = 'connected'
    } catch (e) {
      firebaseStatus = 'error'
    }
  } else {
    firebaseStatus = 'unconfigured'
  }

  return NextResponse.json({
    status: mongoStatus === 'connected' ? 'healthy' : 'degraded',
    database: mongoStatus,
    firebase: firebaseStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    platform: 'vercel',
  })
}

export async function HEAD() {
  return new Response(null, { status: 200 })
}