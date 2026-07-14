import { useEffect, useRef, useState } from 'react'

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (window.__googleGisPromise) return window.__googleGisPromise

  window.__googleGisPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'))
    document.head.appendChild(script)
  })

  return window.__googleGisPromise
}

export default function GoogleSignInButton({ clientId, onCredential, disabled = false }) {
  const buttonRef = useRef(null)
  const callbackRef = useRef(onCredential)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    callbackRef.current = onCredential
  }, [onCredential])

  useEffect(() => {
    if (!clientId || disabled) return undefined
    let cancelled = false

    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google?.accounts?.id) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response?.credential) callbackRef.current?.(response.credential)
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        buttonRef.current.innerHTML = ''
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: Math.min(360, buttonRef.current.parentElement?.clientWidth || 320),
          logo_alignment: 'left',
        })
        setReady(true)
        setError('')
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Google Sign-In unavailable')
      })

    return () => {
      cancelled = true
    }
  }, [clientId, disabled])

  if (!clientId) return null

  return (
    <div className="w-full">
      <div ref={buttonRef} className={`flex justify-center ${disabled ? 'pointer-events-none opacity-60' : ''}`} />
      {!ready && !error ? <p className="mt-2 text-center text-xs text-store-muted">Loading Google…</p> : null}
      {error ? <p className="mt-2 text-center text-xs text-[#e11d48]">{error}</p> : null}
    </div>
  )
}
