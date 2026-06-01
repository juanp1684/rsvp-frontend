import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import AdminLayout from '@/components/AdminLayout'
import ProtectedRoute from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import EventPage from '@/pages/EventPage'
import EventPickerPage from '@/pages/EventPickerPage'
import InviteesPage from '@/pages/InviteesPage'
import InvitationsPage from '@/pages/InvitationsPage'
import UsersPage from '@/pages/UsersPage'
import RsvpPage from '@/pages/RsvpPage'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/rsvp/:eventSlug/:code" element={<RsvpPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="invitees" element={<InviteesPage />} />
            <Route path="invitations" element={<InvitationsPage />} />
            <Route path="event" element={<EventPage />} />
            <Route path="events" element={<EventPickerPage />} />
            <Route path="users" element={<UsersPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
