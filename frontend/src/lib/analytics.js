const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-C1PR89EVBK'
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || '881868088016592'

function ensureGtag() {
  if (typeof window === 'undefined') return null
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments)
    }
  }
  return window.gtag
}

function getFbq() {
  return typeof window !== 'undefined' && typeof window.fbq === 'function' ? window.fbq : null
}

function isAdminPath(path) {
  return String(path || '').startsWith('/admin')
}

/**
 * Track a GA4 page view for SPA route changes.
 * Uses gtag config (recommended for SPAs) plus an explicit page_view event.
 * Skips /admin. First page load is also sent by the index.html gtag config.
 */
export function trackGaPageView(path, title = document.title) {
  const gtag = ensureGtag()
  if (!gtag || !GA_MEASUREMENT_ID) return

  const pagePath = path || `${window.location.pathname}${window.location.search}`
  if (isAdminPath(pagePath)) return

  const pageLocation = `${window.location.origin}${pagePath}`
  const pageTitle = title || document.title

  // Update the active config with the virtual page path (SPA-friendly)
  gtag('config', GA_MEASUREMENT_ID, {
    page_path: pagePath,
    page_title: pageTitle,
    page_location: pageLocation,
    send_page_view: false,
  })

  // Explicit page_view so Realtime / DebugView always show navigations
  gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: pageTitle,
    page_location: pageLocation,
    send_to: GA_MEASUREMENT_ID,
  })
}

/** Meta Pixel PageView for SPA route changes. Skips admin dashboard. */
export function trackMetaPageView(path) {
  const fbq = getFbq()
  if (!fbq || !META_PIXEL_ID) return

  const pagePath = path || `${window.location.pathname}${window.location.search}`
  if (isAdminPath(pagePath)) return

  fbq('track', 'PageView')
}

export function trackGaEvent(eventName, params = {}) {
  const gtag = ensureGtag()
  if (!gtag || !GA_MEASUREMENT_ID) return
  if (isAdminPath(window.location.pathname)) return
  gtag('event', eventName, { ...params, send_to: GA_MEASUREMENT_ID })
}

export function trackMetaEvent(eventName, params = {}) {
  const fbq = getFbq()
  if (!fbq || !META_PIXEL_ID) return
  if (isAdminPath(window.location.pathname)) return
  if (params && Object.keys(params).length) fbq('track', eventName, params)
  else fbq('track', eventName)
}

export { GA_MEASUREMENT_ID, META_PIXEL_ID }
