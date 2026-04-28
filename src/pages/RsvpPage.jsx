import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImageIcon, Play, Pause } from 'lucide-react'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'

export default function RsvpPage() {
  useEffect(() => { document.title = 'RSVP' }, [])

  const { eventSlug, code } = useParams()
  const [step, setStep] = useState('form') // 'form' | 'confirmed'
  const [status, setStatus] = useState(null) // 'attending' | 'declined'
  const [companions, setCompanions] = useState([])
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef(null)

  const { data: invitee, isLoading, isError } = useQuery({
    queryKey: ['rsvp', eventSlug, code],
    queryFn: () => api.get(`/rsvp/${eventSlug}/${code}`).then((r) => r.data),
    retry: false,
  })

  const { data: event } = useQuery({
    queryKey: ['event', eventSlug],
    queryFn: () => api.get(`/event/${eventSlug}`).then((r) => r.data),
  })

  const isEditing = invitee?.status !== 'pending'

  const effectiveDeadline = invitee?.type === 'late'
    ? (event?.late_rsvp_deadline ?? event?.rsvp_deadline)
    : event?.rsvp_deadline

  const deadlinePassed = invitee?.type === 'late'
    ? (effectiveDeadline ? new Date() > new Date(effectiveDeadline) : false)
    : (event?.deadline_passed ?? false)

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = 0.5
  }, [event?.song_url])

  useEffect(() => {
    if (!invitee || invitee.status === 'pending') return
    setStatus(invitee.status)
    if (invitee.status === 'attending') {
      setCompanions(invitee.companions.map((c) => ({ full_name: c.full_name })))
    }
  }, [invitee])

  const mutation = useMutation({
    mutationFn: (payload) => api.post(`/rsvp/${eventSlug}/${code}`, payload),
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

  if (step === 'confirmed') {
    const confirmImageUrl = status === 'attending'
      ? event?.confirm_attending_image_url
      : event?.confirm_declined_image_url

    return (
      <Screen>
        {confirmImageUrl
          ? <img
              src={confirmImageUrl}
              alt=""
              className="w-64 aspect-[3/4] rounded-2xl object-cover shadow-md"
            />
          : <p className="text-2xl">
              {status === 'attending' ? '🎉' : '💌'}
            </p>
        }
        <p className="text-lg font-semibold mt-4">
          {status === 'attending'
            ? (event?.confirm_attending_message || '¡Nos vemos pronto!')
            : (event?.confirm_declined_message || 'Gracias por avisarnos')}
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
    <div className="min-h-screen flex flex-col bg-[#FFF1E9]">

      {/* Event title banner */}
      {event?.name && (
        <div className="w-full py-8 px-6 flex justify-center bg-[#FFF1E9]">
          <h1 className="font-display italic text-4xl md:text-6xl text-center leading-tight text-[#412D26]/80">
            {event.name}
          </h1>
        </div>
      )}

      {/* Hero — couple photo */}
      <div className="w-full aspect-[4/5] md:aspect-[10/6] bg-muted overflow-hidden">
        {event?.couple_image_url
          ? <picture className="w-full h-full">
              <source media="(min-width: 768px)" srcSet={event.couple_image_url} />
              <img
                src={event.couple_mobile_image_url ?? event.couple_image_url}
                alt="Foto de la pareja"
                className="w-full h-full object-cover object-top"
              />
            </picture>
          : <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              <ImageIcon className="h-16 w-16 text-muted-foreground/25" />
              <p className="text-xs text-muted-foreground/40 uppercase tracking-widest">Foto de la pareja</p>
            </div>
        }
      </div>

      {/* Music player */}
      {event?.song_url && (
        <>
          <audio ref={audioRef} src={event.song_url} loop preload="auto" />
          <div className="w-full flex flex-col items-center gap-2 py-4">
            <p className={`text-xs text-[#735749]/60 uppercase tracking-widest ${isPlaying ? 'invisible' : ''}`}>Dale Play</p>
            <button
              type="button"
              onClick={() => {
                const audio = audioRef.current
                if (!audio) return
                if (isPlaying) {
                  audio.pause()
                  setIsPlaying(false)
                } else {
                  audio.play().then(() => setIsPlaying(true)).catch(() => {})
                }
              }}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-[#412D26]/10 hover:bg-[#412D26]/20 transition-colors text-[#412D26]"
              aria-label={isPlaying ? 'Pausar música' : 'Reproducir música'}
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
            </button>
          </div>
        </>
      )}

      {/* Gold divider */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-[#C0A18F]/60 to-transparent" />

      <div className="w-full max-w-2xl mx-auto px-4 md:px-8 py-10">
      <div className="flex flex-col items-center gap-10 bg-[#FFF1E9]/90 backdrop-blur-sm rounded-3xl shadow-xl shadow-[#412D26]/10 border border-[#C0A18F]/40 px-6 md:px-10 py-12">

        {/* Invitee name + event title */}
        <div className="text-center">
          <p className="text-[#735749]/60 text-xs uppercase tracking-widest mb-2">Invitación</p>
          <h1 className="text-3xl font-semibold">{invitee.full_name}</h1>
        </div>

        {/* Parents */}
        {(event?.partner1_parent1 || event?.partner1_parent2 || event?.partner2_parent1 || event?.partner2_parent2) && (
          <div className="w-full text-center flex flex-col items-center gap-5">
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs uppercase tracking-[0.2em] text-[#412D26]/60">Con la bendición de</p>
              <p className="font-display italic text-2xl text-[#735749]">nuestros padres</p>
            </div>
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-6">
              {(event.partner1_parent1 || event.partner1_parent2) && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs uppercase tracking-[0.15em] text-[#412D26]/60">De la novia</p>
                  {event.partner1_parent1 && <p className="italic text-[#412D26]">{event.partner1_parent1}</p>}
                  {event.partner1_parent2 && <p className="italic text-[#412D26]">y {event.partner1_parent2}</p>}
                </div>
              )}
              {(event.partner2_parent1 || event.partner2_parent2) && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs uppercase tracking-[0.15em] text-[#412D26]/60">Del novio</p>
                  {event.partner2_parent1 && <p className="italic text-[#412D26]">{event.partner2_parent1}</p>}
                  {event.partner2_parent2 && <p className="italic text-[#412D26]">y {event.partner2_parent2}</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ceremonies */}
        {(event?.ceremony_at || event?.civil_at) && (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8">
            {event?.ceremony_at && (
              <div className="flex flex-col gap-3">
                <div className="w-full aspect-video bg-muted rounded-xl overflow-hidden">
                  {event.ceremony_image_url
                    ? <img src={event.ceremony_image_url} alt="Ceremonia" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <ImageIcon className="h-10 w-10 text-muted-foreground/25" />
                        <p className="text-xs text-muted-foreground/40 uppercase tracking-widest">Ceremonia</p>
                      </div>
                  }
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="font-semibold text-[#412D26]">Ceremonia</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(event.ceremony_at).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}
                  </p>
                  {event.ceremony_url
                    ? <a href={event.ceremony_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#735749] underline">{event.ceremony_location}</a>
                    : <p className="text-sm text-muted-foreground">{event.ceremony_location}</p>}
                </div>
              </div>
            )}
            {event?.civil_at && (
              <div className="flex flex-col gap-3">
                <div className="w-full aspect-video bg-muted rounded-xl overflow-hidden">
                  {event.civil_image_url
                    ? <img src={event.civil_image_url} alt="Ceremonia Civil" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <ImageIcon className="h-10 w-10 text-muted-foreground/25" />
                        <p className="text-xs text-muted-foreground/40 uppercase tracking-widest">Civil</p>
                      </div>
                  }
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="font-semibold text-[#412D26]">Ceremonia Civil</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(event.civil_at).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}
                  </p>
                  {event.civil_url
                    ? <a href={event.civil_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#735749] underline">{event.civil_location}</a>
                    : <p className="text-sm text-muted-foreground">{event.civil_location}</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reception */}
        {event?.reception_at && (
          <div className="w-full flex flex-col gap-3">
            <div className="w-full aspect-video bg-muted rounded-xl overflow-hidden">
              {event.reception_image_url
                ? <img src={event.reception_image_url} alt="Recepción" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/25" />
                    <p className="text-xs text-muted-foreground/40 uppercase tracking-widest">Recepción</p>
                  </div>
              }
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="font-semibold text-[#412D26]">Recepción</p>
              <p className="text-sm text-muted-foreground">
                {new Date(event.reception_at).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}
              </p>
              {event.reception_url
                ? <a href={event.reception_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#735749] underline">{event.reception_location}</a>
                : <p className="text-sm text-muted-foreground">{event.reception_location}</p>}
            </div>
          </div>
        )}

        {/* Invitation card image */}
        <div className="w-full max-w-xs mx-auto aspect-[3/4] bg-muted rounded-2xl shadow-sm overflow-hidden">
          {event?.invitation_image_url
            ? <button
                type="button"
                className="w-full h-full cursor-zoom-in"
                onClick={() => setLightboxOpen(true)}
                aria-label="Ver invitación en pantalla completa"
              >
                <img src={event.invitation_image_url} alt="Invitación" className="w-full h-full object-cover" />
              </button>
            : <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <ImageIcon className="h-12 w-12 text-muted-foreground/25" />
                <p className="text-xs text-muted-foreground/40 uppercase tracking-widest">Invitación</p>
              </div>
          }
        </div>

        {/* No-kids notice */}
        {event?.no_kids && (
          <div className="w-full rounded-xl border border-[#C0A18F]/60 bg-[#C0A18F]/10 px-4 py-3 text-center">
            <p className="text-sm text-[#735749]">
              {event.no_kids_message || 'Este evento es para adultos. Te pedimos no traer niños.'}
            </p>
          </div>
        )}

        {/* Dress code + deadline */}
        {event && (event.dress_code || event.rsvp_deadline) && (
          <div className="text-center flex flex-col gap-1.5">
            {event.dress_code && (
              <p className="text-sm text-muted-foreground">
                Vestimenta: <span className="text-foreground font-medium">{event.dress_code}</span>
              </p>
            )}
            {effectiveDeadline && (
              <p className="text-sm text-muted-foreground">
                Confirmar antes del{' '}
                {new Date(effectiveDeadline).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}
              </p>
            )}
          </div>
        )}

        {/* Status messages */}
        {deadlinePassed && isEditing && (
          <div className="flex flex-col gap-1 text-sm text-center text-muted-foreground">
            <p>Tu respuesta ya fue registrada. El plazo para hacer cambios ha vencido.</p>
            <p>
              {invitee.status === 'attending'
                ? '¡Nos alegra que puedas acompañarnos!'
                : 'Lamentamos que no puedas asistir.'}
            </p>
            <p>Si necesitas hacer algún cambio, comunícate directamente con los comprometidos.</p>
          </div>
        )}

        {deadlinePassed && !isEditing && (
          <p className="text-sm text-center text-muted-foreground">
            El plazo para confirmar asistencia ha vencido. Comunícate directamente con los comprometidos.
          </p>
        )}

        {!deadlinePassed && isEditing && effectiveDeadline && (
          <p className="text-sm text-center text-muted-foreground">
            Puedes actualizar tu respuesta hasta el{' '}
            {new Date(effectiveDeadline).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}.
          </p>
        )}

        {/* RSVP form */}
        {!deadlinePassed && (
          <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-6">

            {/* Attendance */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-center">¿Asistirás a nuestra boda?</p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={status === 'attending' ? 'default' : 'outline'}
                  onClick={() => handleStatusSelect('attending')}
                  className={`w-full ${status === 'attending' ? 'bg-[#412D26] hover:bg-[#735749] text-[#FFF1E9]' : 'border-[#C0A18F] text-[#412D26] hover:bg-[#C0A18F]/10 hover:text-[#412D26]'}`}
                >
                  Sí, asistiré
                </Button>
                <Button
                  type="button"
                  variant={status === 'declined' ? 'default' : 'outline'}
                  onClick={() => handleStatusSelect('declined')}
                  className={`w-full ${status === 'declined' ? 'bg-[#412D26] hover:bg-[#735749] text-[#FFF1E9]' : 'border-[#C0A18F] text-[#412D26] hover:bg-[#C0A18F]/10 hover:text-[#412D26]'}`}
                >
                  No podré ir
                </Button>
              </div>
            </div>

            {status === 'declined' && invitee.companions.length > 0 && (
              <p className="text-sm text-center text-muted-foreground">
                Al seleccionar "No podré ir" se eliminarán los acompañantes registrados.
              </p>
            )}

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
                    className="border-[#C0A18F] text-[#412D26] hover:bg-[#C0A18F]/10 hover:text-[#412D26]"
                  >
                    + Agregar acompañante
                  </Button>
                )}
              </div>
            )}

            {status && (
              <Button type="submit" className="w-full bg-[#412D26] hover:bg-[#735749] text-[#FFF1E9]" disabled={mutation.isPending}>
                {mutation.isPending ? 'Enviando…' : isEditing ? 'Actualizar respuesta' : 'Confirmar'}
              </Button>
            )}

            {mutation.isError && (
              <p className="text-sm text-destructive text-center">
                Ocurrió un error. Intenta de nuevo.
              </p>
            )}
          </form>
        )}

      </div>
      </div>

      {event?.invitation_image_url && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={[{ src: event.invitation_image_url }]}
          plugins={[Zoom]}
          carousel={{ finite: true }}
        />
      )}
    </div>
  )
}

function Screen({ children }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#FFF1E9]">
      {children}
    </div>
  )
}
