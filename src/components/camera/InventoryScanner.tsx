'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { scanCanvas } from '@/lib/scanner/scanner'
import type { ScanResult } from '@/types'

// ============================================================
// 型定義
// ============================================================
interface InventoryItem {
  result: ScanResult
  count: number
  lastScannedAt: string
}

interface InventorySession {
  startedAt: string
  items: InventoryItem[]
}

interface InventorySettings {
  autoConfirm: boolean // false=手動確定, true=3秒自動確定
}

// ============================================================
// localStorage
// ============================================================
const SESSION_KEY = 'nukitoru_inventory'
const SETTINGS_KEY = 'nukitoru_inventory_settings'

const DEFAULT_SETTINGS: InventorySettings = { autoConfirm: false }

function saveSession(session: InventorySession) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)) } catch {}
}
function loadSession(): InventorySession | null {
  try { const r = localStorage.getItem(SESSION_KEY); return r ? JSON.parse(r) : null } catch { return null }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY) } catch {}
}
function loadSettings(): InventorySettings {
  try { const r = localStorage.getItem(SETTINGS_KEY); return r ? { ...DEFAULT_SETTINGS, ...JSON.parse(r) } : DEFAULT_SETTINGS } catch { return DEFAULT_SETTINGS }
}
function saveSettings(s: InventorySettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch {}
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// ============================================================
// 音
// ============================================================
let audioCtx: AudioContext | null = null

function unlockAudio() {
  try {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const buf = audioCtx.createBuffer(1, 1, 22050)
    const src = audioCtx.createBufferSource()
    src.buffer = buf
    src.connect(audioCtx.destination)
    src.start(0)
  } catch {}
}

function playTone(freq: number, duration: number, volume = 0.4) {
  if (!audioCtx) return
  try {
    const ctx = audioCtx
    const play = () => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(volume, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + duration)
    }
    if (ctx.state === 'suspended') ctx.resume().then(play).catch(() => {})
    else play()
  } catch {}
}

const playNewItem  = () => playTone(600,  0.2, 0.4)  // 低音：新商品
const playExisting = () => playTone(1200, 0.15, 0.4) // 高音：既存商品
const playError    = () => { playTone(200, 0.1, 0.4); setTimeout(() => playTone(200, 0.1, 0.4), 150) } // エラー

// ============================================================
// コンポーネント
// ============================================================
interface Props {
  onFinish: (session: InventorySession) => void
  onClose: () => void
}

