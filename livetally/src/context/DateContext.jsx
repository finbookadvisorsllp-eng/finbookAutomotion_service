import { createContext, useState, useContext } from 'react'

const DateContext = createContext()

export function DateProvider({ children }) {
  const [selectedDateRange, setSelectedDateRange] = useState("This Year (1st Apr '26 - 31st Mar '27)")
  return (
    <DateContext.Provider value={{ selectedDateRange, setSelectedDateRange }}>
      {children}
    </DateContext.Provider>
  )
}

export const useDateRange = () => useContext(DateContext)
