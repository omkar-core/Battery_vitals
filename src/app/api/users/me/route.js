import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { getVerifiedFirebaseUser } from '../../../../lib/firebaseAuthVerify'
import { hasPermission } from '../../../../lib/permissions'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    // Verify Firebase ID token — this is the authoritative auth check
    const firebaseUser = await getVerifiedFirebaseUser(request)
    if (!firebaseUser) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'MISSING_CREDENTIALS' },
        { status: 401 }
      )
    }

    const db = await getDB()

    // Look up MongoDB profile by Firebase UID
    let profile = await db.collection('users').findOne({ firebaseUid: firebaseUser.uid })

    if (!profile && firebaseUser.email) {
      // Look up by email for existing accounts (e.g. registered before Firebase Auth migration)
      const emailLower = firebaseUser.email.toLowerCase()
      profile = await db.collection('users').findOne({ email: emailLower })
      if (profile) {
        // Link the Firebase UID to the existing profile
        await db.collection('users').updateOne(
          { _id: profile._id },
          { $set: { firebaseUid: firebaseUser.uid, lastActive: new Date().toISOString() } }
        )
        profile.firebaseUid = firebaseUser.uid
      }
    }

    if (!profile) {
      // Profile doesn't exist yet — create default profile
      const emailLower = (firebaseUser.email || '').toLowerCase()
      const isDefaultAdmin = emailLower === 'admin@batteryvitals.com' || emailLower.startsWith('admin@')
      const newProfile = {
        firebaseUid: firebaseUser.uid,
        name: firebaseUser.name || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Team Member'),
        email: emailLower,
        role: isDefaultAdmin ? 'admin' : 'viewer',
        title: isDefaultAdmin ? 'Lead System Administrator' : 'Battery Specialist',
        department: isDefaultAdmin ? 'Security & Compliance' : 'Operations',
        avatar: isDefaultAdmin ? '🛡️' : '👁️',
        status: 'active',
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }
      try {
        const result = await db.collection('users').insertOne(newProfile)
        profile = { ...newProfile, id: result.insertedId.toString() }
      } catch (insertErr) {
        // Handle race condition or duplicate key gracefully
        profile = await db.collection('users').findOne({ email: emailLower })
        if (profile) {
          await db.collection('users').updateOne(
            { _id: profile._id },
            { $set: { firebaseUid: firebaseUser.uid, lastActive: new Date().toISOString() } }
          )
          profile.firebaseUid = firebaseUser.uid
        }
      }
    }

    const granted = Object.values(PERMISSIONS).filter((p) => hasPermission(profile.role, p))
    const { passwordHash, ...safeUser } = profile

    return NextResponse.json({
      user: { ...safeUser, id: profile.id || profile._id?.toString(), firebaseUid: firebaseUser.uid },
      permissions: granted,
      session: {
        authenticated: true,
        role: profile.role,
        loginTime: new Date().toISOString(),
        expiresIn: '1h', // Firebase ID tokens expire in 1 hour
      },
    })
  } catch (error) {
    return handleError(error, request)
  }
}