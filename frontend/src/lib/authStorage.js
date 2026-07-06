const TOKEN_KEY = 'token'
const USER_KEY = 'authUser'
const EMAIL_KEY = 'rememberedEmail'

export function readAuthToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function readCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function readRememberedEmail() {
  return localStorage.getItem(EMAIL_KEY) ?? ''
}

export function persistAuthSession({ token, user, email }) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  if (email) localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase())
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function clearRememberedEmail() {
  localStorage.removeItem(EMAIL_KEY)
}
