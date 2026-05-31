import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'

type AlertVariant = 'info' | 'success' | 'warning' | 'error'

const config: Record<AlertVariant, { icon: React.ElementType; classes: string }> = {
  info:    { icon: Info,          classes: 'bg-blue-50 border-blue-200 text-blue-800' },
  success: { icon: CheckCircle,   classes: 'bg-green-50 border-green-200 text-green-800' },
  warning: { icon: AlertTriangle, classes: 'bg-amber-50 border-amber-200 text-amber-800' },
  error:   { icon: AlertCircle,   classes: 'bg-red-50 border-red-200 text-red-800' },
}

interface AlertProps {
  variant?:  AlertVariant
  title?:    string
  children:  React.ReactNode
  className?: string
}

export function Alert({ variant = 'info', title, children, className }: AlertProps) {
  const { icon: Icon, classes } = config[variant]
  return (
    <div className={cn('flex gap-3 rounded-lg border p-4', classes, className)}>
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div>
        {title && <p className="font-medium mb-1">{title}</p>}
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}
