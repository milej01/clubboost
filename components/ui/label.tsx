import { cn } from '@/lib/utils'
import type { LabelHTMLAttributes } from 'react'

export function Label({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('label-base', className)} {...props}>
      {children}
    </label>
  )
}

export function FormField({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label:     string
  htmlFor?:  string
  hint?:     string
  children:  React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
