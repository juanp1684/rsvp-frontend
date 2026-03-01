import { useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Download } from 'lucide-react'

export default function QrCodeDialog({ open, onOpenChange, invitee }) {
  const canvasRef = useRef(null)

  const rsvpUrl = invitee
    ? `${window.location.origin}/rsvp/${invitee.code}`
    : ''

  const handleDownload = () => {
    const qrCanvas = canvasRef.current?.querySelector('canvas')
    if (!qrCanvas) return

    const padding = 16
    const textHeight = 36
    const out = document.createElement('canvas')
    out.width = qrCanvas.width + padding * 2
    out.height = qrCanvas.height + padding * 2 + textHeight

    const ctx = out.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(qrCanvas, padding, padding)

    ctx.fillStyle = '#000000'
    ctx.font = `bold ${textHeight * 0.6}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      invitee.full_name,
      out.width / 2,
      qrCanvas.height + padding + textHeight / 2,
    )

    const a = document.createElement('a')
    a.href = out.toDataURL('image/png')
    a.download = `rsvp-${invitee.full_name.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-xs">
        <DialogHeader>
          <DialogTitle className="truncate">{invitee?.full_name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div ref={canvasRef} className="p-3 bg-white rounded-lg">
            {invitee && (
              <QRCodeCanvas
                value={rsvpUrl}
                size={200}
                marginSize={1}
              />
            )}
          </div>
          <a href={rsvpUrl} target='_blank' className="text-xs text-muted-foreground font-mono break-all text-center">
            {rsvpUrl}
          </a>
          <Button className="w-full" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download PNG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
