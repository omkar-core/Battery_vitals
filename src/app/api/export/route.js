import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { batteryId = 'BAT001', format = 'csv', minutes = 1440, metrics = [] } = body

    const db = await getDB()
    const since = new Date(Date.now() - parseInt(minutes, 10) * 60 * 1000)

    const cursor = await db
      .collection('readings')
      .find({ batteryId, timestamp: { $gte: since } })
      .sort({ timestamp: -1 })
      .limit(5000)
      .toArray()

    const formattedData = cursor.map((r) => ({
      timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : '',
      voltage: r.voltage ?? '',
      current: r.current ?? '',
      power: r.power ?? '',
      soc: r.soc ?? '',
      soh: r.soh ?? '',
      temperature: r.temperature ?? '',
      humidity: r.humidity ?? '',
      bhi: r.bhi ?? '',
      safety: r.safety ?? '',
      resistance: r.resistance ?? '',
      mq2: r.gasIndex?.mq2 ?? '',
      mq135: r.gasIndex?.mq135 ?? '',
    }))

    if (format === 'json') {
      return new NextResponse(JSON.stringify(formattedData, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="battery_${batteryId}_export.json"`,
        },
      })
    }

    // CSV format
    const headers = [
      'timestamp',
      'voltage',
      'current',
      'power',
      'soc',
      'soh',
      'temperature',
      'humidity',
      'bhi',
      'safety',
      'resistance',
      'mq2',
      'mq135',
    ]

    const csvRows = [
      headers.join(','),
      ...formattedData.map((row) =>
        headers.map((h) => (typeof row[h] === 'string' && row[h].includes(',') ? `"${row[h]}"` : row[h])).join(',')
      ),
    ]

    return new NextResponse(csvRows.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="battery_${batteryId}_export.csv"`,
      },
    })
  } catch (error) {
    console.error('export error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
