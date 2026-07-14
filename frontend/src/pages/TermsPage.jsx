import { useEffect } from 'react'
import { trackPage } from '../lib/api'
import { LEGAL_UPDATED, TERMS_SECTIONS } from '../lib/legalContent'
import { useLegalPage } from '../lib/useLegalPage'
import LegalDocument from '../components/LegalDocument'

const FALLBACK = {
  title: 'Terms and Conditions',
  description: 'Terms and conditions governing use of eSoftware Store and purchases on the Site.',
  updated: LEGAL_UPDATED,
  sections: TERMS_SECTIONS,
}

export default function TermsPage() {
  const page = useLegalPage('terms', FALLBACK)

  useEffect(() => {
    trackPage('/terms')
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
