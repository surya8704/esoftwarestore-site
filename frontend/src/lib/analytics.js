const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-C1PR89EVBK'
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || '881868088016592'

function getGtag() {
  return typeof window !== 'undefined' && typeof window.gtag === 'function' ? window.gtag : null
}

function getFbq() {
  return typeof window !== 'undefined' && typeof window.fbq === 'function' ? window.fbq : null
}

function isAdminPath(path) {
  return String(path || '').startsWith('/admin')
}

/** Send a GA4 page_view for SPA route changes. Skips admin dashboard. */
export function trackGaPageView(path, title = document.title) {
  const gtag = getGtag()
  if (!gtag || !GA_MEASUREMENT_ID) return

  const pagePath = path || `${window.location.pathname}${window.location.search}`
  if (isAdminPath(pagePath)) return

  gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: title,
    page_location: `${window.location.origin}${pagePath}`,
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
  const gtag = getGtag()
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
