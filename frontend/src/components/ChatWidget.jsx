import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot,
  ChevronDown,
  ExternalLink,
  Headphones,
  LoaderCircle,
  Mail,
  MessageCircle,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import { api } from '../lib/api'
import {
  MAILTO_URL,
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  WHATSAPP_URL,
} from '../lib/contact'

const QUICK_PROMPTS = [
  { label: 'Activate license', message: 'How do I activate my license key?' },
  { label: 'Order status', message: 'Where can I find my order and license keys?' },
  { label: 'Delivery time', message: 'How long does digital delivery take?' },
  { label: 'Refund policy', message: 'What is your refund policy?' },
]

const WELCOME = {
  role: 'bot',
  text: 'Hi! Welcome to eSoftware Store support. I can help with activation, orders, delivery, and refunds. Pick a topic below or type your question.',
  time: Date.now(),
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function ChatBubble({ message }) {
  const isBot = message.role === 'bot'
  return (
    <div className={`flex gap-2 ${isBot ? '' : 'flex-row-reverse'}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isBot ? 'bg-gradient-to-br from-[#1e3a5f] to-[#2d4a73] text-white' : 'bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white'
        }`}
      >
        {isBot ? <Bot size={14} /> : <User size={14} />}
      </div>
      <div className={`max-w-[85%] ${isBot ? '' : 'text-right'}`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isBot
              ? 'rounded-tl-sm bg-store-hover text-store-body'
              : 'rounded-tr-sm bg-store-primary-muted text-store-body'
          }`}
        >
          {message.text}
        </div>
        {message.time ? (
          <p className={`mt-1 text-[10px] text-store-muted ${isBot ? '' : 'text-right'}`}>
            {formatTime(message.time)}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([WELCOME])
  const [unread, setUnread] = useState(0)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    })
  }, [])

  useEffect(() => {
    if (open && !minimized) scrollToBottom()
  }, [messages, open, minimized, loading, scrollToBottom])

  useEffect(() => {
    if (open && !minimized) {
      setUnread(0)
      inputRef.current?.focus()
    }
  }, [open, minimized])

  const sendMessage = async (text) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg = { role: 'user', text: trimmed, time: Date.now() }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setMessage('')
    setLoading(true)

    try {
      const history = nextMessages
        .slice(0, -1)
        .map(({ role, text: t }) => ({ role, text: t }))

      const data = await api('/api/support/chat', {
        method: 'POST',
        body: JSON.stringify({ message: trimmed, history }),
      })
      const botMsg = { role: 'bot', text: data.reply, time: Date.now() }
      setMessages((m) => [...m, botMsg])
      if (!open || minimized) setUnread((n) => n + 1)
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'bot',
          text: `Sorry, I couldn't connect right now. Email us at ${SUPPORT_EMAIL} or WhatsApp ${SUPPORT_PHONE_DISPLAY} for immediate help.`,
          time: Date.now(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(message)
  }

  const openChat = () => {
    setOpen(true)
    setMinimized(false)
    setUnread(0)
  }

  return (
    <div className="chat-widget-anchor">
      {open && !minimized ? (
        <div
          className="flex w-[min(100vw-2rem,380px)] max-h-[min(32rem,calc(100dvh-11rem))] flex-col overflow-hidden rounded-2xl border border-store bg-store-surface shadow-2xl animate-fade-in-up"
          role="dialog"
          aria-label="Support chat"
        >
          {/* Header */}
          <div className="relative overflow-hidden bg-gradient-to-r from-[#1e3a5f] via-[#2d4a73] to-[#1e3a5f] px-4 py-4 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(249,115,22,0.2),transparent_50%)]" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                  <Headphones size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold">
                    e<span className="text-[#fbbf24]">Software</span> Support
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/80">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#4ade80]" />
                    Online — replies instantly
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setMinimized(true)}
                  className="rounded-full p-1.5 hover:bg-white/10 transition-colors"
                  aria-label="Minimize chat"
                >
                  <ChevronDown size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1.5 hover:bg-white/10 transition-colors"
                  aria-label="Close chat"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="relative mt-3 flex flex-wrap gap-1.5">
              <span className="trust-pill text-[11px] text-white/90">
                <Sparkles size={10} /> 24/7 support
              </span>
              <span className="trust-pill text-[11px] text-white/90">
                Instant delivery help
              </span>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex max-h-72 flex-col gap-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <ChatBubble key={`${m.time}-${i}`} message={m} />
            ))}
            {loading ? (
              <div className="flex items-center gap-2 text-store-muted">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-store-hover">
                  <Bot size={14} />
                </div>
                <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-store-hover px-4 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#f97316] [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#f97316] [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#f97316] [animation-delay:300ms]" />
                </div>
              </div>
            ) : null}
          </div>

          {/* Quick prompts */}
          {messages.length <= 1 && !loading ? (
            <div className="flex flex-wrap gap-2 border-t border-store px-4 py-3">
              {QUICK_PROMPTS.map(({ label, message: prompt }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="rounded-full border border-store bg-store-subtle px-3 py-1.5 text-xs font-semibold text-store-body transition-colors hover:border-[#f97316] hover:bg-store-primary-muted hover:text-[#f97316]"
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t border-store bg-store-subtle p-3">
            <div className="flex items-end gap-2">
              <input
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask about activation, orders..."
                className="store-input flex-1 py-2.5 text-sm"
                disabled={loading}
                aria-label="Message support"
              />
              <button
                type="submit"
                disabled={loading || !message.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white shadow-md transition-opacity hover:brightness-105 disabled:opacity-40"
                aria-label="Send message"
              >
                {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </form>

          {/* Footer links */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-store px-4 py-2.5 text-xs">
            <div className="flex gap-3">
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex items-center gap-1 text-store-muted hover:text-[#f97316] transition-colors"
              >
                <Mail size={12} /> Email
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-store-muted hover:text-[#f97316] transition-colors"
              >
                <MessageCircle size={12} /> WhatsApp
              </a>
            </div>
            <Link
              to="/support"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 font-semibold text-[#f97316] hover:underline"
            >
              Help center <ExternalLink size={11} />
            </Link>
          </div>
        </div>
      ) : null}

      {(!open || minimized) ? (
        <button
          type="button"
          onClick={openChat}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white shadow-lg transition-transform hover:scale-105 hover:shadow-xl"
          aria-label="Chat with support"
        >
          <MessageCircle size={22} />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1e3a5f] text-[10px] font-bold text-white ring-2 ring-store-surface">
              {unread}
            </span>
          ) : null}
          <span className="pointer-events-none absolute -top-10 right-0 whitespace-nowrap rounded-full bg-store-heading px-3 py-1 text-xs font-semibold text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100">
            Need help?
          </span>
        </button>
      ) : null}
    </div>
  )
}
