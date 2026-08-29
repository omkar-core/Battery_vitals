import { MongoClient } from 'mongodb'

// Fallback MongoDB connection string if process.env.MONGODB_URI is missing or malformed
const DEFAULT_MONGODB_URI = 'mongodb+srv://omkar:omkar12345@cluster0.bzbhymi.mongodb.net/BatteryVitals?retryWrites=true&w=majority&appName=Cluster0'

function getCleanUri() {
  let envUri = process.env.MONGODB_URI || DEFAULT_MONGODB_URI
  // Fix accidental trailing '>' or typos in URI (e.g. omkar12345> -> omkar12345)
  envUri = envUri.replace('omkar12345>', 'omkar12345')
  if (!envUri.includes('/BatteryVitals')) {
    envUri = envUri.replace('.net/?', '.net/BatteryVitals?')
  }
  return envUri
}

let clientPromise = null

function getClientPromise() {
  if (clientPromise) return clientPromise

  const uri = getCleanUri()
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