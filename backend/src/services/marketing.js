import { AbandonedCart } from '../db/models.js'
import { sendAbandonedCartEmail } from './email.js'

const FOLLOW_UP_HOURS = [1, 24, 72]
const STAGE_COUPONS = ['', 'SAVE10', 'LASTCHANCE15']

export async function trackAbandonedCart(cartId, email, step = 'checkout') {
  const existing = await AbandonedCart.findOne({ cartId })
  if (existing) {
    existing.email = email
    existing.step = step
    await existing.save()
    return existing._id
  }
  const created = await AbandonedCart.create({ cartId, email, step })
  return created._id
}

export async function processAbandonedCartFollowUps() {
  const rows = await AbandonedCart.find({ recovered: false })
  let sent = 0
  for (const row of rows) {
    if (!row.email) continue
    const stage = row.followUpStage
    if (stage >= FOLLOW_UP_HOURS.length) continue
    const hours = FOLLOW_UP_HOURS[stage]
    const dueAt = new Date(row.createdAt)
    dueAt.setHours(dueAt.getHours() + hours)
    if (dueAt > new Date()) continue
    if (row.lastEmailAt) {
      const nextDue = new Date(row.lastEmailAt)
      nextDue.setHours(nextDue.getHours() + hours)
      if (nextDue > new Date()) continue
    }
    await sendAbandonedCartEmail({ email: row.email, cartId: row.cartId, stage, couponCode: STAGE_COUPONS[stage] })
    row.followUpStage = stage + 1
    row.lastEmailAt = new Date()
    await row.save()
    sent += 1
  }
  return { sent }
}

export async function markCartRecovered(cartId) {
  await AbandonedCart.updateMany({ cartId }, { recovered: true })
}
