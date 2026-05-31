import { layout, h1, p, button, infoBox, divider, plainText, url, esc } from './layout'
import type { WinnerNotificationData } from './types'
import { formatPence } from '@/lib/utils'

export function renderWinnerNotification(d: WinnerNotificationData) {
  const subject   = `🏆 You've won! — ${d.fundraiserTitle}`
  const preheader = `Congratulations! You've won the prize in ${d.fundraiserTitle}. Here's how to claim.`

  const prizeDisplay = d.prizePence !== null
    ? formatPence(d.prizePence)
    : d.prizeDescription

  const content = [
    h1(`You're a winner! 🏆`),
    p(`Hi ${esc(d.winnerName)},`),
    p(`Incredible — you've won the prize in <strong>${esc(d.fundraiserTitle)}</strong> run by <strong>${esc(d.clubName)}</strong>!`),
    infoBox(`
      <strong>Your prize:</strong> ${esc(prizeDisplay)}<br>
      <br>
      The club team at ${esc(d.clubName)} will be in touch about claiming your prize. If you haven't heard from them within 5 days, get in touch at
      <a href="mailto:${esc(d.contactEmail)}" style="color:#7c3aed;">${esc(d.contactEmail)}</a>.
    `, 'success'),
    button('View competition results', d.competitionUrl),
    divider(),
    p(`Thank you for supporting ${esc(d.clubName)} — and enjoy the winnings! 🎉`,
      { colour: '#94a3b8', size: '14px' }),
  ].join('')

  const html = layout({ subject, preheader, content })

  const text = plainText([
    `You've won! — ${d.fundraiserTitle}`,
    `Hi ${d.winnerName},`,
    `Congratulations — you've won the prize in ${d.fundraiserTitle} run by ${d.clubName}!`,
    `Your prize: ${prizeDisplay}`,
    `The club will be in touch about claiming your prize. If not, contact: ${d.contactEmail}`,
    `View results: ${d.competitionUrl}`,
    `Thank you for supporting ${d.clubName}!`,
  ])

  return { subject, html, text }
}

export const winnerNotificationFixture: WinnerNotificationData = {
  winnerName:       'James Wilson',
  fundraiserTitle:  'Northgate FC Score Predictor — Matchday 12',
  clubName:         'Northgate FC',
  prizeDescription: '70% of the entry pot',
  prizePence:       22050,
  competitionUrl:   'https://clubboost.co.uk/c/northgate-fc/comp123',
  contactEmail:     'sarah@northgatefc.co.uk',
}
