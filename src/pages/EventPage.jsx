import { useRef, useState, useEffect } from 'react'
import { useIsViewer } from '@/hooks/useIsViewer'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import EventEditDialog from '@/components/EventEditDialog'
import { Upload, Trash2, ImageIcon, Pencil, Music2, Plus, Check, X } from 'lucide-react'
import { TAG_COLORS, TagChip } from '@/lib/tagColors.jsx'
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const RSVP_IMAGE_SLOTS = [
  { key: 'civil',           label: 'Civil Ceremony',        aspect: 'aspect-video',  ratio: '16:9', optional: true },
  { key: 'ceremony',        label: 'Religious Ceremony',    aspect: 'aspect-video',  ratio: '16:9' },
  { key: 'reception',       label: 'Reception',             aspect: 'aspect-video',  ratio: '16:9' },
  { key: 'couple',          label: 'Couple Photo',          aspect: 'aspect-[10/6]', ratio: '10:6' },
  { key: 'couple_mobile',   label: 'Couple Photo (Mobile)', aspect: 'aspect-[4/5]',  ratio: '4:5', optional: true },
  { key: 'invitation',      label: 'Invitation Card',       aspect: 'aspect-[3/4]',  ratio: '3:4' },
  { key: 'dress_code',      label: 'Dress Code',            aspect: 'aspect-video',  ratio: '16:9', optional: true },
  { key: 'gift_suggestion',  label: 'Gift Suggestion',  aspect: 'aspect-video', ratio: '16:9', optional: true },
  { key: 'recommendations',  label: 'Recommendations',  aspect: 'aspect-video', ratio: '16:9', optional: true },
]

const CONFIRMATION_IMAGE_SLOTS = [
  { key: 'confirm_attending', label: 'Attending', aspect: 'aspect-[3/4]', ratio: '3:4', optional: true },
  { key: 'confirm_declined',  label: 'Declined',  aspect: 'aspect-[3/4]', ratio: '3:4', optional: true },
]

const fmt = (iso, opts) => new Date(iso).toLocaleString('en-US', opts)

