import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import SEO from '../components/SEO'

export default function CheckoutCompletePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const orderId = searchParams.get('orderId')
  const [delivery, setDelivery] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!orderId) {
      setError('Order not found.')
      return
    }

    let cancelled = false
    api(`/api/checkout/result/${orderId}`)
      .then((data) => {
        if (cancelled) return
        if (data.paid && data.delivery) {
          setDelivery(data.delivery)
        } else if (data.cancelled || data.paymentStatus === 'cancelled') {
          setError('Payment was cancelled. No charge was made.')
        } else if (data.paymentStatus === 'failed') {
          setError('Payment failed. Please try checkout again.')
        } else {
          setError('Payment is still processing. Refresh in a moment or check your email.')
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })

    return () => { cancelled = true }
  }, [orderId])

  if (error) {
    return (
      <div className="store-container py-16 text-center">
        <SEO title="Checkout" />
        <div className="store-card mx-auto max-w-lg p-8">
          <p className="text-store-muted">{error}</p>
          <button type="button" onClick={() => navigate('/checkout')} className="btn-store-primary mt-6">
            Back to checkout
          </button>
        </div>
      </div>
    )
  }

  if (!delivery) {
    return (
      <div className="store-container py-20 text-center">
        <SEO title="Confirming order" />
        <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-[#f97316]/20" />
        <p className="mt-4 text-store-muted">Confirming your payment...</p>
      </div>
    )
  }

  return (
    <div className="store-container py-16 text-center">
      <SEO title="Order confirmed" />
      <div className="store-card mx-auto max-w-lg p-8 md:p-10">
        <h1 className="text-2xl font-extrabold text-[#16a34a]">Order confirmed — license delivered!</h1>
        <p className="mt-4 text-sm text-store-muted">Confirmation code</p>
        <code className="mt-1 inline-block rounded-lg bg-store-hover px-3 py-2 text-sm font-bold text-store-heading">
          {delivery.confirmationCode}
        </code>
        <p className="mt-4 font-mono text-lg">{delivery.licenseKey}</p>
        <p className="mt-4 text-sm text-store-muted">Check your email for the activation key and download link.</p>
        <button type="button" onClick={() => navigate('/orders')} className="btn-store-primary mt-8">
          View my orders
        </button>
      </div>
    </div>
  )
}
