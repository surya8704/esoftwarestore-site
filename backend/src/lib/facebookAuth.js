/**
 * Verify a Facebook user access token for our app and return the profile.
 */
export async function verifyFacebookAccessToken(accessToken, { appId, appSecret }) {
  if (!accessToken) throw new Error('Missing Facebook access token')
  if (!appId || !appSecret) throw new Error('FACEBOOK_APP_ID / FACEBOOK_APP_SECRET are not configured')

  const appToken = `${appId}|${appSecret}`
  const debugUrl = new URL('https://graph.facebook.com/debug_token')
  debugUrl.searchParams.set('input_token', accessToken)
  debugUrl.searchParams.set('access_token', appToken)

  const debugResponse = await fetch(debugUrl)
  const debugPayload = await debugResponse.json().catch(() => ({}))
  const data = debugPayload.data
  if (!debugResponse.ok || !data?.is_valid) {
    throw new Error(debugPayload.error?.message || 'Invalid Facebook token')
  }
  if (String(data.app_id) !== String(appId)) {
    throw new Error('Facebook token app mismatch')
  }

  const meUrl = new URL('https://graph.facebook.com/me')
  meUrl.searchParams.set('fields', 'id,name,email')
  meUrl.searchParams.set('access_token', accessToken)
  const meResponse = await fetch(meUrl)
  const me = await meResponse.json().catch(() => ({}))
  if (!meResponse.ok || !me.id) {
    throw new Error(me.error?.message || 'Could not load Facebook profile')
  }
  if (!me.email) {
    throw new Error('Facebook account email is required. Grant email permission and try again.')
  }

  return {
    facebookId: String(me.id),
    email: String(me.email).toLowerCase(),
    name: me.name || me.email.split('@')[0],
  }
}
