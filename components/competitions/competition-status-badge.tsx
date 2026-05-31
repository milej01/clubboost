import { Badge } from '@/components/ui/badge'
import type { CompetitionStatus } from '@/types/app'

const statusConfig: Record<CompetitionStatus, { label: string; variant: 'green' | 'amber' | 'red' | 'slate' | 'blue' | 'purple' }> = {
  draft:     { label: 'Draft',     variant: 'slate' },
  open:      { label: 'Open',      variant: 'green' },
  closed:    { label: 'Closed',    variant: 'amber' },
  settled:   { label: 'Settled',   variant: 'blue' },
  cancelled: { label: 'Cancelled', variant: 'red' },
}

export function CompetitionStatusBadge({ status }: { status: CompetitionStatus }) {
  const { label, variant } = statusConfig[status] ?? { label: status, variant: 'slate' }
  return <Badge variant={variant}>{label}</Badge>
}
