'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { ActionResult } from '@/types/app'

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(6),
})

const registerSchema = z.object({
  display_name: z.string().min(2).max(100),
  email:        z.string().email(),
  password:     z.string().min(8, 'Password must be at least 8 characters'),
})

export async function loginAction(formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse({
    email:    formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { success: false, error: error.message }

  return { success: true, data: { redirectTo: '/dashboard' } }
}

export async function registerAction(formData: FormData): Promise<ActionResult<void>> {
  const parsed = registerSchema.safeParse({
    display_name: formData.get('display_name'),
    email:        formData.get('email'),
    password:     formData.get('password'),
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email:    parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.display_name },
    },
  })

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