export function InventoryScanner({ onFinish, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const rafRef      = useRef<number>(0)
  const processingRef = useRef(false)
  const cooldownRef   = useRef(0)
  const sessionRef    = useRef<InventorySession | null>(null)
  const autoTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [status, setStatus]       = useState<'resume'|'starting'|'scanning'|'error'>('starting')
  const [session, setSession]     = useState<InventorySession | null>(null)
  const [pending, setPending]     = useState<{result: ScanResult, isNew: boolean} | null>(null)
  const [audioReady, setAudioReady] = useState(false)
  const [errorMsg, setErrorMsg]   = useState('')
  const [settings, setSettings]   = useState<InventorySettings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    setSettings(loadSettings())
    const saved = loadSession()
    if (saved && saved.items.length > 0) {
      setStatus('resume')
    } else {
      initSession(false)
    }
  }, [])

  const initSession = (resume: boolean) => {
    const saved = loadSession()
    const s: InventorySession = resume && saved
      ? saved
      : { startedAt: new Date().toISOString(), items: [] }
    if (!resume) clearSession()
    sessionRef.current = s
    setSession(s)
    setStatus('starting')
    startCamera()
  }

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
    if (!video || !canvas || video.readyState < 2) { rafRef.current = requestAnimationFrame(scanFrame); return }
    if (processingRef.current) { rafRef.current = requestAnimationFrame(scanFrame); return }
    processingRef.current = true

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (ctx) {
      ctx.drawImage(video, 0, 0)
      if (Date.now() - cooldownRef.current > 1500) {
        const results = await scanCanvas(canvas)
        if (results.length > 0) {
          const r = results[0]
          const isNew = !sessionRef.current?.items.some(
            i => i.result.type === r.type && i.result.value === r.value
          )
          cooldownRef.current = Date.now()
          if (isNew) playNewItem(); else playExisting()
          setPending({ result: r, isNew })
        }
      }
    }

    processingRef.current = false
    rafRef.current = requestAnimationFrame(scanFrame)
  }, [])

  // 自動確定タイマー
  useEffect(() => {
    if (pending && settings.autoConfirm) {
      autoTimerRef.current = setTimeout(() => handleConfirm(), 3000)
    }
    return () => { if (autoTimerRef.current) clearTimeout(autoTimerRef.current) }
  }, [pending, settings.autoConfirm])

  const handleConfirm = useCallback(() => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    setPending(prev => {
      if (!prev) return null
      const r = prev.result
      const now = new Date().toISOString()
      setSession(s => {
        if (!s) return s
        const idx = s.items.findIndex(i => i.result.type === r.type && i.result.value === r.value)
        const newItems = idx >= 0
          ? s.items.map((item, i) => i === idx ? { ...item, count: item.count + 1, lastScannedAt: now } : item)
          : [...s.items, { result: r, count: 1, lastScannedAt: now }]
        const updated = { ...s, items: newItems }
        sessionRef.current = updated
        saveSession(updated)
        return updated
      })
      return null
    })
  }, [])

  const handleCancel = useCallback(() => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    playError()
    setPending(null)
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

  const updateSettings = (s: InventorySettings) => {
    setSettings(s)
    saveSettings(s)
  }

  const totalCount = session?.items.reduce((s, i) => s + i.count, 0) ?? 0
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
            {saved.items.reduce((s,i) => s+i.count, 0)}件スキャン済み
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={() => initSession(true)} className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold">続きから再開</button>
          <button onClick={() => initSession(false)} className="w-full h-12 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold">新規開始（データを破棄）</button>
          <button onClick={onClose} className="w-full h-12 rounded-xl text-gray-400 text-sm">キャンセル</button>
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
            <span className="text-white text-sm font-bold">📋 棚卸し</span>
            {session && <span className="text-gray-400 text-xs">{formatDateTime(session.startedAt)}〜</span>}
          </div>
          <p className="text-emerald-400 text-xs font-semibold">合計 {totalCount}件 / {totalItems}商品</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(true)} className="w-8 h-8 rounded-full bg-gray-700 text-white text-sm flex items-center justify-center">⚙️</button>
          <button onClick={handleFinish} className="px-4 py-1.5 rounded-full bg-white text-black text-sm font-semibold">終了・保存</button>
        </div>
      </div>

      {/* カメラ映像 */}
      <div className="flex-1 relative overflow-hidden">
        {status !== 'error' && (
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
        )}

        {/* スキャン枠 */}
        {status === 'scanning' && !pending && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-64 h-64">
              <div className="absolute inset-0 border-[80px] border-black/50 rounded-lg" />
              {['top-0 left-0 border-t-4 border-l-4 rounded-tl-lg',
                'top-0 right-0 border-t-4 border-r-4 rounded-tr-lg',
                'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg',
                'bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-8 h-8 border-emerald-400 ${cls}`} />
              ))}
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-red-500/80 animate-pulse" />
            </div>
          </div>
        )}

        {/* 音を有効化 */}
        {!audioReady && status === 'scanning' && !pending && (
          <div className="absolute inset-0 flex items-end justify-center pb-36 z-10">
            <button onClick={() => { unlockAudio(); setAudioReady(true) }}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 text-white text-sm font-semibold shadow-lg animate-bounce">
              🔊 タップしてピッ音を有効化
            </button>
          </div>
        )}

        {/* 確認ダイアログ */}
        {pending && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl p-6 space-y-4">
              <div className="text-center space-y-1">
                <p className={`text-xs font-semibold ${pending.isNew ? 'text-blue-600' : 'text-emerald-600'}`}>
                  {pending.isNew ? '🆕 新しい商品' : '✅ 既存の商品'}
                </p>
                <p className="font-mono text-sm text-gray-600 dark:text-gray-400 break-all">{pending.result.value}</p>
                <p className="text-4xl font-bold text-gray-900 dark:text-white">
                  {pending.isNew ? '×1' : `×${(session?.items.find(i => i.result.value === pending.result.value)?.count ?? 0) + 1}`}
                </p>
                {settings.autoConfirm && (
                  <p className="text-xs text-gray-400">3秒後に自動確定</p>
                )}
              </div>

              {/* 正しいボタン（下・大きく） */}
              <button onClick={handleConfirm}
                className="w-full h-16 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-lg font-bold">
                ✅ 正しい
              </button>
              {/* 違うボタン（上・小さく） */}
              <button onClick={handleCancel}
                className="w-full h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm">
                ❌ 違う（取り消す）
              </button>
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

      {/* 設定パネル */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-end">
          <div className="w-full bg-white dark:bg-gray-900 rounded-t-2xl p-6 space-y-6">
            <h3 className="font-bold text-lg">棚卸し設定</h3>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">確定モード</p>
              <button onClick={() => updateSettings({ ...settings, autoConfirm: false })}
                className={`w-full h-12 rounded-xl text-sm font-medium border-2 ${!settings.autoConfirm ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                ● 手動確定（推奨・正確性重視）
              </button>
              <button onClick={() => updateSettings({ ...settings, autoConfirm: true })}
                className={`w-full h-12 rounded-xl text-sm font-medium border-2 ${settings.autoConfirm ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                ● 3秒自動確定（スピード重視）
              </button>
            </div>

            <button onClick={() => { updateSettings(DEFAULT_SETTINGS) }}
              className="w-full h-10 rounded-xl text-sm text-gray-500 border border-gray-200">
              初期設定に戻す
            </button>

            <button onClick={() => setShowSettings(false)}
              className="w-full h-12 rounded-xl bg-gray-900 text-white font-semibold">
              閉じる
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

export type { InventorySession, InventoryItem }
