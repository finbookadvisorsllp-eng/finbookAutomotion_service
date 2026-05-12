import { Navigate, useLocation } from 'react-router-dom'
import { useAuthToken } from '../stores/useAppStore'

// Gate every authenticated route. Unauthenticated users are bounced to /login,
// with `from` preserved so the login flow can return them after sign-in.
export default function ProtectedRoute({ children }) {
  const token = useAuthToken()
  const location = useLocation()
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}
