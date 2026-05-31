import { layout, h1, p, button, infoBox, divider, plainText, url, esc } from './layout'
import type { StripeReminderData } from './types'

export function renderStripeReminder(d: StripeReminderData) {
  const subject   = `Reminder: connect Stripe to start receiving payments — ${d.clubName}`
  const preheader = `You're set up on ClubBoost but can't accept payments yet. Connect Stripe to unlock fundraising.`

  const content = [
    h1('One step left to start fundraising'),
    p(`Hi ${esc(d.contactName)},`),
    p(`<strong>${esc(d.clubName)}</strong> is approved on ClubBoost — but you still need to connect a Stripe account before supporters can pay entry fees.`),
    infoBox(`
      <strong>Why Stripe?</strong><br>
      Stripe Connect lets entry fees go directly to your club's bank account. ClubBoost never holds your money — it flows straight through.
    `),
    button('Connect Stripe now', d.stripeSetupUrl),
    divider(),
    p(`It takes about 5 minutes to complete. You'll need your club's bank account details and some basic information.`,
      { colour: '#475569', size: '14px' }),
    p(`If you run into any trouble, reply to this email and we'll help you through it.`,
      { colour: '#94a3b8', size: '14px' }),
  ].join('')

  const html = layout({ subject, preheader, content })

  const text = plainText([
    `Reminder: connect Stripe to start fundraising — ${d.clubName}`,
    `Hi ${d.contactName},`,
    `${d.clubName} is approved on ClubBoost, but you need to connect a Stripe account before supporters can pay entry fees.`,
    `Connect Stripe here: ${d.stripeSetupUrl}`,
    `It takes about 5 minutes. If you need help, just reply to this email.`,
  ])

  return { subject, html, text }
}

export const stripeReminderFixture: StripeReminderData = {
  contactName:     'Sarah Johnson',
  clubName:        'Northgate FC',
  stripeSetupUrl:  url('/dashboard/stripe'),
  daysSinceSignup: 5,
}
