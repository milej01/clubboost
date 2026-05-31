import { layout, h1, p, button, infoBox, kvTable, divider, badge, plainText, url, esc } from './layout'
import type { EntryConfirmationData } from './types'

export function renderEntryConfirmation(d: EntryConfirmationData) {
  const subject   = `You're in! Entry #${d.entryNumber} — ${d.fundraiserTitle}`
  const preheader = `Your entry to ${d.fundraiserTitle} is confirmed. Good luck — and thanks for supporting ${d.clubName}!`

  const content = [
    h1(`You're in! 🎉`),
    p(`Hi ${esc(d.participantName)},`),
    p(`Your entry to <strong>${esc(d.fundraiserTitle)}</strong> is confirmed. Good luck — and thank you for supporting <strong>${esc(d.clubName)}</strong>!`),
    kvTable([
      ['Entry number', `#${d.entryNumber}`],
      ['Fundraiser',   d.fundraiserTitle],
      ['Club',         d.clubName],
      ['Type',         d.competitionType],
      ['Entry fee',    d.entryFee],
    ]),
    d.selectionSummary ? infoBox(`
      <strong>Your selections</strong><br>
      <pre style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;white-space:pre-wrap;margin:8px 0 0;color:#475569;">${esc(d.selectionSummary)}</pre>
    `) : '',
    button('View competition', d.competitionUrl),
    divider(),
    p(`<a href="${esc(d.dashboardUrl)}" style="color:#7c3aed;">View all your entries</a> from your ClubBoost dashboard.`,
      { colour: '#94a3b8', size: '14px' }),
    p(`Every entry directly supports ${esc(d.clubName)}. Thanks for being a brilliant supporter! ❤️`,
      { colour: '#94a3b8', size: '14px' }),
  ].join('')

  const html = layout({ subject, preheader, content })

  const text = plainText([
    `You're in! Entry #${d.entryNumber} — ${d.fundraiserTitle}`,
    `Hi ${d.participantName},`,
    `Your entry is confirmed. Good luck and thanks for supporting ${d.clubName}!`,
    `Entry #${d.entryNumber}`,
    `Fundraiser: ${d.fundraiserTitle}`,
    `Club: ${d.clubName}`,
    `Type: ${d.competitionType}`,
    `Entry fee: ${d.entryFee}`,
    ...(d.selectionSummary ? [`Your selections:\n${d.selectionSummary}`] : []),
    `View competition: ${d.competitionUrl}`,
    `Your dashboard: ${d.dashboardUrl}`,
  ])

  return { subject, html, text }
}

export const entryConfirmationFixture: EntryConfirmationData = {
  participantName:  'James Wilson',
  fundraiserTitle:  'Northgate FC Score Predictor — Matchday 12',
  clubName:         'Northgate FC',
  entryNumber:      47,
  entryFee:         '£5.00',
  competitionType:  'Score Predictor',
  selectionSummary: 'Match 1 — Home Win\nMatch 2 — Draw\nMatch 3 — Away Win\nMatch 4 — Home Win\nMatch 5 — Home Win\nMatch 6 — Draw\nTiebreaker: 9 goals',
  competitionUrl:   'https://clubboost.co.uk/c/northgate-fc/comp123',
  dashboardUrl:     url('/my/dashboard'),
}
