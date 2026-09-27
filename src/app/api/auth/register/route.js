import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { getVerifiedFirebaseUser } from '../../../../lib/firebaseAuthVerify'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { ValidationError } from '../../../../lib/errors'
import { handleError } from '../../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`auth_register_${ip}`, 10, 60000)
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.', retryAfter: 60 },
        { status: 429 }
      )
    }

    // Verify Firebase ID token — this is the ONLY way to register a profile
    const firebaseUser = await getVerifiedFirebaseUser(request)
    if (!firebaseUser) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in first.', code: 'MISSING_CREDENTIALS' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const role = String(body.role || 'viewer').toLowerCase()
    const title = String(body.title || 'Battery Specialist').trim()
    const department = String(body.department || 'Operations').trim()

    if (!name || !email) {
      throw new ValidationError('Name and Email are required.')
    }

    // Email in body must match Firebase Auth email (security)
    if (email !== firebaseUser.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email mismatch with authenticated user.', code: 'EMAIL_MISMATCH' },
        { status: 400 }
      )
    }

    const db = await getDB()

    // Idempotent upsert: if profile exists for this Firebase UID, return it
    const existingProfile = await db.collection('users').findOne({ firebaseUid: firebaseUser.uid })
    if (existingProfile) {
      const { passwordHash, ...safeProfile } = existingProfile
      return NextResponse.json({
        success: true,
        user: { ...safeProfile, id: existingProfile.id || existingProfile._id?.toString(), firebaseUid: firebaseUser.uid },
      })
    }

    // Create new MongoDB profile keyed by Firebase UID
    // NO password field — Firebase Auth owns credentials
    const newProfile = {
      firebaseUid: firebaseUser.uid,
      name,
      email,
      role: ['admin', 'operator', 'viewer'].includes(role) ? role : 'viewer',
      title,
      department,
      avatar: role === 'admin' ? '🛡️' : role === 'operator' ? '⚡' : '👁️',
      status: 'active',
      lastActive: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }

    const result = await db.collection('users').insertOne(newProfile)

    const savedProfile = {
      ...newProfile,
      id: result.insertedId.toString(),
      firebaseUid: firebaseUser.uid,
    }

    return NextResponse.json({
      success: true,
      user: savedProfile,
    }, { status: 201 })
  } catch (error) {
    return handleError(error, request)
  }
}