import { getDB } from '../../src/lib/mongodb'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store, max-age=0')

  const allowed = ['GET', 'OPTIONS']
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!allowed.includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const batteryId = req.query.batteryId || 'BAT001'
    const db = await getDB()
    const data = await db.collection('live_data').findOne({ batteryId })

    if (!data) {
      return res.status(404).json({
        error: 'No data available',
        message: 'ESP32 has not sent data yet',
      })
    }

    return res.status(200).json({
      success: true,
      data: serialize(data),
    })
  } catch (error) {
    console.error('latest error:', error)
    return res.status(500).json({ error: error.message })
  }
}

export function serialize(d) {
  return {
    ...d,
    _id: String(d._id),
    timestamp: d.timestamp ? new Date(d.timestamp).getTime() : Date.now(),
    receivedAt: d.receivedAt ? new Date(d.receivedAt).getTime() : null,
  }
}
