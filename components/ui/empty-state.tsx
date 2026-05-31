import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?:        LucideIcon
  emoji?:       string
  title:        string
  description?: string
  action?:      React.ReactNode
  size?:        'sm' | 'md' | 'lg'
  className?:   string
}

const sizeClasses = {
  sm: { wrap: 'py-8',  icon: 'h-10 w-10', iconBox: 'h-14 w-14 rounded-2xl', title: 'text-base', desc: 'text-sm' },
  md: { wrap: 'py-14', icon: 'h-12 w-12', iconBox: 'h-20 w-20 rounded-3xl', title: 'text-xl',   desc: 'text-sm' },
  lg: { wrap: 'py-20', icon: 'h-14 w-14', iconBox: 'h-24 w-24 rounded-3xl', title: 'text-2xl',  desc: 'text-base' },
}

export function EmptyState({
  icon: Icon,
  emoji,
  title,
  description,
  action,
  size = 'md',
  className,
}: EmptyStateProps) {
  const s = sizeClasses[size]

  return (
    <div className={cn('flex flex-col items-center justify-center text-center', s.wrap, className)}>
      {(Icon || emoji) && (
        <div
          className={cn(
            'mb-5 flex items-center justify-center bg-slate-100',
            s.iconBox,
          )}
        >
          {emoji
            ? <span className="text-4xl" role="img">{emoji}</span>
            : Icon && <Icon className={cn(s.icon, 'text-slate-400')} />
          }
        </div>
      )}

      <h3 className={cn('font-semibold text-slate-800 mb-2', s.title)}>{title}</h3>

      {description && (
        <p className={cn('text-slate-500 max-w-sm leading-relaxed mb-6', s.desc)}>
          {description}
        </p>
      )}

      {action && <div className="flex justify-center">{action}</div>}
    </div>
  )
}
