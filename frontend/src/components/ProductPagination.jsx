import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages = new Set([1, total, current, current - 1, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const result = []

  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('…')
    result.push(sorted[i])
  }

  return result
}

export default function ProductPagination({ page, totalPages, total, from, to, onPageChange }) {
  const { t } = useTranslation()

  if (totalPages <= 1) return null

  const pages = pageNumbers(page, totalPages)

  return (
    <nav className="pagination-bar mt-10" aria-label="Product pages">
      <p className="pagination-summary text-sm text-store-muted">
        {t('showingRange', { from, to, total })}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="pagination-btn"
          aria-label={t('previousPage')}
        >
          <ChevronLeft size={18} />
          <span className="hidden sm:inline">{t('previousPage')}</span>
        </button>

        <div className="flex items-center gap-0.5 px-1">
          {pages.map((item, index) =>
            item === '…' ? (
              <span key={`ellipsis-${index}`} className="px-2 text-store-muted">…</span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                className={`pagination-page ${page === item ? 'active' : ''}`}
                aria-label={t('pageNumber', { page: item })}
                aria-current={page === item ? 'page' : undefined}
              >
                {item}
              </button>
            ),
          )}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="pagination-btn"
          aria-label={t('nextPage')}
        >
          <span className="hidden sm:inline">{t('nextPage')}</span>
          <ChevronRight size={18} />
        </button>
      </div>

      <p className="pagination-summary text-sm font-medium text-store-muted sm:hidden">
        {t('pageOf', { page, total: totalPages })}
      </p>
    </nav>
  )
}
