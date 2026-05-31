import { createAdminClient } from '@/lib/supabase/admin'
import type { AuditAction } from '@/types/app'

interface AuditParams {
  actorId:     string | null
  clubId?:     string | null
  entityType:  string
  entityId?:   string | null
  action:      AuditAction | string
  beforeState?: Record<string, unknown> | null
  afterState?:  Record<string, unknown> | null
  metadata?:    Record<string, unknown>
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const db = createAdminClient()
    await db.from('audit_log').insert({
      actor_id:     params.actorId,
      club_id:      params.clubId ?? null,
      entity_type:  params.entityType,
      entity_id:    params.entityId ?? null,
      action:       params.action,
      before_state: params.beforeState ?? null,
      after_state:  params.afterState ?? null,
      metadata:     params.metadata ?? {},
    })
  } catch (err) {
    // Audit failures must never break the main flow
    console.error('[audit] Failed to write audit log:', err)
  }
}
