import { createContext, useState, useContext, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getFinancialYears } from '../api'
import { getCompanyId } from '../api/client'
import { CACHE_TIMES } from '../queryClient'

const DateContext = createContext()

export function DateProvider({ children }) {
  const [fy, setFy] = useState(null)               // selected financial-year id, e.g. "2025-2026"
  const [selectedDateRange, setSelectedDateRange] = useState('')

  // Selectable financial years — master data, cached (was a bare useEffect that
  // re-fetched on every provider mount).
  const { data } = useQuery({
    queryKey: ['company', getCompanyId(), 'financial-years'],
    queryFn: getFinancialYears,
    ...CACHE_TIMES.master,
  })
  const years = data?.years || []

  // Default to the latest year that actually has data, once the list loads.
  useEffect(() => {
    if (years.length && !fy) {
      const def = years[years.length - 1] // latest year (oldest -> newest order)
      setFy(def.id)
      setSelectedDateRange(def.label)
    }
  }, [years, fy])

  const selectFy = (id) => {
    setFy(id)
    const match = years.find((y) => y.id === id)
    if (match) setSelectedDateRange(match.label)
  }

  return (
    <DateContext.Provider value={{ fy, years, selectFy, setFy, selectedDateRange, setSelectedDateRange }}>
      {children}
    </DateContext.Provider>
  )
}

export const useDateRange = () => useContext(DateContext)
