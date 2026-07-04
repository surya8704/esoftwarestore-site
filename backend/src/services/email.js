import { EmailLog } from '../db/models.js'
import { config } from '../config.js'

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildLicenseKeyText({ order, items, confirmationCode, customMessage }) {
  const orderRef = String(order.id ?? order._id ?? 'order').slice(-8).toUpperCase()
  const lines = [
    'eSoftware Store — Product License Keys',
    '=====================================',
    '',
    `Order reference: #${orderRef}`,
    `Confirmation code: ${confirmationCode ?? 'N/A'}`,
    `Customer: ${order.customerEmail ?? ''}`,
    `Date: ${new Date().toISOString()}`,
    '',
  ]

  if (customMessage?.trim()) {
    lines.push('Message from support:', customMessage.trim(), '')
  }

  for (const item of items.filter((i) => i.licenseKey)) {
    lines.push(`Product: ${item.productName}`)
    lines.push(`Activation code: ${item.licenseKey}`)
    if (item.deliveryDescription) lines.push(`Description: ${item.deliveryDescription}`)
    for (const att of item.deliveryAttachments ?? []) {
      if (att.url) lines.push(`${att.label || att.type}: ${att.url}`)
      else if (att.filename) lines.push(`Attachment: ${att.filename}`)
    }
    if (item.downloadUrl && !(item.deliveryAttachments ?? []).some((a) => a.url === item.downloadUrl)) {
      lines.push(`Download link: ${item.downloadUrl}`)
    }
    lines.push('')
  }

  lines.push('Keep this file secure. Do not share your license keys with others.')
  return { text: lines.join('\n'), orderRef }
}

export function buildLicenseAttachments({ order, items, confirmationCode, customMessage }) {
  const { text, orderRef } = buildLicenseKeyText({ order, items, confirmationCode, customMessage })
  const attachments = [
    {
      filename: `License-Keys-Order-${orderRef}.txt`,
      content: Buffer.from(text, 'utf8').toString('base64'),
      contentType: 'text/plain',
    },
  ]

  const withDownloads = items.filter((i) => i.downloadUrl)
  if (withDownloads.length) {
    const linkLines = [
      'eSoftware Store — Download Links',
      '================================',
      '',
      ...withDownloads.flatMap((item) => [
        item.productName,
        item.downloadUrl,
        '',
      ]),
    ]
    attachments.push({
      filename: `Download-Links-Order-${orderRef}.txt`,
      content: Buffer.from(linkLines.join('\n'), 'utf8').toString('base64'),
      contentType: 'text/plain',
    })
  }

  return attachments
}

async function fetchRemoteAttachment(url, suggestedName) {
  if (!url?.startsWith('http')) return null
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': 'eSoftwareStore/1.0' },
    })
    if (!response.ok) return null

    const buffer = Buffer.from(await response.arrayBuffer())
    if (!buffer.length || buffer.length > MAX_ATTACHMENT_BYTES) return null

    const fromUrl = url.split('/').pop()?.split('?')[0]
    const filename = suggestedName || fromUrl || 'software-download.bin'
    const contentType = response.headers.get('content-type') ?? undefined

    return {
      filename: filename.slice(0, 120),
      content: buffer.toString('base64'),
      contentType,
    }
  } catch {
    return null
  }
}

