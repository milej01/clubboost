import { cn } from '@/lib/utils'

interface ProgressProps {
  /** 0–100 */
  value:      number
  label?:     string
  sublabel?:  string
  size?:      'sm' | 'md' | 'lg'
  color?:     'primary' | 'boost' | 'club' | 'success'
  showValue?: boolean
  className?: string
}

const colorClasses = {
  primary: 'bg-primary-500',
  boost:   'bg-boost-500',
  club:    'bg-club-500',
  success: 'bg-green-500',
}

const heightClasses = {
  sm: 'h-1.5',
  md: 'h-3',
  lg: 'h-4',
}

export function Progress({
  value,
  label,
  sublabel,
  size     = 'md',
  color    = 'primary',
  showValue = false,
  className,
}: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-sm">
          {label   && <span className="font-medium text-slate-700">{label}</span>}
          {showValue && <span className="text-slate-500 tabular-nums">{Math.round(clamped)}%</span>}
        </div>
      )}
      <div
        className={cn('w-full overflow-hidden rounded-full bg-slate-100', heightClasses[size])}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-out',
            colorClasses[color],
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {sublabel && (
        <p className="text-xs text-slate-400">{sublabel}</p>
      )}
    </div>
  )
}

/**
 * Segmented progress bar for fundraising pot breakdown.
 * Each segment is a colour-coded portion of the 100% bar.
 */
interface Segment {
  label:    string
  pct:      number
  color:    string   // Tailwind bg class e.g. 'bg-primary-500'
}

interface SegmentedProgressProps {
  segments:  Segment[]
  className?: string
}

export function SegmentedProgress({ segments, className }: SegmentedProgressProps) {
  return (
    <div className={cn('flex h-3 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      {segments.filter(s => s.pct > 0).map(s => (
        <div
          key={s.label}
          className={cn(s.color, 'h-full transition-all duration-700')}
          style={{ width: `${s.pct}%` }}
          title={`${s.label}: ${s.pct.toFixed(1)}%`}
        />
      ))}
    </div>
  )
}
