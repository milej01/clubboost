import { createClient } from '@/lib/supabase/server'
import type { FeatureFlagKey, FeatureFlag } from '@/types/app'
import { cache } from 'react'

// Cached per-request via React cache()
export const getFeatureFlags = cache(async (): Promise<FeatureFlag[]> => {
  const supabase = await createClient()
  const { data } = await supabase.from('feature_flags').select('*')
  return data ?? []
})

export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const flags = await getFeatureFlags()
  return flags.find(f => f.key === key)?.enabled ?? false
}

export async function getFeatureFlagMeta(key: FeatureFlagKey): Promise<Record<string, unknown>> {
  const flags = await getFeatureFlags()
  return flags.find(f => f.key === key)?.metadata ?? {}
}
