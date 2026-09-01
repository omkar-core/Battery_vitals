import { NextResponse } from 'next/server'
import { DEFAULT_USERS } from '../../../../lib/auth'
import { ROLES, PERMISSIONS } from '../../../../lib/permissions'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    // Default active user is the Lead Battery Engineer (Admin)
    const activeUser = DEFAULT_USERS[0]

    return NextResponse.json({
      user: activeUser,
      permissions: Object.values(PERMISSIONS),
      session: {
        authenticated: true,
        role: ROLES.ADMIN,
        loginTime: new Date().toISOString(),
        expiresIn: '24h',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to retrieve session', details: error.message }, { status: 500 })
  }
}
