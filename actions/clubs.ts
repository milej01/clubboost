'use server'

import { createClient } from '@/lib/supabase/server'
import { createClub, updateClub } from '@/lib/services/clubs'
import { clubSchema } from '@/lib/validations/club'
import type { ActionResult } from '@/types/app'
import { revalidatePath } from 'next/cache'

export async function createClubAction(formData: FormData): Promise<ActionResult<{ clubId: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'You must be logged in' }

  const parsed = clubSchema.safeParse({
    name:           formData.get('name'),
    sport:          formData.get('sport') ?? 'football',
    team_age_group: formData.get('team_age_group') || undefined,
    location:       formData.get('location'),
    contact_name:   formData.get('contact_name'),
    contact_email:  formData.get('contact_email'),
    contact_phone:  formData.get('contact_phone') || undefined,
    description:    formData.get('description') || undefined,
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  const { club, error } = await createClub(user.id, parsed.data)
  if (error || !club) return { success: false, error: error ?? 'Failed to create club' }

  revalidatePath('/dashboard')
  return { success: true, data: { clubId: club.id } }
}

export async function updateClubAction(
  clubId: string,
  formData: FormData
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const parsed = clubSchema.partial().safeParse({
    name:           formData.get('name'),
    sport:          formData.get('sport'),
    team_age_group: formData.get('team_age_group') || undefined,
    location:       formData.get('location'),
    contact_name:   formData.get('contact_name'),
    contact_email:  formData.get('contact_email'),
    contact_phone:  formData.get('contact_phone') || undefined,
    description:    formData.get('description') || undefined,
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  const { error } = await updateClub(clubId, user.id, parsed.data)
  if (error) return { success: false, error }

  revalidatePath('/dashboard/club/settings')
  return { success: true, data: undefined }
}
