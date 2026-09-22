import { NextResponse } from 'next/server'
import { getAIResponse } from '../../../../lib/aiProvider'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rate = checkRateLimit(`ai_prof_verify_${ip}`, 10, 3600000) // 10/hour
    if (!rate.success) {
      return NextResponse.json({ error: 'Vision verification quota exceeded. Please wait.' }, { status: 429 })
    }

    await requirePermission(request, PERMISSIONS.ACCESS_AI)

    const body = await request.json().catch(() => ({}))
    const { profile, imageBase64, mimeType = 'image/jpeg' } = body

    if (!imageBase64 || !profile) {
      return NextResponse.json({ error: 'Both imageBase64 and candidate profile are required' }, { status: 400 })
    }

    const prompt = `You are a battery specification verification inspector.
Compare the user's submitted battery profile against the printed specifications visible in the uploaded image.

SUBMITTED PROFILE:
- Chemistry: ${profile.chemistry || 'unknown'}
- Series cell count: ${profile.series || 'unknown'}
- Nominal Voltage: ${profile.nominalVoltage || profile.nominalV || 'unknown'} V
- Capacity: ${profile.capacityAh || 'unknown'} Ah

INSTRUCTIONS:
1. Extract the values directly visible on the printed battery label.
2. Cross-reference each field against the submitted profile.
3. If ANY value differs, is ambiguous, or is unreadable, set verdict to "REVIEW REQUIRED" and list the discrepancies.
4. If and only if all visible fields match exactly, set verdict to "MATCHES".
5. NEVER silently approve.

Return JSON in this exact structure:
{
  "verdict": "MATCHES" | "REVIEW REQUIRED",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "extracted": {
    "chemistry": string | null,
    "series": number | null,
    "nominalVoltage": number | null,
    "capacityAh": number | null
  },
  "discrepancies": [string],
  "reasoning": string
}`

    const aiRes = await getAIResponse(prompt, {
      task: 'profile-verify',
      json: true,
      vision: {
        base64: imageBase64,
        mimeType,
      },
      fallbackFn: () => ({
        verdict: 'REVIEW REQUIRED',
        confidence: 'LOW',
        discrepancies: ['AI vision verification unavailable; manual review required.'],
        reasoning: 'AI model offline. Offline safety rule mandates manual profile review.',
      }),
    })

    const parsed = aiRes.parsed || {
      verdict: 'REVIEW REQUIRED',
      confidence: 'LOW',
      discrepancies: ['Could not parse verification analysis.'],
      reasoning: 'Model output unparseable.',
    }

    // Hard invariant: never allow auto-approval if confidence is low or unverified
    if (parsed.verdict !== 'MATCHES' && parsed.verdict !== 'REVIEW REQUIRED') {
      parsed.verdict = 'REVIEW REQUIRED'
    }

    return NextResponse.json({
      success: true,
      provider: aiRes.provider,
      ...parsed,
    })
  } catch (error) {
    return handleError(error, request)
  }
}
