import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { getLatestTelemetry } from '../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString, secureErrorResponse } from '../../../lib/security'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`latest_get_${ip}`, 120, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)

    // Try reading from Firebase Realtime Database first
    let data = await getLatestTelemetry(batteryId)

    // Fall back to MongoDB if Firebase is empty
    if (!data) {
      const db = await getDB()
      data = await db.collection('live_data').findOne({ batteryId })
    }

    if (!data) {
      return NextResponse.json(
        {
          error: 'No data available',
          message: 'ESP32 has not sent data to Firebase yet',
        },
        {
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: serialize(data),
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  } catch (error) {
    console.error('latest error:', error)
    return secureErrorResponse(error.message)
  }
}

function serialize(d) {
  return {
    ...d,
    _id: d._id ? String(d._id) : undefined,
    timestamp: d.timestamp ? new Date(d.timestamp).getTime() : Date.now(),
    receivedAt: d.receivedAt ? new Date(d.receivedAt).getTime() : null,
  }
}
