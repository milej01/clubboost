'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button }    from '@/components/ui/button'
import { Input }     from '@/components/ui/input'
import { Alert }     from '@/components/ui/alert'
import { FormField } from '@/components/ui/label'
import { createBoostPeriodAction } from '@/actions/weekly-boost'

export default function NewBoostPeriodPage() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name,         setName]         = useState('')
  const [startDate,    setStartDate]    = useState('')
  const [endDate,      setEndDate]      = useState('')
  const [rules,        setRules]        = useState('')
  const [notes,        setNotes]        = useState('')

  function handleSubmit() {
    setError(null)
    if (!name.trim())    { setError('Period name is required');    return }
    if (!startDate)      { setError('Start date is required');     return }
    if (!endDate)        { setError('End date is required');       return }
    if (startDate >= endDate) { setError('End date must be after start date'); return }

    startTransition(async () => {
      const result = await createBoostPeriodAction({
        periodName:     name.trim(),
        periodStart:    startDate,
        periodEnd:      endDate,
        publishedRules: rules || undefined,
        notes:          notes || undefined,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      router.push(`/admin/weekly-boost/${result.data.periodId}`)
    })
  }

  // Default to current ISO week
  function fillCurrentWeek() {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const mon = new Date(now); mon.setDate(diff)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    setStartDate(mon.toISOString().split('T')[0])
    setEndDate(sun.toISOString().split('T')[0])
    if (!name) setName(`Boost Week ${mon.toISOString().split('T')[0]}`)
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/weekly-boost">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        </Link>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary-600" />
          <h1 className="text-xl font-bold text-slate-900">New Boost Period</h1>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Period details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Period name" htmlFor="name" hint="Displayed to clubs and in reports">
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Boost Week — 19 May 2026"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start date" htmlFor="start">
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </FormField>
            <FormField label="End date" htmlFor="end">
              <Input
                id="end"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </FormField>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={fillCurrentWeek}
            type="button"
          >
            Fill current calendar week (Mon–Sun)
          </Button>

          <FormField
            label="Published rules"
            htmlFor="rules"
            hint="Optional. Shown to clubs on the dashboard."
          >
            <textarea
              id="rules"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[100px]"
              value={rules}
              onChange={e => setRules(e.target.value)}
              placeholder="Describe the rules and criteria for this boost period…"
            />
          </FormField>

          <FormField
            label="Internal notes"
            htmlFor="notes"
            hint="Not shown publicly — for platform admin use only."
          >
            <textarea
              id="notes"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[80px]"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Admin notes…"
            />
          </FormField>

          {error && <Alert variant="error">{error}</Alert>}
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Link href="/admin/weekly-boost">
            <Button variant="secondary">Cancel</Button>
          </Link>
          <Button onClick={handleSubmit} loading={pending}>
            Create period
          </Button>
        </CardFooter>
      </Card>

      <Alert variant="info" title="Next steps">
        After creating the period, set it to <strong>Active</strong> when you&apos;re ready to accept
        contributions. Add sponsor or platform contributions manually, then award eligible clubs
        before closing the period.
      </Alert>
    </div>
  )
}
