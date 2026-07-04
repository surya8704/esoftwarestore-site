import { EmailLog } from '../db/models.js'
import { config } from '../config.js'

export async function sendEmail({ to, subject, template, html, metadata = {} }) {
  let status = 'queued'
  if (config.resendApiKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.emailFrom, to: [to], subject, html }),
    })
    status = response.ok ? 'sent' : 'failed'
  } else {
    console.log(`[email:${template}] → ${to}: ${subject}`)
    status = 'logged'
  }

  await EmailLog.create({ toEmail: to, subject, template, status, metadata: JSON.stringify(metadata) })
  return { status }
}

export function orderDeliveryEmail({ order, items, confirmationCode, downloadLinks = [] }) {
  const itemLines = items
    .map((item) => {
      const download = item.downloadUrl
        ? `<br><a href="${item.downloadUrl}" style="color:#f97316">Download software</a>`
        : downloadLinks.find((d) => d.productName === item.productName)?.url
          ? `<br><a href="${downloadLinks.find((d) => d.productName === item.productName).url}" style="color:#f97316">Download software</a>`
          : ''
      return `<li style="margin-bottom:12px"><strong>${item.productName}</strong><br>Activation code: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">${item.licenseKey ?? 'Processing'}</code>${download}</li>`
    })
    .join('')
  return `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px"><h1 style="color:#1e3a5f">Your license is ready</h1><p>Confirmation: <strong>${confirmationCode}</strong></p><p>Order #${order.id ?? order._id}</p><ul style="padding-left:20px">${itemLines}</ul><p style="color:#64748b;font-size:14px;margin-top:24px">Keep this email safe — it contains your product activation key(s).</p></div>`
}

export async function sendOrderDeliveryEmail({ order, items, confirmationCode }) {
  const html = orderDeliveryEmail({ order, items, confirmationCode })
  return sendEmail({
    to: order.customerEmail,
    subject: `Your eSoftware Store order — License delivered`,
    template: 'order_delivery',
    html,
    metadata: { orderId: order._id?.toString?.() ?? order.id, confirmationCode },
  })
}

export async function sendAdminKeyDeliveryEmail({ order, items, confirmationCode, customMessage }) {
  const html = `${customMessage ? `<p>${customMessage}</p>` : ''}${orderDeliveryEmail({ order, items, confirmationCode })}`
  return sendEmail({
    to: order.customerEmail,
    subject: `Your product key — Order #${(order.id ?? order._id)?.toString?.()?.slice(-8) ?? ''}`,
    template: 'admin_key_delivery',
    html,
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
