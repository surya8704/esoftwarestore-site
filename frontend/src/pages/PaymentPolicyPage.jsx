import { useEffect } from 'react'
import { trackPage } from '../lib/api'
import { LEGAL_UPDATED, PAYMENT_POLICY_SECTIONS } from '../lib/legalContent'
import { useLegalPage } from '../lib/useLegalPage'
import LegalDocument from '../components/LegalDocument'

const FALLBACK = {
  title: 'Payment Policy',
  description: 'Payment methods, pricing, and order confirmation at eSoftware Store.',
  updated: LEGAL_UPDATED,
  sections: PAYMENT_POLICY_SECTIONS,
}

export default function PaymentPolicyPage() {
  const page = useLegalPage('payment-policy', FALLBACK)

  useEffect(() => {
    trackPage('/payment-policy')
  }, [])

  return (
    <LegalDocument
      title={page.title}
      description={page.description}
      updated={page.updatedLabel}
      sections={page.sections}
    />
  )
}
