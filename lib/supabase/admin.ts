import { createClient } from '@supabase/supabase-js'

// Service role client — bypasses RLS. NEVER expose to client.
// Only import from server-side code (route handlers, server actions).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
