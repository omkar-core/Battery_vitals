import { NextResponse } from 'next/server'
import { executeBenchmarkValidation } from '../../../lib/validation/runValidation'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { handleError } from '../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`validation_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const results = executeBenchmarkValidation()
    return NextResponse.json({
      success: true,
      data: results,
    })
  } catch (error) {
    return handleError(error, request)
  }
}
