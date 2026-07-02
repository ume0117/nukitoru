'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { scanCanvas } from '@/lib/scanner/scanner'
import type { ScanResult } from '@/types'

interface InventoryItem {
  result: ScanResult
  count: number
  lastScannedAt: string
}

interface InventorySession {
  startedAt: string
  items: InventoryItem[]
}

const STORAGE_KEY = 'nukitoru_inventory'

function saveSession(session: InventorySession) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)) } catch {}
}

function loadSession(): InventorySession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// ============================================================
// ピッ音
// ============================================================
let inventoryAudioCtx: AudioContext | null = null

function unlockInventoryAudio() {
  try {
    inventoryAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const buf = inventoryAudioCtx.createBuffer(1, 1, 22050)
    const src = inventoryAudioCtx.createBufferSource()
    src.buffer = buf
    src.connect(inventoryAudioCtx.destination)
    src.start(0)
  } catch {}
}

function playInventoryBeep() {
  if (!inventoryAudioCtx) return
  try {
    const ctx = inventoryAudioCtx
    const doPlay = () => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 1000
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.12)
    }
    if (ctx.state === 'suspended') ctx.resume().then(doPlay).catch(() => {})
    else doPlay()
  } catch {}
}

// ============================================================
// コンポーネント
// ============================================================
interface InventoryScannerProps {
  onFinish: (session: InventorySession) => void
  onClose: () => void
}

export function InventoryScanner({ onFinish, onClose }: InventoryScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const processingRef = useRef<boolean>(false)
  const globalCooldownRef = useRef<number>(0)
  const sessionRef = useRef<InventorySession | null>(null)

  const [status, setStatus] = useState<'resume' | 'starting' | 'scanning' | 'error'>('starting')
  const [session, setSession] = useState<InventorySession | null>(null)
  const [lastItem, setLastItem] = useState<InventoryItem | null>(null)
  const [audioReady, setAudioReady] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // 起動時に前回セッションを確認
  useEffect(() => {
    const saved = loadSession()
    if (saved && saved.items.length > 0) {
      setStatus('resume')
    } else {
      // 保存データなし → 新規セッションを開始してカメラ起動
      const newSession: InventorySession = { startedAt: new Date().toISOString(), items: [] }
      sessionRef.current = newSession
      setSession(newSession)
      startCamera()
    }
  }, [])

  const startSession = useCallback((resume: boolean) => {
    const saved = loadSession()
    const newSession: InventorySession = resume && saved
      ? saved
      : { startedAt: new Date().toISOString(), items: [] }
    if (!resume) clearSession()
    sessionRef.current = newSession
    setSession(newSession)
    setStatus('starting')
    startCamera()
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setStatus('scanning')
        rafRef.current = requestAnimationFrame(scanFrame)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      setErrorMsg(msg.includes('Permission') ? 'カメラへのアクセスが拒否されました。' : 'カメラを起動できませんでした。')
      setStatus('error')
    }
  }, [])

  const scanFrame = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanFrame)
      return
    }
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

    if (results.length > 0 && Date.now() - globalCooldownRef.current > 1500) {
      const r = results[0]
      const now = new Date().toISOString()
      globalCooldownRef.current = Date.now()

      setSession(prev => {
        if (!prev) return prev
        const existing = prev.items.findIndex(
          i => i.result.type === r.type && i.result.value === r.value
        )
        let newItems: InventoryItem[]
        if (existing >= 0) {
          newItems = prev.items.map((item, idx) =>
            idx === existing
              ? { ...item, count: item.count + 1, lastScannedAt: now }
              : item
          )
        } else {
          newItems = [...prev.items, { result: r, count: 1, lastScannedAt: now }]
        }
        const updated = { ...prev, items: newItems }
        sessionRef.current = updated
        saveSession(updated) // リアルタイム自動保存
        const updatedItem = newItems[existing >= 0 ? existing : newItems.length - 1]
        setLastItem(updatedItem)
        playInventoryBeep()
        return updated
      })
    }

    processingRef.current = false
    rafRef.current = requestAnimationFrame(scanFrame)
  }, [])

  const handleFinish = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (sessionRef.current && sessionRef.current.items.length > 0) {
      onFinish(sessionRef.current)
      clearSession()
    } else {
      onClose()
    }
  }, [onFinish, onClose])

  const totalCount = session?.items.reduce((sum, i) => sum + i.count, 0) ?? 0
  const totalItems = session?.items.length ?? 0

  // 再開確認画面
  if (status === 'resume') {
    const saved = loadSession()!
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-950 flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-4xl">📋</div>
        <div className="text-center space-y-2">
          <p className="font-bold text-lg">前回の棚卸しデータがあります</p>
          <p className="text-sm text-gray-500">
            開始：{formatDateTime(saved.startedAt)}<br/>
            {saved.items.reduce((s,i)=>s+i.count,0)}件スキャン済み
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={() => startSession(true)}
            className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold">
            続きから再開
          </button>
          <button onClick={() => startSession(false)}
            className="w-full h-12 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold">
            新規開始（データを破棄）
          </button>
          <button onClick={onClose}
            className="w-full h-12 rounded-xl text-gray-400 text-sm">
            キャンセル
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-bold">📋 棚卸しモード</span>
            {session && (
              <span className="text-gray-400 text-xs">{formatDateTime(session.startedAt)}〜</span>
            )}
          </div>
          <p className="text-blue-400 text-xs font-semibold">
            合計 {totalCount}件 / {totalItems}商品
          </p>
        </div>
        <button onClick={handleFinish}
          className="px-4 py-1.5 rounded-full bg-white text-black text-sm font-semibold">
          終了・保存
        </button>
      </div>

      {/* カメラ映像 */}
      <div className="flex-1 relative overflow-hidden">
        {status !== 'error' && (
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
        )}

        {/* スキャン枠 */}
        {status === 'scanning' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-64 h-64">
              <div className="absolute inset-0 border-[80px] border-black/50 rounded-lg" />
              {['top-0 left-0 border-t-4 border-l-4 rounded-tl-lg',
                'top-0 right-0 border-t-4 border-r-4 rounded-tr-lg',
                'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg',
                'bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-8 h-8 border-green-400 ${cls}`} />
              ))}
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-red-500/80 animate-pulse" />
            </div>
          </div>
        )}

        {/* 音を有効化ボタン */}
        {!audioReady && status === 'scanning' && (
          <div className="absolute inset-0 flex items-end justify-center pb-36 z-10">
            <button onClick={() => { unlockInventoryAudio(); setAudioReady(true) }}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 text-white text-sm font-semibold shadow-lg animate-bounce">
              🔊 タップしてピッ音を有効化
            </button>
          </div>
        )}

        {/* 最後にスキャンした商品 */}
        {lastItem && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <div className="bg-black/80 rounded-xl px-5 py-3 mx-4 w-full max-w-xs">
              <p className="text-green-400 text-xs font-mono truncate">✓ {lastItem.result.value}</p>
              <p className="text-white text-2xl font-bold text-center mt-1">
                ×{lastItem.count}
              </p>
            </div>
          </div>
        )}

        {status === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="text-center space-y-4">
              <p className="text-4xl">📷</p>
              <p className="text-white text-sm">{errorMsg}</p>
              <button onClick={onClose} className="px-6 py-2 rounded-full bg-white text-black text-sm font-medium">閉じる</button>
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

export type { InventorySession, InventoryItem }
