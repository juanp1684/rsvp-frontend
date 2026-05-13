import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

const empty = { name: '', email: '', password: '', role: 'admin', event_id: '' }
const rolesNeedingEvent = ['admin', 'viewer']

export default function UserFormDialog({ open, onOpenChange, user }) {
  const isEdit = !!user
  const qc = useQueryClient()
  const [form, setForm] = useState(empty)

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get('/events').then((r) => r.data),
  })

  useEffect(() => {
    setForm(
      user
        ? { name: user.name, email: user.email, password: '', role: user.role, event_id: user.event_id ?? '' }
        : empty
    )
  }, [user, open])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? api.put(`/users/${user.id}`, data)
        : api.post('/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(isEdit ? 'User updated.' : 'User created.')
      onOpenChange(false)
    },
    onError: (err) => {
      const msg = err?.response?.data?.message ?? err?.response?.data?.errors?.email?.[0]
      toast.error(msg ?? 'Something went wrong.')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      name: form.name,
      email: form.email,
      role: form.role,
      event_id: rolesNeedingEvent.includes(form.role) ? (form.event_id || null) : null,
    }
    if (form.password) payload.password = form.password
    mutation.mutate(payload)
  }

  const needsEvent = rolesNeedingEvent.includes(form.role)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit user' : 'Add user'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={form.name} onChange={set('name')} required maxLength={255} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={set('email')} required maxLength={255} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">
              {isEdit ? 'New password' : 'Password'}
              {isEdit && <span className="ml-1 text-xs text-muted-foreground font-normal">(leave blank to keep current)</span>}
            </Label>
            <Input id="password" type="password" value={form.password} onChange={set('password')} required={!isEdit} minLength={8} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v, event_id: '' }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {needsEvent && (
            <div className="flex flex-col gap-1.5">
              <Label>Event</Label>
              <Select value={String(form.event_id)} onValueChange={(v) => setForm((f) => ({ ...f, event_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select event…" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
