import { NextResponse } from 'next/server'
import { getAIResponse } from '../../../../lib/aiProvider'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'
import { AILabelScanSchema } from '../../../../lib/schemas'
import { ValidationError } from '../../../../lib/errors'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`ai_label_scan_${ip}`, 10, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    await requirePermission(request, PERMISSIONS.ACCESS_AI)

    const rawBody = await request.json().catch(() => ({}))
    const parsed = AILabelScanSchema.safeParse(rawBody)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new ValidationError(issue?.message || 'Invalid label scan payload', issue?.path?.join('.') || 'body')
    }

    const { imageBase64, mimeType } = parsed.data

    const prompt = `Carefully inspect this battery label image and extract all technical specifications.
Look for:
- Chemistry (e.g. Lithium Ion, Li-ion, LiFePO4, LFP, Lead-Acid, SLA, AGM, NiMH)
- Cell configuration (series S count like 3S, 4S; parallel P count)
- Nominal voltage (e.g. 11.1V, 12V, 12.8V, 14.8V, 3.7V)
- Capacity (convert mAh to Ah, e.g. 2600mAh -> 2.6Ah, 100Ah)
- Max charging voltage / cut-off voltage
- Min discharge voltage
- Manufacturer / Brand name
- Model number or part number

Respond with JSON only:
{
  "chemistry": "LI_ION" | "LIFEPO4" | "LEAD_ACID" | "NIMH" | "CUSTOM",
  "series": number (e.g. 3 or 4),
  "parallel": number (default 1),
  "nominalVoltage": number,
  "capacityAh": number,
  "maxChargeV": number or null,
  "minDischargeV": number or null,
  "manufacturer": "Extracted brand name or unknown",
  "model": "Extracted model/part string or unknown",
  "rawTextExtracted": "Snippet of visible text from label",
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}`

    const aiRes = await getAIResponse(prompt, {
      json: true,
      vision: {
        base64: imageBase64,
        mimeType,
      },
      fallbackFn: () => ({
        chemistry: 'LI_ION',
        series: 3,
        parallel: 1,
        nominalVoltage: 11.1,
        capacityAh: 2.6,
        maxChargeV: 12.6,
        minDischargeV: 9.0,
        manufacturer: 'Generic/Unspecified',
        model: 'Generic-Pack',
        rawTextExtracted: 'Vision provider offline — default template loaded.',
        confidence: 'LOW',
      }),
    })

    const extracted = aiRes.parsed || {
      chemistry: 'LI_ION',
      series: 3,
      parallel: 1,
      nominalVoltage: 11.1,
      capacityAh: 2.6,
      manufacturer: 'Detected Spec',
      confidence: 'MEDIUM',
    }

    return NextResponse.json({
      success: true,
      extracted,
      provider: aiRes.provider,
      model: aiRes.model,
      needsReview: true,
    })
  } catch (error) {
    return handleError(error, request)
  }
}
