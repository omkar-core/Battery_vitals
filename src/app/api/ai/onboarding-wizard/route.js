import { NextResponse } from 'next/server'
import { getAIResponse } from '../../../../lib/aiProvider'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'
import { requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'
import { AIOnboardingWizardSchema } from '../../../../lib/schemas'
import { ValidationError } from '../../../../lib/errors'
import { buildProfileFromInput } from '../../../../lib/batteryProfiles'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`ai_onboard_${ip}`, 20, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    await requirePermission(request, PERMISSIONS.ACCESS_AI)

    const rawBody = await request.json().catch(() => ({}))
    const parsed = AIOnboardingWizardSchema.safeParse(rawBody)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new ValidationError(issue?.message || 'Invalid onboarding wizard payload', issue?.path?.join('.') || 'body')
    }

    const { batteryId, step, answers } = parsed.data
    const cleanId = sanitizeString(batteryId, 30)

    if (step === 1) {
      return NextResponse.json({
        success: true,
        step: 1,
        message: `Welcome! Let's set up your battery profile for device ${cleanId}. What type of battery are you monitoring?`,
        options: [
          { label: 'LiFePO4 (Lithium Iron Phosphate)', value: 'LIFEPO4' },
          { label: 'Li-ion (Standard Lithium Ion)', value: 'LI_ION' },
          { label: 'Lead-Acid (SLA / AGM / Gel)', value: 'LEAD_ACID' },
          { label: 'NiMH (Nickel Metal Hydride)', value: 'NIMH' },
          { label: 'Custom / Other', value: 'CUSTOM' },
        ],
        nextStep: 2,
      })
    }

    if (step === 2) {
      const chem = answers.chemistry || 'LIFEPO4'
      const defaultSeries = chem === 'LIFEPO4' ? 4 : chem === 'LI_ION' ? 3 : chem === 'LEAD_ACID' ? 6 : 10
      return NextResponse.json({
        success: true,
        step: 2,
        message: `Great, ${chem} selected. How is your cell pack configured?`,
        fields: [
          { key: 'series', label: 'Series Cells (S)', type: 'number', defaultValue: defaultSeries, min: 1, max: 16 },
          { key: 'parallel', label: 'Parallel Strings (P)', type: 'number', defaultValue: 1, min: 1, max: 8 },
          { key: 'capacityAh', label: 'Nominal Capacity (Ah)', type: 'number', defaultValue: 2.6, min: 0.1, max: 500 },
        ],
        nextStep: 3,
      })
    }

    if (step === 3) {
      return NextResponse.json({
        success: true,
        step: 3,
        message: `Almost done! Tell us about where this battery will be operating so AI can tailor safety buffers.`,
        fields: [
          { key: 'application', label: 'Application', type: 'select', options: ['Solar / Energy Storage', 'Electric Mobility / Robotics', 'UPS / Backup Power', 'Laboratory / Bench Test'] },
          { key: 'ambientEnvironment', label: 'Environment', type: 'select', options: ['Climate Controlled (20-25°C)', 'Unconditioned Indoors (10-35°C)', 'Outdoor Enclosure (-10-45°C)'] },
        ],
        nextStep: 4,
      })
    }

    // Step 4+: Generate starter profile + thresholds
    const chemistry = answers.chemistry || 'LIFEPO4'
    const series = Number(answers.series || 4)
    const parallel = Number(answers.parallel || 1)
    const capacityAh = Number(answers.capacityAh || 2.6)

    const rawProfile = buildProfileFromInput({
      chemistry,
      series,
      parallel,
      capacityAh,
      name: `${chemistry} ${series}S${parallel}P (${cleanId})`,
    })

    const prompt = `A user has completed onboarding for a battery:
Chemistry: ${chemistry}
Configuration: ${series}S ${parallel}P
Capacity: ${capacityAh} Ah
Application: ${answers.application || 'General'}
Environment: ${answers.ambientEnvironment || 'Normal'}

Provide an executive onboarding completion summary with:
1. Short welcome & setup affirmation.
2. 3 key best practices for this chemistry.
Respond with JSON only:
{
  "summary": "2-3 sentences congratulating the user and summarizing the active setup.",
  "bestPractices": ["Practice 1", "Practice 2", "Practice 3"]
}`

    const aiRes = await getAIResponse(prompt, {
      json: true,
      fallbackFn: () => ({
        summary: `Your ${chemistry} ${series}S pack has been configured with nominal capacity of ${capacityAh}Ah and safe dynamic voltage bounds.`,
        bestPractices: [
          `Maintain ${chemistry} within normal operating temperatures.`,
          'Perform regular visual inspection of wiring and terminals.',
          'Verify INA219 shunt calibration under standard loads.',
        ],
      }),
    })

    return NextResponse.json({
      success: true,
      step: 4,
      completed: true,
      summary: aiRes.parsed?.summary || `Your ${chemistry} pack has been initialized.`,
      bestPractices: aiRes.parsed?.bestPractices || [],
      proposedProfile: rawProfile,
      provider: aiRes.provider,
      model: aiRes.model,
    })
  } catch (error) {
    return handleError(error, request)
  }
}