export async function buildItemDeliveryAttachments(items) {
  const attachments = []
  const seen = new Set()

  const pushUnique = (entry) => {
    const key = `${entry.filename}:${entry.content?.slice(0, 32)}`
    if (seen.has(key)) return
    seen.add(key)
    attachments.push(entry)
  }

  for (const item of items) {
    for (const att of item.deliveryAttachments ?? []) {
      if (att.type === 'file' && att.content) {
        pushUnique({
          filename: att.filename || `${item.productName}-file`.replace(/[^\w.-]/g, '_').slice(0, 40),
          content: att.content,
          contentType: att.contentType,
        })
        continue
      }

      if (!att.url?.startsWith('http')) continue

      if (att.type === 'link') {
        continue
      }

      if (att.type === 'image' || att.type === 'video') {
        const ext = att.type === 'image' ? 'jpg' : 'mp4'
        const remote = await fetchRemoteAttachment(
          att.url,
          att.filename || `${item.productName}-${att.type}.${ext}`.replace(/[^\w.-]/g, '_').slice(0, 50),
        )
        if (remote) {
          pushUnique(remote)
        }
        continue
      }

      const urlExt = att.url.split('.').pop()?.split('?')[0]?.toLowerCase()
      const isFile = ['exe', 'zip', 'msi', 'dmg', 'pkg', 'rar', '7z', 'iso', 'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov'].includes(urlExt ?? '')
      if (isFile) {
        const remote = await fetchRemoteAttachment(att.url, att.filename || att.label)
        if (remote) pushUnique(remote)
      }
    }

    if (item.downloadUrl?.startsWith('http')) {
      const ext = item.downloadUrl.split('.').pop()?.split('?')[0]?.toLowerCase()
      const isFile = ['exe', 'zip', 'msi', 'dmg', 'pkg', 'rar', '7z', 'iso', 'pdf'].includes(ext ?? '')
      if (isFile) {
        const remote = await fetchRemoteAttachment(item.downloadUrl, `${item.productName}.${ext}`.replace(/[^\w.-]/g, '_'))
        if (remote) pushUnique(remote)
      }
    }
  }

  return attachments
}

export async function buildProductFileAttachments(items) {
  return buildItemDeliveryAttachments(items)
}

