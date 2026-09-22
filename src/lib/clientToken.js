// Client-safe session token helpers. Kept separate from lib/auth.js (server-only)
// so Client Components can read/send the bearer token without pulling server deps.

const TOKEN_KEY = 'bv_auth_token'

export function getAuthToken() {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch (e) {
    return ''
  }
}

export function setAuthToken(token) {
  if (typeof window === 'undefined') return
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
      document.cookie = `bv_session=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`
    }
  } catch (e) {}
}

export function clearAuthToken() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(TOKEN_KEY)
    document.cookie = `bv_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`
  } catch (e) {}
}

/**
 * Build fetch headers with the bearer token attached when one is present.
 * @param {Record<string,string>} extra
 * @returns {Record<string,string>}
 */
export function authHeaders(extra = {}) {
  const token = getAuthToken()
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
}