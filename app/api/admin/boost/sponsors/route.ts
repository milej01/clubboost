import { NextResponse } from 'next/server'
import { createClient }  from '@/lib/supabase/server'
import { getSponsors }   from '@/lib/services/weekly-boost'

export async function GET() {
  // Auth check — platform admin only
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('platform_role')
    .eq('id', user.id)
    .single()

  if (profile?.platform_role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sponsors = await getSponsors()
  return NextResponse.json(sponsors)
}
