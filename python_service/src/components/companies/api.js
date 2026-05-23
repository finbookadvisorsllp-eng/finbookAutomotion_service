import api from '../../lib/axios'
import { CompanyListSchema, CompanySchema } from './schema'

// Reference shape: one function per endpoint, axios + Zod-validate the response.
// Every other feature folder should mirror this pattern (api.js + schema.js + hooks.js).

export const fetchCompanies = async () => {
  const { data } = await api.get('/companies')
  return CompanyListSchema.parse(data)
}

export const createCompany = async (payload) => {
  const { data } = await api.post('/companies', payload)
  return CompanySchema.parse(data)
}
