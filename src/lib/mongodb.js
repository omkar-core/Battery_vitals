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
    maxIdleTimeMS: 300000,
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
