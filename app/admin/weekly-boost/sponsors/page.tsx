'use client'

import { useState, useTransition, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button }    from '@/components/ui/button'
import { Input }     from '@/components/ui/input'
import { Alert }     from '@/components/ui/alert'
import { FormField } from '@/components/ui/label'
import { Badge }     from '@/components/ui/badge'
import { ArrowLeft, Plus, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { createSponsorAction, updateSponsorStatusAction } from '@/actions/weekly-boost'
import type { BoostSponsor } from '@/types/app'

// We fetch sponsors client-side so we can refresh after mutations
async function fetchSponsors(): Promise<BoostSponsor[]> {
  const res = await fetch('/api/admin/boost/sponsors', { cache: 'no-store' })
  if (!res.ok) return []
  return res.json()
}

function SponsorCard({
  sponsor,
  onToggle,
  toggling,
}: {
  sponsor:  BoostSponsor
  onToggle: (id: string, active: boolean) => void
  toggling: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-slate-200 bg-white">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{sponsor.name}</span>
          {sponsor.is_active ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </div>
        {sponsor.website_url && (
          <a
            href={sponsor.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
          >
            {sponsor.website_url} <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {sponsor.contact_name && (
          <p className="text-xs text-slate-500 mt-0.5">
            Contact: {sponsor.contact_name}
            {sponsor.contact_email && ` · ${sponsor.contact_email}`}
          </p>
        )}
      </div>
      <Button
        size="sm"
        variant={sponsor.is_active ? 'ghost' : 'secondary'}
        onClick={() => onToggle(sponsor.id, !sponsor.is_active)}
        loading={toggling}
        className={sponsor.is_active ? 'text-red-600 hover:text-red-700' : ''}
      >
        {sponsor.is_active ? 'Deactivate' : 'Activate'}
      </Button>
    </div>
  )
}

function AddSponsorForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen]           = useState(false)
  const [pending, start]          = useTransition()
  const [error, setError]         = useState<string | null>(null)
  const [name, setName]           = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [website, setWebsite]     = useState('')

  function handleCreate() {
    setError(null)
    if (!name.trim()) { setError('Sponsor name is required'); return }
    start(async () => {
      const res = await createSponsorAction({
        name: name.trim(),
        contactName:  contactName  || undefined,
        contactEmail: contactEmail || undefined,
        websiteUrl:   website      || undefined,
      })
      if (!res.success) { setError(res.error); return }
      setName(''); setContactName(''); setContactEmail(''); setWebsite('')
      setOpen(false)
      onCreated()
    })
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" /> Add sponsor
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle>New sponsor</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <FormField label="Sponsor name" htmlFor="sp-name">
          <Input
            id="sp-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Acme Ltd"
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Contact name (optional)" htmlFor="sp-contact-name">
            <Input
              id="sp-contact-name"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="Jane Smith"
            />
          </FormField>
          <FormField label="Contact email (optional)" htmlFor="sp-contact-email">
            <Input
              id="sp-contact-email"
              type="email"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              placeholder="jane@acme.com"
            />
          </FormField>
        </div>
        <FormField label="Website (optional)" htmlFor="sp-website">
          <Input
            id="sp-website"
            type="url"
            value={website}
            onChange={e => setWebsite(e.target.value)}
            placeholder="https://acme.com"
          />
        </FormField>

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex gap-3">
          <Button onClick={handleCreate} loading={pending}>Create sponsor</Button>
          <Button
            variant="secondary"
            onClick={() => { setOpen(false); setError(null) }}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SponsorsPage() {
  const [sponsors, setSponsors] = useState<BoostSponsor[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [toggling, startToggle] = useTransition()

  async function reload() {
    setLoading(true)
    try {
      const data = await fetchSponsors()
      setSponsors(data)
    } catch {
      setError('Failed to load sponsors')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  function handleToggle(id: string, active: boolean) {
    setError(null)
    startToggle(async () => {
      const res = await updateSponsorStatusAction(id, active)
      if (!res.success) { setError(res.error); return }
      await reload()
    })
  }

  const active   = sponsors.filter(s => s.is_active)
  const inactive = sponsors.filter(s => !s.is_active)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/weekly-boost"
          className="text-slate-500 hover:text-slate-700 flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Weekly Boost
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-xl font-semibold text-slate-900">Sponsors</h1>
      </div>

      <p className="text-sm text-slate-600">
        Manage sponsor organisations that contribute to the Weekly Boost fund. Sponsors can be
        linked to specific fund contributions when adding to a period.
      </p>

      <AddSponsorForm onCreated={reload} />

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading sponsors…</p>
      ) : sponsors.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-500">
            No sponsors yet. Add your first sponsor above.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-slate-700 uppercase tracking-wide">
                Active ({active.length})
              </h2>
              {active.map(s => (
                <SponsorCard
                  key={s.id}
                  sponsor={s}
                  onToggle={handleToggle}
                  toggling={toggling}
                />
              ))}
            </div>
          )}

          {inactive.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
                Inactive ({inactive.length})
              </h2>
              {inactive.map(s => (
                <SponsorCard
                  key={s.id}
                  sponsor={s}
                  onToggle={handleToggle}
                  toggling={toggling}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
