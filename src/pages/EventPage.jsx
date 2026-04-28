import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import EventEditDialog from '@/components/EventEditDialog'
import { Upload, Trash2, ImageIcon, Pencil, Music2 } from 'lucide-react'

const RSVP_IMAGE_SLOTS = [
  { key: 'civil',         label: 'Civil Ceremony',        aspect: 'aspect-video',  ratio: '16:9', optional: true },
  { key: 'ceremony',      label: 'Ceremony',              aspect: 'aspect-video',  ratio: '16:9' },
  { key: 'reception',     label: 'Reception',             aspect: 'aspect-video',  ratio: '16:9' },
  { key: 'couple',        label: 'Couple Photo',          aspect: 'aspect-[10/6]', ratio: '10:6' },
  { key: 'couple_mobile', label: 'Couple Photo (Mobile)', aspect: 'aspect-[4/5]',  ratio: '4:5', optional: true },
  { key: 'invitation',    label: 'Invitation Card',       aspect: 'aspect-[3/4]',  ratio: '3:4' },
]

const CONFIRMATION_IMAGE_SLOTS = [
  { key: 'confirm_attending', label: 'Attending', aspect: 'aspect-[3/4]', ratio: '3:4', optional: true },
  { key: 'confirm_declined',  label: 'Declined',  aspect: 'aspect-[3/4]', ratio: '3:4', optional: true },
]

const fmt = (iso, opts) => new Date(iso).toLocaleString('en-US', opts)

