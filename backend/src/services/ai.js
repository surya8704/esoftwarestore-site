import { config } from '../config.js'

const FAQ_CONTEXT = `
You are the friendly support assistant for eSoftware Store (esoftwarestore.com).
eSoftware Store sells genuine software licenses, ebooks, and digital products at discount prices with instant email delivery.

Key policies:
- Digital delivery only — license keys and download links sent by email within minutes after payment
- Orders also visible on the customer's account page under "My Account" > Orders
- 30-day money-back guarantee on unactivated licenses
- All products are genuine and sourced from reputable distributors
- Support available 24/7 via email (info@esoftwarestore.com) and WhatsApp (+447520642304)
- For activation: use the key from the order email at the official vendor download/activation page
- Refunds: contact support with order number; unactivated licenses qualify within 30 days
- Payment: secure checkout via Razorpay; confirmation code provided after purchase

Be concise, helpful, and professional. Use short paragraphs. If you cannot help, direct users to email info@esoftwarestore.com or the Support page.
`

const FAQ_RULES = [
  {
    match: (m) => /refund|money.?back|return/i.test(m),
    reply:
      'We offer a 30-day money-back guarantee on unactivated licenses. Email info@esoftwarestore.com with your order number and we\'ll assist you promptly.',
  },
  {
    match: (m) => /activat|license.?key|product.?key|serial/i.test(m),
    reply:
      'Your license key is in the order confirmation email. Open the official download link from that email, install the software, and enter the key when prompted. You can also find keys under My Account → Orders.',
  },
  {
    match: (m) => /deliver|download|email|when.*(get|receive)/i.test(m),
    reply:
      'Delivery is instant and digital — after payment, your license key and download instructions are sent to your email within minutes. Check spam/junk if you don\'t see it. Orders also appear in My Account.',
  },
  {
    match: (m) => /order|track|status|where.*(order|purchase)/i.test(m),
    reply:
      'Sign in at My Account → Orders to view order history, confirmation codes, and license keys. Use the same email you entered at checkout.',
  },
  {
    match: (m) => /payment|pay|razorpay|checkout|failed/i.test(m),
    reply:
      'We use secure Razorpay checkout. If payment failed, try again or use a different method. Once paid, you\'ll receive a confirmation code and license key by email. Contact us with your order email if issues persist.',
  },
  {
    match: (m) => /genuine|legit|authentic|real|fake/i.test(m),
    reply:
      'All products on eSoftware Store are genuine, legal licenses sourced from reputable distributors. We\'ve served thousands of customers with instant digital delivery.',
  },
  {
    match: (m) => /whatsapp|contact|human|agent|speak|call/i.test(m),
    reply:
      'Reach our team 24/7 via email at info@esoftwarestore.com or WhatsApp at +447520642304. Share your order number for faster help. You can also visit our Support page for guides.',
  },
  {
    match: (m) => /price|discount|coupon|cheap/i.test(m),
    reply:
      'We offer genuine software at competitive discount prices — often lower than retail. Browse our catalog on the homepage and apply coupon codes at checkout if you have one.',
  },
  {
    match: (m) => /hello|hi|hey|good\s*(morning|afternoon|evening)/i.test(m),
    reply:
      'Hello! Welcome to eSoftware Store support. I can help with activation, orders, delivery, and refunds. What do you need help with?',
  },
]

function getFaqReply(message) {
  const rule = FAQ_RULES.find((r) => r.match(message))
  if (rule) return rule.reply
  return 'Thanks for reaching out! For personalized help, email info@esoftwarestore.com or WhatsApp +447520642304 — include your order number if you have one. You can also visit our Support page for guides.'
}

export async function getAiSupportReply(message, history = [], context = FAQ_CONTEXT) {
  if (!config.openaiApiKey) {
    return getFaqReply(message)
  }

  const historyMessages = history.slice(-6).map((m) => ({
    role: m.role === 'bot' ? 'assistant' : 'user',
    content: m.text,
  }))

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: context },
        ...historyMessages,
        { role: 'user', content: message },
      ],
      max_tokens: 350,
    }),
  })

  const data = await response.json()
  return data.choices?.[0]?.message?.content ?? getFaqReply(message)
}

export function getTelephonicActivationScript(orderId) {
  return {
    steps: [
      'Press 1 to hear your license key',
      'Press 2 for activation guide',
      'Press 3 to connect to support',
    ],
    licensePlayback: `Your order ${orderId} license will be read after verification.`,
  }
}
