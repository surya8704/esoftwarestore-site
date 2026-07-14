import { useEffect, useRef, useState } from 'react'

function loadFacebookSdk(appId) {
  if (window.FB) return Promise.resolve(window.FB)
  if (window.__facebookSdkPromise) return window.__facebookSdkPromise

  window.__facebookSdkPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: false,
        version: 'v19.0',
      })
      resolve(window.FB)
    }

    if (document.getElementById('facebook-jssdk')) {
      if (window.FB) resolve(window.FB)
      return
    }

    const script = document.createElement('script')
    script.id = 'facebook-jssdk'
    script.src = 'https://connect.facebook.net/en_US/sdk.js'
    script.async = true
    script.defer = true
    script.onerror = () => reject(new Error('Failed to load Facebook Login'))
    document.body.appendChild(script)
  })

  return window.__facebookSdkPromise
}

export default function FacebookSignInButton({ appId, onAccessToken, disabled = false }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const callbackRef = useRef(onAccessToken)

  useEffect(() => {
    callbackRef.current = onAccessToken
  }, [onAccessToken])

  useEffect(() => {
    if (!appId || disabled) return undefined
    let cancelled = false
    loadFacebookSdk(appId)
      .then(() => {
        if (!cancelled) {
          setReady(true)
          setError('')
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Facebook Login unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [appId, disabled])

  if (!appId) return null

  const handleClick = () => {
    if (!window.FB || busy || disabled) return
    setBusy(true)
    setError('')
    window.FB.login(
      (response) => {
        setBusy(false)
        if (response?.authResponse?.accessToken) {
          callbackRef.current?.(response.authResponse.accessToken)
          return
        }
        if (response?.status === 'unknown') return
        setError('Facebook sign-in was cancelled or failed')
      },
      { scope: 'public_profile,email' },
    )
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={!ready || disabled || busy}
        className="flex w-full items-center justify-center gap-3 rounded-full border border-[#1877F2]/30 bg-[#1877F2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#166fe5] disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073"
          />
        </svg>
        {busy ? 'Connecting…' : 'Continue with Facebook'}
      </button>
      {!ready && !error ? <p className="mt-2 text-center text-xs text-store-muted">Loading Facebook…</p> : null}
      {error ? <p className="mt-2 text-center text-xs text-[#e11d48]">{error}</p> : null}
    </div>
  )
}
