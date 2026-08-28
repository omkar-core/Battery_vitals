import { MongoClient } from 'mongodb'

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
}

const uri = process.env.MONGODB_URI
const options = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxIdleTimeMS: 300000,
  compressors: ['zlib'],
}

let client
let clientPromise

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

export default clientPromise

export async function getDB() {
  try {
    const client = await clientPromise
    return client.db('BatteryVitals')
  } catch (error) {
    console.error('MongoDB connection error:', error)
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
