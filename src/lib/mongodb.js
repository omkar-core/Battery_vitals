import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI

// Lazy, graceful handling: importing this module never throws.
// getDB() reports a clear error only when the DB is actually needed,
// so API routes can degrade cleanly instead of crashing.
let clientPromise = null

if (uri) {
  const options = {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxIdleTimeMS: 30000,
    waitQueueTimeoutMS: 10000,
    family: 4,
    retryWrites: true,
    w: 'majority',
    compressors: ['zlib'],
  }

  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri, options).connect()
    }
    clientPromise = global._mongoClientPromise
  } else {
    clientPromise = new MongoClient(uri, options).connect()
  }
}

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    try {
      if (clientPromise) {
        const connectedClient = await clientPromise
        await connectedClient.close()
        console.log('MongoDB connection closed')
      }
    } catch (error) {
      console.error('MongoDB shutdown error:', error.message)
    }
  })
}

export default clientPromise

export async function getDB() {
  if (!uri) {
    throw new Error('MONGODB_URI not configured')
  }
  try {
    const connectedClient = await clientPromise
    return connectedClient.db('BatteryVitals')
  } catch (error) {
    console.error('MongoDB connection error:', error.message)
    throw error
  }
}