import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function StatCard({ label, value, sub }) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <span className="text-3xl font-bold">{value}</span>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  useEffect(() => { document.title = 'RSVP Admin | Dashboard' }, [])

  const activeEvent = useAuthStore((s) => s.activeEvent)

  const { data: invitees = [], isLoading } = useQuery({
    queryKey: ['invitees', activeEvent?.id],
    queryFn: () => api.get(`/events/${activeEvent.id}/invitees`).then((r) => r.data),
    enabled: !!activeEvent?.id,
  })

  const total       = invitees.reduce((sum, i) => sum + 1 + (i.allowed_companions ?? 0), 0)
  const attending   = invitees.filter((i) => i.status === 'attending').reduce((sum, i) => sum + 1 + (i.companions?.length ?? 0), 0)
  const declined    = invitees.filter((i) => i.status === 'declined').reduce((sum, i) => sum + 1 + (i.allowed_companions ?? 0), 0)
  const pending     = invitees.filter((i) => i.status === 'pending').reduce((sum, i) => sum + 1 + (i.allowed_companions ?? 0), 0)
  const responded   = invitees.filter((i) => i.status !== 'pending').length
  const responseRate = invitees.length > 0 ? Math.round((responded / invitees.length) * 100) : 0
  const sentCount   = invitees.filter((i) => i.invitation_sent).length
  const lateCount   = invitees.filter((i) => i.type === 'late').length

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total invited"       value={total} />
          <StatCard label="Attending"           value={attending} />
          <StatCard label="Declined"            value={declined} />
          <StatCard label="Pending"             value={pending} />
          <StatCard label="Unique invitations"  value={invitees.length} sub="invitees only, no companions" />
          <StatCard label="Response rate"       value={`${responseRate}%`} sub={`${responded} of ${invitees.length} responded`} />
          <StatCard label="Invitations sent"    value={`${sentCount} / ${invitees.length}`} />
          {lateCount > 0 && (
            <StatCard label="Late invitees" value={lateCount} />
          )}
        </div>
      )}
    </div>
  )
}
