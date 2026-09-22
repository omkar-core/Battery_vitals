import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/auth'
import { hasPermission } from '../../../../lib/permissions'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const user = await getSessionUser(request)

    const granted = Object.values(PERMISSIONS).filter((p) => hasPermission(user.role, p))
    const { passwordHash, ...safeUser } = user

    return NextResponse.json({
      user: safeUser,
      permissions: granted,
      session: {
        authenticated: true,
        role: user.role,
        loginTime: new Date().toISOString(),
        expiresIn: '12h',
      },
    })
  } catch (error) {
    return handleError(error, request)
  }
}