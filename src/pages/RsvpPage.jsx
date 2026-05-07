import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImageIcon, Play, Pause } from 'lucide-react'
import CeremoniesBlock from '@/components/CeremoniesBlock'
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
  const autoplayedRef = useRef(false)

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
    if (!event?.song_url) return
    const tryPlay = () => {
      if (autoplayedRef.current || !audioRef.current) return
      autoplayedRef.current = true
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {})
    }
    window.addEventListener('click', tryPlay)
    window.addEventListener('touchstart', tryPlay)
    window.addEventListener('scroll', tryPlay, { passive: true })
    return () => {
      window.removeEventListener('click', tryPlay)
      window.removeEventListener('touchstart', tryPlay)
      window.removeEventListener('scroll', tryPlay)
    }
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

    const confirmMessage = status === 'attending'
      ? (event?.confirm_attending_message || '¡Nos vemos pronto!')
      : (event?.confirm_declined_message || 'Gracias por avisarnos')

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
        <p className="text-lg font-semibold mt-4">{confirmMessage}</p>

        <div className="mt-8 w-full max-w-[220px] rounded-2xl border border-[#C0A18F]/40 bg-[#FFF1E9] px-5 py-4 text-center shadow-sm">
          <p className="text-[10px] uppercase tracking-widest text-[#412D26]/40 mb-2">¿Te gustó esta invitación?</p>
          <p className="text-sm font-semibold text-[#412D26]">rsvp-lat</p>
          <p className="text-[11px] text-[#412D26]/50">by JP Chávez</p>
          <a
            href="https://wa.me/59177977988"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-green-700 hover:text-green-800 font-medium"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            +591 77977988
          </a>
        </div>
      </Screen>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#A47864]">

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
            <p className={`text-xs text-[#FFF1E9]/60 uppercase tracking-widest ${isPlaying ? 'invisible' : ''}`}>Play</p>
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
              className="flex items-center justify-center w-12 h-12 rounded-full bg-[#FFF1E9]/20 hover:bg-[#FFF1E9]/30 transition-colors text-[#FFF1E9]"
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
          <h1 className="text-5xl font-script text-[#A47864]">{invitee.full_name}</h1>
        </div>

        {/* Parents */}
        {(event?.partner1_parent1 || event?.partner1_parent2 || event?.partner2_parent1 || event?.partner2_parent2) && (
          <div className="w-full text-center flex flex-col items-center gap-5">
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs uppercase tracking-[0.2em] text-[#412D26]/60">Con la bendición de</p>
              <p className="font-display italic uppercase text-2xl text-[#735749]">nuestros padres</p>
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

        {/* Couple name */}
        {event?.name && (
          <div className="text-center flex flex-col items-center gap-3">
            <p className="text-2xl uppercase tracking-[0.2em] text-[#412D26]/60">Nosotros</p>
            <h2 className="font-script text-3xl md:text-5xl text-center leading-tight text-[#A47864]">
              {event.name}
            </h2>
            {event.subtitle && (
              <p className="text-xs uppercase tracking-[0.2em] text-[#412D26]/60">{event.subtitle}</p>
            )}
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

        {/* Ceremonies + Reception */}
        {event && (event.civil_at || event.ceremony_at || event.reception_at) && (
          <CeremoniesBlock event={event} />
        )}

        {/* Dress code */}
        {event && (event.dress_code || event.dress_code_image_url) && (
          <div className="w-full rounded-xl overflow-hidden border border-[#C0A18F]/60">
            <div className="bg-[#C0A18F]/10 px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-[0.15em] text-[#412D26]/60 mb-1">Vestimenta</p>
              {event.dress_code && <p className="text-sm text-[#735749] font-medium">{event.dress_code}</p>}
            </div>
            {event.dress_code_image_url && (
              <div className="w-full aspect-video">
                <img src={event.dress_code_image_url} alt="Dress code" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        )}

        {/* Gift suggestion */}
        {event && (event.gift_suggestion || event.gift_suggestion_image_url) && (
          <div className="w-full rounded-xl overflow-hidden border border-[#C0A18F]/60">
            <div className="bg-[#C0A18F]/10 px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-[0.15em] text-[#412D26]/60 mb-1">Regalo</p>
              {event.gift_suggestion && <p className="text-sm text-[#735749]">{event.gift_suggestion}</p>}
            </div>
            {event.gift_suggestion_image_url && (
              <div className="w-full aspect-video">
                <img src={event.gift_suggestion_image_url} alt="Gift suggestion" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        )}

        {/* Recommendations */}
        {event && (event.recommendations || event.recommendations_image_url) && (
          <div className="w-full rounded-xl overflow-hidden border border-[#C0A18F]/60">
            <div className="bg-[#C0A18F]/10 px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-[0.15em] text-[#412D26]/60 mb-1">Recomendaciones</p>
              {event.recommendations && <p className="text-sm text-[#735749]">{event.recommendations}</p>}
            </div>
            {event.recommendations_image_url && (
              <div className="w-full aspect-video">
                <img src={event.recommendations_image_url} alt="Recomendaciones" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        )}

        {/* No-kids notice */}
        {event?.no_kids && (
          <div className="w-full rounded-xl border border-[#C0A18F]/60 bg-[#C0A18F]/10 px-4 py-3 text-center">
            <p className="text-xs uppercase tracking-[0.15em] text-[#412D26]/60 mb-1">Solo adultos</p>
            <p className="text-sm text-[#735749]">
              {event.no_kids_message || 'Este evento es para adultos. Te pedimos no traer niños.'}
            </p>
          </div>
        )}

        {/* RSVP deadline */}
        {effectiveDeadline && (
          <p className="text-sm text-center text-muted-foreground">
            Confirmar antes del{' '}
            {new Date(effectiveDeadline).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}
          </p>
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
              <p className="text-sm font-medium font-subtitle text-center">¿Asistirás a nuestra boda?</p>
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
