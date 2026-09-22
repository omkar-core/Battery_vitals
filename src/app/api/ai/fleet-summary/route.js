import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { getAIResponse } from '../../../../lib/aiProvider'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'
import { AIFleetSummarySchema } from '../../../../lib/schemas'
import { ValidationError } from '../../../../lib/errors'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`ai_fleet_${ip}`, 15, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    await requirePermission(request, PERMISSIONS.ACCESS_AI)

    const rawBody = await request.json().catch(() => ({}))
    const parsed = AIFleetSummarySchema.safeParse(rawBody)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new ValidationError(issue?.message || 'Invalid fleet summary payload', issue?.path?.join('.') || 'body')
    }

    const db = await getDB()
    let devices = []
    try {
      devices = await db.collection('devices').find({}).toArray()
    } catch (e) {
      console.warn('[AIFleetSummary] DB devices fetch failed:', e.message)
    }

    // Also check live data for each device
    const packSummaries = []
    let safeCount = 0
    let warningCount = 0
    let criticalCount = 0

    for (const dev of devices) {
      const id = dev.deviceId
      let live = null
      try {
        live = await db.collection('live_data').findOne({ batteryId: id })
      } catch (e) {}

      const b = live?.battery || live || {}
      const state = String(live?.safety?.state || b.safety || 'SAFE').toUpperCase()
      const soh = b.soh != null ? Number(b.soh) : 100
      const voltage = b.voltage != null ? Number(b.voltage) : null
      const temp = live?.environment?.temperature ?? live?.temperature ?? null

      if (state === 'CRITICAL' || state === 'EMERGENCY') criticalCount++
      else if (state === 'WARNING' || state === 'CAUTION') warningCount++
      else safeCount++

      packSummaries.push({
        deviceId: id,
        name: dev.name || id,
        state,
        soh,
        voltage,
        temperature: temp,
        activeProfileId: dev.activeProfileId || 'Default',
      })
    }

    const totalPacks = packSummaries.length

    const prompt = `Synthesize an executive fleet health summary for an EV / ESS Fleet Operator:
Total Connected Packs: ${totalPacks}
Status Breakdown:
- Optimal / Safe: ${safeCount}
- Caution / Warning: ${warningCount}
- Critical / Hazard: ${criticalCount}

Fleet Pack Details:
${JSON.stringify(packSummaries.slice(0, 15), null, 2)}

Provide a concise fleet-wide operational narrative highlighting which packs need priority inspection and fleet trends.
Respond with JSON only:
{
  "fleetHeadline": "Short summary title like '3 of 12 packs show elevated thermal load'",
  "fleetNarrative": "1-2 paragraphs summarizing cross-fleet trends and operational posture.",
  "topPriorityActions": ["Action 1", "Action 2"]
}`

    const aiRes = await getAIResponse(prompt, {
      json: true,
      cacheKey: `fleet_summary_${totalPacks}_${criticalCount}`,
      fallbackFn: () => ({
        fleetHeadline: `${safeCount} of ${totalPacks} battery packs operating optimally`,
        fleetNarrative: `The fleet currently comprises ${totalPacks} monitored battery units. ${safeCount} packs are operating within standard safety limits, ${warningCount} are in caution status, and ${criticalCount} require immediate engineering review.`,
        topPriorityActions: [
          criticalCount > 0 ? 'Prioritize inspection of packs reporting critical trip status.' : 'Continue routine daily fleet telemetry checks.',
          'Verify temperature balance across parallel charge stations.',
        ],
      }),
    })

    const parsedData = aiRes.parsed || {}

    return NextResponse.json({
      success: true,
      totalPacks,
      safeCount,
      warningCount,
      criticalCount,
      fleetHeadline: parsedData.fleetHeadline || 'Fleet Telemetry Overview',
      fleetNarrative: parsedData.fleetNarrative || 'Fleet status compiled.',
      topPriorityActions: parsedData.topPriorityActions || [],
      packs: packSummaries,
      provider: aiRes.provider,
      model: aiRes.model,
      timestamp: Date.now(),
    })
  } catch (error) {
    return handleError(error, request)
  }
}
