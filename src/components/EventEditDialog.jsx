import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import api from '@/lib/api'

const toLocalDatetimeValue = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EventEditDialog({ event, open, onOpenChange }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (event) {
      setForm({
        name: event.name ?? '',
        ceremony_at: toLocalDatetimeValue(event.ceremony_at),
        reception_at: toLocalDatetimeValue(event.reception_at),
        ceremony_location: event.ceremony_location ?? '',
        ceremony_url: event.ceremony_url ?? '',
        reception_location: event.reception_location ?? '',
        reception_url: event.reception_url ?? '',
        dress_code: event.dress_code ?? '',
        rsvp_deadline: toLocalDatetimeValue(event.rsvp_deadline),
        notes: event.notes ?? '',
      })
    }
  }, [event])

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const ceremony = new Date(form.ceremony_at)
    const reception = new Date(form.reception_at)
    const deadline = new Date(form.rsvp_deadline)

    if (deadline >= ceremony) {
      setError('RSVP deadline must be before the ceremony date.')
      return
    }

    setLoading(true)
    try {
      await api.put(`/events/${event.id}`, form)
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">

          <Field label="Name" id="name" value={form.name} onChange={set('name')} required />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Ceremony date & time" id="ceremony_at" type="datetime-local" value={form.ceremony_at} onChange={set('ceremony_at')} required />
            <Field label="Reception date & time" id="reception_at" type="datetime-local" value={form.reception_at} onChange={set('reception_at')} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Ceremony location" id="ceremony_location" value={form.ceremony_location} onChange={set('ceremony_location')} required />
            <Field label="Ceremony URL" id="ceremony_url" type="url" value={form.ceremony_url} onChange={set('ceremony_url')} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Reception location" id="reception_location" value={form.reception_location} onChange={set('reception_location')} required />
            <Field label="Reception URL" id="reception_url" type="url" value={form.reception_url} onChange={set('reception_url')} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Dress code" id="dress_code" value={form.dress_code} onChange={set('dress_code')} />
            <Field label="RSVP deadline" id="rsvp_deadline" type="date" value={form.rsvp_deadline?.slice(0, 10)} onChange={set('rsvp_deadline')} required />
          </div>

          <Field label="Notes" id="notes" value={form.notes} onChange={set('notes')} />

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, id, value, onChange, type = 'text', required = false }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value ?? ''} onChange={onChange} required={required} />
    </div>
  )
}
