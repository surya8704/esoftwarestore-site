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

  if (config.resendSandbox && config.resendAccountEmail) {
    const allowed = config.resendAccountEmail.trim().toLowerCase()
    const recipient = String(to).trim().toLowerCase()
    if (recipient !== allowed) {
      const message = `Resend sandbox only allows sending to ${config.resendAccountEmail}. Verify esoftwarestore.com at https://resend.com/domains and set RESEND_SANDBOX=false on the server to email customers.`
      await EmailLog.create({
        toEmail: to,
        subject,
        template,
        status: 'failed',
        metadata: JSON.stringify({ ...metadata, error: message, sandbox: true }),
      })
      if (required) {
        const err = new Error(message)
        err.code = 'EMAIL_SANDBOX_RECIPIENT'
        throw err
      }
      return { status: 'failed', error: message }
    }
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
  let errorMessage = data.message ?? data.error ?? (response.ok ? null : `Email provider error (${response.status})`)

  if (!response.ok && errorMessage) {
    if (String(errorMessage).includes('domain is not verified')) {
      errorMessage = `${errorMessage} Verify your domain at https://resend.com/domains and set EMAIL_FROM to an address on that domain. For local testing only, set RESEND_SANDBOX=true (sends from onboarding@resend.dev to your Resend account email).`
    }
    if (String(errorMessage).includes('only send testing emails to your own email')) {
      const hint = config.resendAccountEmail
        ? ` Sandbox mode only allows sending to ${config.resendAccountEmail}.`
        : ' Set RESEND_ACCOUNT_EMAIL to your Resend login email, or verify your domain to email customers.'
      errorMessage = `${errorMessage}${hint}`
    }
  }

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

export async function sendAbandonedCartEmail({
  email,
  cartId,
  stage,
  items = [],
  subtotal = 0,
  currency = 'INR',
}) {
  const subjects = [
    'You left something in your cart',
    'Still thinking about your cart?',
    'Last chance — finish your order before it expires',
  ]
  const headlines = [
    'Your licenses are waiting',
    'Complete your order anytime',
    'Last reminder before your cart expires',
  ]
  const intros = [
    'You added items to your cart on eSoftware Store but didn’t finish checkout. Resume anytime — delivery is instant after payment.',
    'Your cart is still waiting. Complete checkout in minutes and we’ll email your license keys right away.',
    'This is your final reminder. Finish checkout now to receive your license keys by email right away.',
  ]

  const subject = subjects[stage] ?? subjects[0]
  const resumeParams = new URLSearchParams()
  resumeParams.set('utm_source', 'abandoned_cart')
  resumeParams.set('utm_campaign', `stage_${stage}`)
  const resumeUrl = `${config.clientUrl}/checkout?${resumeParams}`

  const currencyCode = currency || 'INR'
  const itemRows = (items || [])
    .map((item) => {
      const name = escapeHtml(item.name)
      const qty = Number(item.quantity) || 1
      const line = Number(item.lineTotal ?? item.unitPrice ?? 0)
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:14px;color:#0f172a;">
          <strong>${name}</strong><br/><span style="color:#64748b;">Qty ${qty}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;font-family:Arial,sans-serif;font-size:14px;color:#0f172a;">
          ${escapeHtml(currencyCode)} ${line.toLocaleString()}
        </td>
      </tr>`
    })
    .join('')

  const html = `<div style="max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
      <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#f97316;">eSoftware Store</p>
      <h1 style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:22px;line-height:1.3;color:#0f172a;">${escapeHtml(headlines[stage] ?? headlines[0])}</h1>
      <p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#475569;">${escapeHtml(intros[stage] ?? intros[0])}</p>
      ${itemRows ? `<table style="width:100%;border-collapse:collapse;margin:0 0 8px;">${itemRows}</table>
      <p style="margin:12px 0 0;text-align:right;font-family:Arial,sans-serif;font-size:15px;color:#0f172a;"><strong>Subtotal: ${escapeHtml(currencyCode)} ${Number(subtotal || 0).toLocaleString()}</strong></p>` : ''}
      <p style="margin:24px 0 0;">
        <a href="${escapeHtml(resumeUrl)}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;font-weight:700;padding:12px 22px;border-radius:999px;">Resume checkout</a>
      </p>
      <p style="margin:18px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;">If you already completed your order, you can ignore this email.</p>
    </div>
  </div>`

  return sendEmail({
    to: email,
    subject,
    template: `abandoned_cart_${stage}`,
    html,
    metadata: { cartId: String(cartId), stage, itemCount: items?.length ?? 0 },
  })
}

export async function sendNewsletterWelcome({ email }) {
  return sendEmail({ to: email, subject: 'Welcome to eSoftware Store', template: 'newsletter_welcome', html: '<p>Thanks for subscribing.</p>' })
}
