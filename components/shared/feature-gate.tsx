import { isFeatureEnabled } from '@/lib/feature-flags'
import type { FeatureFlagKey } from '@/types/app'

interface FeatureGateProps {
  flag:      FeatureFlagKey
  fallback?: React.ReactNode
  children:  React.ReactNode
}

// Server component — flag checked on server side, no client round-trip
export async function FeatureGate({ flag, fallback = null, children }: FeatureGateProps) {
  const enabled = await isFeatureEnabled(flag)
  if (!enabled) return <>{fallback}</>
  return <>{children}</>
}
