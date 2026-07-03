import { useEffect } from 'react'
import { trackPage } from '../lib/api'
import { DELIVERY_POLICY_SECTIONS, LEGAL_UPDATED } from '../lib/legalContent'
import LegalDocument from '../components/LegalDocument'

export default function DeliveryPolicyPage() {
  useEffect(() => {
    trackPage('/delivery-policy')
  }, [])

  return (
    <LegalDocument
      title="Delivery Policy"
      description="How digital software licenses are delivered after purchase at eSoftware Store."
      updated={LEGAL_UPDATED}
      sections={DELIVERY_POLICY_SECTIONS}
    />
  )
}
