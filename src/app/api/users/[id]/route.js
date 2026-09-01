import { NextResponse } from 'next/server'
import { findUser, updateUser, deleteUser } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  try {
    const { id } = params
    const user = await findUser(id)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json(user)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch user', details: error.message }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params
    const body = await request.json().catch(() => ({}))
    const updated = await updateUser(id, body)
    return NextResponse.json({ success: true, user: updated })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update user', details: error.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params
    await deleteUser(id)
    return NextResponse.json({ success: true, id, message: 'User deleted successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete user', details: error.message }, { status: 500 })
  }
}
