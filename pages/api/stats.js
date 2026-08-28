import { getDB } from '../../src/lib/mongodb'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const db = await getDB()
    const [r, a, l, d] = await Promise.all([
      db.collection('readings').countDocuments(),
      db.collection('alerts').countDocuments(),
      db.collection('live_data').findOne({ batteryId: 'BAT001' }),
      db.collection('devices').countDocuments(),
    ])

    res.json({
      totalReadings: r,
      totalAlerts: a,
      deviceCount: d,
      lastReading: l?.timestamp,
      currentSoc: l?.soc,
      currentSafety: l?.safety,
      currentBhi: l?.bhi,
    })
  } catch (error) {
    console.error('stats error:', error)
    res.status(500).json({ error: error.message })
  }
}
