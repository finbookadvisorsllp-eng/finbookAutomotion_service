import { z } from 'zod'

const schema = z.object({
  VITE_API_BASE_URL: z.string().url().default('http://localhost:8000/api'),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
})

const parsed = schema.safeParse(import.meta.env)

if (!parsed.success) {
  // Fail fast at startup with a readable message instead of a 404 three screens deep.
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables — check .env')
}

export const env = parsed.data
