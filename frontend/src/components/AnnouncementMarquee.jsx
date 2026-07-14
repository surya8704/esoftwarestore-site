import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Megaphone } from 'lucide-react'
import { api } from '../lib/api'

function AnnouncementItem({ item }) {
  const text = (
    <span className="inline-flex items-center gap-2 whitespace-nowrap px-6 text-sm">
      <span className="font-semibold text-[#fbbf24]">{item.title}</span>
      <span className="text-white/90">{item.message}</span>
      {item.linkUrl ? (
        <span className="font-semibold text-white underline decoration-white/40 underline-offset-2">
          {item.linkLabel || 'Learn more'}
        </span>
      ) : null}
    </span>
  )

  if (item.linkUrl?.startsWith('/')) {
    return (
      <Link to={item.linkUrl} className="hover:opacity-90">
        {text}
      </Link>
    )
  }
  if (item.linkUrl) {
    return (
      <a href={item.linkUrl} target="_blank" rel="noreferrer" className="hover:opacity-90">
        {text}
      </a>
    )
  }
  return text
}

export default function AnnouncementMarquee() {
  const [announcements, setAnnouncements] = useState([])

  useEffect(() => {
    let cancelled = false
    api('/api/announcements')
      .then((data) => {
        if (!cancelled) setAnnouncements(data.announcements ?? [])
      })
      .catch(() => {
        if (!cancelled) setAnnouncements([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!announcements.length) return null

  // Duplicate content so the CSS loop scrolls continuously without a gap
  const track = [...announcements, ...announcements]

  return (
    <div className="announcement-marquee border-b border-white/10 bg-[#0f2744] text-white" role="region" aria-label="Latest announcements">
      <div className="flex items-stretch">
        <div className="hidden shrink-0 items-center gap-2 border-r border-white/10 bg-[#163556] px-4 text-xs font-bold uppercase tracking-wide text-[#fbbf24] sm:flex">
          <Megaphone size={14} />
          News
        </div>
        <div className="announcement-marquee-viewport min-w-0 flex-1 overflow-hidden py-2.5">
          <div className="announcement-marquee-track">
            {track.map((item, index) => (
              <span key={`${item.id}-${index}`} className="inline-flex items-center">
                <AnnouncementItem item={item} />
                <span className="text-white/25" aria-hidden>
                  •
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