export default function EventPage() {
  const qc = useQueryClient()
  const [uploading, setUploading] = useState({})
  const [carouselUploading, setCarouselUploading] = useState(false)
  const [carouselInterval, setCarouselInterval] = useState(5)
  const [editOpen, setEditOpen] = useState(false)
  const fileRefs = useRef({})
  const carouselFileRef = useRef(null)
  const activeEvent = useAuthStore((s) => s.activeEvent)
  const isViewer = useIsViewer()

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', activeEvent?.slug],
    queryFn: () => api.get(`/event/${activeEvent.slug}`).then((r) => r.data),
    enabled: !!activeEvent?.slug,
  })

  useEffect(() => {
    if (event?.carousel_interval) setCarouselInterval(event.carousel_interval)
  }, [event?.carousel_interval])

  const intervalSaveRef = useRef(null)
  const handleCarouselIntervalChange = (value) => {
    const clamped = Math.min(30, Math.max(1, value || 1))
    setCarouselInterval(clamped)
    clearTimeout(intervalSaveRef.current)
    intervalSaveRef.current = setTimeout(async () => {
      try {
        await api.put(`/events/${event.id}`, { ...event, carousel_interval: clamped })
        qc.invalidateQueries({ queryKey: ['event'] })
      } catch {
        toast.error('Could not save interval.')
      }
    }, 1000)
  }

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

  const handleCarouselUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCarouselUploading(true)
    const formData = new FormData()
    formData.append('image', file)
    try {
      await api.post(`/events/${event.id}/carousel-images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      qc.invalidateQueries({ queryKey: ['event'] })
      toast.success('Photo added.')
    } catch (err) {
      const msg = err?.response?.data?.message
      toast.error(msg ?? 'Upload failed. Please try again.')
    } finally {
      setCarouselUploading(false)
      e.target.value = ''
    }
  }

  const handleCarouselRemove = async (imageId) => {
    try {
      await api.delete(`/events/${event.id}/carousel-images/${imageId}`)
      qc.invalidateQueries({ queryKey: ['event'] })
      toast.success('Photo removed.')
    } catch {
      toast.error('Could not remove photo.')
    }
  }

  const handleCarouselReorder = async (newImages) => {
    qc.setQueryData(['event', activeEvent?.slug], (old) => old ? { ...old, carousel_images: newImages } : old)
    try {
      await api.put(`/events/${event.id}/carousel-images/reorder`, { ids: newImages.map((img) => img.id) })
    } catch {
      qc.invalidateQueries({ queryKey: ['event'] })
      toast.error('Could not save order.')
    }
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 5 } }),
  )

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const images = event.carousel_images ?? []
    const oldIndex = images.findIndex((img) => img.id === active.id)
    const newIndex = images.findIndex((img) => img.id === over.id)
    handleCarouselReorder(arrayMove(images, oldIndex, newIndex))
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>

  if (!event) return <p className="text-sm text-muted-foreground">No event configured.</p>

  return (
    <div className="flex flex-col gap-8">

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Event</h1>
        {!isViewer && (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        )}
      </div>

      {/* Event details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm border rounded-lg p-5">
        <Detail label="Name" value={event.name} />
        {event.subdomain && (
          <Detail label="Subdomain" value={`${event.subdomain}.${import.meta.env.VITE_APP_DOMAIN}`} className="sm:col-span-2" />
        )}
        <Detail label="De la novia" value={[event.partner1_parent1, event.partner1_parent2].filter(Boolean).join(' & ')} />
        <Detail label="Del novio" value={[event.partner2_parent1, event.partner2_parent2].filter(Boolean).join(' & ')} />
        <Detail label="Dress Code" value={event.dress_code} />
        <Detail
          label="Religious Ceremony"
          value={event.ceremony_at && fmt(event.ceremony_at, { dateStyle: 'long', timeStyle: 'short' })}
        />
        <Detail
          label="Reception"
          value={event.reception_at && fmt(event.reception_at, { dateStyle: 'long', timeStyle: 'short' })}
        />
        <Detail label="Religious Ceremony Location" value={event.ceremony_location} url={event.ceremony_url} />
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
                {!isViewer && (
                  <>
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
                  </>
                )}
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
                  {!isViewer && (
                    <>
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
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Photo Gallery */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Photo Gallery</h2>
          <p className="text-xs text-muted-foreground">{event.carousel_images?.length ?? 0} / 10 photos</p>
        </div>
        <div className="flex items-center justify-between gap-4 -mt-2">
          <p className="text-sm text-muted-foreground">Up to 10 photos shown as a carousel on the RSVP page.</p>
          {!isViewer && (
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="carousel_interval" className="text-xs text-muted-foreground whitespace-nowrap">Slide every</label>
              <input
                id="carousel_interval"
                type="number"
                min={1}
                max={30}
                value={carouselInterval}
                onChange={(e) => handleCarouselIntervalChange(Number(e.target.value))}
                className="w-14 h-7 rounded-md border border-input bg-transparent px-2 text-sm text-center shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-xs text-muted-foreground">s</span>
            </div>
          )}
        </div>

        {isViewer ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(event.carousel_images ?? []).map((img) => (
              <div key={img.id} className="aspect-square rounded-xl overflow-hidden bg-muted">
                <img src={img.url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={(event.carousel_images ?? []).map((img) => img.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(event.carousel_images ?? []).map((img) => (
                    <SortableCarouselItem key={img.id} img={img} onRemove={handleCarouselRemove} />
                  ))}
                  {(event.carousel_images?.length ?? 0) < 10 && (
                    <button
                      onClick={() => carouselFileRef.current?.click()}
                      disabled={carouselUploading}
                      className="aspect-square rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors disabled:pointer-events-none"
                    >
                      {carouselUploading
                        ? <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
                        : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
                      }
                    </button>
                  )}
                </div>
              </SortableContext>
            </DndContext>
            <input
              ref={carouselFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleCarouselUpload}
            />
          </>
        )}
      </div>

      {/* Tags */}
      <TagsSection event={event} isViewer={isViewer} />

      {/* Music */}
      <MusicSection event={event} isViewer={isViewer} onRefresh={() => qc.invalidateQueries({ queryKey: ['event'] })} />

      <EventEditDialog event={event} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  )
}

function MusicSection({ event, isViewer, onRefresh }) {
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
      <div className="flex flex-col gap-3 border rounded-lg p-4">
        <div className="flex items-center gap-3">
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
        </div>
        {!isViewer && (
          <>
            <input ref={fileRef} type="file" accept=".mp3,audio/mpeg" className="hidden" onChange={handleUpload} />
            <div className="flex gap-2">
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
          </>
        )}
      </div>
    </div>
  )
}

function SortableCarouselItem({ img, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative group aspect-square rounded-xl overflow-hidden bg-muted ${isDragging ? 'scale-105 shadow-xl z-10 opacity-90' : ''}`}
      {...attributes}
      {...listeners}
    >
      <img src={img.url} alt="" className="w-full h-full object-cover pointer-events-none" />
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(img.id)}
        className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function TagsSection({ event, isViewer }) {
  const qc = useQueryClient()
  const activeEvent = useAuthStore((s) => s.activeEvent)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('blue')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('blue')

  const { data: tags = [] } = useQuery({
    queryKey: ['tags', activeEvent?.id],
    queryFn: () => api.get(`/events/${event.id}/tags`).then((r) => r.data),
    enabled: !!event?.id,
  })

  const createMutation = useMutation({
    mutationFn: (data) => api.post(`/events/${event.id}/tags`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags', activeEvent?.id] }); setAdding(false); setNewName(''); setNewColor('blue') },
    onError: () => toast.error('Could not create tag.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/events/${event.id}/tags/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags', activeEvent?.id] }); setEditingId(null) },
    onError: () => toast.error('Could not update tag.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/events/${event.id}/tags/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags', activeEvent?.id] }),
    onError: () => toast.error('Could not delete tag.'),
  })

  const startEdit = (tag) => { setEditingId(tag.id); setEditName(tag.name); setEditColor(tag.color) }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Tags</h2>

      <div className="flex flex-col gap-2">
        {tags.map((tag) => (
          <div key={tag.id} className="flex items-center gap-3 border rounded-lg px-3 py-2">
            {editingId === tag.id ? (
              <>
                <input
                  className="flex-1 min-w-0 h-7 rounded-md border border-input bg-transparent px-2 text-sm"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={50}
                  autoFocus
                />
                <div className="flex gap-1 shrink-0">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setEditColor(c.key)}
                      className={`h-5 w-5 rounded-full border-2 transition-transform ${editColor === c.key ? 'scale-125 border-foreground' : 'border-transparent'}`}
                      style={{ backgroundColor: c.bg, borderColor: editColor === c.key ? c.text : 'transparent' }}
                    />
                  ))}
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                  disabled={!editName.trim() || updateMutation.isPending}
                  onClick={() => updateMutation.mutate({ id: tag.id, name: editName.trim(), color: editColor })}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground"
                  onClick={() => setEditingId(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                <TagChip tag={tag} className="shrink-0" />
                {!isViewer && (
                  <div className="flex gap-1 ml-auto shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(tag)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(tag.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {!isViewer && adding && (
          <div className="flex items-center gap-3 border rounded-lg px-3 py-2">
            <input
              className="flex-1 min-w-0 h-7 rounded-md border border-input bg-transparent px-2 text-sm"
              placeholder="Tag name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={50}
              autoFocus
            />
            <div className="flex gap-1 shrink-0">
              {TAG_COLORS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setNewColor(c.key)}
                  className={`h-5 w-5 rounded-full border-2 transition-transform ${newColor === c.key ? 'scale-125' : 'border-transparent'}`}
                  style={{ backgroundColor: c.bg, borderColor: newColor === c.key ? c.text : 'transparent' }}
                />
              ))}
            </div>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0"
              disabled={!newName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ name: newName.trim(), color: newColor })}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground"
              onClick={() => { setAdding(false); setNewName(''); setNewColor('blue') }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {!isViewer && !adding && (
        <div>
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add tag
          </Button>
        </div>
      )}
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
