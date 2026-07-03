import { EmailLog } from '../db/models.js'
import { config } from '../config.js'

export async function sendWhatsAppMessage({ to, message }) {
  if (!config.whatsappToken || !config.whatsappPhoneId) {
    console.log(`[whatsapp] → ${to}: ${message}`)
    return { status: 'logged' }
  }
  const response = await fetch(`https://graph.facebook.com/v19.0/${config.whatsappPhoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.whatsappToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace(/\D/g, ''), type: 'text', text: { body: message } }),
  })
  return { status: response.ok ? 'sent' : 'failed' }
}

export async function sendOrderWhatsApp({ phone, order, confirmationCode, licenseKey }) {
  if (!phone) return { status: 'skipped' }
  const message = `eSoftware Store: Order confirmed (${confirmationCode}). License: ${licenseKey}. Support: ${config.clientUrl}/support`
  return sendWhatsAppMessage({ to: phone, message })
}

export async function trackEmailOpen(logId) {
  await EmailLog.findByIdAndUpdate(logId, { opened: true })
}
