import { useEffect, useState } from 'react'

function resolvePageSize() {
  if (typeof window === 'undefined') return 12
  if (window.matchMedia('(min-width: 1024px)').matches) return 24
  if (window.matchMedia('(min-width: 640px)').matches) return 18
  return 12
}

export default function usePageSize() {
  const [pageSize, setPageSize] = useState(resolvePageSize)

  useEffect(() => {
    const lg = window.matchMedia('(min-width: 1024px)')
    const sm = window.matchMedia('(min-width: 640px)')

    const update = () => setPageSize(resolvePageSize())

    lg.addEventListener('change', update)
    sm.addEventListener('change', update)
    return () => {
      lg.removeEventListener('change', update)
      sm.removeEventListener('change', update)
    }
  }, [])

  return pageSize
}
