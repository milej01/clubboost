import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClubsForUser } from '@/lib/services/clubs'
import { NewCompetitionForm } from './new-competition-form'
import { Alert } from '@/components/ui/alert'
import Link from 'next/link'

export default async function NewCompetitionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clubs = await getClubsForUser(user.id)
  const club = clubs.find(c => c.status === 'approved')

  if (!club) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">New competition</h1>
        <Alert variant="warning">
          {clubs.length === 0
            ? 'You need to create a club before you can run a competition.'
            : 'Your club is pending approval. You can create competitions once a platform admin has approved your club.'}
        </Alert>
        <Link href="/dashboard" className="btn-secondary inline-flex items-center justify-center">Back to dashboard</Link>
      </div>
    )
  }

  return <NewCompetitionForm clubId={club.id} />
}
