import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import InviteeFormDialog from '@/components/InviteeFormDialog'
import QrCodeDialog from '@/components/QrCodeDialog'
import ImportDialog from '@/components/ImportDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Plus, Pencil, Trash2, Upload, Download, ChevronUp, ChevronDown, ChevronsUpDown, QrCode, SlidersHorizontal, X } from 'lucide-react'
import { useIsViewer } from '@/hooks/useIsViewer'

function WhatsAppIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

const buildRsvpBase = (event) => {
  const domain = import.meta.env.VITE_APP_DOMAIN
  if (event?.subdomain && domain) {
    return `${window.location.protocol}//${event.subdomain}.${domain}`
  }
  return window.location.origin
}

const getRsvpUrl = (invitee, event) =>
  `${buildRsvpBase(event)}/rsvp/${event?.slug ?? event}/${invitee.code}`

const fmtDate = (iso) => new Date(iso).toLocaleString('es', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  hour: '2-digit', minute: '2-digit',
})

const getWhatsAppUrl = (invitee, event) => {
  if (!invitee.phone) return null
  const phone = invitee.phone.replace(/\D/g, '')
  const rsvpUrl = getRsvpUrl(invitee, event)

  const deadline = invitee.type === 'late'
    ? (event.late_rsvp_deadline ?? event.rsvp_deadline)
    : event.rsvp_deadline
  const isPastDeadline = deadline && new Date() > new Date(deadline)

  if (isPastDeadline) {
    if (invitee.status === 'declined') return null

    if (invitee.status === 'pending') {
      const message = `Hola ${invitee.full_name}, te compartimos el enlace para confirmar tu asistencia a nuestra boda: ${rsvpUrl}`
      return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    }

    const greeting = invitee.full_name.toLowerCase().includes(' y ')
      ? `Estimados *${invitee.full_name}*,`
      : `Hola *${invitee.full_name}*,`

    const lines = [
      greeting,
      '',
      'Te recordamos que tienes confirmada tu asistencia a nuestra boda.',
      '',
    ]
    if (event.ceremony_at) lines.push(fmtDate(event.ceremony_at))
    if (event.ceremony_location) lines.push(event.ceremony_location)
    lines.push('', 'Puedes ver todos los detalles aquí:', rsvpUrl)

    return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`
  }

  const message = `Hola ${invitee.full_name}, te compartimos el enlace para confirmar tu asistencia a nuestra boda: ${rsvpUrl}`
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

const statusVariant = {
  attending: 'default',
  declined: 'destructive',
  pending: 'secondary',
}

const statusCycle = ['attending', 'pending', 'declined']

export default function InviteesPage() {
  useEffect(() => { document.title = 'RSVP Admin | Invitees' }, [])

  const qc = useQueryClient()
  const activeEvent = useAuthStore((s) => s.activeEvent)
  const isViewer = useIsViewer()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: 'all', type: 'all', sent: 'all' })
  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))
  const [formOpen, setFormOpen] = useState(false)
  const [editInvitee, setEditInvitee] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [qrInvitee, setQrInvitee] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [sort, setSort] = useState({ field: 'full_name', dir: 'asc' })
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const { data: invitees = [], isLoading } = useQuery({
    queryKey: ['invitees', activeEvent?.id],
    queryFn: () => api.get(`/events/${activeEvent.id}/invitees`).then((r) => r.data),
    enabled: !!activeEvent?.id,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/events/${activeEvent.id}/invitees/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitees', activeEvent?.id] })
      toast.success('Invitee deleted.')
      setDeleteTarget(null)
    },
    onError: () => toast.error('Could not delete invitee.'),
  })

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, data }) => api.post(`/events/${activeEvent.id}/invitees/bulk-update`, { ids: [...ids], data }),
    onMutate: async ({ ids, data }) => {
      await qc.cancelQueries({ queryKey: ['invitees', activeEvent?.id] })
      const previous = qc.getQueryData(['invitees', activeEvent?.id])
      qc.setQueryData(['invitees', activeEvent?.id], (old) =>
        old?.map((i) => ids.has(i.id) ? { ...i, ...data } : i)
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      qc.setQueryData(['invitees', activeEvent?.id], context.previous)
      toast.error('Could not update invitees.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['invitees', activeEvent?.id] }),
  })

  const toggleSentMutation = useMutation({
    mutationFn: ({ id, value }) => api.put(`/events/${activeEvent.id}/invitees/${id}`, { invitation_sent: value }),
    onMutate: async ({ id, value }) => {
      await qc.cancelQueries({ queryKey: ['invitees', activeEvent?.id] })
      const previous = qc.getQueryData(['invitees', activeEvent?.id])
      qc.setQueryData(['invitees', activeEvent?.id], (old) =>
        old?.map((i) => i.id === id ? { ...i, invitation_sent: value } : i)
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      qc.setQueryData(['invitees', activeEvent?.id], context.previous)
      toast.error('Could not update invitation status.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['invitees', activeEvent?.id] }),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => api.post(`/events/${activeEvent.id}/invitees/bulk-destroy`, { ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitees', activeEvent?.id] })
      toast.success(`Deleted ${selectedIds.size} invitees.`)
      setSelectedIds(new Set())
      setBulkDeleteOpen(false)
    },
    onError: () => toast.error('Could not delete invitees.'),
  })

  const toggleSelect = (id) => setSelectedIds((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const handleSort = (field) => {
    setSort((s) => {
      if (field === 'status') {
        if (s.field !== 'status') return { field: 'status', dir: 'attending' }
        const next = statusCycle[(statusCycle.indexOf(s.dir) + 1) % statusCycle.length]
        return { field: 'status', dir: next }
      }
      return s.field === field
        ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' }
    })
  }

  const SortIcon = ({ field }) => {
    if (sort.field !== field) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />
    if (field === 'status') return <ChevronUp className="h-3 w-3 ml-1" />
    return sort.dir === 'asc'
      ? <ChevronUp className="h-3 w-3 ml-1" />
      : <ChevronDown className="h-3 w-3 ml-1" />
  }

  const normalize = (str) =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const countInvitee = (i) =>
    i.status === 'attending'
      ? 1 + (i.companions?.length ?? 0)
      : 1 + (i.allowed_companions ?? 0)

  const statusCounts = {
    all:       invitees.reduce((sum, i) => sum + countInvitee(i), 0),
    attending: invitees.filter((i) => i.status === 'attending').reduce((sum, i) => sum + countInvitee(i), 0),
    pending:   invitees.filter((i) => i.status === 'pending').reduce((sum, i) => sum + countInvitee(i), 0),
    declined:  invitees.filter((i) => i.status === 'declined').reduce((sum, i) => sum + countInvitee(i), 0),
  }

  const lateCount = invitees.filter((i) => i.type === 'late').length
  const sentCount = invitees.filter((i) => i.invitation_sent).length
  const unsentCount = invitees.filter((i) => !i.invitation_sent).length
  const activeFilterCount = [filters.status !== 'all', filters.type !== 'all', filters.sent !== 'all'].filter(Boolean).length

  const filtered = invitees
    .filter((i) => filters.status === 'all' || i.status === filters.status)
    .filter((i) => filters.type === 'all' || i.type === filters.type)
    .filter((i) => filters.sent === 'all' || (filters.sent === 'sent' ? i.invitation_sent : !i.invitation_sent))
    .filter((i) => {
      const q = normalize(search)
      return (
        normalize(i.full_name).includes(q) ||
        i.companions?.some((c) => normalize(c.full_name).includes(q))
      )
    })
    .sort((a, b) => {
      if (sort.field === 'full_name') {
        const dir = sort.dir === 'asc' ? 1 : -1
        return a.full_name.localeCompare(b.full_name) * dir
      }
      if (sort.field === 'status') {
        const order = statusCycle.indexOf(sort.dir)
        const statusOrder = statusCycle.reduce((acc, s, i) => {
          acc[s] = (i - order + statusCycle.length) % statusCycle.length
          return acc
        }, {})
        return statusOrder[a.status] - statusOrder[b.status]
      }
      return 0
    })

  const allFilteredSelected = filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id))

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((i) => i.id)))
    }
  }

  const handleEdit = (invitee) => {
    setEditInvitee(invitee)
    setFormOpen(true)
  }

  const handleAdd = () => {
    setEditInvitee(null)
    setFormOpen(true)
  }

  const STATUS_ES = { attending: 'confirmado', pending: 'pendiente', declined: 'declinado' }
  const TYPE_ES = { invitee: 'invitado', companion: 'acompañante' }

  const buildExportRows = () =>
    filtered.flatMap((invitee) => [
      { tipo: TYPE_ES.invitee, nombre: invitee.full_name, telefono: invitee.phone ?? '', estado: STATUS_ES[invitee.status] },
      ...invitee.companions.map((c) => ({
        tipo: TYPE_ES.companion, nombre: c.full_name, telefono: '', estado: STATUS_ES[invitee.status],
      })),
    ])

  const handleExportCsv = () => {
    const data = buildExportRows()
    const headers = ['tipo', 'nombre', 'telefono', 'estado']
    const rows = data.map((r) => headers.map((h) => r[h] ?? '').join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lista-invitados.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportExcel = () => {
    const data = buildExportRows()
    const ws = XLSX.utils.json_to_sheet(
      data.map((r) => ({
        Tipo: r.tipo ?? '',
        Nombre: r.nombre ?? '',
        Teléfono: r.telefono ?? '',
        Estado: r.estado ?? '',
      }))
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Lista de Invitados')
    XLSX.writeFile(wb, 'lista-invitados.xlsx')
  }


  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Invitees</h1>
        {!isViewer && (
          <div className="flex gap-2 flex-wrap justify-end">
            {selectedIds.size > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={() => bulkUpdateMutation.mutate({ ids: selectedIds, data: { invitation_sent: true } })}>
                  Mark sent ({selectedIds.size})
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkUpdateMutation.mutate({ ids: selectedIds, data: { invitation_sent: false } })}>
                  Mark unsent ({selectedIds.size})
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete ({selectedIds.size})
                </Button>
              </>
            )}
            <Button size="sm" onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        )}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        {/* Filters */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="relative">
                <SlidersHorizontal className="h-4 w-4 mr-1" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-medium">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3 flex flex-col gap-4" align="start">
              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'attending', label: 'Attending' },
                  { key: 'pending', label: 'Pending' },
                  { key: 'declined', label: 'Declined' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFilter('status', key)}
                    className={`flex items-center justify-between text-sm px-2 py-1 rounded-md transition-colors ${filters.status === key ? 'bg-secondary font-medium' : 'hover:bg-muted'}`}
                  >
                    {label}
                    <span className="text-xs text-muted-foreground">{statusCounts[key]}</span>
                  </button>
                ))}
              </div>

              {/* Type */}
              {lateCount > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</p>
                  {[
                    { key: 'all', label: 'All', count: invitees.length },
                    { key: 'regular', label: 'Regular', count: invitees.length - lateCount },
                    { key: 'late', label: 'Late', count: lateCount },
                  ].map(({ key, label, count }) => (
                    <button
                      key={key}
                      onClick={() => setFilter('type', key)}
                      className={`flex items-center justify-between text-sm px-2 py-1 rounded-md transition-colors ${filters.type === key ? 'bg-secondary font-medium' : 'hover:bg-muted'}`}
                    >
                      {label}
                      <span className="text-xs text-muted-foreground">{count}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Sent */}
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invitation</p>
                {[
                  { key: 'all', label: 'All', count: invitees.length },
                  { key: 'sent', label: 'Sent', count: sentCount },
                  { key: 'unsent', label: 'Not sent', count: unsentCount },
                ].map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setFilter('sent', key)}
                    className={`flex items-center justify-between text-sm px-2 py-1 rounded-md transition-colors ${filters.sent === key ? 'bg-secondary font-medium' : 'hover:bg-muted'}`}
                  >
                    {label}
                    <span className="text-xs text-muted-foreground">{count}</span>
                  </button>
                ))}
              </div>

              {/* Clear */}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setFilters({ status: 'all', type: 'all', sent: 'all' })}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1 border-t"
                >
                  <X className="h-3 w-3" /> Clear all filters
                </button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Sort (mobile) + export/import */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-2 md:hidden">
          <Button
            variant={sort.field === 'full_name' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => handleSort('full_name')}
            className="flex items-center"
          >
            Name <SortIcon field="full_name" />
          </Button>
          <Button
            variant={sort.field === 'status' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => handleSort('status')}
            className="flex items-center"
          >
            Status <SortIcon field="status" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-1" />
            Excel
          </Button>
          {!isViewer && (
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((invitee) => (
              <div key={invitee.id} className={`border rounded-lg overflow-hidden${invitee.type === 'late' ? ' border-l-4 border-l-amber-400' : ''}`}>
                {/* Invitee row */}
                <div className={`p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3${invitee.type === 'late' ? ' bg-amber-50/60 dark:bg-amber-950/20' : ''}`}>
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {!isViewer && (
                      <Checkbox
                        checked={selectedIds.has(invitee.id)}
                        onCheckedChange={() => toggleSelect(invitee.id)}
                        className="mt-0.5 shrink-0"
                      />
                    )}
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium text-sm truncate">{invitee.full_name}</span>
                        {invitee.type === 'late' && (
                          <Badge className="text-xs shrink-0 bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">Late</Badge>
                        )}
                      </div>
                      {invitee.phone && (
                        <span className="text-xs text-muted-foreground">{invitee.phone}</span>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant={statusVariant[invitee.status]} className="text-xs capitalize">
                          {invitee.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {invitee.companions.length}/{invitee.allowed_companions} companions
                        </span>
                        {!isViewer && (
                          <div className="flex items-center gap-1.5">
                            <Switch
                              id={`sent-${invitee.id}`}
                              checked={!!invitee.invitation_sent}
                              onCheckedChange={(v) => toggleSentMutation.mutate({ id: invitee.id, value: v })}
                            />
                            <label htmlFor={`sent-${invitee.id}`} className="text-xs text-muted-foreground cursor-pointer">Sent</label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 border-t pt-2 -mx-4 px-3 sm:border-0 sm:pt-0 sm:mx-0 sm:px-0">
                    {getWhatsAppUrl(invitee, activeEvent) && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={getWhatsAppUrl(invitee, activeEvent)} target="_blank" rel="noopener noreferrer" className="text-green-600">
                          <WhatsAppIcon className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setQrInvitee(invitee)}>
                      <QrCode className="h-4 w-4" />
                    </Button>
                    {!isViewer && (
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(invitee)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {!isViewer && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => setDeleteTarget(invitee)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Companion rows */}
                {invitee.companions.map((companion) => (
                  <div
                    key={companion.id}
                    className="px-4 py-2.5 flex items-center gap-2 border-t bg-muted/40"
                  >
                    <span className="text-muted-foreground text-xs w-3">↳</span>
                    <span className="text-sm text-muted-foreground">{companion.full_name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    {!isViewer && (
                      <Checkbox
                        checked={allFilteredSelected}
                        onCheckedChange={toggleSelectAll}
                      />
                    )}
                  </TableHead>
                  <TableHead>
                    <button onClick={() => handleSort('full_name')} className="flex items-center hover:text-foreground transition-colors cursor-pointer">
                      Name <SortIcon field="full_name" />
                    </button>
                  </TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>
                    <button onClick={() => handleSort('status')} className="flex items-center hover:text-foreground transition-colors cursor-pointer">
                      Status <SortIcon field="status" />
                    </button>
                  </TableHead>
                  <TableHead>Companions</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((invitee) => (
                  <>
                    <TableRow key={invitee.id} className={invitee.type === 'late' ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(invitee.id)}
                          onCheckedChange={() => toggleSelect(invitee.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {invitee.full_name}
                          {invitee.type === 'late' && (
                            <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">Late</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{invitee.phone ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[invitee.status]} className="capitalize">
                          {invitee.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {invitee.companions.length} / {invitee.allowed_companions}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {invitee.code}
                      </TableCell>
                      <TableCell>
                        {!isViewer && (
                          <Switch
                            checked={!!invitee.invitation_sent}
                            onCheckedChange={(v) => toggleSentMutation.mutate({ id: invitee.id, value: v })}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {getWhatsAppUrl(invitee, activeEvent) && (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={getWhatsAppUrl(invitee, activeEvent)} target="_blank" rel="noopener noreferrer" className="text-green-600">
                              <WhatsAppIcon className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setQrInvitee(invitee)}>
                          <QrCode className="h-4 w-4" />
                        </Button>
                        {!isViewer && (
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(invitee)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {!isViewer && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setDeleteTarget(invitee)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Companion rows */}
                    {invitee.companions.map((companion) => (
                      <TableRow key={companion.id} className="bg-muted/40 hover:bg-muted/40">
                        <TableCell />
                        <TableCell className="text-muted-foreground pl-8">
                          <span className="mr-2 text-xs">↳</span>
                          {companion.full_name}
                        </TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell />
                      </TableRow>
                    ))}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>

          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No invitees found.</p>
          )}
        </>
      )}

      <InviteeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        invitee={editInvitee}
      />

      <QrCodeDialog
        open={!!qrInvitee}
        onOpenChange={(o) => !o && setQrInvitee(null)}
        invitee={qrInvitee}
        event={activeEvent}
      />

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} invitees?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected invitees and all their companions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulkDeleteMutation.mutate([...selectedIds])}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invitee?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <strong>{deleteTarget?.full_name}</strong> and all their companions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
