import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginatorProps {
  page:         number
  totalPages:   number
  totalItems:   number
  pageSize:     number
  basePath:     string          // e.g. "/admin/clubs"
  searchParams: Record<string, string | string[] | undefined>
}

function buildUrl(
  base:         string,
  searchParams: Record<string, string | string[] | undefined>,
  page:         number,
) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams)) {
    if (!v || k === 'page') continue
    if (Array.isArray(v)) v.forEach(val => params.append(k, val))
    else params.set(k, v)
  }
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export function Paginator({
  page,
  totalPages,
  totalItems,
  pageSize,
  basePath,
  searchParams,
}: PaginatorProps) {
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, totalItems)

  // Build visible page numbers (always show first, last, and ±2 around current)
  const pages: (number | '…')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= page - 2 && i <= page + 2)
    ) {
      pages.push(i)
    } else if (
      (i === page - 3 && page - 3 > 1) ||
      (i === page + 3 && page + 3 < totalPages)
    ) {
      pages.push('…')
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
      <p className="text-sm text-slate-400 tabular-nums">
        {from}–{to} of {totalItems.toLocaleString()}
      </p>

      <div className="flex items-center gap-1">
        {/* Prev */}
        {page > 1 ? (
          <Link
            href={buildUrl(basePath, searchParams, page - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-200">
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}

        {/* Page numbers */}
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-sm text-slate-300">…</span>
          ) : (
            <Link
              key={p}
              href={buildUrl(basePath, searchParams, p)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors',
                p === page
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </Link>
          )
        )}

        {/* Next */}
        {page < totalPages ? (
          <Link
            href={buildUrl(basePath, searchParams, page + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-200">
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  )
}
