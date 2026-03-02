import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export default function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const activeEvent = useAuthStore((s) => s.activeEvent)
  const { pathname } = useLocation()

  if (!token) return <Navigate to="/login" replace />

  // Super admins without an active event go to the event picker
  // (skip redirect if already on /events to avoid a loop)
  if (user?.role === 'super_admin' && !activeEvent && pathname !== '/events') {
    return <Navigate to="/events" replace />
  }

  return children
}
