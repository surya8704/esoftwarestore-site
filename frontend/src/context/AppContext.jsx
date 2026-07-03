import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import i18n from '../i18n'
import { api, setApiRegion } from '../lib/api'
import { prefetchStaticCatalog } from '../lib/products'
import {
  detectRegionFromBrowser,
  getRegionForSelection,
  isRegionManual,
  persistRegion,
  readStoredRegion,
} from '../lib/region'
import { applyTheme, getInitialTheme, persistTheme } from '../lib/theme'

const AppContext = createContext(null)

const stored = readStoredRegion()
applyRegionState(stored, isRegionManual())

function applyRegionState({ country, currency, locale }, manual = false) {
  persistRegion({ country, currency, locale }, manual)
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
  const [user, setUser] = useState(null)
  const [config, setConfig] = useState(null)
  const [cart, setCart] = useState(null)
  const [country, setCountry] = useState(stored.country)
  const [currency, setCurrency] = useState(stored.currency)
  const [locale, setLocale] = useState(stored.locale)
  const [theme, setThemeState] = useState(() => getInitialTheme())
  const [regionAuto, setRegionAuto] = useState(!isRegionManual())

  const refreshCart = useCallback(async () => {
    const data = await api('/api/cart')
    setCart(data.cart)
  }, [])

  const setRegion = useCallback(
    async (partial, manual = true) => {
      const nextCountry = partial.country ?? country
      const nextLocale = partial.locale ?? locale
      const resolved = partial.currency
        ? { country: nextCountry, currency: partial.currency, locale: nextLocale }
        : getRegionForSelection(nextCountry, nextLocale)

      setCountry(resolved.country)
      setCurrency(resolved.currency)
      setLocale(resolved.locale)
      setRegionAuto(!manual)
      applyRegionState(resolved, manual)
      await syncCartRegion(resolved.country, resolved.currency)
      await refreshCart()
    },
    [country, locale, refreshCart],
  )

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

    async function refineRegion() {
      if (isRegionManual()) return

      try {
        const region = await api('/api/geo')
        if (cancelled) return
        if (
          region.country !== country ||
          region.currency !== currency ||
          region.locale !== locale
        ) {
          applyRegionState(region, false)
          setCountry(region.country)
          setCurrency(region.currency)
          setLocale(region.locale)
          setRegionAuto(true)
          await syncCartRegion(region.country, region.currency)
        }
      } catch {
        if (!cancelled) {
          const fallback = detectRegionFromBrowser()
          if (fallback.country !== country) {
            applyRegionState(fallback, false)
            setCountry(fallback.country)
            setCurrency(fallback.currency)
            setLocale(fallback.locale)
          }
        }
      }
    }

    refineRegion()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  useEffect(() => {
    localStorage.setItem('country', country)
    localStorage.setItem('currency', currency)
    localStorage.setItem('locale', locale)
  }, [country, currency, locale])

  useEffect(() => {
    api('/api/config').then(setConfig).catch(() => {})
    const token = localStorage.getItem('token')
    if (token) {
      api('/api/auth/me').then((d) => setUser(d.user)).catch(() => localStorage.removeItem('token'))
    }
    refreshCart().catch(() => {})
  }, [refreshCart])

  const login = useCallback(async (email, password) => {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    })
    localStorage.setItem('token', data.token)
    setUser(data.user)
    return data
  }, [])

  const signup = useCallback(async (payload) => {
    const data = await api('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        email: payload.email?.trim().toLowerCase(),
        name: payload.name?.trim(),
      }),
    })
    localStorage.setItem('token', data.token)
    setUser(data.user)
    return data
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
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
      config,
      cart,
      country,
      setCountry,
      currency,
      setCurrency,
      locale,
      setLocale,
      setRegion,
      regionAuto,
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
      user, config, cart, country, currency, locale, setRegion, regionAuto,
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
