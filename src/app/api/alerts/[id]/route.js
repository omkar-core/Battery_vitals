import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { ObjectId } from 'mongodb'

export const dynamic = 'force-dynamic'

export async function PUT(request, { params }) {
  try {
    const { id } = params
    const body = await request.json().catch(() => ({}))

    try {
      const db = await getDB()
      let filter = {}
      if (ObjectId.isValid(id)) {
        filter = { _id: new ObjectId(id) }
      } else {
        filter = { id }
      }

      await db.collection('alerts').updateOne(filter, {
        $set: {
          acknowledged: body.acknowledged !== undefined ? Boolean(body.acknowledged) : true,
          resolved: body.resolved !== undefined ? Boolean(body.resolved) : false,
          acknowledgedAt: new Date().toISOString(),
        },
      })
    } catch (e) {}

    return NextResponse.json({ success: true, id, acknowledged: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update alert', details: error.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params
    try {
      const db = await getDB()
      let filter = {}
      if (ObjectId.isValid(id)) {
        filter = { _id: new ObjectId(id) }
      } else {
        filter = { id }
      }
      await db.collection('alerts').deleteOne(filter)
    } catch (e) {}

    return NextResponse.json({ success: true, id, dismissed: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to dismiss alert', details: error.message }, { status: 500 })
  }
}
