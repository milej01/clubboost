import { layout, h1, p, button, infoBox, kvTable, divider, plainText, url, esc } from './layout'
import type { BoostContributionSummaryData } from './types'

export function renderBoostContributionSummary(d: BoostContributionSummaryData) {
  const subject   = `⚡ Weekly Boost update — ${d.periodName}`
  const preheader = `${d.clubName} contributed ${d.contributionAmount} to this week's shared prize pool.`

  const content = [
    h1(`Weekly Boost — ${esc(d.periodName)} ⚡`),
    p(`Hi ${esc(d.contactName)},`),
    p(`Here's your <strong>Weekly Boost</strong> summary for <strong>${esc(d.clubName)}</strong> this week.`),
    kvTable([
      ['Your contribution', d.contributionAmount],
      ['Pool total',        d.poolTotal],
      ['Period ends',       d.periodEnd],
    ]),
    infoBox(`
      <strong>How it works</strong><br>
      A small share of every entry fee from enrolled clubs goes into a shared weekly prize pool. The ClubBoost team awards the pool to eligible clubs — spreading the boost fairly each week. You'll hear from us if ${esc(d.clubName)} wins!
    `),
    button('Learn more about Weekly Boost', d.boostInfoUrl, '#d97706'),
    divider(),
    p(`<a href="${esc(d.dashboardUrl)}" style="color:#7c3aed;">View your Weekly Boost dashboard →</a>`,
      { colour: '#94a3b8', size: '14px', mb: '0' }),
  ].join('')

  const html = layout({ subject, preheader, content, unsubscribeUrl: '#unsubscribe' })

  const text = plainText([
    `Weekly Boost — ${d.periodName}`,
    `Hi ${d.contactName},`,
    `Here's your Weekly Boost summary for ${d.clubName}.`,
    `Your contribution this period: ${d.contributionAmount}`,
    `Total pool: ${d.poolTotal}`,
    `Period ends: ${d.periodEnd}`,
    `Learn more: ${d.boostInfoUrl}`,
    `Dashboard: ${d.dashboardUrl}`,
  ])

  return { subject, html, text }
}

export const boostContributionSummaryFixture: BoostContributionSummaryData = {
  contactName:        'Sarah Johnson',
  clubName:           'Northgate FC',
  periodName:         'Week 21 — 19 May 2026',
  contributionAmount: '£3.15',
  poolTotal:          '£420.00',
  periodEnd:          'Friday 23 May 2026',
  boostInfoUrl:       url('/weekly-boost'),
  dashboardUrl:       url('/dashboard/weekly-boost'),
}
