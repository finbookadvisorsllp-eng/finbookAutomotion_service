import { createContext, useState, useContext, useEffect } from 'react'
import { getFinancialYears } from '../api'

const DateContext = createContext()

export function DateProvider({ children }) {
  const [years, setYears] = useState([])           // [{id,label}]
  const [fy, setFy] = useState(null)               // selected financial-year id, e.g. "2025-2026"
  const [selectedDateRange, setSelectedDateRange] = useState('')

  // Load selectable financial years from the backend; default to the latest
  // year that actually has data.
  useEffect(() => {
    let alive = true
    getFinancialYears()
      .then((res) => {
        if (!alive || !res) return
        const list = res.years || []
        setYears(list)
        if (list.length) {
          const def = list[list.length - 1] // latest year (oldest -> newest order)
          setFy(def.id)
          setSelectedDateRange(def.label)
        }
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

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
