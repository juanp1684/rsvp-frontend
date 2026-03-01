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

  const filtered = invitees
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

  const fetchExportData = () => api.get('/invitees/export').then((r) => r.data)

  const handleExportCsv = async () => {
    const data = await fetchExportData()
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

  const handleExportExcel = async () => {
    const data = await fetchExportData()
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
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
