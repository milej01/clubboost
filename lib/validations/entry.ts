import { z } from 'zod'

export const predictorEntrySchema = z.object({
  competition_id: z.string().uuid(),
  predictions: z.array(z.object({
    fixture_id:       z.string().uuid(),
    predicted_result: z.enum(['H', 'D', 'A']),
  })).min(1, 'At least one prediction required'),
})

export const lmsEntrySchema = z.object({
  competition_id: z.string().uuid(),
  // First round pick submitted at entry time (subsequent rounds handled in-game)
  initial_team: z.string().min(1, 'You must pick a team'),
})

export const teamCardEntrySchema = z.object({
  competition_id: z.string().uuid(),
  slot_number:    z.number().int().min(1, 'You must select a team'),
})

export const donationEntrySchema = z.object({
  competition_id: z.string().uuid(),
  message:        z.string().max(200).optional(),
})

export type PredictorEntryFormData = z.infer<typeof predictorEntrySchema>
export type LMSEntryFormData       = z.infer<typeof lmsEntrySchema>
export type TeamCardEntryFormData  = z.infer<typeof teamCardEntrySchema>
export type DonationEntryFormData  = z.infer<typeof donationEntrySchema>
