import { z } from 'zod'

// Validate at the boundary. Without TypeScript, this is the only thing
// preventing a bad backend response from silently corrupting the UI.
export const CompanySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  gstin: z.string().nullable().optional(),
  createdAt: z.string().optional(),
})

export const CompanyListSchema = z.array(CompanySchema)
