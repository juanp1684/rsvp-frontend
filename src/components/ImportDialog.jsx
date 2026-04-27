import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Upload } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

const COLUMNS = [
  { col: 'nombre',       required: true },
  { col: 'teléfono',     required: false },
  { col: 'acompañantes', required: false },
  { col: 'notas',        required: false },
  { col: 'tipo',         required: false, hint: 'regular o tarde' },
]

function validateStructure(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

        if (rows.length === 0) {
          resolve([{ row: 0, field: '', message: 'The file is empty.' }])
          return
        }

        const headerCount = rows[0].filter((h) => String(h).trim() !== '').length

        const errs = []
        for (let i = 1; i < rows.length; i++) {
          const rowCount = rows[i].filter((v) => v !== '').length
          if (rowCount === 0) continue // skip blank rows
          if (rowCount !== headerCount) {
            errs.push({
              row: i + 1,
              field: '',
              message: `Row has ${rowCount} column${rowCount !== 1 ? 's' : ''} but the header has ${headerCount}.`,
            })
          }
        }
        resolve(errs)
      } catch {
        resolve([{ row: 0, field: '', message: 'Could not read the file. Make sure it is a valid CSV or Excel file.' }])
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

export default function ImportDialog({ open, onOpenChange }) {
  const qc = useQueryClient()
  const activeEvent = useAuthStore((s) => s.activeEvent)
  const fileInputRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState([])

  const handleClose = (v) => {
    if (!v) setErrors([])
    onOpenChange(v)
  }

  const handleTemplateDownload = () => {
    const csv = 'nombre,teléfono,acompañantes,notas,tipo\nJuan García,+52 55 1234 5678,1,,regular\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla-invitados.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setErrors([])
    setLoading(true)

    const structureErrors = await validateStructure(file)
    if (structureErrors.length > 0) {
      setErrors(structureErrors)
      setLoading(false)
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    try {
      const { data } = await api.post(
        `/events/${activeEvent.id}/invitees/import`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      qc.invalidateQueries({ queryKey: ['invitees', activeEvent?.id] })
      toast.success(`${data.imported} invitados importados.`)
      handleClose(false)
    } catch (err) {
      const validationErrors = err.response?.data?.errors
      if (validationErrors) {
        setErrors(validationErrors)
      } else {
        toast.error('Error al importar. Verifica el formato del archivo.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
            {COLUMNS.map(({ col, required, hint }) => (
              <tr key={col} className="border-b last:border-0">
                <td className="py-1.5 font-mono text-xs">
                  {col}
                  {hint && <span className="text-muted-foreground ml-1 font-sans">({hint})</span>}
                </td>
                <td className="py-1.5">
                  {required
                    ? <span className="text-green-600 font-medium">Required</span>
                    : <span className="text-muted-foreground">Optional</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {errors.length > 0 && (
          <div className="border border-destructive rounded-md overflow-hidden">
            <div className="bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {errors.length} error{errors.length > 1 ? 's' : ''} found
            </div>
            <ul className="divide-y max-h-48 overflow-y-auto">
              {errors.map((err, i) => (
                <li key={i} className="px-3 py-2 text-xs flex gap-3">
                  {err.row > 0 && <span className="text-muted-foreground shrink-0">Row {err.row}</span>}
                  {err.field && <span className="font-mono text-muted-foreground shrink-0">{err.field}</span>}
                  <span className="text-destructive">{err.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFile}
        />

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button variant="outline" className="w-full" onClick={handleTemplateDownload}>
            <Download className="h-4 w-4 mr-1" />
            Download template
          </Button>
          <Button className="w-full" disabled={loading} onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" />
            {loading ? 'Importing…' : errors.length > 0 ? 'Choose another file…' : 'Choose file…'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
