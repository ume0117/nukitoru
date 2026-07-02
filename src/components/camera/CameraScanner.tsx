'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { scanCanvas } from '@/lib/scanner/scanner'
import type { ScanResult } from '@/types'

interface CameraScannerProps {
  onResult: (results: ScanResult[]) => void
  onClose: () => void
}

// ============================================================
// ピッ音（Web Audio API）
// ============================================================
let sharedAudioContext: AudioContext | null = null

function unlockAudio() {
  try {
    if (!sharedAudioContext) {
      sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume()
    }
  } catch {}
}

function playBeep() {
  try {
    const ctx = sharedAudioContext || new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 1200
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
  } catch {}
}

// ============================================================
// コンポーネント
// ============================================================
export function CameraScanner({ onResult, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const accumulatedRef = useRef<ScanResult[]>([])
  const cooldownRef = useRef<Map<string, number>>(new Map())
  const processingRef = useRef<boolean>(false)
  // 確認用：直前に読んだコード（同じコードが2回連続で出たら確定）
  const lastDetectedRef = useRef<{key: string, time: number} | null>(null)

  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting')
  const [errorMsg, setErrorMsg] = useState('')
  const [count, setCount] = useState(0)
  const [lastScanned, setLastScanned] = useState<string>('')

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const handleFinish = useCallback(() => {
    stopCamera()
    if (accumulatedRef.current.length > 0) {
      onResult(accumulatedRef.current)
    }
    onClose()
  }, [stopCamera, onResult, onClose])

  const scanFrame = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanFrame)
      return
    }

    // 前のフレームがまだ処理中なら次のフレームへ
    if (processingRef.current) {
      rafRef.current = requestAnimationFrame(scanFrame)
      return
    }

    processingRef.current = true

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) { processingRef.current = false; return }
    ctx.drawImage(video, 0, 0)

    const results = await scanCanvas(canvas)

    if (results.length > 0) {
      const now = Date.now()
      const COOLDOWN_MS = 2000
      const CONFIRM_MS = 500 // 500ms以内に同じコードが2回出たら確定

      results.forEach(r => {
        const key = `${r.type}::${r.value}`
        const lastTime = cooldownRef.current.get(key) ?? 0
        if (now - lastTime <= COOLDOWN_MS) return // クールダウン中

        const last = lastDetectedRef.current
        if (last && last.key === key && now - last.time <= CONFIRM_MS) {
          // 同じコードが500ms以内に2回検出 → 確定
          lastDetectedRef.current = null
          cooldownRef.current.set(key, now)
          const existing = accumulatedRef.current.find(
            e => e.type === r.type && e.value === r.value
          )
          if (!existing) {
            accumulatedRef.current = [...accumulatedRef.current, r]
            setCount(accumulatedRef.current.length)
            setLastScanned(r.value)
            playBeep()
          }
        } else {
          // 1回目 → 保留
          lastDetectedRef.current = { key, time: now }
        }
      })
    }

    processingRef.current = false
    rafRef.current = requestAnimationFrame(scanFrame)
  }, [])

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
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        // ユーザー操作（カメラ許可）のタイミングでAudioContextを初期化
        unlockAudio()
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
        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
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
        <div className="flex items-center gap-3">
          <span className="text-white text-sm font-medium">
            {status === 'scanning' ? 'コードに向けてください' : status === 'starting' ? 'カメラ起動中...' : 'エラー'}
          </span>
          {count > 0 && (
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {count} 件
            </span>
          )}
        </div>
        <button
          onClick={handleFinish}
          className="px-4 py-1.5 rounded-full bg-white text-black text-sm font-semibold"
        >
          スキャン終了
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
              <div className="absolute inset-0 border-[80px] border-black/50 rounded-lg" />
              {[
                'top-0 left-0 border-t-4 border-l-4 rounded-tl-lg',
                'top-0 right-0 border-t-4 border-r-4 rounded-tr-lg',
                'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg',
                'bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-8 h-8 border-blue-400 ${cls}`} />
              ))}
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-red-500/80 animate-pulse" />
            </div>
          </div>
        )}

        {/* 最後に読み取ったコード */}
        {lastScanned && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <div className="bg-black/70 rounded-lg px-4 py-2 max-w-xs">
              <p className="text-green-400 text-xs font-mono text-center truncate">
                ✓ {lastScanned}
              </p>
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
                onClick={handleFinish}
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
