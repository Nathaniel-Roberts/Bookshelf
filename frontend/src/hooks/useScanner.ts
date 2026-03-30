import { useEffect, useRef, useCallback, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface UseScannerOptions {
  onScan: (code: string) => void
  enabled?: boolean
}

export function useScanner({ onScan, enabled = true }: UseScannerOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const elementId = 'barcode-scanner'

  const start = useCallback(async () => {
    if (!enabled || scannerRef.current) return

    try {
      const scanner = new Html5Qrcode(elementId)
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onScan(decodedText)
        },
        () => {},
      )
      setIsScanning(true)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scanner')
      setIsScanning(false)
    }
  }, [enabled, onScan])

  const stop = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
      } catch {
        // ignore
      }
      scannerRef.current = null
      setIsScanning(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [])

  return { elementId, isScanning, error, start, stop }
}

// Detect rapid keyboard input from USB/Bluetooth barcode scanners
export function useKeyboardScanner(onScan: (code: string) => void) {
  const bufferRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === 'Enter' && bufferRef.current.length >= 4) {
        onScan(bufferRef.current)
        bufferRef.current = ''
        return
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          bufferRef.current = ''
        }, 100)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearTimeout(timerRef.current)
    }
  }, [onScan])
}
