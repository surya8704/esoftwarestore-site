import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import i18n from '../i18n'
import { api, setApiRegion } from '../lib/api'
import {
  clearAuthSession,
  clearRememberedEmail,
  persistAuthSession,
  readAuthToken,
  readCachedUser,
} from '../lib/authStorage'
import { prefetchStaticCatalog } from '../lib/products'
import { detectRegionFromBrowser, readStoredRegion } from '../lib/region'
import { applyTheme, getInitialTheme, persistTheme } from '../lib/theme'

const AppContext = createContext(null)

const stored = readStoredRegion()
applyRegionState(stored)

function applyRegionState({ country, currency, locale }) {
  localStorage.setItem('country', country)
  localStorage.setItem('currency', currency)
  localStorage.setItem('locale', locale)
  localStorage.removeItem('regionManual')
  setApiRegion({ country, currency, locale })
  document.documentElement.lang = locale
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  i18n.changeLanguage(locale)
}

async function syncCartRegion(country, currency) {
  try {
    await api('/api/cart', {
      method: 'PATCH',
      body: JSON.stringify({ countryCode: country, currency }),
    })
  } catch {
    /* cart may not exist yet */
  }
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => readCachedUser())
  const [authReady, setAuthReady] = useState(false)
  const [config, setConfig] = useState(null)
  const [cart, setCart] = useState(null)
  const [country, setCountry] = useState(stored.country)
  const [currency, setCurrency] = useState(stored.currency)
  const [locale, setLocale] = useState(stored.locale)
  const [theme, setThemeState] = useState(() => getInitialTheme())

  const refreshCart = useCallback(async () => {
    const data = await api('/api/cart')
    setCart(data.cart)
  }, [])

  const applyDetectedRegion = useCallback(async (region) => {
    applyRegionState(region)
    setCountry(region.country)
    setCurrency(region.currency)
    setLocale(region.locale)
    await syncCartRegion(region.country, region.currency)
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    prefetchStaticCatalog().catch(() => {})
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (!localStorage.getItem('theme')) {
        setThemeState(media.matches ? 'dark' : 'light')
      }
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const setTheme = useCallback((next) => {
    setThemeState(next)
    persistTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    document.documentElement.classList.add('theme-transition')
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      persistTheme(next)
      return next
    })
    window.setTimeout(() => document.documentElement.classList.remove('theme-transition'), 300)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function detectRegion() {
      try {
        const region = await api('/api/geo')
        if (!cancelled) await applyDetectedRegion(region)
      } catch {
        if (!cancelled) await applyDetectedRegion(detectRegionFromBrowser())
      }
    }

    detectRegion()
    return () => { cancelled = true }
  }, [applyDetectedRegion])

  useEffect(() => {
    api('/api/config').then(setConfig).catch(() => {})

    const token = readAuthToken()
    if (!token) {
      setAuthReady(true)
      refreshCart().catch(() => {})
      return
    }

    api('/api/auth/me')
      .then((data) => {
        setUser(data.user)
        persistAuthSession({ token, user: data.user })
      })
      .catch(() => {
        clearAuthSession()
        setUser(null)
      })
      .finally(() => {
        setAuthReady(true)
        refreshCart().catch(() => {})
      })
  }, [refreshCart])

  const login = useCallback(async (email, password, { remember = true } = {}) => {
    const normalizedEmail = email.trim().toLowerCase()
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: normalizedEmail, password }),
    })
    persistAuthSession({
      token: data.token,
      user: data.user,
      email: remember ? normalizedEmail : undefined,
    })
    if (!remember) clearRememberedEmail()
    setUser(data.user)
    return data
  }, [])

  const signup = useCallback(async (payload, { remember = true } = {}) => {
    const normalizedEmail = payload.email?.trim().toLowerCase()
    const data = await api('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        email: normalizedEmail,
        name: payload.name?.trim(),
      }),
    })
    persistAuthSession({
      token: data.token,
      user: data.user,
      email: remember ? normalizedEmail : undefined,
    })
    if (!remember) clearRememberedEmail()
    setUser(data.user)
    return data
  }, [])

  const logout = useCallback(() => {
    clearAuthSession()
    setUser(null)
  }, [])

  const addToCart = async (productId, variantId, quantity = 1) => {
    await api('/api/cart/items', {
      method: 'POST',
      body: JSON.stringify({ productId, variantId, quantity }),
    })
    await refreshCart()
  }

  const removeFromCart = useCallback(async (itemId) => {
    await api(`/api/cart/items/${itemId}`, { method: 'DELETE' })
    await refreshCart()
  }, [refreshCart])

  const value = useMemo(
    () => ({
      user,
      authReady,
      config,
      cart,
      country,
      currency,
      locale,
      theme,
      setTheme,
      toggleTheme,
      login,
      signup,
      logout,
      addToCart,
      removeFromCart,
      refreshCart,
    }),
    [
      user, authReady, config, cart, country, currency, locale,
      theme, setTheme, toggleTheme, refreshCart, removeFromCart, login, signup, logout,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
