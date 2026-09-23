import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/auth'
import { getUserBatteries, upsertUserBattery } from '../../../../lib/batteryRegistry'

export async function GET(request) {
  try {
    const user = await getSessionUser(request)
    const batteries = await getUserBatteries(user.id)
    return NextResponse.json({
      success: true,
      batteries,
      userId: user.id,
      isGuest: user.id === 'usr_guest',
    })
  } catch (error) {
    console.error('Error in GET /api/battery/my-batteries:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve user batteries', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const user = await getSessionUser(request)
    if (user.id === 'usr_guest') {
      return NextResponse.json(
        { error: 'Forbidden: Guest users cannot register custom batteries' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const battery = await upsertUserBattery(user.id, body)
    return NextResponse.json({ success: true, battery })
  } catch (error) {
    console.error('Error in POST /api/battery/my-batteries:', error)
    return NextResponse.json(
      { error: 'Failed to register battery', details: error.message },
      { status: 500 }
    )
  }
}
