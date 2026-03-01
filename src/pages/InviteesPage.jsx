import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import InviteeFormDialog from '@/components/InviteeFormDialog'
import QrCodeDialog from '@/components/QrCodeDialog'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Plus, Pencil, Trash2, Upload, Download, ChevronUp, ChevronDown, ChevronsUpDown, QrCode } from 'lucide-react'

function WhatsAppIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

const getWhatsAppUrl = (invitee) => {
  const phone = invitee.phone.replace(/\D/g, '')
  const rsvpUrl = `${window.location.origin}/rsvp/${invitee.code}`
  const message = encodeURIComponent(
    `Hola ${invitee.full_name}, te compartimos el enlace para confirmar tu asistencia a nuestra boda: ${rsvpUrl}`
  )
  return `https://wa.me/${phone}?text=${message}`
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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editInvitee, setEditInvitee] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [qrInvitee, setQrInvitee] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const fileInputRef = useRef(null)
  const [sort, setSort] = useState({ field: 'full_name', dir: 'asc' })

  const { data: invitees = [], isLoading } = useQuery({
    queryKey: ['invitees'],
    queryFn: () => api.get('/invitees').then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/invitees/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitees'] })
      toast.success('Invitee deleted.')
      setDeleteTarget(null)
    },
    onError: () => toast.error('Could not delete invitee.'),
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

  const statusCounts = {
    all: invitees.length,
    attending: invitees.filter((i) => i.status === 'attending').length,
    pending: invitees.filter((i) => i.status === 'pending').length,
    declined: invitees.filter((i) => i.status === 'declined').length,
  }

  const filtered = invitees
    .filter((i) => statusFilter === 'all' || i.status === statusFilter)
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

  const handleEdit = (invitee) => {
    setEditInvitee(invitee)
    setFormOpen(true)
  }

  const handleAdd = () => {
    setEditInvitee(null)
    setFormOpen(true)
  }

  const buildExportRows = () =>
    filtered.flatMap((invitee) => [
      { type: 'invitee', full_name: invitee.full_name, phone: invitee.phone ?? '', status: invitee.status },
      ...invitee.companions.map((c) => ({
        type: 'companion', full_name: c.full_name, phone: '', status: invitee.status,
      })),
    ])

  const handleExportCsv = () => {
    const data = buildExportRows()
    const headers = ['type', 'full_name', 'phone', 'status']
    const rows = data.map((r) => headers.map((h) => r[h] ?? '').join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'guest-list.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportExcel = () => {
    const data = buildExportRows()
    const ws = XLSX.utils.json_to_sheet(
      data.map((r) => ({
        Type: r.type ?? '',
        'Full Name': r.full_name ?? '',
        Phone: r.phone ?? '',
        Status: r.status ?? '',
      }))
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Guest List')
    XLSX.writeFile(wb, 'guest-list.xlsx')
  }

  const handleTemplateDownload = () => {
    const csv = 'full_name,phone,allowed_companions,notes\nJuan García,+52 55 1234 5678,1,\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'invitees-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportOpen(false)
    const formData = new FormData()
    formData.append('file', file)
    api
      .post('/invitees/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(({ data }) => {
        qc.invalidateQueries({ queryKey: ['invitees'] })
        toast.success(`Imported ${data.imported} invitees.`)
      })
      .catch(() => toast.error('Import failed. Check your file format.'))
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Invitees</h1>
        <Button size="sm" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Search + actions */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all', label: 'All' },
            { key: 'attending', label: 'Attending' },
            { key: 'pending', label: 'Pending' },
            { key: 'declined', label: 'Declined' },
          ].map(({ key, label }) => (
            <Button
              key={key}
              variant={statusFilter === key ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(key)}
            >
              {label} ({statusCounts[key]})
            </Button>
          ))}
        </div>
        {/* Mobile sort */}
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
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((invitee) => (
              <div key={invitee.id} className="border rounded-lg overflow-hidden">
                {/* Invitee row */}
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-medium text-sm truncate">{invitee.full_name}</span>
                    {invitee.phone && (
                      <span className="text-xs text-muted-foreground">{invitee.phone}</span>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={statusVariant[invitee.status]} className="text-xs capitalize">
                        {invitee.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {invitee.companions.length}/{invitee.allowed_companions} companions
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {invitee.phone && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={getWhatsAppUrl(invitee)} target="_blank" rel="noopener noreferrer" className="text-green-600">
                          <WhatsAppIcon className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setQrInvitee(invitee)}>
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(invitee)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setDeleteTarget(invitee)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((invitee) => (
                  <>
                    <TableRow key={invitee.id}>
                      <TableCell className="font-medium">{invitee.full_name}</TableCell>
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
                      <TableCell className="text-right">
                        {invitee.phone && (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={getWhatsAppUrl(invitee)} target="_blank" rel="noopener noreferrer" className="text-green-600">
                              <WhatsAppIcon className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setQrInvitee(invitee)}>
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(invitee)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => setDeleteTarget(invitee)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* Companion rows */}
                    {invitee.companions.map((companion) => (
                      <TableRow key={companion.id} className="bg-muted/40 hover:bg-muted/40">
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
      />

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

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Import invitees</DialogTitle>
          </DialogHeader>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1.5 font-medium">Column</th>
                <th className="text-left py-1.5 font-medium">Required?</th>
              </tr>
            </thead>
            <tbody>
              {[
                { col: 'full_name', required: true },
                { col: 'phone', required: false },
                { col: 'allowed_companions', required: false },
                { col: 'notes', required: false },
              ].map(({ col, required }) => (
                <tr key={col} className="border-b last:border-0">
                  <td className="py-1.5 font-mono text-xs">{col}</td>
                  <td className="py-1.5">
                    {required
                      ? <span className="text-green-600 font-medium">Required</span>
                      : <span className="text-muted-foreground">Optional</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button variant="outline" className="w-full" onClick={handleTemplateDownload}>
              <Download className="h-4 w-4 mr-1" />
              Download template
            </Button>
            <Button className="w-full" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" />
              Choose file…
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
