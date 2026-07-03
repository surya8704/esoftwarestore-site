import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Calendar, ExternalLink } from 'lucide-react'
import { api, trackPage } from '../lib/api'
import { findGuideBySlug, getInstantGuides, prefetchStaticGuides } from '../lib/guides'
import SEO from '../components/SEO'
import GuideCard from '../components/GuideCard'

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function GuidePage() {
  const { slug } = useParams()
  const [data, setData] = useState(() => {
    const guide = findGuideBySlug(slug)
    return guide ? { guide, related: [] } : null
  })

  useEffect(() => {
    trackPage(`/guides/${slug}`)
    const cached = findGuideBySlug(slug)
    if (cached) setData({ guide: cached, related: [] })

    let cancelled = false
    api(`/api/guides/${slug}`)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(async () => {
        if (!cancelled && !cached) {
          await prefetchStaticGuides()
          const guide = findGuideBySlug(slug)
          if (guide) setData({ guide, related: [] })
        }
      })

    return () => { cancelled = true }
  }, [slug])

  if (!data?.guide) {
    return (
      <div className="store-container py-20 text-center">
        <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-[#f97316]/20" />
        <p className="mt-4 text-store-muted">Loading guide...</p>
      </div>
    )
  }

  const { guide, related } = data
  const relatedGuides = related?.length
    ? related
    : getInstantGuides()
        .filter((g) => g.slug !== guide.slug)
        .filter((g) => g.categories?.some((c) => guide.categories?.includes(c)))
        .slice(0, 3)

  return (
    <>
      <SEO
        title={guide.title}
        description={guide.excerpt}
        path={`/guides/${slug}`}
      />

      <article className="store-container py-6 pb-28 lg:pb-10">
        <div className="mb-6 text-sm text-store-muted">
          <Link to="/guides" className="font-medium hover:text-[#f97316]">← Back to guides</Link>
        </div>

        <header className="max-w-3xl">
          {guide.categories?.[0] ? (
            <p className="text-xs font-bold uppercase tracking-wider text-[#f97316]">{guide.categories[0]}</p>
          ) : null}
          <h1 className="mt-2 text-2xl font-extrabold leading-tight text-store-heading md:text-4xl">{guide.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-store-muted">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={15} />
              {formatDate(guide.publishedAt)}
            </span>
            {guide.sourceUrl ? (
              <a
                href={guide.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#f97316] hover:underline"
              >
                View original <ExternalLink size={14} />
              </a>
            ) : null}
          </div>
        </header>

        {guide.imageUrl ? (
          <div className="mt-8 overflow-hidden rounded-2xl border border-store">
            <img src={guide.imageUrl} alt={guide.title} className="w-full max-h-[420px] object-cover" />
          </div>
        ) : null}

        <div
          className="guide-content prose-store mt-8 max-w-3xl"
          dangerouslySetInnerHTML={{ __html: guide.contentHtml ?? `<p>${guide.excerpt}</p>` }}
        />

        <div className="mt-10 max-w-3xl store-card bg-store-subtle p-6">
          <h2 className="font-semibold text-store-heading">Need more help?</h2>
          <p className="mt-2 text-sm text-store-muted">
            Our support team can help with activation, refunds, and order issues.
          </p>
          <Link to="/support" className="btn-store-primary mt-4 inline-flex">
            Contact support
          </Link>
        </div>

        {relatedGuides.length > 0 ? (
          <section className="mt-14 border-t border-store pt-10">
            <h2 className="text-xl font-extrabold text-store-heading">Related guides</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedGuides.map((g) => (
                <GuideCard key={g.slug} guide={g} compact />
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </>
  )
}
