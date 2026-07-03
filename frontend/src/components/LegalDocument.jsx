import { Link, useLocation } from 'react-router-dom'
import SEO from './SEO'

export default function LegalDocument({ title, description, sections, updated }) {
  const location = useLocation()

  return (
    <div className="store-container py-10 pb-28 lg:pb-10">
      <SEO title={title} description={description} path={location.pathname} />
      <header className="max-w-3xl">
        <h1 className="text-2xl font-extrabold text-store-heading md:text-3xl">{title}</h1>
        {updated ? <p className="mt-2 text-sm text-store-muted">Last updated: {updated}</p> : null}
      </header>

      <div className="prose-store mt-8 max-w-3xl space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-bold text-store-heading">{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-sm leading-relaxed text-store-body md:text-base">
                {paragraph}
                {section.links?.length ? (
                  <>
                    {' '}
                    {section.links.map((link, index) => (
                      <span key={link.to}>
                        {index > 0 ? ', ' : ''}
                        <Link to={link.to} className="font-medium text-[#f97316] hover:underline">
                          {link.label}
                        </Link>
                      </span>
                    ))}
                    .
                  </>
                ) : null}
              </p>
            ))}
            {section.list?.length ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-store-body md:text-base">
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  )
}
