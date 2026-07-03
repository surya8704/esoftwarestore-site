import { useEffect } from 'react'
import { trackPage } from '../lib/api'
import { LEGAL_UPDATED, TERMS_SECTIONS } from '../lib/legalContent'
import LegalDocument from '../components/LegalDocument'

export default function TermsPage() {
  useEffect(() => {
    trackPage('/terms')
  }, [])

  return (
    <LegalDocument
      title="Terms and Conditions"
      description="Terms and conditions governing use of eSoftware Store and purchases on the Site."
      updated={LEGAL_UPDATED}
      sections={TERMS_SECTIONS}
    />
  )
}
