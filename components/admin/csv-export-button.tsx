'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

interface CsvExportButtonProps {
  /** API route that streams CSV — e.g. /api/admin/export/payments */
  href:       string
  /** Query params to forward (filters, date range, etc.) */
  params?:    Record<string, string>
  label?:     string
  className?: string
}

export function CsvExportButton({
  href,
  params,
  label     = 'Export CSV',
  className,
}: CsvExportButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const url = new URL(href, window.location.origin)
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          if (v) url.searchParams.set(k, v)
        }
      }
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const a    = document.createElement('a')
      a.href     = URL.createObjectURL(blob)
      a.download = res.headers.get('content-disposition')?.match(/filename="?([^"]+)"?/)?.[1]
        ?? `export-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      alert('Export failed — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 ${className ?? ''}`}
    >
      {loading
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <Download className="h-4 w-4" />}
      {label}
    </button>
  )
}
