import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchCompanies, createCompany } from './api'

const KEY = ['companies']

export const useCompanies = () =>
  useQuery({ queryKey: KEY, queryFn: fetchCompanies })

export const useCreateCompany = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCompany,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      toast.success('Company created')
    },
    onError: (err) => toast.error(err?.message ?? 'Could not create company'),
  })
}
