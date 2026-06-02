import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { TagChip } from '@/lib/tagColors.jsx'

const empty = { full_name: '', phone: '', allowed_companions: '0', notes: '', type: 'regular', status: 'pending' }

export default function InviteeFormDialog({ open, onOpenChange, invitee }) {
  const isEdit = !!invitee
  const qc = useQueryClient()
  const activeEvent = useAuthStore((s) => s.activeEvent)
  const [form, setForm] = useState(empty)
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [addingName, setAddingName] = useState('')
  const [localCompanions, setLocalCompanions] = useState([])
  const [selectedTagIds, setSelectedTagIds] = useState(new Set())

  const { data: eventTags = [] } = useQuery({
    queryKey: ['tags', activeEvent?.id],
    queryFn: () => api.get(`/events/${activeEvent.id}/tags`).then((r) => r.data),
    enabled: !!activeEvent?.id && isEdit,
  })

  const syncTagsMutation = useMutation({
    mutationFn: (tagIds) => api.put(`/events/${activeEvent.id}/invitations/${invitee.invitation_id}/tags`, { tag_ids: [...tagIds] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitees', activeEvent?.id] }),
    onError: () => toast.error('No se pudieron actualizar las etiquetas.'),
  })

  useEffect(() => {
    setForm(
      invitee
        ? {
            full_name: invitee.full_name,
            phone: invitee.phone ?? '',
            allowed_companions: String(invitee.allowed_companions),
            notes: invitee.notes ?? '',
            type: invitee.type ?? 'regular',
            status: invitee.status ?? 'pending',
          }
        : empty
    )
    setLocalCompanions(invitee?.companions ?? [])
    setSelectedTagIds(new Set(invitee?.tags?.map((t) => t.id) ?? []))
    setEditingId(null)
    setIsAdding(false)
    setAddingName('')
  }, [invitee, open])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (isEdit) {
        const { full_name, status, ...invitationData } = data
        await Promise.all([
          api.put(`/events/${activeEvent.id}/invitations/${invitee.invitation_id}/invitees/${invitee.id}`, { full_name, status }),
          api.put(`/events/${activeEvent.id}/invitations/${invitee.invitation_id}`, invitationData),
        ])
      } else {
        return api.post(`/events/${activeEvent.id}/invitations`, {
          name_on_invitation: data.full_name,
          phone: data.phone,
          allowed_companions: data.allowed_companions,
          notes: data.notes,
          type: data.type,
          invitees: [{ full_name: data.full_name }],
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitees', activeEvent?.id] })
      toast.success(isEdit ? 'Invitado actualizado.' : 'Invitado creado.')
      onOpenChange(false)
    },
    onError: () => toast.error('Algo salió mal.'),
  })

  const addCompanionMutation = useMutation({
    mutationFn: (name) =>
      api.post(`/events/${activeEvent.id}/invitations/${invitee.invitation_id}/companions`, { full_name: name }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ['invitees', activeEvent?.id] })
      setLocalCompanions((prev) => [...prev, data])
      setIsAdding(false)
      setAddingName('')
    },
    onError: () => toast.error('No se pudo agregar el acompañante.'),
  })

  const updateCompanionMutation = useMutation({
    mutationFn: ({ id, name }) =>
      api.put(`/events/${activeEvent.id}/invitations/${invitee.invitation_id}/companions/${id}`, { full_name: name }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ['invitees', activeEvent?.id] })
      setLocalCompanions((prev) => prev.map((c) => c.id === data.id ? data : c))
      setEditingId(null)
    },
    onError: () => toast.error('No se pudo actualizar el acompañante.'),
  })

  const deleteCompanionMutation = useMutation({
    mutationFn: (id) =>
      api.delete(`/events/${activeEvent.id}/invitations/${invitee.invitation_id}/companions/${id}`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['invitees', activeEvent?.id] })
      setLocalCompanions((prev) => prev.filter((c) => c.id !== id))
    },
    onError: () => toast.error('No se pudo eliminar el acompañante.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isEdit) syncTagsMutation.mutate(selectedTagIds)
    mutation.mutate({ ...form, allowed_companions: Number(form.allowed_companions) })
  }

  const toggleTag = (id) => setSelectedTagIds((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const showCompanions =
    isEdit && form.status === 'attending' && Number(form.allowed_companions) > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar invitación' : 'Nueva invitación'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="full_name">Nombre completo</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={set('full_name')}
              maxLength={255}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" value={form.phone} onChange={set('phone')} maxLength={50} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Acompañantes permitidos</Label>
            <Select
              value={form.allowed_companions}
              onValueChange={(v) => setForm((f) => ({ ...f, allowed_companions: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n === 0 ? 'Ninguno' : `+${n}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notas</Label>
            <Input id="notes" value={form.notes} onChange={set('notes')} maxLength={500} />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="late">Rezagado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isEdit && (
              <div className="flex flex-col gap-1.5 flex-1">
                <Label>Estado</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="attending">Asistirá</SelectItem>
                    <SelectItem value="declined">Rechazó</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {showCompanions && (
            <div className="flex flex-col gap-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label>
                  Acompañantes{' '}
                  <span className="text-muted-foreground font-normal">
                    ({localCompanions.length}/{form.allowed_companions})
                  </span>
                </Label>
                {!isAdding && localCompanions.length < Number(form.allowed_companions) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAdding(true)}
                  >
                    + Agregar
                  </Button>
                )}
              </div>

              {localCompanions.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  {editingId === c.id ? (
                    <>
                      <Input
                        className="h-8 text-sm flex-1"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (editingName.trim())
                              updateCompanionMutation.mutate({ id: c.id, name: editingName.trim() })
                          }
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        maxLength={255}
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        disabled={!editingName.trim() || updateCompanionMutation.isPending}
                        onClick={() =>
                          updateCompanionMutation.mutate({ id: c.id, name: editingName.trim() })
                        }
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-muted-foreground"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm flex-1 truncate">{c.full_name}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-muted-foreground"
                        onClick={() => { setEditingId(c.id); setEditingName(c.full_name) }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-destructive"
                        disabled={deleteCompanionMutation.isPending}
                        onClick={() => deleteCompanionMutation.mutate(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}

              {isAdding && (
                <div className="flex items-center gap-2">
                  <Input
                    className="h-8 text-sm flex-1"
                    placeholder="Nombre completo"
                    value={addingName}
                    onChange={(e) => setAddingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (addingName.trim()) addCompanionMutation.mutate(addingName.trim())
                      }
                      if (e.key === 'Escape') { setIsAdding(false); setAddingName('') }
                    }}
                    maxLength={255}
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    disabled={!addingName.trim() || addCompanionMutation.isPending}
                    onClick={() => addCompanionMutation.mutate(addingName.trim())}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted-foreground"
                    onClick={() => { setIsAdding(false); setAddingName('') }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {isEdit && eventTags.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t pt-3">
              <Label>Etiquetas</Label>
              <div className="flex flex-wrap gap-1.5">
                {eventTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`transition-opacity ${selectedTagIds.has(tag.id) ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
                  >
                    <TagChip tag={tag} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
