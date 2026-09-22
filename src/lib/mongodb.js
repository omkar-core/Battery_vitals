import 'server-only'
import { MongoClient } from 'mongodb'

function getCleanUri() {
  const envUri = process.env.MONGODB_URI
  if (!envUri) {
    // SECURITY: never provide a hardcoded credential fallback.
    // If MONGODB_URI is absent, every route's try/catch will degrade gracefully.
    console.error(
      '[MongoDB] MONGODB_URI environment variable is not set. ' +
      'Database operations will fail until it is configured in .env.local or your deployment secrets.'
    )
    return null
  }
  // Ensure the database name segment is present
  return envUri.includes('/BatteryVitals')
    ? envUri
    : envUri.replace(/\.net\/\?/, '.net/BatteryVitals?')
}


let clientPromise = null

function getClientPromise() {
  if (clientPromise) return clientPromise

  const uri = getCleanUri()
  if (!uri) return null  // MONGODB_URI not configured; callers handle null gracefully

  const options = {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxIdleTimeMS: 30000,
    waitQueueTimeoutMS: 5000,
    family: 4,
    retryWrites: true,
    w: 'majority',
  }

  try {
    if (process.env.NODE_ENV === 'development') {
      if (!global._mongoClientPromise) {
        global._mongoClientPromise = new MongoClient(uri, options).connect()
      }
      clientPromise = global._mongoClientPromise
    } else {
      clientPromise = new MongoClient(uri, options).connect()
    }
  } catch (err) {
    console.error('MongoClient initialization error:', err.message)
    clientPromise = null
  }

  return clientPromise
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

export default getClientPromise()

export async function getDB() {
  try {
    const cp = getClientPromise()
    if (!cp) throw new Error('MongoDB client not initialized')
    const connectedClient = await cp
    return connectedClient.db('BatteryVitals')
  } catch (error) {
    console.error('MongoDB connection error:', error.message)
    throw error
  }
}

export const getDb = getDB