import { z } from 'zod'

export const clubSchema = z.object({
  name:           z.string().min(2, 'Club name must be at least 2 characters').max(100),
  sport:          z.string().default('football'),
  team_age_group: z.string().max(50).optional(),
  location:       z.string().min(2, 'Location is required').max(100),
  contact_name:   z.string().min(2, 'Contact name is required').max(100),
  contact_email:  z.string().email('Valid email required'),
  contact_phone:  z.string().max(20).optional(),
  description:    z.string().max(500).optional(),
})

export type ClubFormData = z.infer<typeof clubSchema>

export const clubApprovalSchema = z.object({
  status:           z.enum(['approved', 'rejected', 'suspended']),
  rejection_reason: z.string().max(500).optional(),
  suspension_reason: z.string().max(500).optional(),
})

export type ClubApprovalData = z.infer<typeof clubApprovalSchema>
