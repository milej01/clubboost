import { layout, h1, p, button, infoBox, divider, plainText, url, esc } from './layout'
import type { SettlementResultData } from './types'

const RESULT_COPY: Record<SettlementResultData['result'], { emoji: string; heading: string; body: string }> = {
  eliminated: {
    emoji:   '👏',
    heading: 'Thanks for playing!',
    body:    'You didn\'t win this time, but every entry goes to support your club — so you\'re a winner in our books.',
  },
  no_winner: {
    emoji:   '🤷',
    heading: 'No winner this time',
    body:    'The competition ended without a clear winner. Any refunds due will be processed automatically.',
  },
  refunded: {
    emoji:   '↩️',
    heading: 'Competition cancelled — refund incoming',
    body:    'This competition was cancelled. Your entry fee will be refunded within 5–10 working days.',
  },
}

export function renderSettlementResult(d: SettlementResultData) {
  const copy = RESULT_COPY[d.result]

  const subject   = `${copy.emoji} ${copy.heading} — ${d.fundraiserTitle}`
  const preheader = `Results are in for ${d.fundraiserTitle} run by ${d.clubName}.`

  const winnerSection = d.winnerName
    ? infoBox(`<strong>🏆 Winner:</strong> Congratulations to <strong>${esc(d.winnerName)}</strong>!`)
    : ''

  const content = [
    h1(`Results are in — ${d.fundraiserTitle}`),
    p(`Hi ${esc(d.participantName)},`),
    p(copy.body),
    winnerSection,
    button('See the full results', d.competitionUrl),
    divider(),
    p(`Want to try again? <a href="${esc(d.dashboardUrl)}" style="color:#7c3aed;">Browse open fundraisers</a> and keep supporting your local clubs.`,
      { colour: '#94a3b8', size: '14px' }),
  ].join('')

  const html = layout({ subject, preheader, content })

  const text = plainText([
    `${copy.heading} — ${d.fundraiserTitle}`,
    `Hi ${d.participantName},`,
    copy.body,
    ...(d.winnerName ? [`Winner: ${d.winnerName}`] : []),
    `See the full results: ${d.competitionUrl}`,
    `Browse fundraisers: ${d.dashboardUrl}`,
  ])

  return { subject, html, text }
}

export const settlementResultFixture: SettlementResultData = {
  participantName: 'James Wilson',
  fundraiserTitle: 'Northgate FC Score Predictor — Matchday 12',
  clubName:        'Northgate FC',
  result:          'eliminated',
  winnerName:      'Emma Thompson',
  competitionUrl:  'https://clubboost.co.uk/c/northgate-fc/comp123',
  dashboardUrl:    url('/my/dashboard'),
}