export async function sendEmail({
  to,
  subject,
  template,
  html,
  metadata = {},
  attachments = [],
  required = false,
}) {
  if (!config.resendApiKey) {
    const message = 'Email service is not configured. Set RESEND_API_KEY on the server.'
    await EmailLog.create({
      toEmail: to,
      subject,
      template,
      status: 'failed',
      metadata: JSON.stringify({ ...metadata, error: message }),
    })
    if (required) {
      const err = new Error(message)
      err.code = 'EMAIL_NOT_CONFIGURED'
      throw err
    }
    console.log(`[email:${template}] → ${to}: ${subject} (no RESEND_API_KEY)`)
    return { status: 'logged', error: message }
  }

  const payload = {
    from: config.emailFrom,
    to: [to],
    subject,
    html,
  }

  if (attachments.length) {
    payload.attachments = attachments.map(({ filename, content, contentType }) => ({
      filename,
      content,
      ...(contentType ? { content_type: contentType } : {}),
    }))
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  const status = response.ok ? 'sent' : 'failed'
  const errorMessage = data.message ?? data.error ?? (response.ok ? null : `Email provider error (${response.status})`)

  await EmailLog.create({
    toEmail: to,
    subject,
    template,
    status,
    metadata: JSON.stringify({
      ...metadata,
      resendId: data.id ?? null,
      error: errorMessage,
      attachmentCount: attachments.length,
    }),
  })

  if (!response.ok) {
    if (required) {
      const err = new Error(errorMessage ?? 'Failed to send email')
      err.code = 'EMAIL_SEND_FAILED'
      throw err
    }
    console.error(`[email:${template}] failed → ${to}:`, errorMessage)
    return { status: 'failed', error: errorMessage }
  }

  return { status: 'sent', id: data.id }
}

export function orderDeliveryEmail({ order, items, confirmationCode, customMessage }) {
  const itemBlocks = items
    .map((item) => {
      const attachmentLines = (item.deliveryAttachments ?? [])
        .filter((att) => att.url)
        .map((att) => {
          const label = escapeHtml(att.label || att.type)
          if (att.type === 'video') {
            return `<li><a href="${escapeHtml(att.url)}" style="color:#f97316">${label} (video)</a></li>`
          }
          if (att.type === 'image') {
            return `<li><a href="${escapeHtml(att.url)}" style="color:#f97316">${label} (image)</a></li>`
          }
          return `<li><a href="${escapeHtml(att.url)}" style="color:#f97316">${label}</a></li>`
        })
        .join('')

      const desc = item.deliveryDescription?.trim()
        ? `<p style="margin:8px 0;color:#475569;font-size:14px">${escapeHtml(item.deliveryDescription.trim())}</p>`
        : ''

      const attachmentsBlock = attachmentLines
        ? `<ul style="margin:8px 0 0;padding-left:18px;font-size:14px">${attachmentLines}</ul>`
        : ''

      return `<li style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e5e7eb">
        <strong>${escapeHtml(item.productName)}</strong>
        ${desc}
        <p style="margin:8px 0">Activation code: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">${escapeHtml(item.licenseKey ?? 'Processing')}</code></p>
        ${attachmentsBlock}
      </li>`
    })
    .join('')

  const messageBlock = customMessage?.trim()
    ? `<div style="background:#fff7ed;border-left:4px solid #f97316;padding:12px 16px;border-radius:8px;margin-bottom:20px;white-space:pre-wrap">${escapeHtml(customMessage.trim())}</div>`
    : ''

  return `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <h1 style="color:#1e3a5f">Thank you for your purchase</h1>
    ${messageBlock}
    <p>Confirmation: <strong>${escapeHtml(confirmationCode)}</strong></p>
    <p>Order #${escapeHtml(String(order.id ?? order._id).slice(-8).toUpperCase())}</p>
    <ul style="padding-left:20px;list-style:none">${itemBlocks}</ul>
    <p style="color:#64748b;font-size:14px;margin-top:24px">License details and files are attached to this email.</p>
  </div>`
}

export async function sendOrderDeliveryEmail({ order, items, confirmationCode }) {
  const keyedItems = items.filter((i) => i.licenseKey)
  const attachments = [
    ...buildLicenseAttachments({ order, items: keyedItems, confirmationCode }),
    ...(await buildItemDeliveryAttachments(keyedItems)),
  ]
  const html = orderDeliveryEmail({ order, items: keyedItems, confirmationCode })
  return sendEmail({
    to: order.customerEmail,
    subject: 'Your eSoftware Store order — License delivered',
    template: 'order_delivery',
    html,
    attachments,
    metadata: { orderId: order._id?.toString?.() ?? order.id, confirmationCode },
  })
}

export async function sendAdminKeyDeliveryEmail({ order, items, confirmationCode, customMessage }) {
  const keyedItems = items.filter((i) => i.licenseKey)
  if (!keyedItems.length) {
    const err = new Error('No license keys to send')
    err.code = 'NO_KEYS'
    throw err
  }

  const attachments = [
    ...buildLicenseAttachments({ order, items: keyedItems, confirmationCode, customMessage }),
    ...(await buildItemDeliveryAttachments(keyedItems)),
  ]
  const html = orderDeliveryEmail({ order, items: keyedItems, confirmationCode, customMessage })
  const orderRef = String(order.id ?? order._id ?? '').slice(-8).toUpperCase()

  return sendEmail({
    to: order.customerEmail,
    subject: `Your product key — Order #${orderRef}`,
    template: 'admin_key_delivery',
    html,
    attachments,
    required: true,
    metadata: { orderId: order._id?.toString?.() ?? order.id, confirmationCode, source: 'admin' },
  })
}

export async function sendAbandonedCartEmail({ email, cartId, stage, couponCode }) {
  const subjects = ['You left something behind', 'Still thinking? Here is 10% off', 'Last chance — your cart expires soon']
  const html = `<div><h2>${subjects[stage] ?? subjects[0]}</h2><p>${couponCode ? `Use code <strong>${couponCode}</strong>.` : ''}</p><a href="${config.clientUrl}/checkout?cart=${cartId}">Resume checkout</a></div>`
  return sendEmail({ to: email, subject: subjects[stage] ?? subjects[0], template: `abandoned_cart_${stage}`, html, metadata: { cartId, stage } })
}

export async function sendNewsletterWelcome({ email }) {
  return sendEmail({ to: email, subject: 'Welcome to eSoftware Store', template: 'newsletter_welcome', html: '<p>Thanks for subscribing.</p>' })
}
