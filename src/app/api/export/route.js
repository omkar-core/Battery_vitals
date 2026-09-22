import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString } from '../../../lib/security'
import { handleError } from '../../../lib/errorHandler'
import { ExportRateLimitError } from '../../../lib/errors'
import { requirePermission } from '../../../lib/auth'
import { PERMISSIONS } from '../../../lib/permissions'
import { buildTelemetryPdf } from '../../../lib/pdf'

export const dynamic = 'force-dynamic'

// Cap export spans so an attacker cannot request an unscalable time window.
const MAX_MINUTES = 525600 // 365 days

function clampMinutes(raw) {
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 1440
  return Math.min(parsed, MAX_MINUTES)
}

// Reject CSV cells that start with a spreadsheet formula prefix (CSV injection,
// OWASP). Single quotes neutralize =, +, -, @, tab and CR.
function csvSafe(value) {
  if (typeof value !== 'string') return value
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`
  return value
}

async function generateExport({ batteryId = 'BAT001', format = 'csv', minutes = 1440 }) {
  const db = await getDB()
  const spanMs = clampMinutes(minutes) * 60 * 1000
  const sinceTs = Date.now() - spanMs

  const cursor = await db
    .collection('readings')
    .find({
      batteryId,
      $or: [
        { timestamp: { $gte: sinceTs } },
        { receivedAt: { $gte: new Date(sinceTs).toISOString() } },
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

  const filename = `battery_${batteryId}_export.${String(format).toLowerCase() === 'json' ? 'json' : String(format).toLowerCase() === 'pdf' ? 'pdf' : 'csv'}`

  if (String(format).toLowerCase() === 'json') {
    return new NextResponse(JSON.stringify(formattedData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  if (String(format).toLowerCase() === 'pdf') {
    const pdfDoc = buildTelemetryPdf(formattedData, batteryId)
    return new NextResponse(pdfDoc, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
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
        .map((h) => {
          const v = csvSafe(row[h])
          return typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))
            ? `"${v.replace(/"/g, '""')}"`
            : v
        })
        .join(',')
    ),
  ]

  return new NextResponse(csvRows.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`export_get_${ip}`, 10, 3600000)
    if (!rateCheck.success) {
      throw new ExportRateLimitError(rateCheck.resetTime)
    }

    await requirePermission(request, PERMISSIONS.EXPORT_DATA)

    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)
    const format = sanitizeString(searchParams.get('format') || 'csv', 10)
    const minutes = searchParams.get('minutes') || '1440'

    return await generateExport({ batteryId, format, minutes })
  } catch (error) {
    return handleError(error, request)
  }
}

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`export_post_${ip}`, 10, 3600000)
    if (!rateCheck.success) {
      throw new ExportRateLimitError(rateCheck.resetTime)
    }

    await requirePermission(request, PERMISSIONS.EXPORT_DATA)

    const body = await request.json().catch(() => ({}))
    const batteryId = sanitizeString(body.batteryId || 'BAT001', 30)
    const format = sanitizeString(body.format || 'csv', 10)
    const minutes = body.minutes != null ? String(body.minutes) : '1440'

    return await generateExport({ batteryId, format, minutes })
  } catch (error) {
    return handleError(error, request)
  }
}