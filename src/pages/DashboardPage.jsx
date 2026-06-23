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

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['invitations', activeEvent?.id],
    queryFn: () => api.get(`/events/${activeEvent.id}/invitations`).then((r) => r.data),
    enabled: !!activeEvent?.id,
  })

  const invitees = invitations.flatMap((inv) => inv.invitees.map((i) => ({ ...i, type: inv.type })))

  const invitationCount   = invitations.length
  const allowedCompanions = invitations.reduce((sum, inv) => sum + (inv.allowed_companions ?? 0), 0)

  let actualCompanions = 0
  let declinedUnfilled = 0
  let pendingUnfilled  = 0
  for (const inv of invitations) {
    const unfilled     = Math.max(0, (inv.allowed_companions ?? 0) - (inv.companions?.length ?? 0))
    const hasResponded = inv.invitees.some((i) => i.status !== 'pending')
    actualCompanions  += inv.companions?.length ?? 0
    if (hasResponded) declinedUnfilled += unfilled
    else              pendingUnfilled  += unfilled
  }

  const total     = invitees.length + allowedCompanions
  const attending = invitees.filter((i) => i.status === 'attending').length + actualCompanions
  const declined  = invitees.filter((i) => i.status === 'declined').length + declinedUnfilled
  const pending   = invitees.filter((i) => i.status === 'pending').length + pendingUnfilled
  const responded    = invitees.filter((i) => i.status !== 'pending').length
  const responseRate = invitees.length > 0 ? Math.round((responded / invitees.length) * 100) : 0
  const sentCount    = invitations.filter((inv) => inv.invitation_sent).length
  const lateCount    = invitees.filter((i) => i.type === 'late').length

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Cargando…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total invitados"       value={total} />
          <StatCard label="Asistirá"              value={attending} />
          <StatCard label="Rechazó"               value={declined} />
          <StatCard label="Pendiente"             value={pending} />
          <StatCard label="Invitaciones únicas"   value={invitationCount} sub="solo invitados, sin acompañantes" />
          <StatCard label="Tasa de respuesta"     value={`${responseRate}%`} sub={`${responded} de ${invitees.length} respondieron`} />
          <StatCard label="Invitaciones enviadas" value={`${sentCount} / ${invitationCount}`} />
          {lateCount > 0 && (
            <StatCard label="Invitados rezagados" value={lateCount} />
          )}
        </div>
      )}
    </div>
  )
}
