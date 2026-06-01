import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useIsViewer } from '@/hooks/useIsViewer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, QrCode, Check, X } from 'lucide-react'
import { TagChip } from '@/lib/tagColors.jsx'
import QrCodeDialog from '@/components/QrCodeDialog'

const statusVariant = { attending: 'default', declined: 'destructive', pending: 'secondary' }
const statusLabel = { attending: 'Asistirá', declined: 'Rechazó', pending: 'Pendiente' }

function WhatsAppIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

const buildRsvpBase = (event) => {
  const domain = import.meta.env.VITE_APP_DOMAIN
  if (event?.subdomain && domain) return `${window.location.protocol}//${event.subdomain}.${domain}`
  return window.location.origin
}

export default function InvitationsPage() {
  useEffect(() => { document.title = 'RSVP Admin | Invitaciones' }, [])

  const qc = useQueryClient()
  const activeEvent = useAuthStore((s) => s.activeEvent)
  const isViewer = useIsViewer()
  const [formOpen, setFormOpen] = useState(false)
  const [editInvitation, setEditInvitation] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [qrTarget, setQrTarget] = useState(null)

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['invitations', activeEvent?.id],
    queryFn: () => api.get(`/events/${activeEvent.id}/invitations`).then((r) => r.data),
    enabled: !!activeEvent?.id,
  })

  const { data: event } = useQuery({
    queryKey: ['event', activeEvent?.slug],
    queryFn: () => api.get(`/event/${activeEvent.slug}`).then((r) => r.data),
    enabled: !!activeEvent?.slug,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/events/${activeEvent.id}/invitations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations', activeEvent?.id] })
      qc.invalidateQueries({ queryKey: ['invitees', activeEvent?.id] })
      toast.success('Invitación eliminada.')
      setDeleteTarget(null)
    },
    onError: () => toast.error('No se pudo eliminar la invitación.'),
  })

  const toggleSentMutation = useMutation({
    mutationFn: ({ id, value }) => api.put(`/events/${activeEvent.id}/invitations/${id}`, { invitation_sent: value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations', activeEvent?.id] }),
    onError: () => toast.error('No se pudo actualizar el estado.'),
  })

  const handleEdit = (inv) => { setEditInvitation(inv); setFormOpen(true) }
  const handleAdd = () => { setEditInvitation(null); setFormOpen(true) }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Invitaciones</h1>
        {!isViewer && (
          <Button size="sm" onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : invitations.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin invitaciones.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {invitations.map((inv) => (
            <div key={inv.id} className={`border rounded-lg overflow-hidden${inv.type === 'late' ? ' border-l-4 border-l-amber-400' : ''}`}>
              {/* Header */}
              <div className={`px-4 py-3 flex items-start justify-between gap-3${inv.type === 'late' ? ' bg-amber-50/60 dark:bg-amber-950/20' : ' bg-muted/30'}`}>
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{inv.name_on_invitation}</span>
                    {inv.type === 'late' && (
                      <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">Rezagado</Badge>
                    )}
                    {inv.tags?.map((tag) => <TagChip key={tag.id} tag={tag} />)}
                  </div>
                  {inv.phone && <span className="text-xs text-muted-foreground">{inv.phone}</span>}
                  <span className="text-xs text-muted-foreground">
                    {inv.allowed_companions > 0 ? `+${inv.allowed_companions} acompañantes` : 'Sin acompañantes'}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {inv.phone && (
                    <Button variant="ghost" size="icon" asChild>
                      <a
                        href={`https://wa.me/${inv.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${inv.name_on_invitation}, te compartimos el enlace para confirmar tu asistencia: ${buildRsvpBase(event)}/rsvp/${event?.slug}/${inv.code}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600"
                      >
                        <WhatsAppIcon className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => setQrTarget({ code: inv.code, full_name: inv.name_on_invitation })}>
                    <QrCode className="h-4 w-4" />
                  </Button>
                  {!isViewer && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(inv)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteTarget(inv)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Invitees */}
              <div className="divide-y">
                {inv.invitees?.map((invitee) => (
                  <div key={invitee.id} className="px-4 py-2 flex items-center gap-3">
                    <span className="text-sm flex-1">{invitee.full_name}</span>
                    <Badge variant={statusVariant[invitee.status]} className="text-xs">
                      {statusLabel[invitee.status]}
                    </Badge>
                  </div>
                ))}
                {inv.companions?.length > 0 && inv.companions.map((c) => (
                  <div key={c.id} className="px-4 py-2 flex items-center gap-2 bg-muted/20">
                    <span className="text-xs text-muted-foreground">↳</span>
                    <span className="text-sm text-muted-foreground">{c.full_name}</span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              {!isViewer && (
                <div className="px-4 py-2 border-t flex items-center gap-2 bg-muted/10">
                  <Switch
                    id={`sent-${inv.id}`}
                    checked={!!inv.invitation_sent}
                    onCheckedChange={(v) => toggleSentMutation.mutate({ id: inv.id, value: v })}
                  />
                  <label htmlFor={`sent-${inv.id}`} className="text-xs text-muted-foreground cursor-pointer">Enviada</label>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <InvitationFormDialog
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditInvitation(null) }}
        invitation={editInvitation}
        activeEvent={activeEvent}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['invitations', activeEvent?.id] })
          qc.invalidateQueries({ queryKey: ['invitees', activeEvent?.id] })
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar invitación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la invitación de{' '}
              <strong>{deleteTarget?.name_on_invitation}</strong> y todos sus datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QrCodeDialog
        open={!!qrTarget}
        onOpenChange={(o) => !o && setQrTarget(null)}
        invitee={qrTarget}
        event={event}
      />
    </div>
  )
}

const emptyForm = {
  name_on_invitation: '', phone: '', allowed_companions: '0',
  notes: '', type: 'regular',
}

function InvitationFormDialog({ open, onOpenChange, invitation, activeEvent, onSuccess }) {
  const isEdit = !!invitation
  const qc = useQueryClient()
  const [form, setForm] = useState(emptyForm)
  const [invitees, setInvitees] = useState([{ full_name: '' }])
  const [addingName, setAddingName] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    if (invitation) {
      setForm({
        name_on_invitation: invitation.name_on_invitation,
        phone: invitation.phone ?? '',
        allowed_companions: String(invitation.allowed_companions),
        notes: invitation.notes ?? '',
        type: invitation.type ?? 'regular',
      })
    } else {
      setForm(emptyForm)
      setInvitees([{ full_name: '' }])
    }
    setAddingName('')
    setIsAdding(false)
  }, [invitation, open])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const mainMutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? api.put(`/events/${activeEvent.id}/invitations/${invitation.id}`, data)
        : api.post(`/events/${activeEvent.id}/invitations`, data),
    onSuccess: () => {
      onSuccess()
      toast.success(isEdit ? 'Invitación actualizada.' : 'Invitación creada.')
      onOpenChange(false)
    },
    onError: () => toast.error('Algo salió mal.'),
  })

  const addInviteeMutation = useMutation({
    mutationFn: (name) => api.post(`/events/${activeEvent.id}/invitations/${invitation.id}/invitees`, { full_name: name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invitations', activeEvent?.id] }); setIsAdding(false); setAddingName('') },
    onError: () => toast.error('No se pudo agregar el invitado.'),
  })

  const removeInviteeMutation = useMutation({
    mutationFn: (inviteeId) => api.delete(`/events/${activeEvent.id}/invitations/${invitation.id}/invitees/${inviteeId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations', activeEvent?.id] }),
    onError: (err) => toast.error(err?.response?.data?.message ?? 'No se pudo eliminar el invitado.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      ...form,
      allowed_companions: Number(form.allowed_companions),
    }
    if (!isEdit) {
      const validInvitees = invitees.filter((i) => i.full_name.trim())
      if (validInvitees.length === 0) {
        toast.error('Agrega al menos un invitado.')
        return
      }
      payload.invitees = validInvitees
    }
    mainMutation.mutate(payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar invitación' : 'Nueva invitación'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name_on_invitation">Nombre en la invitación</Label>
            <Input id="name_on_invitation" value={form.name_on_invitation} onChange={set('name_on_invitation')} required maxLength={255} placeholder="Sr. Juan Pérez y Sra." />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" value={form.phone} onChange={set('phone')} maxLength={50} />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="late">Rezagado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <Label>Acompañantes permitidos</Label>
              <Select value={form.allowed_companions} onValueChange={(v) => setForm((f) => ({ ...f, allowed_companions: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0,1,2,3,4,5,6,7,8,9,10].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n === 0 ? 'Ninguno' : `+${n}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notas</Label>
            <Input id="notes" value={form.notes} onChange={set('notes')} maxLength={500} />
          </div>

          {/* Invitees — create mode */}
          {!isEdit && (
            <div className="flex flex-col gap-2 border-t pt-3">
              <Label>Invitados <span className="text-muted-foreground font-normal text-xs">(mín. 1)</span></Label>
              {invitees.map((inv, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Nombre completo"
                    value={inv.full_name}
                    onChange={(e) => setInvitees((prev) => prev.map((x, j) => j === i ? { full_name: e.target.value } : x))}
                    maxLength={255}
                  />
                  {invitees.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" className="shrink-0 text-muted-foreground"
                      onClick={() => setInvitees((prev) => prev.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm"
                onClick={() => setInvitees((prev) => [...prev, { full_name: '' }])}>
                + Agregar invitado
              </Button>
            </div>
          )}

          {/* Invitees — edit mode */}
          {isEdit && (
            <div className="flex flex-col gap-2 border-t pt-3">
              <Label>Invitados</Label>
              {invitation?.invitees?.map((inv) => (
                <div key={inv.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm">{inv.full_name}</span>
                  <Badge variant={statusVariant[inv.status]} className="text-xs">{statusLabel[inv.status]}</Badge>
                  {invitation.invitees.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0"
                      disabled={removeInviteeMutation.isPending}
                      onClick={() => removeInviteeMutation.mutate(inv.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              {isAdding ? (
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-sm"
                    placeholder="Nombre completo"
                    value={addingName}
                    onChange={(e) => setAddingName(e.target.value)}
                    autoFocus
                    maxLength={255}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); if (addingName.trim()) addInviteeMutation.mutate(addingName.trim()) }
                      if (e.key === 'Escape') { setIsAdding(false); setAddingName('') }
                    }}
                  />
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0"
                    disabled={!addingName.trim() || addInviteeMutation.isPending}
                    onClick={() => addInviteeMutation.mutate(addingName.trim())}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground"
                    onClick={() => { setIsAdding(false); setAddingName('') }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding(true)}>
                  + Agregar invitado
                </Button>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="submit" className="w-full" disabled={mainMutation.isPending}>
              {mainMutation.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
