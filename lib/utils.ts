import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPence(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100)
}

export function poundsToPence(pounds: number): number {
  return Math.round(pounds * 100)
}

export function penceToPounds(pence: number): number {
  return pence / 100
}

export function bpsToPercent(bps: number): number {
  return bps / 100
}

export function percentToBps(pct: number): number {
  return Math.round(pct * 100)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/**
 * Estimate Stripe's processing fee for a UK card payment.
 * Actual fee is retrieved from the Stripe charge balance transaction.
 * Uses the European card rate: 1.4% + 20p, rounded up.
 * International card rate (2.9% + 30p) is covered by the estimate with a +£0.10 buffer.
 */
export function estimateStripeFee(amountPence: number): number {
  // 1.5% + 25p gives a slightly pessimistic estimate that covers most UK card types.
  // The 5p buffer absorbs rounding and covers some non-EU card spread.
  return Math.ceil(amountPence * 0.015 + 25)
}

/**
 * Calculate the full 5-way payment split.
 * All inputs and outputs are in pence (integer).
 *
 * Allocation order (priority highest → lowest):
 *   1. prize pool (% of gross)
 *   2. platform service fee (% of gross)
 *   3. weekly boost contribution (% of gross)
 *   4. Stripe processing fee (estimated; refined from actual charge later)
 *   5. club fundraising = residual (guaranteed never negative)
 *
 * The Stripe fee is deducted from the amount the club receives because
 * Stripe deducts it from the connected account's balance, not from the
 * application_fee_amount.
 */
export function calculateSplit(entryFeePence: number, config: {
  prizePctBps:    number
  clubPctBps:     number
  platformFeeBps: number
  weeklyBoostBps: number
  stripeFee?:     number   // override with actual Stripe fee when known
}) {
  if (entryFeePence <= 0) {
    return { prize: 0, platform: 0, boost: 0, stripeFee: 0, club: 0, total: 0 }
  }

  const prize    = Math.floor(entryFeePence * config.prizePctBps    / 10_000)
  const platform = Math.floor(entryFeePence * config.platformFeeBps / 10_000)
  const boost    = Math.floor(entryFeePence * config.weeklyBoostBps / 10_000)
  const stripeFee = config.stripeFee ?? estimateStripeFee(entryFeePence)

  // Club gets the residual. Use GREATEST to prevent negative if fees > gross.
  const club = Math.max(0, entryFeePence - prize - platform - boost - stripeFee)

  return { prize, platform, boost, stripeFee, club, total: entryFeePence }
}

export function exportToCsv(data: Record<string, unknown>[], filename: string): void {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h]
      if (val === null || val === undefined) return ''
      const str = String(val)
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
