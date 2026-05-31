import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin text-primary-600', className)} />
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  )
}
