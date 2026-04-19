import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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

const empty = { full_name: '', phone: '', allowed_companions: '0', notes: '', type: 'regular' }

export default function InviteeFormDialog({ open, onOpenChange, invitee }) {
  const isEdit = !!invitee
  const qc = useQueryClient()
  const activeEvent = useAuthStore((s) => s.activeEvent)
  const [form, setForm] = useState(empty)
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [addingName, setAddingName] = useState('')

  useEffect(() => {
    setForm(
      invitee
        ? {
            full_name: invitee.full_name,
            phone: invitee.phone ?? '',
            allowed_companions: String(invitee.allowed_companions),
            notes: invitee.notes ?? '',
            type: invitee.type ?? 'regular',
          }
        : empty
    )
    setEditingId(null)
    setIsAdding(false)
    setAddingName('')
  }, [invitee, open])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? api.put(`/events/${activeEvent.id}/invitees/${invitee.id}`, data)
        : api.post(`/events/${activeEvent.id}/invitees`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitees', activeEvent?.id] })
      toast.success(isEdit ? 'Invitee updated.' : 'Invitee created.')
      onOpenChange(false)
    },
    onError: () => toast.error('Something went wrong.'),
  })

  const addCompanionMutation = useMutation({
    mutationFn: (name) =>
      api.post(`/events/${activeEvent.id}/invitees/${invitee.id}/companions`, { full_name: name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitees', activeEvent?.id] })
      setIsAdding(false)
      setAddingName('')
    },
    onError: () => toast.error('Could not add companion.'),
  })

  const updateCompanionMutation = useMutation({
    mutationFn: ({ id, name }) =>
      api.put(`/events/${activeEvent.id}/invitees/${invitee.id}/companions/${id}`, { full_name: name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitees', activeEvent?.id] })
      setEditingId(null)
    },
    onError: () => toast.error('Could not update companion.'),
  })

  const deleteCompanionMutation = useMutation({
    mutationFn: (id) =>
      api.delete(`/events/${activeEvent.id}/invitees/${invitee.id}/companions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitees', activeEvent?.id] })
    },
    onError: () => toast.error('Could not remove companion.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate({ ...form, allowed_companions: Number(form.allowed_companions) })
  }

  const showCompanions =
    isEdit && invitee.status === 'attending' && invitee.allowed_companions > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit invitee' : 'Add invitee'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={set('full_name')}
              maxLength={255}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} onChange={set('phone')} maxLength={50} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Companions allowed</Label>
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
                    {n === 0 ? 'None' : `+${n}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={form.notes} onChange={set('notes')} maxLength={500} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="late">Late</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showCompanions && (
            <div className="flex flex-col gap-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label>
                  Companions{' '}
                  <span className="text-muted-foreground font-normal">
                    ({invitee.companions.length}/{invitee.allowed_companions})
                  </span>
                </Label>
                {!isAdding && invitee.companions.length < invitee.allowed_companions && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAdding(true)}
                  >
                    + Add
                  </Button>
                )}
              </div>

              {invitee.companions.map((c) => (
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
                    placeholder="Full name"
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

          <DialogFooter className="pt-2">
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
