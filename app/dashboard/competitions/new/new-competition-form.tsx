'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FormField } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { createCompetitionAction } from '@/actions/competitions'
import type { CompetitionType } from '@/types/app'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'

const typeOptions = [
  { value: 'predictor',         label: 'Six-Result Predictor' },
  { value: 'last_man_standing', label: 'Last Man Standing' },
  { value: 'team_card',         label: 'Football Team Card' },
  { value: 'donation',          label: 'Donation Fundraiser' },
]

const prizeTypeOptions = [
  { value: 'none',        label: 'No prize' },
  { value: 'percentage',  label: 'Percentage of pot' },
  { value: 'fixed',       label: 'Fixed amount' },
  { value: 'description', label: 'Prize description only' },
]

interface Fixture { home_team: string; away_team: string; kickoff_at: string }
interface TeamSlot { slot_number: number; team_name: string }

export function NewCompetitionForm({ clubId }: { clubId: string }) {
  const router = useRouter()
  const [type, setType]            = useState<CompetitionType>('predictor')
  const [prizeType, setPrizeType]  = useState('none')
  const [error, setError]          = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [fixtures, setFixtures] = useState<Fixture[]>(
    Array.from({ length: 6 }, () => ({ home_team: '', away_team: '', kickoff_at: '' }))
  )

  const [slots, setSlots] = useState<TeamSlot[]>(
    Array.from({ length: 6 }, (_, i) => ({ slot_number: i + 1, team_name: '' }))
  )

  function updateFixture(i: number, field: keyof Fixture, value: string) {
    setFixtures(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: value } : f))
  }

  function addSlot() {
    setSlots(prev => [...prev, { slot_number: prev.length + 1, team_name: '' }])
  }

  function updateSlot(i: number, value: string) {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, team_name: value } : s))
  }

  function removeSlot(i: number) {
    setSlots(prev => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, slot_number: idx + 1 })))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    fixtures.forEach((f, i) => {
      formData.set(`fixture_${i}_home`, f.home_team)
      formData.set(`fixture_${i}_away`, f.away_team)
      if (f.kickoff_at) formData.set(`fixture_${i}_kickoff`, f.kickoff_at)
    })
    formData.set('team_slots', JSON.stringify(slots))

    startTransition(async () => {
      const result = await createCompetitionAction(clubId, null, formData)
      if (!result.success) { setError(result.error); return }
      router.push(`/dashboard/competitions/${result.data.competitionId}`)
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-900">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">New competition</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type */}
        <Card>
          <CardHeader><CardTitle>Competition type</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Type" htmlFor="type">
              <Select
                id="type"
                name="type"
                options={typeOptions}
                value={type}
                onChange={e => setType(e.target.value as CompetitionType)}
              />
            </FormField>
          </CardContent>
        </Card>

        {/* Basics */}
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Title" htmlFor="title">
              <Input id="title" name="title" required placeholder="e.g. Season Opener Predictor 2025" />
            </FormField>
            <FormField label="Description" htmlFor="description">
              <Textarea id="description" name="description" placeholder="Tell supporters what this competition is about" />
            </FormField>
            <FormField label="Rules" htmlFor="rules_text" hint="Optional — additional rules specific to this competition">
              <Textarea id="rules_text" name="rules_text" rows={3} />
            </FormField>
          </CardContent>
        </Card>

        {/* Predictor fixtures */}
        {type === 'predictor' && (
          <Card>
            <CardHeader><CardTitle>Fixtures (6 required)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {fixtures.map((f, i) => (
                <div key={i} className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="col-span-2">
                    <p className="text-xs font-medium text-slate-500 mb-2">Match {i + 1}</p>
                  </div>
                  <FormField label="Home team" htmlFor={`home_${i}`}>
                    <Input id={`home_${i}`} value={f.home_team} onChange={e => updateFixture(i, 'home_team', e.target.value)} required placeholder="Arsenal" />
                  </FormField>
                  <FormField label="Away team" htmlFor={`away_${i}`}>
                    <Input id={`away_${i}`} value={f.away_team} onChange={e => updateFixture(i, 'away_team', e.target.value)} required placeholder="Chelsea" />
                  </FormField>
                  <FormField label="Kick-off (optional)" htmlFor={`kickoff_${i}`} className="col-span-2">
                    <Input id={`kickoff_${i}`} type="datetime-local" value={f.kickoff_at} onChange={e => updateFixture(i, 'kickoff_at', e.target.value)} />
                  </FormField>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Team card slots */}
        {type === 'team_card' && (
          <Card>
            <CardHeader><CardTitle>Teams</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {slots.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-8 text-sm text-slate-400 flex-shrink-0">#{s.slot_number}</span>
                  <Input
                    value={s.team_name}
                    onChange={e => updateSlot(i, e.target.value)}
                    placeholder="Team name"
                    required
                  />
                  <button type="button" onClick={() => removeSlot(i)} className="text-slate-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={addSlot}>
                <Plus className="h-4 w-4 mr-1" /> Add team
              </Button>
            </CardContent>
          </Card>
        )}

        {/* LMS config */}
        {type === 'last_man_standing' && (
          <Card>
            <CardHeader><CardTitle>LMS Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField label="Max rounds" htmlFor="max_rounds">
                <Input id="max_rounds" name="max_rounds" type="number" min={1} max={52} defaultValue={10} />
              </FormField>
              <FormField label="Available teams" htmlFor="available_teams" hint="One team per line">
                <Textarea id="available_teams" name="available_teams" rows={8} placeholder={"Arsenal\nChelsea\nLiverpool\n..."} />
              </FormField>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="allow_team_reuse" value="true" className="rounded" />
                Allow participants to pick the same team more than once
              </label>
            </CardContent>
          </Card>
        )}

        {/* Donation target */}
        {type === 'donation' && (
          <Card>
            <CardHeader><CardTitle>Donation target (optional)</CardTitle></CardHeader>
            <CardContent>
              <FormField label="Target amount (£)" htmlFor="target_amount_pounds" hint="Leave blank for no target">
                <Input id="target_amount_pounds" name="target_amount_pounds" type="number" step="1" min="0" placeholder="500" />
              </FormField>
            </CardContent>
          </Card>
        )}

        {/* Entry & prize */}
        <Card>
          <CardHeader><CardTitle>Entry fee & prize</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Entry fee (£)" htmlFor="entry_fee_pounds" hint="Set to 0 for free entry">
              <Input id="entry_fee_pounds" name="entry_fee_pounds" type="number" step="0.50" min="0" max="100" required defaultValue="5" />
            </FormField>
            <FormField label="Maximum entries" htmlFor="max_entries" hint="Leave blank for unlimited">
              <Input id="max_entries" name="max_entries" type="number" min="1" placeholder="Unlimited" />
            </FormField>
            <FormField label="Prize type" htmlFor="prize_type">
              <Select
                id="prize_type"
                name="prize_type"
                options={prizeTypeOptions}
                value={prizeType}
                onChange={e => setPrizeType(e.target.value)}
              />
            </FormField>
            {prizeType === 'percentage' && (
              <FormField label="Prize (%)" htmlFor="prize_pct" hint="Percentage of total entry pot">
                <Input id="prize_pct" name="prize_pct" type="number" step="1" min="1" max="90" defaultValue="50" />
              </FormField>
            )}
            {prizeType === 'fixed' && (
              <FormField label="Prize amount (£)" htmlFor="prize_pounds">
                <Input id="prize_pounds" name="prize_pounds" type="number" step="1" min="1" />
              </FormField>
            )}
            {prizeType === 'description' && (
              <FormField label="Prize description" htmlFor="prize_description">
                <Input id="prize_description" name="prize_description" placeholder="e.g. Match day VIP tickets" />
              </FormField>
            )}
          </CardContent>
        </Card>

        {/* Split */}
        <Card>
          <CardHeader><CardTitle>Fundraising split</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Club fundraising (%)" htmlFor="club_pct" hint="Percentage of entry fee that goes to the club">
              <Input id="club_pct" name="club_pct" type="number" step="1" min="10" max="95" required defaultValue="40" />
            </FormField>
            <FormField label="Platform fee (%)" htmlFor="platform_fee_pct">
              <Input id="platform_fee_pct" name="platform_fee_pct" type="number" step="0.5" defaultValue="8" readOnly className="bg-slate-50" />
            </FormField>
            <input type="hidden" name="weekly_boost_contribution_pct" value="0" />
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader><CardTitle>Dates</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Opens at" htmlFor="opens_at" hint="Leave blank to open immediately on publish">
              <Input id="opens_at" name="opens_at" type="datetime-local" />
            </FormField>
            <FormField label="Closes at" htmlFor="closes_at">
              <Input id="closes_at" name="closes_at" type="datetime-local" />
            </FormField>
          </CardContent>
        </Card>

        {/* Terms */}
        <Card>
          <CardContent className="py-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" name="terms_accepted" value="true" required className="mt-0.5 rounded" />
              <span className="text-sm text-slate-600">
                I confirm this competition complies with ClubBoost&apos;s platform terms and is a genuine fundraising activity for our club.
              </span>
            </label>
          </CardContent>
        </Card>

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex gap-3">
          <Button type="submit" loading={pending} size="lg">Save as draft</Button>
          <Link href="/dashboard" className="btn-secondary inline-flex items-center justify-center px-6 py-3 text-base">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
