import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/auth'
import { getUserBatteries } from '../../../../lib/batteryRegistry'
import { callAIProvider } from '../../../../lib/aiProvider'
import { logAIAuditRecord } from '../../../../lib/aiAudit'
import { handleError } from '../../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const startTime = Date.now()
  try {
    const user = await getSessionUser(request)

    // User-specific fleet intelligence: load batteries ONLY belonging to this user
    const userBatteries = await getUserBatteries(user.id)

    let safeCount = 0
    let warningCount = 0
    let criticalCount = 0

    const fleetOverview = userBatteries.map((b) => {
      const state = b.state || 'SAFE'
      if (state === 'CRITICAL' || state === 'EMERGENCY') criticalCount++
      else if (state === 'WARNING' || state === 'CAUTION') warningCount++
      else safeCount++

      return {
        batteryId: b.batteryId,
        name: b.name,
        chemistry: b.chemistry,
        state,
        soh: b.soh != null ? b.soh : null,
      }
    })

    const totalPacks = userBatteries.length

    const prompt = `Synthesize an executive fleet health summary for User ${user.name} (${user.email}):
Total User Owned Packs: ${totalPacks}
Status Breakdown:
- Safe: ${safeCount}
- Warning: ${warningCount}
- Critical: ${criticalCount}

Packs Overview:
${JSON.stringify(fleetOverview, null, 2)}

Respond with structured JSON strictly matching:
{
  "fleetHeadline": "Short summary title",
  "fleetNarrative": "Clear explanation of user fleet posture.",
  "topPriorityActions": ["Action 1", "Action 2"]
}`

    const responseText = await callAIProvider({
      taskType: 'report',
      prompt,
      systemInstruction: 'Output valid JSON strictly adhering to requested schema.',
    })

    let result = null
    try {
      result = JSON.parse(responseText.replace(/```json|```/g, '').trim())
    } catch (e) {
      result = {
        fleetHeadline: `${safeCount} of ${totalPacks} battery packs operating normally`,
        fleetNarrative: `Your personal fleet comprises ${totalPacks} battery units. ${safeCount} packs are healthy, ${warningCount} require monitoring, and ${criticalCount} require immediate attention.`,
        topPriorityActions: [
          criticalCount > 0 ? 'Inspect critical packs immediately' : 'Perform routine charge balancing',
        ],
      }
    }

    await logAIAuditRecord({
      userId: user.id,
      batteryId: userBatteries[0]?.batteryId || 'BAT001',
      endpoint: '/api/ai/fleet-summary',
      responseTimeMs: Date.now() - startTime,
    })

    return NextResponse.json({
      success: true,
      userId: user.id,
      totalPacks,
      safeCount,
      warningCount,
      criticalCount,
      summary: result,
    })
  } catch (error) {
    return handleError(error, request)
  }
}
