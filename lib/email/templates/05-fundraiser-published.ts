import { layout, h1, p, button, infoBox, kvTable, divider, plainText, esc } from './layout'
import type { FundraiserPublishedData } from './types'

export function renderFundraiserPublished(d: FundraiserPublishedData) {
  const subject   = `🚀 "${d.fundraiserTitle}" is live!`
  const preheader = `Your fundraiser is live — share it with your supporters and start raising money for ${d.clubName}.`

  const content = [
    h1('Your fundraiser is live! 🚀'),
    p(`Hi ${esc(d.contactName)},`),
    p(`<strong>${esc(d.fundraiserTitle)}</strong> is now live and accepting entries. Share the link with your supporters and get the entries rolling in!`),
    kvTable([
      ['Entry fee',    d.entryFee],
      ...(d.closingDate ? [['Closes', d.closingDate] as [string, string]] : []),
    ]),
    button('View live fundraiser', d.publicUrl),
    infoBox(`
      <strong>💬 Share it!</strong><br>
      Copy and paste this to WhatsApp, Facebook, or your club newsletter:<br><br>
      <em style="color:#475569;">"${esc(d.shareText)}"</em>
    `),
    divider(),
    p(`You can track entries, see the pot growing, and manage the fundraiser from your dashboard.`,
      { colour: '#94a3b8', size: '14px' }),
  ].join('')

  const html = layout({ subject, preheader, content })

  const text = plainText([
    `Your fundraiser is live! "${d.fundraiserTitle}"`,
    `Hi ${d.contactName},`,
    `${d.fundraiserTitle} is now live and accepting entries at ${d.publicUrl}.`,
    `Entry fee: ${d.entryFee}`,
    ...(d.closingDate ? [`Closes: ${d.closingDate}`] : []),
    `Share this with your supporters:`,
    d.shareText,
  ])

  return { subject, html, text }
}

export const fundraiserPublishedFixture: FundraiserPublishedData = {
  contactName:     'Sarah Johnson',
  clubName:        'Northgate FC',
  fundraiserTitle: 'Northgate FC Score Predictor — Matchday 12',
  entryFee:        '£5.00',
  publicUrl:       'https://clubboost.co.uk/c/northgate-fc/comp123',
  closingDate:     'Saturday 25 May 2026 at 3:00 PM',
  shareText:       '⚽ Can you predict all six results? Enter Northgate FC\'s Score Predictor for just £5 — prizes for the winners and all money goes to the club! https://clubboost.co.uk/c/northgate-fc/comp123',
}
