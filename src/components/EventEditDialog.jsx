import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import api from '@/lib/api'

const toLocalDatetimeValue = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const toUTC = (localStr) => localStr ? new Date(localStr).toISOString() : null

export default function EventEditDialog({ event, open, onOpenChange }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (event && open) {
      setError(null)
      setForm({
        name: event.name ?? '',
        partner1_parent1: event.partner1_parent1 ?? '',
        partner1_parent2: event.partner1_parent2 ?? '',
        partner2_parent1: event.partner2_parent1 ?? '',
        partner2_parent2: event.partner2_parent2 ?? '',
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
      setError({ field: 'rsvp_deadline', message: 'RSVP deadline must be before the ceremony date.' })
      return
    }

    if (lateDeadline) {
      if (lateDeadline < deadline) {
        setError({ field: 'late_rsvp_deadline', message: 'Late deadline must be on or after the regular RSVP deadline.' })
        return
      }
      if (lateDeadline >= ceremony) {
        setError({ field: 'late_rsvp_deadline', message: 'Late deadline must be before the ceremony date.' })
        return
      }
    }

    setLoading(true)
    try {
      await api.put(`/events/${event.id}`, {
        ...form,
        ceremony_at:        toUTC(form.ceremony_at),
        civil_at:           toUTC(form.civil_at),
        reception_at:       toUTC(form.reception_at),
        rsvp_deadline:      toUTC(form.rsvp_deadline),
        late_rsvp_deadline: toUTC(form.late_rsvp_deadline),
      })
      qc.invalidateQueries({ queryKey: ['event'] })
      toast.success('Event updated.')
      onOpenChange(false)
    } catch {
      toast.error('Could not save changes.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-2">

          {/* General */}
          <Section title="General">
            <Field label="Name" id="name" value={form.name} onChange={set('name')} required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="De la novia — 1" id="partner1_parent1" value={form.partner1_parent1} onChange={set('partner1_parent1')} placeholder="Sonia Zelada" />
              <Field label="De la novia — 2" id="partner1_parent2" value={form.partner1_parent2} onChange={set('partner1_parent2')} placeholder="Alberto Peñaranda" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Del novio — 1" id="partner2_parent1" value={form.partner2_parent1} onChange={set('partner2_parent1')} placeholder="Carolina Aillón" />
              <Field label="Del novio — 2" id="partner2_parent2" value={form.partner2_parent2} onChange={set('partner2_parent2')} placeholder="Ángel Herbas" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Dress code" id="dress_code" value={form.dress_code} onChange={set('dress_code')} />
              <div /> {/* spacer */}
            </div>
            <Field label="Notes" id="notes" value={form.notes} onChange={set('notes')} />
          </Section>

          {/* Civil ceremony */}
          <Section title="Civil ceremony">
            <Field label="Date & time" id="civil_at" type="datetime-local" value={form.civil_at} onChange={set('civil_at')} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Location" id="civil_location" value={form.civil_location} onChange={set('civil_location')} />
              <Field label="URL" id="civil_url" type="url" value={form.civil_url} onChange={set('civil_url')} />
            </div>
          </Section>

          {/* Ceremony */}
          <Section title="Ceremony">
            <Field label="Date & time" id="ceremony_at" type="datetime-local" value={form.ceremony_at} onChange={set('ceremony_at')} required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Location" id="ceremony_location" value={form.ceremony_location} onChange={set('ceremony_location')} required />
              <Field label="URL" id="ceremony_url" type="url" value={form.ceremony_url} onChange={set('ceremony_url')} />
            </div>
          </Section>

          {/* Reception */}
          <Section title="Reception">
            <Field label="Date & time" id="reception_at" type="datetime-local" value={form.reception_at} onChange={set('reception_at')} required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Location" id="reception_location" value={form.reception_location} onChange={set('reception_location')} required />
              <Field label="URL" id="reception_url" type="url" value={form.reception_url} onChange={set('reception_url')} />
            </div>
          </Section>

          {/* RSVP */}
          <Section title="RSVP">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Deadline" id="rsvp_deadline" type="datetime-local" value={form.rsvp_deadline ?? ''} onChange={set('rsvp_deadline')} required hasError={error?.field === 'rsvp_deadline'} />
              <Field label="Late deadline" id="late_rsvp_deadline" type="datetime-local" value={form.late_rsvp_deadline ?? ''} onChange={set('late_rsvp_deadline')} hasError={error?.field === 'late_rsvp_deadline'} />
            </div>
            {error?.field === 'rsvp_deadline' || error?.field === 'late_rsvp_deadline'
              ? <p className="text-sm text-destructive">{error.message}</p>
              : <p className="text-xs text-muted-foreground">Late deadline is optional — for invitees marked as "Late".</p>
            }
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="no_kids"
                  checked={form.no_kids}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, no_kids: !!checked }))}
                />
                <Label htmlFor="no_kids">No kids policy</Label>
              </div>
              {form.no_kids && (
                <Field
                  label="Custom message (optional)"
                  id="no_kids_message"
                  value={form.no_kids_message}
                  onChange={set('no_kids_message')}
                  placeholder="Este evento es para adultos. Te pedimos no traer niños."
                />
              )}
            </div>
          </Section>

          {/* Confirmation */}
          <Section title="Confirmation">
            <Field
              label="Attending message"
              id="confirm_attending_message"
              value={form.confirm_attending_message}
              onChange={set('confirm_attending_message')}
              placeholder="¡Nos vemos pronto!"
            />
            <Field
              label="Declined message"
              id="confirm_declined_message"
              value={form.confirm_declined_message}
              onChange={set('confirm_declined_message')}
              placeholder="Gracias por avisarnos"
            />
          </Section>

          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Save changes'}
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
