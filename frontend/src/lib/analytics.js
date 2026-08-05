const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-C1PR89EVBK'

function getGtag() {
  return typeof window !== 'undefined' && typeof window.gtag === 'function' ? window.gtag : null
}

/** Send a GA4 page_view for SPA route changes. Skips admin dashboard. */
export function trackGaPageView(path, title = document.title) {
  const gtag = getGtag()
  if (!gtag || !GA_MEASUREMENT_ID) return

  const pagePath = path || `${window.location.pathname}${window.location.search}`
  if (pagePath.startsWith('/admin')) return

  gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: title,
    page_location: `${window.location.origin}${pagePath}`,
    send_to: GA_MEASUREMENT_ID,
  })
}

export function trackGaEvent(eventName, params = {}) {
  const gtag = getGtag()
  if (!gtag || !GA_MEASUREMENT_ID) return
  if (window.location.pathname.startsWith('/admin')) return
  gtag('event', eventName, { ...params, send_to: GA_MEASUREMENT_ID })
}

export { GA_MEASUREMENT_ID }
