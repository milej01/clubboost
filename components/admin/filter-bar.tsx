'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition, Suspense } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterTab {
  label:  string
  value:  string       // the searchParam value; '' means "all"
  count?: number
}

interface FilterBarProps {
  /** URL search param key for the text search */
  searchKey?:   string
  /** URL search param key for the tab filter */
  filterKey?:   string
  /** Tab definitions (first is "all") */
  tabs?:        FilterTab[]
  placeholder?: string
  className?:   string
  /** Additional static filters rendered beside the search */
  extras?: React.ReactNode
}

function FilterBarInner({
  searchKey   = 'q',
  filterKey   = 'status',
  tabs,
  placeholder = 'Search…',
  className,
  extras,
}: FilterBarProps) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const active = searchParams.get(filterKey) ?? ''
  const query  = searchParams.get(searchKey) ?? ''

  function push(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    // Reset to page 1 whenever filters change
    params.delete('page')
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') params.delete(k)
      else params.set(k, v)
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const onSearch = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const val = new FormData(e.currentTarget).get(searchKey) as string
      push({ [searchKey]: val })
    },
    [searchKey, searchParams], // eslint-disable-line
  )

  return (
    <div className={cn('space-y-3', className)}>
      {/* Search row */}
      <div className="flex items-center gap-3 flex-wrap">
        <form onSubmit={onSearch} className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            key={query} // reset field when searchParam is cleared externally
            type="search"
            name={searchKey}
            defaultValue={query}
            placeholder={placeholder}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => push({ [searchKey]: null })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>
        {extras}
      </div>

      {/* Filter tabs */}
      {tabs && tabs.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap" role="tablist">
          {tabs.map(tab => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={active === tab.value}
              onClick={() => push({ [filterKey]: tab.value || null })}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                active === tab.value
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  'rounded-full px-1.5 text-xs tabular-nums',
                  active === tab.value
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-500',
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function FilterBar(props: FilterBarProps) {
  return (
    <Suspense fallback={<div className="h-10 animate-pulse rounded-xl bg-slate-100" />}>
      <FilterBarInner {...props} />
    </Suspense>
  )
}
