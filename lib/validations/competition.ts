import { z } from 'zod'

const fixtureSchema = z.object({
  fixture_order: z.number().int().min(0),
  home_team:     z.string().min(1, 'Home team required'),
  away_team:     z.string().min(1, 'Away team required'),
  kickoff_at:    z.string().optional(),
})

const teamSlotSchema = z.object({
  slot_number: z.number().int().min(1),
  team_name:   z.string().min(1, 'Team name required'),
})

export const competitionSchema = z.object({
  type:        z.enum(['predictor', 'last_man_standing', 'team_card', 'donation']),
  title:       z.string().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().max(1000).optional(),
  rules_text:  z.string().max(2000).optional(),

  entry_fee_pounds: z.coerce
    .number()
    .min(0, 'Entry fee cannot be negative')
    .max(100, 'Entry fee cannot exceed £100'),

  max_entries: z.coerce.number().int().positive().optional().nullable(),

  prize_type:        z.enum(['percentage', 'fixed', 'description', 'none']),
  prize_pct:         z.coerce.number().min(0).max(100).optional(),
  prize_pounds:      z.coerce.number().min(0).optional(),
  prize_description: z.string().max(200).optional(),

  club_pct:     z.coerce.number().min(10, 'Club share must be at least 10%').max(95),
  platform_fee_pct:         z.coerce.number().min(0).max(30),
  weekly_boost_contribution_pct: z.coerce.number().min(0).max(10),

  opens_at:  z.string().optional().nullable(),
  closes_at: z.string().optional().nullable(),

  // Type-specific
  fixtures:    z.array(fixtureSchema).optional(),
  team_slots:  z.array(teamSlotSchema).optional(),

  // LMS
  max_rounds:          z.coerce.number().int().min(1).max(52).optional(),
  allow_team_reuse:    z.boolean().optional(),
  available_teams:     z.array(z.string()).optional(),
  round_deadline_hours: z.coerce.number().min(1).max(168).optional(),

  // Donation
  target_amount_pounds: z.coerce.number().min(0).optional(),
  show_progress:        z.boolean().optional(),

  terms_accepted: z.boolean().refine(v => v === true, 'You must accept the terms'),
})
.superRefine((data, ctx) => {
  if (data.type === 'predictor' && (!data.fixtures || data.fixtures.length !== 6)) {
    ctx.addIssue({ code: 'custom', path: ['fixtures'], message: 'Six fixtures are required for a predictor competition' })
  }
  if (data.type === 'team_card' && (!data.team_slots || data.team_slots.length < 2)) {
    ctx.addIssue({ code: 'custom', path: ['team_slots'], message: 'At least 2 teams are required for a team card' })
  }
  if (data.prize_type === 'percentage' && (data.prize_pct === undefined || data.prize_pct <= 0)) {
    ctx.addIssue({ code: 'custom', path: ['prize_pct'], message: 'Prize percentage must be greater than 0' })
  }
  if (data.prize_type === 'fixed' && (data.prize_pounds === undefined || data.prize_pounds <= 0)) {
    ctx.addIssue({ code: 'custom', path: ['prize_pounds'], message: 'Fixed prize amount must be greater than 0' })
  }
  // Splits should total ≤ 100%
  const prizePct = data.prize_type === 'percentage' ? (data.prize_pct ?? 0) : 0
  const total = prizePct + data.club_pct + data.platform_fee_pct + data.weekly_boost_contribution_pct
  if (total > 100) {
    ctx.addIssue({ code: 'custom', path: ['club_pct'], message: `Split total is ${total}% — must not exceed 100%` })
  }
})

export type CompetitionFormData = z.infer<typeof competitionSchema>

// Settlement result input
export const settlementSchema = z.object({
  competition_id: z.string().uuid(),
  fixture_results: z.array(z.object({
    fixture_id: z.string().uuid(),
    result:     z.enum(['H', 'D', 'A']),
  })).optional(),
  winning_slot_number: z.number().int().optional(),
  winner_entry_id:     z.string().uuid().optional(),
  notes:               z.string().max(500).optional(),
})

export type SettlementFormData = z.infer<typeof settlementSchema>
