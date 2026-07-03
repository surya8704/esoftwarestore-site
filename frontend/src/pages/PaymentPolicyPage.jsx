import { useEffect } from 'react'
import { trackPage } from '../lib/api'
import { LEGAL_UPDATED, PAYMENT_POLICY_SECTIONS } from '../lib/legalContent'
import LegalDocument from '../components/LegalDocument'

export default function PaymentPolicyPage() {
  useEffect(() => {
    trackPage('/payment-policy')
  }, [])

  return (
    <LegalDocument
      title="Payment Policy"
      description="Payment methods, pricing, and order confirmation at eSoftware Store."
      updated={LEGAL_UPDATED}
      sections={PAYMENT_POLICY_SECTIONS}
    />
  )
}