export default function EventPage() {
  const qc = useQueryClient()
  const [uploading, setUploading] = useState({})
  const [editOpen, setEditOpen] = useState(false)
  const fileRefs = useRef({})
  const activeEvent = useAuthStore((s) => s.activeEvent)

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', activeEvent?.slug],
    queryFn: () => api.get(`/event/${activeEvent.slug}`).then((r) => r.data),
    enabled: !!activeEvent?.slug,
  })

  const handleRemove = async (type) => {
    try {
      await api.delete(`/events/${event.id}/images/${type}`)
      qc.invalidateQueries({ queryKey: ['event'] })
      toast.success('Image removed.')
    } catch {
      toast.error('Could not remove image.')
    }
  }

  const handleUpload = async (type, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading((prev) => ({ ...prev, [type]: true }))
    const formData = new FormData()
    formData.append('image', file)
    try {
      await api.post(`/events/${event.id}/images/${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      qc.invalidateQueries({ queryKey: ['event'] })
      toast.success('Image updated.')
    } catch (err) {
      const status = err?.response?.status
      if (status === 413) {
        toast.error('Image too large. Maximum size is 10 MB.')
      } else if (status === 422) {
        const msg = err?.response?.data?.errors?.image?.[0]
        toast.error(msg ?? 'Invalid image. Use JPG, PNG or WebP, max 10 MB.')
      } else {
        toast.error('Upload failed. Please try again.')
      }
    } finally {
      setUploading((prev) => ({ ...prev, [type]: false }))
      e.target.value = ''
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>

  if (!event) return <p className="text-sm text-muted-foreground">No event configured.</p>

  return (
    <div className="flex flex-col gap-8">

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Event</h1>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </div>

      {/* Event details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm border rounded-lg p-5">
        <Detail label="Name" value={event.name} />
        <Detail label="De la novia" value={[event.partner1_parent1, event.partner1_parent2].filter(Boolean).join(' & ')} />
        <Detail label="Del novio" value={[event.partner2_parent1, event.partner2_parent2].filter(Boolean).join(' & ')} />
        <Detail label="Dress Code" value={event.dress_code} />
        <Detail
          label="Ceremony"
          value={event.ceremony_at && fmt(event.ceremony_at, { dateStyle: 'long', timeStyle: 'short' })}
        />
        <Detail
          label="Reception"
          value={event.reception_at && fmt(event.reception_at, { dateStyle: 'long', timeStyle: 'short' })}
        />
        <Detail label="Ceremony Location" value={event.ceremony_location} url={event.ceremony_url} />
        <Detail label="Reception Location" value={event.reception_location} url={event.reception_url} />
        <Detail
          label="RSVP Deadline"
          value={event.rsvp_deadline && fmt(event.rsvp_deadline, { dateStyle: 'long', timeStyle: 'short' })}
        />
        {event.notes && <Detail label="Notes" value={event.notes} className="sm:col-span-2" />}
        {event.no_kids && (
          <Detail
            label="No kids policy"
            value={event.no_kids_message || 'Este evento es para adultos. Te pedimos no traer niños.'}
            className="sm:col-span-2"
          />
        )}
      </div>

      {/* Images */}
      <div className="flex flex-col gap-8">
        <h2 className="text-lg font-semibold -mb-4">Images</h2>

        <div className="flex flex-col gap-4">
          <h3 className="text-base font-medium">Invitee / RSVP page</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {RSVP_IMAGE_SLOTS.map(({ key, label, aspect, ratio, optional }) => {
            const url = event[`${key}_image_url`]
            return (
              <div key={key} className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground font-mono">{ratio}</p>
                  {optional && (
                    <p className="text-xs text-muted-foreground italic">optional</p>
                  )}
                </div>

                {/* Preview */}
                <div className={`w-full ${aspect} bg-muted rounded-xl overflow-hidden`}>
                  {url
                    ? <img src={url} alt={label} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                        <p className="text-xs text-muted-foreground/40 uppercase tracking-widest">No image</p>
                      </div>
                  }
                </div>

                {/* Upload / Remove */}
                <input
                  ref={(el) => (fileRefs.current[key] = el)}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleUpload(key, e)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading[key]}
                    onClick={() => fileRefs.current[key]?.click()}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    {uploading[key] ? 'Uploading…' : url ? 'Replace' : 'Upload'}
                  </Button>
                  {url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemove(key)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-base font-medium">Confirmation page</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {CONFIRMATION_IMAGE_SLOTS.map(({ key, label, aspect, ratio, optional }) => {
              const url = event[`${key}_image_url`]
              return (
                <div key={key} className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground font-mono">{ratio}</p>
                    {optional && (
                      <p className="text-xs text-muted-foreground italic">optional</p>
                    )}
                  </div>
                  <div className={`w-full ${aspect} bg-muted rounded-xl overflow-hidden`}>
                    {url
                      ? <img src={url} alt={label} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                          <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                          <p className="text-xs text-muted-foreground/40 uppercase tracking-widest">No image</p>
                        </div>
                    }
                  </div>
                  <input
                    ref={(el) => (fileRefs.current[key] = el)}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handleUpload(key, e)}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={uploading[key]}
                      onClick={() => fileRefs.current[key]?.click()}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      {uploading[key] ? 'Uploading…' : url ? 'Replace' : 'Upload'}
                    </Button>
                    {url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemove(key)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Music */}
      <MusicSection event={event} onRefresh={() => qc.invalidateQueries({ queryKey: ['event'] })} />

      <EventEditDialog event={event} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  )
}

function MusicSection({ event, onRefresh }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('song', file)
    try {
      await api.post(`/events/${event.id}/song`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onRefresh()
      toast.success('Song uploaded.')
    } catch (err) {
      const status = err?.response?.status
      if (status === 413) {
        toast.error('File too large. Maximum size is 10 MB.')
      } else if (status === 422) {
        toast.error('Invalid file. Use MP3, max 10 MB.')
      } else {
        toast.error('Upload failed. Please try again.')
      }
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleRemove = async () => {
    try {
      await api.delete(`/events/${event.id}/song`)
      onRefresh()
      toast.success('Song removed.')
    } catch {
      toast.error('Could not remove song.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Music</h2>
      {event.song_url && (
        <audio controls src={event.song_url} className="w-full" />
      )}
      <div className="flex items-center gap-4 border rounded-lg p-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted shrink-0">
          <Music2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          {event.song_url
            ? <p className="text-sm font-medium truncate">{event.song.split('/').pop()}</p>
            : <p className="text-sm text-muted-foreground">No song uploaded</p>
          }
          <p className="text-xs text-muted-foreground mt-0.5">MP3 · max 10 MB · autoplays on the RSVP page</p>
        </div>
        <input ref={fileRef} type="file" accept=".mp3,audio/mpeg" className="hidden" onChange={handleUpload} />
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" />
            {uploading ? 'Uploading…' : event.song_url ? 'Replace' : 'Upload'}
          </Button>
          {event.song_url && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleRemove}>
              <Trash2 className="h-4 w-4 mr-1" />
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value, url, className = '' }) {
  if (!value) return null
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
      {url
        ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{value}</a>
        : <p className="font-medium">{value}</p>
      }
    </div>
  )
}
