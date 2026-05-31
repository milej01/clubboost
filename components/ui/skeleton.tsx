import { cn } from '@/lib/utils'

// ── Base skeleton ──────────────────────────────────────────

interface SkeletonProps {
  className?: string
  rounded?:   'sm' | 'md' | 'lg' | 'xl' | 'full'
}

const roundedClasses = {
  sm:   'rounded-sm',
  md:   'rounded-md',
  lg:   'rounded-lg',
  xl:   'rounded-xl',
  full: 'rounded-full',
}

export function Skeleton({ className, rounded = 'md' }: SkeletonProps) {
  return (
    <div
      className={cn(
        'skeleton bg-shimmer-gradient bg-[length:200%_100%] animate-shimmer',
        roundedClasses[rounded],
        className,
      )}
      aria-hidden="true"
    />
  )
}

// ── Composed skeletons ─────────────────────────────────────

export function SkeletonText({ lines = 2, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', i === lines - 1 ? 'w-3/4' : 'w-full')}
          rounded="md"
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white p-6 space-y-4', className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10" rounded="xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <SkeletonText lines={3} />
      <Skeleton className="h-9 w-full" rounded="xl" />
    </div>
  )
}

export function SkeletonTable({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number
  cols?: number
  className?: string
}) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white overflow-hidden', className)}>
      {/* Header */}
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="border-b border-slate-50 last:border-0 px-4 py-3 flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn('h-4 flex-1', c === 0 && 'w-1/3 flex-none')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white p-5 space-y-3', className)}>
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-2.5 w-full" rounded="full" />
    </div>
  )
}

export function SkeletonAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14' }
  return <Skeleton className={s[size]} rounded="full" />
}
