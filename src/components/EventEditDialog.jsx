import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import api from '@/lib/api'

const normalizeSubdomain = (val) =>
  val.toLowerCase().trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const toLocalDatetimeValue = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const toUTC = (localStr) => localStr ? new Date(localStr).toISOString() : null

export default function EventEditDialog({ event, open, onOpenChange }) {
  const qc = useQueryClient()
  const setActiveEvent = useAuthStore((s) => s.setActiveEvent)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (event && open) {
      setError(null)
      setForm({
        name: event.name ?? '',
        subdomain: event.subdomain ?? '',
        subtitle: event.subtitle ?? '',
        partner1_parent1: event.partner1_parent1 ?? '',
        partner1_parent2: event.partner1_parent2 ?? '',
        partner2_parent1: event.partner2_parent1 ?? '',
        partner2_parent2: event.partner2_parent2 ?? '',
        civil_ceremony_same_venue: event.civil_ceremony_same_venue ?? false,
        civil_reception_same_venue: event.civil_reception_same_venue ?? false,
        ceremony_reception_same_venue: event.ceremony_reception_same_venue ?? false,
        dress_code: event.dress_code ?? '',
        notes: event.notes ?? '',
        ceremony_at: toLocalDatetimeValue(event.ceremony_at),
        ceremony_location: event.ceremony_location ?? '',
        ceremony_url: event.ceremony_url ?? '',
        civil_at: toLocalDatetimeValue(event.civil_at),
        civil_location: event.civil_location ?? '',
        civil_url: event.civil_url ?? '',
        reception_at: toLocalDatetimeValue(event.reception_at),
        reception_location: event.reception_location ?? '',
        reception_url: event.reception_url ?? '',
        rsvp_deadline: toLocalDatetimeValue(event.rsvp_deadline),
        late_rsvp_deadline: toLocalDatetimeValue(event.late_rsvp_deadline),
        no_kids: event.no_kids ?? false,
        no_kids_message: event.no_kids_message ?? '',
        confirm_attending_message: event.confirm_attending_message ?? '',
        confirm_declined_message: event.confirm_declined_message ?? '',
        gift_suggestion: event.gift_suggestion ?? '',
        recommendations: event.recommendations ?? '',
        carousel_interval: event.carousel_interval ?? 5,
      })
    }
  }, [event, open])

  const set = (field) => (e) => {
    if (error?.field === field) setError(null)
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const ceremony = new Date(form.ceremony_at)
    const deadline = new Date(form.rsvp_deadline)
    const lateDeadline = form.late_rsvp_deadline ? new Date(form.late_rsvp_deadline) : null

    if (deadline >= ceremony) {
      setError({ field: 'rsvp_deadline', message: 'La fecha límite debe ser antes de la ceremonia.' })
      return
    }

    if (lateDeadline) {
      if (lateDeadline < deadline) {
        setError({ field: 'late_rsvp_deadline', message: 'La fecha tardía debe ser igual o posterior a la fecha límite regular.' })
        return
      }
      if (lateDeadline >= ceremony) {
        setError({ field: 'late_rsvp_deadline', message: 'La fecha tardía debe ser antes de la ceremonia.' })
        return
      }
    }

    setLoading(true)
    try {
      const { data: updated } = await api.put(`/events/${event.id}`, {
        ...form,
        ceremony_at:        toUTC(form.ceremony_at),
        civil_at:           toUTC(form.civil_at),
        reception_at:       toUTC(form.reception_at),
        rsvp_deadline:      toUTC(form.rsvp_deadline),
        late_rsvp_deadline: toUTC(form.late_rsvp_deadline),
      })
      setActiveEvent(updated)
      qc.invalidateQueries({ queryKey: ['event'] })
      toast.success('Evento actualizado.')
      onOpenChange(false)
    } catch {
      toast.error('No se pudieron guardar los cambios.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar evento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-2">

          {/* General */}
          <Section title="General">
            <Field label="Nombre" id="name" value={form.name} onChange={set('name')} required />
            <Field label="Subtítulo" id="subtitle" value={form.subtitle} onChange={set('subtitle')} placeholder="Una historia de amor" />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subdomain">Subdominio</Label>
              <Input
                id="subdomain"
                value={form.subdomain}
                onChange={(e) => setForm((p) => ({ ...p, subdomain: e.target.value }))}
                placeholder="juan-y-maria"
              />
              {form.subdomain && (
                <p className="text-xs text-muted-foreground">
                  Se guardará como: <span className="font-medium text-foreground">{normalizeSubdomain(form.subdomain) || '—'}</span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="De la novia — 1" id="partner1_parent1" value={form.partner1_parent1} onChange={set('partner1_parent1')} placeholder="Sonia Zelada" />
              <Field label="De la novia — 2" id="partner1_parent2" value={form.partner1_parent2} onChange={set('partner1_parent2')} placeholder="Alberto Peñaranda" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Del novio — 1" id="partner2_parent1" value={form.partner2_parent1} onChange={set('partner2_parent1')} placeholder="Carolina Aillón" />
              <Field label="Del novio — 2" id="partner2_parent2" value={form.partner2_parent2} onChange={set('partner2_parent2')} placeholder="Ángel Herbas" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Vestimenta" id="dress_code" value={form.dress_code} onChange={set('dress_code')} />
              <div /> {/* spacer */}
            </div>
            <Field label="Notas" id="notes" value={form.notes} onChange={set('notes')} />
          </Section>

          {/* Civil ceremony */}
          <Section title="Ceremonia civil">
            <Field label="Fecha y hora" id="civil_at" type="datetime-local" value={form.civil_at} onChange={set('civil_at')} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Lugar" id="civil_location" value={form.civil_location} onChange={set('civil_location')} />
              <Field label="URL" id="civil_url" type="url" value={form.civil_url} onChange={set('civil_url')} />
            </div>
          </Section>

          {/* Religious ceremony */}
          <Section title="Ceremonia religiosa">
            <Field label="Fecha y hora" id="ceremony_at" type="datetime-local" value={form.ceremony_at} onChange={set('ceremony_at')} required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Lugar" id="ceremony_location" value={form.ceremony_location} onChange={set('ceremony_location')} required />
              <Field label="URL" id="ceremony_url" type="url" value={form.ceremony_url} onChange={set('ceremony_url')} />
            </div>
          </Section>

          {/* Reception */}
          <Section title="Recepción">
            <Field label="Fecha y hora" id="reception_at" type="datetime-local" value={form.reception_at} onChange={set('reception_at')} required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Lugar" id="reception_location" value={form.reception_location} onChange={set('reception_location')} required />
              <Field label="URL" id="reception_url" type="url" value={form.reception_url} onChange={set('reception_url')} />
            </div>
          </Section>

          {/* RSVP */}
          <Section title="RSVP">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Fecha límite" id="rsvp_deadline" type="datetime-local" value={form.rsvp_deadline ?? ''} onChange={set('rsvp_deadline')} required hasError={error?.field === 'rsvp_deadline'} />
              <Field label="Fecha límite tardía" id="late_rsvp_deadline" type="datetime-local" value={form.late_rsvp_deadline ?? ''} onChange={set('late_rsvp_deadline')} hasError={error?.field === 'late_rsvp_deadline'} />
            </div>
            {error?.field === 'rsvp_deadline' || error?.field === 'late_rsvp_deadline'
              ? <p className="text-sm text-destructive">{error.message}</p>
              : <p className="text-xs text-muted-foreground">La fecha límite tardía es opcional — para invitados marcados como "Rezagado".</p>
            }
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="no_kids"
                  checked={form.no_kids}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, no_kids: !!checked }))}
                />
                <Label htmlFor="no_kids">Solo adultos</Label>
              </div>
              {form.no_kids && (
                <Field
                  label="Mensaje personalizado (opcional)"
                  id="no_kids_message"
                  value={form.no_kids_message}
                  onChange={set('no_kids_message')}
                  placeholder="Este evento es para adultos. Te pedimos no traer niños."
                />
              )}
            </div>
          </Section>

          {/* Gift & Recommendations */}
          <Section title="Regalos y recomendaciones">
            <Field
              label="Sugerencia de regalo"
              id="gift_suggestion"
              value={form.gift_suggestion}
              onChange={set('gift_suggestion')}
              placeholder="Si deseas hacernos un regalo, puedes contribuir a…"
            />
            <Field
              label="Recomendaciones"
              id="recommendations"
              value={form.recommendations}
              onChange={set('recommendations')}
              placeholder="Te recomendamos llegar 15 minutos antes…"
            />
          </Section>

          {/* Venue sharing */}
          <Section title="Mismo lugar">
            <p className="text-xs text-muted-foreground -mt-1">Cuando las ceremonias comparten el mismo lugar, la invitación las mostrará agrupadas bajo una sola foto y dirección.</p>
            <div className="flex flex-col gap-3">
              {form.civil_at !== undefined && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="civil_ceremony_same_venue"
                    checked={form.civil_ceremony_same_venue}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, civil_ceremony_same_venue: !!v }))}
                  />
                  <Label htmlFor="civil_ceremony_same_venue">La ceremonia civil y religiosa son en el mismo lugar</Label>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="civil_reception_same_venue"
                  checked={form.civil_reception_same_venue}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, civil_reception_same_venue: !!v }))}
                />
                <Label htmlFor="civil_reception_same_venue">La ceremonia civil y la recepción son en el mismo lugar</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ceremony_reception_same_venue"
                  checked={form.ceremony_reception_same_venue}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, ceremony_reception_same_venue: !!v }))}
                />
                <Label htmlFor="ceremony_reception_same_venue">La ceremonia religiosa y la recepción son en el mismo lugar</Label>
              </div>
            </div>
          </Section>

          {/* Confirmation */}
          <Section title="Confirmación">
            <Field
              label="Mensaje al confirmar asistencia"
              id="confirm_attending_message"
              value={form.confirm_attending_message}
              onChange={set('confirm_attending_message')}
              placeholder="¡Nos vemos pronto!"
            />
            <Field
              label="Mensaje al declinar"
              id="confirm_declined_message"
              value={form.confirm_declined_message}
              onChange={set('confirm_declined_message')}
              placeholder="Gracias por avisarnos"
            />
          </Section>

          <Button type="submit" disabled={loading}>
            {loading ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide shrink-0">{title}</h3>
        <div className="h-px bg-border flex-1" />
      </div>
      {children}
    </div>
  )
}

function Field({ label, id, value, onChange, type = 'text', required = false, hasError = false, placeholder }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className={hasError ? 'text-destructive' : ''}>{label}</Label>
      <Input id={id} type={type} value={value ?? ''} onChange={onChange} required={required} placeholder={placeholder} className={hasError ? 'border-destructive focus-visible:ring-destructive' : ''} />
    </div>
  )
}
