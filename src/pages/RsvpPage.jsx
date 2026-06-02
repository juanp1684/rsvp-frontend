import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImageIcon, Play, Pause } from 'lucide-react'
import CeremoniesBlock from '@/components/CeremoniesBlock'
import PhotoCarousel from '@/components/PhotoCarousel'
import PromoCard from '@/components/PromoCard'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'

export default function RsvpPage() {
  const { eventSlug, code } = useParams()
  const [step, setStep] = useState('form') // 'form' | 'confirmed'
  const [inviteeStatuses, setInviteeStatuses] = useState({}) // { [inviteeId]: 'attending' | 'declined' }
  const [companions, setCompanions] = useState([])
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef(null)
  const autoplayedRef = useRef(false)

  const { data: invitation, isLoading, isError } = useQuery({
    queryKey: ['rsvp', eventSlug, code],
    queryFn: () => api.get(`/rsvp/${eventSlug}/${code}`).then((r) => r.data),
    retry: false,
  })

  const { data: event } = useQuery({
    queryKey: ['event', eventSlug],
    queryFn: () => api.get(`/event/${eventSlug}`).then((r) => r.data),
  })

  useEffect(() => { document.title = 'RSVP | ' + event?.name }, [event?.name])

  const isEditing = invitation?.invitees?.some((i) => i.status !== 'pending')
  const hasAttending = Object.values(inviteeStatuses).some((s) => s === 'attending')
  const allResponded = invitation?.invitees?.length > 0 &&
    invitation.invitees.every((i) => inviteeStatuses[i.id])

  const effectiveDeadline = invitation?.type === 'late'
    ? (event?.late_rsvp_deadline ?? event?.rsvp_deadline)
    : event?.rsvp_deadline

  const deadlinePassed = invitation?.type === 'late'
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
    if (!invitation?.invitees) return
    const initial = {}
    invitation.invitees.forEach((i) => {
      if (i.status !== 'pending') initial[i.id] = i.status
    })
    if (Object.keys(initial).length > 0) setInviteeStatuses(initial)
    if (invitation.companions?.length > 0) {
      setCompanions(invitation.companions.map((c) => ({ full_name: c.full_name })))
    }
  }, [invitation])

  const mutation = useMutation({
    mutationFn: (payload) => api.post(`/rsvp/${eventSlug}/${code}`, payload),
    onSuccess: () => setStep('confirmed'),
  })

  const handleInviteeStatus = (inviteeId, value) => {
    setInviteeStatuses((prev) => ({ ...prev, [inviteeId]: value }))
    if (!hasAttending && value !== 'attending') setCompanions([])
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
      invitees: (invitation?.invitees ?? []).map((i) => ({
        id: i.id,
        status: inviteeStatuses[i.id] ?? 'pending',
      })),
      companions: hasAttending ? companions.filter((c) => c.full_name.trim()) : [],
    })
  }

  // Overall status for confirmation screen
  const confirmStatus = hasAttending ? 'attending' : 'declined'

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
    const confirmImageUrl = confirmStatus === 'attending'
      ? event?.confirm_attending_image_url
      : event?.confirm_declined_image_url

    const confirmMessage = confirmStatus === 'attending'
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
              {confirmStatus === 'attending' ? '🎉' : '💌'}
            </p>
        }
        <p className="text-lg font-semibold mt-4">{confirmMessage}</p>

        <PromoCard className="mt-8" />
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
          <h1 className="text-5xl font-script text-[#A47864]">{invitation?.name_on_invitation}</h1>
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

        {/* Photo Gallery Carousel */}
        {event?.carousel_images?.length > 0 && (
          <PhotoCarousel images={event.carousel_images} interval={(event.carousel_interval ?? 5) * 1000} />
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
              {hasAttending
                ? '¡Nos alegra que puedan acompañarnos!'
                : 'Lamentamos que no puedan asistir.'}
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
            <div className="flex flex-col gap-4">
              {(invitation?.invitees ?? []).length === 1 && (
                <p className="text-sm font-medium font-subtitle text-center">¿Asistirás a nuestra boda?</p>
              )}
              {(invitation?.invitees ?? []).map((invitee) => (
                <div key={invitee.id} className="flex flex-col gap-4">
                  {(invitation?.invitees ?? []).length > 1 && (
                    <p className="text-sm font-medium font-subtitle text-center">{invitee.full_name}</p>
                  )}

                  <div className="flex justify-center gap-8">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`status-${invitee.id}`}
                        checked={inviteeStatuses[invitee.id] === 'attending'}
                        onChange={() => handleInviteeStatus(invitee.id, 'attending')}
                        className="accent-[#412D26] w-4 h-4"
                      />
                      <span className="text-sm text-[#412D26]">Sí, asistiré</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`status-${invitee.id}`}
                        checked={inviteeStatuses[invitee.id] === 'declined'}
                        onChange={() => handleInviteeStatus(invitee.id, 'declined')}
                        className="accent-[#412D26] w-4 h-4"
                      />
                      <span className="text-sm text-[#412D26]">No podré ir</span>
                    </label>
                  </div>

                </div>
              ))}
            </div>

            {/* Companions */}
            {hasAttending && (invitation?.allowed_companions ?? 0) > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">
                  ¿Llevarán acompañantes?{' '}
                  <span className="text-muted-foreground font-normal">
                    (máx. {invitation.allowed_companions})
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
                {companions.length < invitation.allowed_companions && (
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

            <Button type="submit" className="w-full bg-[#412D26] hover:bg-[#735749] text-[#FFF1E9]" disabled={!allResponded || mutation.isPending}>
                {mutation.isPending ? 'Enviando…' : isEditing ? 'Actualizar respuesta' : 'Confirmar'}
              </Button>

            {mutation.isError && (
              <p className="text-sm text-destructive text-center">
                Ocurrió un error. Intenta de nuevo.
              </p>
            )}
          </form>
        )}

        {deadlinePassed && (
          <div className="flex justify-center">
            <PromoCard />
          </div>
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
