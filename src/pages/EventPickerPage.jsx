import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const fmt = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { dateStyle: 'long' }) : null

export default function EventPickerPage() {
  useEffect(() => { document.title = 'RSVP Admin | Select Event' }, [])

  const navigate = useNavigate()
  const setActiveEvent = useAuthStore((s) => s.setActiveEvent)

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
      <h1 className="text-xl font-semibold">Select Event</h1>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {events.map((event) => (
            <button
              key={event.id}
              onClick={() => handleSelect(event)}
              className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
            >
              <Card className="hover:border-foreground/40 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{event.name}</CardTitle>
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
          ))}
        </div>
      )}
    </div>
  )
}
