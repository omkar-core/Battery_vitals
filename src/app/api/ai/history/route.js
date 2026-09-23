import { NextResponse } from 'next/server'
import { guardAIRequest } from '../../../../lib/securityGuard'
import { getAIAuditLogs } from '../../../../lib/aiAudit'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId') || 'BAT001'

    const guard = await guardAIRequest(request, batteryId)
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const auditHistory = await getAIAuditLogs(guard.user.id, guard.batteryId, 25)

    return NextResponse.json({
      success: true,
      userId: guard.user.id,
      batteryId: guard.batteryId,
      historyCount: auditHistory.length,
      history: auditHistory,
    })
  } catch (error) {
    console.error('Error in GET /api/ai/history:', error)
    return NextResponse.json({ error: 'Failed to fetch AI history', details: error.message }, { status: 500 })
  }
}
