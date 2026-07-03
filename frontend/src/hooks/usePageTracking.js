import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPage } from '../lib/api'

export default function usePageTracking() {
  const location = useLocation()
  useEffect(() => {
    trackPage(location.pathname)
  }, [location.pathname])
}
