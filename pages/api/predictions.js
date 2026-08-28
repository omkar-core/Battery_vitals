import { getDB } from '../../src/lib/mongodb'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const db = await getDB()
    const { batteryId, limit = 10 } = req.query
    const q = {}
    if (batteryId) q.batteryId = batteryId

    const preds = await db
      .collection('predictions')
      .find(q)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit) || 10)
      .toArray()

    res.json(preds.map((p) => ({
      ...p,
      _id: String(p._id),
      timestamp: p.timestamp ? p.timestamp : null,
    })))
  } catch (error) {
    console.error('predictions error:', error)
    res.json([])
  }
}
