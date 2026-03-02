import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const statCards = [
  { key: 'total',    label: 'Total invited' },
  { key: 'attending', label: 'Attending' },
  { key: 'declined', label: 'Declined' },
  { key: 'pending',  label: 'Pending' },
]

export default function DashboardPage() {
  useEffect(() => { document.title = 'RSVP Admin | Dashboard' }, [])

  const activeEvent = useAuthStore((s) => s.activeEvent)

  const { data: invitees = [], isLoading } = useQuery({
    queryKey: ['invitees', activeEvent?.id],
    queryFn: () => api.get(`/events/${activeEvent.id}/invitees`).then((r) => r.data),
    enabled: !!activeEvent?.id,
  })

  const capacity = (list) => list.reduce((sum, i) => sum + 1 + (i.allowed_companions ?? 0), 0)

  const stats = {
    total:    capacity(invitees),
    attending: invitees.filter((i) => i.status === 'attending')
      .reduce((sum, i) => sum + 1 + (i.companions?.length ?? 0), 0),
    declined: capacity(invitees.filter((i) => i.status === 'declined')),
    pending:  capacity(invitees.filter((i) => i.status === 'pending')),
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map(({ key, label }) => (
            <Card key={key}>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <span className="text-3xl font-bold">{stats[key]}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
