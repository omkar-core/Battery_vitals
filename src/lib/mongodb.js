import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI

// Lazy, graceful handling: importing this module never throws.
// getDB() reports a clear error only when the DB is actually needed,
// so pages and API routes can degrade cleanly instead of crashing.
let client
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
      client = new MongoClient(uri, options)
      global._mongoClientPromise = client.connect()
    }
    clientPromise = global._mongoClientPromise
  } else {
    client = new MongoClient(uri, options)
    clientPromise = client.connect()
  }
}

export function isMongoConfigured() {
  return !!uri
}

export default clientPromise || Promise.reject(new Error('MONGODB_URI not configured'))

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

export async function getCollection(name) {
  const db = await getDB()
  return db.collection(name)
}

export async function closeConnection() {
  if (client) {
    await client.close()
    console.log('MongoDB connection closed')
  }
}