import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'

export const dynamic = 'force-dynamic'

async function generateExport({ batteryId = 'BAT001', format = 'csv', minutes = 1440 }) {
  const db = await getDB()
  const since = new Date(Date.now() - parseInt(minutes, 10) * 60 * 1000)
  const sinceMs = since.getTime()

  const cursor = await db
    .collection('readings')
    .find({
      batteryId,
      $or: [
        { timestamp: { $gte: since } },
        { timestamp: { $gte: sinceMs } },
        { receivedAt: { $gte: since.toISOString() } },
      ],
    })
    .sort({ timestamp: -1 })
    .limit(5000)
    .toArray()

  const formattedData = cursor.map((r) => ({
    timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : r.receivedAt || '',
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
    mq2: r.gasIndex?.mq2 ?? r.mq2 ?? '',
    mq135: r.gasIndex?.mq135 ?? r.mq135 ?? '',
  }))

  if (String(format).toLowerCase() === 'json') {
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
      headers
        .map((h) => (typeof row[h] === 'string' && row[h].includes(',') ? `"${row[h]}"` : row[h]))
        .join(',')
    ),
  ]

  return new NextResponse(csvRows.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="battery_${batteryId}_export.csv"`,
    },
  })
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId') || 'BAT001'
    const format = searchParams.get('format') || 'csv'
    const minutes = searchParams.get('minutes') || '1440'

    return await generateExport({ batteryId, format, minutes })
  } catch (error) {
    console.error('export GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { batteryId = 'BAT001', format = 'csv', minutes = 1440 } = body

    return await generateExport({ batteryId, format, minutes })
  } catch (error) {
    console.error('export POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
