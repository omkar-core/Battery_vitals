import { getDB } from '../../src/lib/mongodb'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { batteryId = 'BAT001', limit = 500, minutes = 60 } = req.query

    const db = await getDB()
    const since = new Date(Date.now() - parseInt(minutes) * 60 * 1000)

    const data = await db
      .collection('readings')
      .find({ batteryId, timestamp: { $gte: since } })
      .sort({ timestamp: 1 })
      .limit(parseInt(limit))
      .toArray()

    return res.status(200).json({
      success: true,
      count: data.length,
      data: data.map((d) => ({
        id: String(d._id),
        time: d.timestamp ? new Date(d.timestamp) : null,
        voltage: d.voltage,
        current: d.current,
        power: d.power,
        soc: d.soc,
        soh: d.soh,
        temperature: d.temperature,
        humidity: d.humidity,
        bhi: d.bhi,
        safety: d.safety,
      })),
    })
  } catch (error) {
    console.error('history error:', error)
    return res.status(500).json({ error: error.message })
  }
}
