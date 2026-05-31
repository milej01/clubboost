import { layout, h1, p, button, infoBox, kvTable, divider, plainText, url, esc } from './layout'
import type { FundraiserClosedData } from './types'

export function renderFundraiserClosed(d: FundraiserClosedData) {
  const subject   = `"${d.fundraiserTitle}" has closed — ${d.finalEntryCount} entries, ${d.grossRaised} raised`
  const preheader = `Your fundraiser is done. Here's your summary and next steps to settle and pay out.`

  const content = [
    h1('Your fundraiser has closed 🏁'),
    p(`Hi ${esc(d.contactName)},`),
    p(`<strong>${esc(d.fundraiserTitle)}</strong> has closed. Here's the final tally for <strong>${esc(d.clubName)}</strong>:`),
    kvTable([
      ['Total entries', String(d.finalEntryCount)],
      ['Total raised',  d.grossRaised],
      ['Your share',    d.yourShare],
      ['Prize pool',    d.prizePool],
      ['Closed at',     d.closedAt],
    ]),
    infoBox(`
      <strong>What happens next?</strong><br>
      Head to your dashboard to <strong>settle the competition</strong> — pick the winner(s) and trigger the prize payout. Your share will be transferred to your Stripe account automatically.
    `, 'success'),
    button('Settle the competition', d.settleUrl),
    divider(),
    p(`Need help settling? Reply to this email and we'll walk you through it.`,
      { colour: '#94a3b8', size: '14px' }),
  ].join('')

  const html = layout({ subject, preheader, content })

  const text = plainText([
    `"${d.fundraiserTitle}" has closed.`,
    `Hi ${d.contactName},`,
    `Here's your final summary:`,
    `Total entries: ${d.finalEntryCount}`,
    `Total raised: ${d.grossRaised}`,
    `Your share: ${d.yourShare}`,
    `Prize pool: ${d.prizePool}`,
    `Closed at: ${d.closedAt}`,
    `Settle the competition: ${d.settleUrl}`,
  ])

  return { subject, html, text }
}

export const fundraiserClosedFixture: FundraiserClosedData = {
  contactName:     'Sarah Johnson',
  clubName:        'Northgate FC',
  fundraiserTitle: 'Northgate FC Score Predictor — Matchday 12',
  finalEntryCount: 63,
  grossRaised:     '£315.00',
  yourShare:       '£220.50',
  prizePool:       '£63.00',
  closedAt:        'Saturday 25 May 2026 at 3:00 PM',
  settleUrl:       url('/dashboard/competitions/comp123'),
}
