/**
 * Verify a Google ID token without extra dependencies.
 * Uses Google's tokeninfo endpoint and checks audience + email verification.
 */
export async function verifyGoogleIdToken(idToken, clientId) {
  if (!idToken) throw new Error('Missing Google ID token')
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured on the server')

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  )
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'Invalid Google token')
  }

  const audiences = String(payload.aud ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  if (!audiences.includes(clientId)) {
    throw new Error('Google token audience mismatch')
  }

  const verified = payload.email_verified === true || payload.email_verified === 'true'
  if (!payload.email || !verified) {
    throw new Error('Google account email is not verified')
  }

  return {
    googleId: payload.sub,
    email: String(payload.email).toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture || null,
  }
}
