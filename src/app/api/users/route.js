import { NextResponse } from 'next/server'
import { getUsers, createUser } from '../../../lib/auth'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const users = await getUsers()
    return NextResponse.json({
      count: users.length,
      users,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch users', details: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`user_create_${ip}`, 10, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    if (!body.email || !body.name) {
      return NextResponse.json({ error: 'Name and Email are required.' }, { status: 400 })
    }

    const newUser = await createUser(body)
    return NextResponse.json({ success: true, user: newUser }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create user', details: error.message }, { status: 500 })
  }
}
