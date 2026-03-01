import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
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

const empty = { full_name: '', phone: '', allowed_companions: '0', notes: '' }

export default function InviteeFormDialog({ open, onOpenChange, invitee }) {
  const isEdit = !!invitee
  const qc = useQueryClient()
  const [form, setForm] = useState(empty)

  useEffect(() => {
    setForm(
      invitee
        ? {
            full_name: invitee.full_name,
            phone: invitee.phone ?? '',
            allowed_companions: String(invitee.allowed_companions),
            notes: invitee.notes ?? '',
          }
        : empty
    )
  }, [invitee, open])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? api.put(`/invitees/${invitee.id}`, data)
        : api.post('/invitees', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitees'] })
      toast.success(isEdit ? 'Invitee updated.' : 'Invitee created.')
      onOpenChange(false)
    },
    onError: () => toast.error('Something went wrong.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate({ ...form, allowed_companions: Number(form.allowed_companions) })
  }

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
