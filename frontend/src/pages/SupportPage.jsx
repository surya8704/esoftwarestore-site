import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Mail, MapPin, MessageCircle } from 'lucide-react'
import { api, trackPage } from '../lib/api'
import {
  MAILTO_URL,
  SUPPORT_ADDRESS,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  WHATSAPP_URL,
} from '../lib/contact'
import SEO from '../components/SEO'

export default function SupportPage() {
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    trackPage('/support')
  }, [])

  const ask = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await api('/api/support/chat', { method: 'POST', body: JSON.stringify({ message }) })
      setReply(data.reply)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="store-container py-10 pb-28 lg:pb-10">
      <SEO title="Support" description="Installation guides, activation help, and customer support." />
      <h1 className="text-2xl font-extrabold text-store-heading">Guide & Support</h1>
      <p className="mt-2 text-sm text-store-muted">Installation guides sent by email. Contact us for activation help.</p>

      <div className="mt-6">
        <Link to="/guides" className="store-card inline-flex items-center gap-3 p-4 transition-shadow hover:shadow-md">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f97316]/10 text-[#f97316]">
            <BookOpen size={20} />
          </span>
          <span>
            <span className="block font-semibold text-store-heading">Browse activation guides</span>
            <span className="text-sm text-store-muted">Step-by-step Windows, Office, and design software help</span>
          </span>
        </Link>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <form onSubmit={ask} className="store-card p-6 md:p-8">
          <h2 className="font-semibold text-store-heading">Ask support</h2>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask about activation, refunds, delivery..."
            className="store-input mt-4 min-h-28"
          />
          <button disabled={loading} className="btn-store-primary mt-4">
            {loading ? 'Sending...' : 'Send message'}
          </button>
          {reply ? <div className="mt-4 rounded-xl bg-store-subtle p-4 text-sm text-store-body">{reply}</div> : null}
        </form>

        <div className="store-card bg-store-subtle p-6 md:p-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#f97316]">Contact us</h2>
          <p className="mt-3 text-sm leading-relaxed text-store-muted">
            Our team is available 24/7 for activation help, order issues, and refunds.
          </p>
          <ul className="mt-6 space-y-5 text-sm">
            <li>
              <p className="text-xs font-semibold uppercase tracking-wide text-store-muted">Email</p>
              <a
                href={MAILTO_URL}
                className="mt-1 inline-flex items-center gap-2 font-medium text-[#f97316] hover:underline"
              >
                <Mail size={16} /> {SUPPORT_EMAIL}
              </a>
            </li>
            <li>
              <p className="text-xs font-semibold uppercase tracking-wide text-store-muted">WhatsApp</p>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-2 font-medium text-[#f97316] hover:underline"
              >
                <MessageCircle size={16} /> {SUPPORT_PHONE}
              </a>
            </li>
            <li>
              <p className="text-xs font-semibold uppercase tracking-wide text-store-muted">Address</p>
              <p className="mt-1 inline-flex items-start gap-2 font-medium text-store-body">
                <MapPin size={16} className="mt-0.5 shrink-0 text-[#f97316]" />
                {SUPPORT_ADDRESS}
              </p>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
