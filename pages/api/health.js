import { getDB } from '../../src/lib/mongodb'

export default async function handler(req, res) {
  try {
    const db = await getDB()
    await db.command({ ping: 1 })

    const readingsCount = await db.collection('readings').countDocuments()
    const liveDataCount = await db.collection('live_data').countDocuments()

    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      collections: {
        readings: readingsCount,
        live_data: liveDataCount,
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('health error:', error)
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    })
  }
}
