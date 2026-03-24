import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

const fmt = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { dateStyle: 'long' }) : null

export default function EventPickerPage() {
  useEffect(() => { document.title = 'RSVP Admin | Select Event' }, [])

  const navigate = useNavigate()
  const setActiveEvent = useAuthStore((s) => s.setActiveEvent)
  const activeEvent = useAuthStore((s) => s.activeEvent)

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get('/events').then((r) => r.data),
  })

  const handleSelect = (event) => {
    setActiveEvent(event)
    navigate('/')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        {activeEvent && (
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <h1 className="text-xl font-semibold">Select Event</h1>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {events.map((event) => {
            const isCurrent = activeEvent?.id === event.id
            return (
              <button
                key={event.id}
                onClick={() => handleSelect(event)}
                className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
              >
                <Card className={`hover:border-foreground/40 transition-colors cursor-pointer h-full ${isCurrent ? 'border-foreground/60' : ''}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{event.name}</CardTitle>
                      {isCurrent && <Badge variant="secondary">Current</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
                    {event.ceremony_at && (
                      <p>Ceremony: {fmt(event.ceremony_at)}</p>
                    )}
                    {event.reception_at && (
                      <p>Reception: {fmt(event.reception_at)}</p>
                    )}
                    {event.slug && (
                      <p className="font-mono text-xs mt-1">{event.slug}</p>
                    )}
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
