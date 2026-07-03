import { Link } from 'react-router-dom'
import { Calendar } from 'lucide-react'

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function GuideCard({ guide, compact = false }) {
  return (
    <article className="store-card group flex h-full flex-col overflow-hidden">
      <Link to={`/guides/${guide.slug}`} className="relative block aspect-[16/9] overflow-hidden bg-store-hover">
        {guide.imageUrl ? (
          <img
            src={guide.imageUrl}
            alt={guide.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#1e3a5f] to-[#2d4a73] px-6 text-center text-sm font-semibold text-white">
            {guide.categories?.[0] ?? 'Guide'}
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4 md:p-5">
        {guide.categories?.[0] ? (
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#f97316]">{guide.categories[0]}</p>
        ) : null}
        <Link to={`/guides/${guide.slug}`}>
          <h3 className={`mt-1 font-bold leading-snug text-store-heading transition-colors hover:text-[#f97316] ${compact ? 'text-sm line-clamp-2' : 'text-base line-clamp-3 md:text-lg'}`}>
            {guide.title}
          </h3>
        </Link>
        {!compact ? (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-store-muted">{guide.excerpt}</p>
        ) : null}
        <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-store-muted">
          <Calendar size={14} />
          <span>{formatDate(guide.publishedAt)}</span>
        </div>
      </div>
    </article>
  )
}
