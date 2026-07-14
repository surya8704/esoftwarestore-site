import GoogleSignInButton from './GoogleSignInButton'
import FacebookSignInButton from './FacebookSignInButton'

export default function SocialLoginButtons({
  config,
  onGoogleCredential,
  onFacebookAccessToken,
  disabled = false,
}) {
  const googleEnabled = Boolean(config?.googleLoginEnabled && config?.googleClientId)
  const facebookEnabled = Boolean(config?.facebookLoginEnabled && config?.facebookAppId)

  if (!googleEnabled && !facebookEnabled) return null

  return (
    <div className="mb-5 space-y-3">
      {googleEnabled ? (
        <GoogleSignInButton
          clientId={config.googleClientId}
          onCredential={onGoogleCredential}
          disabled={disabled}
        />
      ) : null}
      {facebookEnabled ? (
        <FacebookSignInButton
          appId={config.facebookAppId}
          onAccessToken={onFacebookAccessToken}
          disabled={disabled}
        />
      ) : null}
      <div className="flex items-center gap-3 text-xs text-store-muted">
        <span className="h-px flex-1 bg-store-border" />
        or continue with email
        <span className="h-px flex-1 bg-store-border" />
      </div>
    </div>
  )
}
