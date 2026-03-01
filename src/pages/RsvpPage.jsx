import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RsvpPage() {
  useEffect(() => { document.title = 'RSVP' }, [])

  const { code } = useParams()
  const [step, setStep] = useState('form') // 'form' | 'confirmed'
  const [status, setStatus] = useState(null) // 'attending' | 'declined'
  const [companions, setCompanions] = useState([])

  const { data: invitee, isLoading, isError } = useQuery({
    queryKey: ['rsvp', code],
    queryFn: () => api.get(`/rsvp/${code}`).then((r) => r.data),
    retry: false,
  })

  const { data: event } = useQuery({
    queryKey: ['event'],
    queryFn: () => api.get('/event').then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: (payload) => api.post(`/rsvp/${code}`, payload),
    onSuccess: () => setStep('confirmed'),
  })

  const handleStatusSelect = (value) => {
    setStatus(value)
    if (value === 'declined') setCompanions([])
  }

  const handleCompanionName = (index, value) => {
    setCompanions((prev) => {
      const next = [...prev]
      next[index] = { full_name: value }
      return next
    })
  }

  const handleAddCompanion = () => {
    setCompanions((prev) => [...prev, { full_name: '' }])
  }

  const handleRemoveCompanion = (index) => {
    setCompanions((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate({
      status,
      companions: status === 'attending' ? companions.filter((c) => c.full_name.trim()) : [],
    })
  }

  if (isLoading) {
    return <Screen><p className="text-muted-foreground">Cargando…</p></Screen>
  }

  if (isError) {
    return (
      <Screen>
        <p className="text-lg font-semibold">Invitación no encontrada</p>
        <p className="text-muted-foreground text-sm mt-1">
          Verifica que el enlace sea correcto.
        </p>
      </Screen>
    )
  }

  if (invitee.status !== 'pending') {
    return (
      <Screen>
        <p className="text-lg font-semibold">Ya recibimos tu respuesta</p>
        <p className="text-muted-foreground text-sm mt-1">
          {invitee.status === 'attending'
            ? '¡Nos alegra que puedas acompañarnos!'
            : 'Lamentamos que no puedas asistir.'}
        </p>
      </Screen>
    )
  }

  if (step === 'confirmed') {
    return (
      <Screen>
        <p className="text-2xl">
          {status === 'attending' ? '🎉' : '💌'}
        </p>
        <p className="text-lg font-semibold mt-2">
          {status === 'attending' ? '¡Nos vemos pronto!' : 'Gracias por avisarnos'}
        </p>
        <p className="text-muted-foreground text-sm mt-1">
          {status === 'attending'
            ? 'Tu confirmación fue registrada. ¡Te esperamos!'
            : 'Lamentamos que no puedas acompañarnos.'}
        </p>
      </Screen>
    )
  }

  return (
    <Screen>
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <p className="text-muted-foreground text-sm uppercase tracking-widest mb-1">
            Invitación
          </p>
          <h1 className="text-2xl font-semibold">{invitee.full_name}</h1>
        </div>

        {event && (
          <div className="flex flex-col gap-2 text-sm border rounded-lg p-4">
            {event.name && <p className="font-semibold text-base text-center">{event.name}</p>}
            {event.ceremony_at && (
              <div>
                <p className="font-medium">Ceremonia</p>
                <p className="text-muted-foreground">{new Date(event.ceremony_at).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}</p>
                {event.ceremony_url
                  ? <a href={event.ceremony_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{event.ceremony_location}</a>
                  : <p className="text-muted-foreground">{event.ceremony_location}</p>}
              </div>
            )}
            {event.reception_at && (
              <div>
                <p className="font-medium">Recepción</p>
                <p className="text-muted-foreground">{new Date(event.reception_at).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}</p>
                {event.reception_url
                  ? <a href={event.reception_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{event.reception_location}</a>
                  : <p className="text-muted-foreground">{event.reception_location}</p>}
              </div>
            )}
            {event.dress_code && (
              <div>
                <p className="font-medium">Vestimenta</p>
                <p className="text-muted-foreground">{event.dress_code}</p>
              </div>
            )}
            {event.rsvp_deadline && (
              <div>
                <p className="font-medium">Confirmar antes del</p>
                <p className="text-muted-foreground">{new Date(event.rsvp_deadline).toLocaleDateString('es-MX', { dateStyle: 'long' })}</p>
              </div>
            )}
          </div>
        )}

        {event?.deadline_passed && (
          <p className="text-sm text-center text-muted-foreground">
            El plazo para confirmar asistencia ha vencido. Para registrar tu respuesta comunícate directamente con los comprometidos.
          </p>
        )}


        {!event?.deadline_passed && <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Attendance */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-center">¿Asistirás a nuestra boda?</p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={status === 'attending' ? 'default' : 'outline'}
                onClick={() => handleStatusSelect('attending')}
                className="w-full"
              >
                Sí, asistiré
              </Button>
              <Button
                type="button"
                variant={status === 'declined' ? 'default' : 'outline'}
                onClick={() => handleStatusSelect('declined')}
                className="w-full"
              >
                No podré ir
              </Button>
            </div>
          </div>

          {/* Companions */}
          {status === 'attending' && invitee.allowed_companions > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">
                ¿Llevarás acompañantes?{' '}
                <span className="text-muted-foreground font-normal">
                  (máx. {invitee.allowed_companions})
                </span>
              </p>
              {companions.map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <Label htmlFor={`companion-${i}`}>Acompañante {i + 1}</Label>
                    <Input
                      id={`companion-${i}`}
                      placeholder="Nombre completo"
                      value={c.full_name}
                      onChange={(e) => handleCompanionName(i, e.target.value)}
                      maxLength={255}
                      required
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-6 shrink-0 text-muted-foreground"
                    onClick={() => handleRemoveCompanion(i)}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              {companions.length < invitee.allowed_companions && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCompanion}
                >
                  + Agregar acompañante
                </Button>
              )}
            </div>
          )}

          {status && (
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? 'Enviando…' : 'Confirmar'}
            </Button>
          )}

          {mutation.isError && (
            <p className="text-sm text-destructive text-center">
              Ocurrió un error. Intenta de nuevo.
            </p>
          )}
        </form>}
      </div>
    </Screen>
  )
}

function Screen({ children }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      {children}
    </div>
  )
}
