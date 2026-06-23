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
  const [pendingNewCompanions, setPendingNewCompanions] = useState([])
  const [localInvitees, setLocalInvitees] = useState([])
  const [createInvitees, setCreateInvitees] = useState([{ full_name: '', status: 'pending' }])
  const [createCompanions, setCreateCompanions] = useState([])
  const [pendingStatuses, setPendingStatuses] = useState({})
  const [addingInviteeName, setAddingInviteeName] = useState('')
  const [isAddingInvitee, setIsAddingInvitee] = useState(false)
  const [selectedTagIds, setSelectedTagIds] = useState(new Set())

  const { data: eventTags = [] } = useQuery({
    queryKey: ['tags', activeEvent?.id],
    queryFn: () => api.get(`/events/${activeEvent.id}/tags`).then((r) => r.data),
    enabled: !!activeEvent?.id && isEdit,
  })

  const syncTagsMutation = useMutation({
    mutationFn: (tagIds) => api.put(`/events/${activeEvent.id}/invitations/${invitee.invitation_id}/tags`, { tag_ids: [...tagIds] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations', activeEvent?.id] }),
    onError: () => toast.error('No se pudieron actualizar las etiquetas.'),
  })

  useEffect(() => {
    if (invitee) {
      setForm({
        full_name: invitee.name_on_invitation ?? invitee.full_name,
        phone: invitee.phone ?? '',
        allowed_companions: String(invitee.allowed_companions),
        notes: invitee.notes ?? '',
        type: invitee.type ?? 'regular',
      })
      // Pull invitees for this invitation from the query cache
      const allInvitations = qc.getQueryData(['invitations', activeEvent?.id]) ?? []
      const matchingInv = allInvitations.find((inv) => inv.id === invitee.invitation_id)
      const siblings = matchingInv?.invitees ?? []
      setLocalInvitees(siblings)
      setLocalCompanions(invitee.companions ?? [])
      setSelectedTagIds(new Set(invitee.tags?.map((t) => t.id) ?? []))
    } else {
      setForm(empty)
      setLocalInvitees([])
      setLocalCompanions([])
      setSelectedTagIds(new Set())
      setCreateInvitees([{ full_name: '', status: 'pending' }])
      setCreateCompanions([])
    }
    setPendingStatuses({})
    setPendingNewCompanions([])
    setEditingId(null)
    setIsAdding(false)
    setAddingName('')
    setIsAddingInvitee(false)
    setAddingInviteeName('')
  }, [invitee, open])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const addInviteeMutation = useMutation({
    mutationFn: (name) =>
      api.post(`/events/${activeEvent.id}/invitations/${invitee.invitation_id}/invitees`, { full_name: name }),
    onSuccess: ({ data }) => {
      setLocalInvitees((prev) => [...prev, data])
      qc.invalidateQueries({ queryKey: ['invitations', activeEvent?.id] })
      setIsAddingInvitee(false)
      setAddingInviteeName('')
    },
    onError: () => toast.error('No se pudo agregar el invitado.'),
  })

  const removeInviteeMutation = useMutation({
    mutationFn: (inviteeId) =>
      api.delete(`/events/${activeEvent.id}/invitations/${invitee.invitation_id}/invitees/${inviteeId}`),
    onSuccess: (_, inviteeId) => {
      setLocalInvitees((prev) => prev.filter((i) => i.id !== inviteeId))
      qc.invalidateQueries({ queryKey: ['invitations', activeEvent?.id] })
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? 'No se pudo eliminar el invitado.'),
  })

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (isEdit) {
        const calls = [
          api.put(`/events/${activeEvent.id}/invitations/${invitee.invitation_id}`, {
            name_on_invitation: data.full_name,
            phone: data.phone,
            allowed_companions: data.allowed_companions,
            notes: data.notes,
            type: data.type,
          }),
          // Apply only touched status changes
          ...Object.entries(pendingStatuses).map(([id, status]) =>
            api.put(`/events/${activeEvent.id}/invitations/${invitee.invitation_id}/invitees/${id}`, { status })
          ),
        ]
        await Promise.all(calls)
        // Create pending new companions after statuses are saved
        for (const name of pendingNewCompanions.filter((n) => n.trim())) {
          await api.post(`/events/${activeEvent.id}/invitations/${invitee.invitation_id}/companions`, { full_name: name })
        }
      } else {
        const validInvitees = createInvitees.filter((i) => i.full_name.trim())
        const res = await api.post(`/events/${activeEvent.id}/invitations`, {
          name_on_invitation: data.full_name,
          phone: data.phone,
          allowed_companions: data.allowed_companions,
          notes: data.notes,
          type: data.type,
          invitees: validInvitees.length > 0
            ? validInvitees.map((i) => ({ full_name: i.full_name, status: i.status }))
            : [{ full_name: data.full_name, status: 'pending' }],
        })
        const invitationId = res.data.id
        // Create companions if any
        for (const c of createCompanions.filter((c) => c.trim())) {
          await api.post(`/events/${activeEvent.id}/invitations/${invitationId}/companions`, { full_name: c })
        }
        return res
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations', activeEvent?.id] })
      toast.success(isEdit ? 'Invitación actualizada.' : 'Invitación creada.')
      onOpenChange(false)
    },
    onError: () => toast.error('Algo salió mal.'),
  })

  const addCompanionMutation = useMutation({
    mutationFn: (name) =>
      api.post(`/events/${activeEvent.id}/invitations/${invitee.invitation_id}/companions`, { full_name: name }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ['invitations', activeEvent?.id] })
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
      qc.invalidateQueries({ queryKey: ['invitations', activeEvent?.id] })
      setLocalCompanions((prev) => prev.map((c) => c.id === data.id ? data : c))
      setEditingId(null)
    },
    onError: () => toast.error('No se pudo actualizar el acompañante.'),
  })

  const deleteCompanionMutation = useMutation({
    mutationFn: (id) =>
      api.delete(`/events/${activeEvent.id}/invitations/${invitee.invitation_id}/companions/${id}`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['invitations', activeEvent?.id] })
      setLocalCompanions((prev) => prev.filter((c) => c.id !== id))
    },
    onError: () => toast.error('No se pudo eliminar el acompañante.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isEdit) syncTagsMutation.mutate(selectedTagIds)
    const { status: _removed, ...formData } = form
    mutation.mutate({ ...formData, allowed_companions: Number(form.allowed_companions) })
  }

  const toggleTag = (id) => setSelectedTagIds((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const showCompanions =
    isEdit && localInvitees.some((i) => (pendingStatuses[i.id] ?? i.status) === 'attending') && Number(form.allowed_companions) > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar invitación' : 'Nueva invitación'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="full_name">Nombre en la invitación</Label>
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
          </div>

          {/* Invitees section — edit mode */}
          {isEdit && (
            <div className="flex flex-col gap-2 border-t pt-3">
              <Label>Invitados</Label>
              {localInvitees.map((inv) => (
                <div key={inv.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm truncate">{inv.full_name}</span>
                  <Select
                    value={pendingStatuses[inv.id] ?? inv.status}
                    onValueChange={(v) => setPendingStatuses((prev) => ({ ...prev, [inv.id]: v }))}
                  >
                    <SelectTrigger className={`h-auto px-2 py-0.5 text-xs font-medium rounded-full border-0 focus:ring-0 w-24 gap-1 shrink-0 ${
                      (pendingStatuses[inv.id] ?? inv.status) === 'attending' ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400' :
                      (pendingStatuses[inv.id] ?? inv.status) === 'declined'  ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400' :
                                                                                 'bg-secondary text-secondary-foreground'
                    }`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="attending">Asistirá</SelectItem>
                      <SelectItem value="declined">Rechazó</SelectItem>
                    </SelectContent>
                  </Select>
                  {localInvitees.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0"
                      disabled={removeInviteeMutation.isPending}
                      onClick={() => removeInviteeMutation.mutate(inv.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              {isAddingInvitee ? (
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-sm flex-1"
                    placeholder="Nombre completo"
                    value={addingInviteeName}
                    onChange={(e) => setAddingInviteeName(e.target.value)}
                    autoFocus
                    maxLength={255}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); if (addingInviteeName.trim()) addInviteeMutation.mutate(addingInviteeName.trim()) }
                      if (e.key === 'Escape') { setIsAddingInvitee(false); setAddingInviteeName('') }
                    }}
                  />
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0"
                    disabled={!addingInviteeName.trim() || addInviteeMutation.isPending}
                    onClick={() => addInviteeMutation.mutate(addingInviteeName.trim())}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground"
                    onClick={() => { setIsAddingInvitee(false); setAddingInviteeName('') }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddingInvitee(true)}>
                  + Agregar invitado
                </Button>
              )}
            </div>
          )}

          {showCompanions && (
            <div className="flex flex-col gap-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label>
                  Acompañantes{' '}
                  <span className="text-muted-foreground font-normal">
                    ({localCompanions.length + pendingNewCompanions.length}/{form.allowed_companions})
                  </span>
                </Label>
                {!isAdding && (localCompanions.length + pendingNewCompanions.length) < Number(form.allowed_companions) && (
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

              {/* Pending new companions (held locally until save) */}
              {pendingNewCompanions.map((name, i) => (
                <div key={`pending-${i}`} className="flex items-center gap-2">
                  <span className="text-sm flex-1 truncate text-muted-foreground italic">{name}</span>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground"
                    onClick={() => setPendingNewCompanions((prev) => prev.filter((_, j) => j !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
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
                        if (addingName.trim()) { setPendingNewCompanions((prev) => [...prev, addingName.trim()]); setAddingName(''); setIsAdding(false) }
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
                    disabled={!addingName.trim()}
                    onClick={() => { setPendingNewCompanions((prev) => [...prev, addingName.trim()]); setAddingName(''); setIsAdding(false) }}
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

          {/* Invitees — create mode */}
          {!isEdit && (
            <div className="flex flex-col gap-2 border-t pt-3">
              <Label>Invitados <span className="text-muted-foreground font-normal text-xs">(mín. 1)</span></Label>
              {createInvitees.map((inv, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    placeholder="Nombre completo"
                    value={inv.full_name}
                    onChange={(e) => setCreateInvitees((prev) => prev.map((x, j) => j === i ? { ...x, full_name: e.target.value } : x))}
                    maxLength={255}
                    className="flex-1"
                  />
                  <Select
                    value={inv.status}
                    onValueChange={(v) => setCreateInvitees((prev) => prev.map((x, j) => j === i ? { ...x, status: v } : x))}
                  >
                    <SelectTrigger className={`h-auto px-2 py-0.5 text-xs font-medium rounded-full border-0 focus:ring-0 w-24 gap-1 shrink-0 ${
                      inv.status === 'attending' ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400' :
                      inv.status === 'declined'  ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400' :
                                                   'bg-secondary text-secondary-foreground'
                    }`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="attending">Asistirá</SelectItem>
                      <SelectItem value="declined">Rechazó</SelectItem>
                    </SelectContent>
                  </Select>
                  {createInvitees.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" className="shrink-0 text-muted-foreground"
                      onClick={() => setCreateInvitees((prev) => prev.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm"
                onClick={() => setCreateInvitees((prev) => [...prev, { full_name: '', status: 'pending' }])}>
                + Agregar invitado
              </Button>
            </div>
          )}

          {/* Companions — create mode */}
          {!isEdit && Number(form.allowed_companions) > 0 && createInvitees.some((i) => i.status === 'attending') && (
            <div className="flex flex-col gap-2 border-t pt-3">
              <Label>Acompañantes <span className="text-muted-foreground font-normal text-xs">(máx. {form.allowed_companions})</span></Label>
              {createCompanions.map((name, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Nombre completo"
                    value={name}
                    onChange={(e) => setCreateCompanions((prev) => prev.map((x, j) => j === i ? e.target.value : x))}
                    maxLength={255}
                  />
                  <Button type="button" size="icon" variant="ghost" className="shrink-0 text-muted-foreground"
                    onClick={() => setCreateCompanions((prev) => prev.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {createCompanions.length < Number(form.allowed_companions) && (
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setCreateCompanions((prev) => [...prev, ''])}>
                  + Agregar acompañante
                </Button>
              )}
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
