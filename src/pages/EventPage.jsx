import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Upload, ImageIcon } from 'lucide-react'

const IMAGE_SLOTS = [
  { key: 'ceremony',   label: 'Ceremony',          aspect: 'aspect-video',   ratio: '16:9' },
  { key: 'reception',  label: 'Reception',         aspect: 'aspect-video',   ratio: '16:9' },
  { key: 'couple',     label: 'Couple Photo',      aspect: 'aspect-[10/6]',  ratio: '10:6' },
  { key: 'invitation', label: 'Invitation Card',   aspect: 'aspect-[3/4]',   ratio: '3:4' },
]

const fmt = (iso, opts) => new Date(iso).toLocaleString('en-US', opts)

export default function EventPage() {
  const qc = useQueryClient()
  const [uploading, setUploading] = useState({})
  const fileRefs = useRef({})
  const activeEvent = useAuthStore((s) => s.activeEvent)

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', activeEvent?.slug],
    queryFn: () => api.get(`/event/${activeEvent.slug}`).then((r) => r.data),
    enabled: !!activeEvent?.slug,
  })

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
        <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">ID: {event.id}</span>
      </div>

      {/* Event details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm border rounded-lg p-5">
        <Detail label="Name" value={event.name} />
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
      </div>

      {/* Images */}
      <div>
        <h2 className="text-base font-medium mb-4">Images</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {IMAGE_SLOTS.map(({ key, label, aspect, ratio }) => {
            const url = event[`${key}_image_url`]
            return (
              <div key={key} className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground font-mono">{ratio}</p>
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

                {/* Upload */}
                <input
                  ref={(el) => (fileRefs.current[key] = el)}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleUpload(key, e)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading[key]}
                  onClick={() => fileRefs.current[key]?.click()}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {uploading[key] ? 'Uploading…' : url ? 'Replace' : 'Upload'}
                </Button>
              </div>
            )
          })}
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
