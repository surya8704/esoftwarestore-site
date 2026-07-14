import { useEffect, useState } from 'react'
import { api } from './api'

/**
 * Load a CMS legal page from the API, falling back to bundled defaults.
 */
export function useLegalPage(key, fallback) {
  const [page, setPage] = useState(() => ({
    title: fallback.title,
    description: fallback.description,
    updatedLabel: fallback.updated,
    sections: fallback.sections,
  }))

  useEffect(() => {
    let cancelled = false
    api(`/api/pages/${key}`)
      .then((data) => {
        if (cancelled || !data?.page) return
        setPage({
          title: data.page.title || fallback.title,
          description: data.page.description || fallback.description,
          updatedLabel: data.page.updatedLabel || fallback.updated,
          sections: data.page.sections?.length ? data.page.sections : fallback.sections,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // fallback is a stable module-level object per page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return page
}
