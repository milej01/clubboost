'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button }    from '@/components/ui/button'
import { Alert }     from '@/components/ui/alert'
import { FormField } from '@/components/ui/label'
import { Megaphone } from 'lucide-react'
import { publishAwardsAction } from '@/actions/weekly-boost'

interface Props {
  periodId:     string
  pendingCount: number
}

export function PublishAwardsForm({ periodId, pendingCount }: Props) {
  const [pending, start]      = useTransition()
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [summary, setSummary] = useState('')
  const [confirm, setConfirm] = useState(false)

  function handlePublish() {
    setError(null); setSuccess(null)
    start(async () => {
      const res = await publishAwardsAction(periodId, summary || undefined)
      if (!res.success) { setError(res.error); return }
      setSuccess('Awards published successfully. The period is now marked as Awarded.')
      setConfirm(false)
    })
  }

  if (success) {
    return (
      <Card>
        <CardContent className="py-6">
          <Alert variant="success" title="Published">{success}</Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <Megaphone className="h-4 w-4" />
          Publish awards
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-amber-700">
          You have <strong>{pendingCount}</strong> award{pendingCount !== 1 ? 's' : ''} ready to
          publish. Publishing will make them visible to clubs and mark this period as{' '}
          <strong>Awarded</strong>. This action cannot be undone.
        </p>

        <FormField
          label="Public summary (optional)"
          htmlFor="pub-summary"
          hint="Shown to clubs alongside their award notification"
        >
          <textarea
            id="pub-summary"
            rows={3}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm
                       placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Congratulations to this week's recipients — thank you to all participating clubs!"
            value={summary}
            onChange={e => setSummary(e.target.value)}
          />
        </FormField>

        {!confirm ? (
          <Button
            onClick={() => setConfirm(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Review & publish
          </Button>
        ) : (
          <div className="space-y-3">
            <Alert variant="warning" title="Confirm publish">
              This will make all non-cancelled awards visible to clubs and close the award period.
              Are you sure?
            </Alert>
            <div className="flex gap-3">
              <Button
                onClick={handlePublish}
                loading={pending}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Yes, publish now
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirm(false)}
                disabled={pending}
              >
                Go back
              </Button>
            </div>
          </div>
        )}

        {error && <Alert variant="error">{error}</Alert>}
      </CardContent>
    </Card>
  )
}
