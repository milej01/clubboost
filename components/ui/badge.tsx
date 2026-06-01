import { cn } from '@/lib/utils'

type BadgeVariant =
  | 'green' | 'amber' | 'red' | 'slate' | 'blue' | 'purple'
  // Semantic aliases
  | 'success' | 'warning' | 'error' | 'info'

const variantClasses: Record<BadgeVariant, string> = {
  green:   'bg-green-100 text-green-800 border-green-200',
  amber:   'bg-amber-100 text-amber-800 border-amber-200',
  red:     'bg-red-100 text-red-800 border-red-200',
  slate:   'bg-slate-100 text-slate-700 border-slate-200',
  blue:    'bg-blue-100 text-blue-800 border-blue-200',
  purple:  'bg-purple-100 text-purple-800 border-purple-200',
  // Semantic aliases
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  error:   'bg-red-100 text-red-800 border-red-200',
  info:    'bg-blue-100 text-blue-800 border-blue-200',
}

interface BadgeProps {
  variant?:  BadgeVariant
  children:  React.ReactNode
  className?: string
}

export function Badge({ variant = 'slate', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
