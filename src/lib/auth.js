import { getDB } from './mongodb'
import { ROLES, hasPermission } from './permissions'

export const DEFAULT_USERS = [
  {
    id: 'usr_admin_01',
    name: 'Chief Battery Engineer',
    email: 'admin@example.com',
    role: ROLES.ADMIN,
    title: 'Lead Power Systems Engineer',
    department: 'Energy Storage & Safety',
    avatar: '🛡️',
    status: 'active',
    lastActive: new Date().toISOString(),
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'usr_op_02',
    name: 'Alex Rivera',
    email: 'operator@example.com',
    role: ROLES.OPERATOR,
    title: 'Field Operations Specialist',
    department: 'Hardware Telemetry & Maintenance',
    avatar: '⚡',
    status: 'active',
    lastActive: new Date().toISOString(),
    createdAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'usr_view_03',
    name: 'Elena Rostova',
    email: 'viewer@example.com',
    role: ROLES.VIEWER,
    title: 'Fleet Analytics Observer',
    department: 'Data Science & Reliability',
    avatar: '👁️',
    status: 'active',
    lastActive: new Date().toISOString(),
    createdAt: '2024-02-01T00:00:00Z',
  },
]

let inMemoryUsers = [...DEFAULT_USERS]

/**
 * Fetch all users from MongoDB or fallback to in-memory store
 */
export async function getUsers() {
  try {
    const db = await getDB()
    const users = await db.collection('users').find({}).toArray()
    if (users && users.length > 0) {
      return users.map((u) => ({
        ...u,
        id: u.id || u._id?.toString(),
      }))
    }
  } catch (e) {
    // Fall back to memory store
  }
  return inMemoryUsers
}

/**
 * Find user by ID or Email
 */
export async function findUser(idOrEmail) {
  const users = await getUsers()
  return users.find((u) => u.id === idOrEmail || u.email.toLowerCase() === idOrEmail.toLowerCase()) || null
}

/**
 * Create or register a new user
 */
export async function createUser(userData) {
  const newUser = {
    id: userData.id || `usr_${Date.now().toString(36)}`,
    name: userData.name || 'Team Member',
    email: userData.email,
    role: userData.role || ROLES.VIEWER,
    title: userData.title || 'Battery Specialist',
    department: userData.department || 'Operations',
    avatar: userData.role === ROLES.ADMIN ? '🛡️' : userData.role === ROLES.OPERATOR ? '⚡' : '👁️',
    status: 'active',
    lastActive: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }

  try {
    const db = await getDB()
    await db.collection('users').insertOne(newUser)
  } catch (e) {
    inMemoryUsers.push(newUser)
  }

  return newUser
}

/**
 * Update user profile or role
 */
export async function updateUser(id, updates) {
  try {
    const db = await getDB()
    await db.collection('users').updateOne({ id }, { $set: updates })
  } catch (e) {
    inMemoryUsers = inMemoryUsers.map((u) => (u.id === id ? { ...u, ...updates } : u))
  }
  return findUser(id)
}

/**
 * Delete a user
 */
export async function deleteUser(id) {
  try {
    const db = await getDB()
    await db.collection('users').deleteOne({ id })
  } catch (e) {
    inMemoryUsers = inMemoryUsers.filter((u) => u.id !== id)
  }
  return true
}
