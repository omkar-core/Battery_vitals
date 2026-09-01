import { NextResponse } from 'next/server'
import { findUser } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { email, password } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await findUser(email)
    if (!user) {
      return NextResponse.json({ error: 'User not found with this email' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      token: `token_${user.id}_${Date.now()}`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        title: user.title,
        department: user.department,
        avatar: user.avatar,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Authentication failed', details: error.message }, { status: 500 })
  }
}
