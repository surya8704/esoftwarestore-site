import { useEffect } from 'react'
import { trackPage } from '../lib/api'
import { DELIVERY_POLICY_SECTIONS, LEGAL_UPDATED } from '../lib/legalContent'
import { useLegalPage } from '../lib/useLegalPage'
import LegalDocument from '../components/LegalDocument'

const FALLBACK = {
  title: 'Delivery Policy',
  description: 'How digital software licenses are delivered after purchase at eSoftware Store.',
  updated: LEGAL_UPDATED,
  sections: DELIVERY_POLICY_SECTIONS,
}

export default function DeliveryPolicyPage() {
  const page = useLegalPage('delivery-policy', FALLBACK)

  useEffect(() => {
    trackPage('/delivery-policy')
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
