'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { scanCanvas } from '@/lib/scanner/scanner'
import type { ScanResult } from '@/types'

interface CameraScannerProps {
  onResult: (results: ScanResult[]) => void
  onClose: () => void
}

export function CameraScanner({ onResult, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting')
  const [errorMsg, setErrorMsg] = useState('')
  const detectedRef = useRef(false)

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const handleClose = useCallback(() => {
    stopCamera()
    onClose()
  }, [stopCamera, onClose])

  const scanFrame = useCallback(async () => {
    if (detectedRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanFrame)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.drawImage(video, 0, 0)

    const results = await scanCanvas(canvas)
    if (results.length > 0 && !detectedRef.current) {
      detectedRef.current = true
      stopCamera()
      onResult(results)
      onClose()
      return
    }

    rafRef.current = requestAnimationFrame(scanFrame)
  }, [stopCamera, onResult, onClose])

  useEffect(() => {
    let cancelled = false

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setStatus('scanning')
          rafRef.current = requestAnimationFrame(scanFrame)
        }
      } catch (e: unknown) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : ''
        if (msg.includes('Permission') || msg.includes('permission') || msg.includes('NotAllowed')) {
          setErrorMsg('カメラへのアクセスが拒否されました。ブラウザの設定から許可してください。')
        } else if (msg.includes('NotFound')) {
          setErrorMsg('カメラが見つかりません。')
        } else {
          setErrorMsg('カメラを起動できませんでした。')
        }
        setStatus('error')
      }
    }

    start()
    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [scanFrame])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <span className="text-white text-sm font-medium">
          {status === 'scanning' ? 'コードに向けてください' : status === 'starting' ? 'カメラ起動中...' : 'エラー'}
        </span>
        <button
          onClick={handleClose}
          className="w-8 h-8 flex items-center justify-center text-white hover:text-gray-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* カメラ映像 */}
      <div className="flex-1 relative overflow-hidden">
        {status !== 'error' && (
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />
        )}

        {/* スキャンオーバーレイ */}
        {status === 'scanning' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-64 h-64">
              {/* 暗いオーバーレイ（四隅） */}
              <div className="absolute inset-0 border-[80px] border-black/50 rounded-lg" />
              {/* コーナーマーカー */}
              {[
                'top-0 left-0 border-t-4 border-l-4 rounded-tl-lg',
                'top-0 right-0 border-t-4 border-r-4 rounded-tr-lg',
                'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg',
                'bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-8 h-8 border-blue-400 ${cls}`} />
              ))}
              {/* スキャンライン */}
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-blue-400/70 animate-pulse" />
            </div>
          </div>
        )}

        {/* 起動中 */}
        {status === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* エラー */}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="text-center space-y-4">
              <p className="text-4xl">📷</p>
              <p className="text-white text-sm leading-relaxed">{errorMsg}</p>
              <button
                onClick={handleClose}
                className="px-6 py-2 rounded-full bg-white text-black text-sm font-medium"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 隠しcanvas */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
