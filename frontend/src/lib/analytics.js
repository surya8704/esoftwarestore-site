const GTM_ID = import.meta.env.VITE_GTM_ID || 'GTM-P2Q5LWQ5'
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || '881868088016592'

function ensureDataLayer() {
  if (typeof window === 'undefined') return null
  window.dataLayer = window.dataLayer || []
  return window.dataLayer
}

function getFbq() {
  return typeof window !== 'undefined' && typeof window.fbq === 'function' ? window.fbq : null
}

function isAdminPath(path) {
  return String(path || '').startsWith('/admin')
}

/**
 * Push a virtual page view into the GTM dataLayer for SPA navigations.
 * Create a GTM trigger on Custom Event = "virtualPageView" (or "page_view")
 * and fire your GA4 / other tags from that.
 */
export function trackGtmPageView(path, title = document.title) {
  const dataLayer = ensureDataLayer()
  if (!dataLayer || !GTM_ID) return

  const pagePath = path || `${window.location.pathname}${window.location.search}`
  if (isAdminPath(pagePath)) return

  const pageTitle = title || document.title
  const pageLocation = `${window.location.origin}${pagePath}`

  dataLayer.push({
    event: 'virtualPageView',
    page_path: pagePath,
    page_title: pageTitle,
    page_location: pageLocation,
  })
}

/** @deprecated Use trackGtmPageView — kept for older imports */
export function trackGaPageView(path, title) {
  trackGtmPageView(path, title)
}

/** Meta Pixel PageView for SPA route changes. Skips admin dashboard. */
export function trackMetaPageView(path) {
  const fbq = getFbq()
  if (!fbq || !META_PIXEL_ID) return

  const pagePath = path || `${window.location.pathname}${window.location.search}`
  if (isAdminPath(pagePath)) return

  fbq('track', 'PageView')
}

export function trackGtmEvent(eventName, params = {}) {
  const dataLayer = ensureDataLayer()
  if (!dataLayer || !GTM_ID) return
  if (isAdminPath(window.location.pathname)) return
  dataLayer.push({ event: eventName, ...params })
}

/** @deprecated Use trackGtmEvent */
export function trackGaEvent(eventName, params = {}) {
  trackGtmEvent(eventName, params)
}

export function trackMetaEvent(eventName, params = {}) {
  const fbq = getFbq()
  if (!fbq || !META_PIXEL_ID) return
  if (isAdminPath(window.location.pathname)) return
  if (params && Object.keys(params).length) fbq('track', eventName, params)
  else fbq('track', eventName)
}

export { GTM_ID, META_PIXEL_ID }
