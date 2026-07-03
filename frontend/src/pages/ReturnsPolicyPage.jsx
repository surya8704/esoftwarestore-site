import { useEffect } from 'react'
import { trackPage } from '../lib/api'
import { LEGAL_UPDATED, RETURNS_POLICY_SECTIONS } from '../lib/legalContent'
import LegalDocument from '../components/LegalDocument'

export default function ReturnsPolicyPage() {
  useEffect(() => {
    trackPage('/returns-refunds')
  }, [])

  return (
    <LegalDocument
      title="Returns & Refunds Policy"
      description="Refund eligibility and returns policy for digital software licenses."
      updated={LEGAL_UPDATED}
      sections={RETURNS_POLICY_SECTIONS}
    />
  )
}
