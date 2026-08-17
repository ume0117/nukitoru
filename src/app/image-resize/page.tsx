'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { getPlan, type PlanType } from '@/lib/license'

const FREE_LIMIT = 2
const PRO_MALL_LIMIT = 3

type FitMode = 'pad' | 'cover' | 'stretch'
type OutputFormat = 'jpeg' | 'png' | 'webp'

interface Preset {
  id: string
  name: string
  width: number
  height: number
  maxBytes: number | null
}

const PRESETS: Preset[] = [
  { id: 'rakuten', name: '楽天市場（700×700px）', width: 700, height: 700, maxBytes: 200 * 1024 },
  { id: 'yahoo', name: 'Yahoo!ショッピング（1280×1280px）', width: 1280, height: 1280, maxBytes: 2 * 1024 * 1024 },
  { id: 'amazon', name: 'Amazon（1600×1600px）', width: 1600, height: 1600, maxBytes: 2 * 1024 * 1024 },
  { id: 'aupay', name: 'auPAYマーケット（640×640px）', width: 640, height: 640, maxBytes: 2 * 1024 * 1024 },
  { id: 'qoo10', name: 'Qoo10（800×800px）', width: 800, height: 800, maxBytes: null },
  { id: 'mercari_kauche', name: 'メルカリ・カウシェ（1080×1080px）', width: 1080, height: 1080, maxBytes: 2 * 1024 * 1024 },
  { id: 'base', name: 'BASE（1280×1280px）', width: 1280, height: 1280, maxBytes: 10 * 1024 * 1024 },
  { id: 'generic', name: '汎用（1200×1200px）', width: 1200, height: 1200, maxBytes: 2 * 1024 * 1024 },
]

interface SourceImage {
  id: string
  file: File
  url: string
  size: number
}

interface ResultImage {
  presetId: string
  url: string
  bytes: number
  label: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

function drawToCanvas(img: HTMLImageElement, targetW: number, targetH: number, fitMode: FitMode, bgColor: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')!

  if (fitMode === 'stretch') {
    ctx.drawImage(img, 0, 0, targetW, targetH)
    return canvas
  }

  const srcRatio = img.width / img.height
  const targetRatio = targetW / targetH

  if (fitMode === 'pad') {
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, targetW, targetH)
    let drawW: number, drawH: number
    if (srcRatio > targetRatio) {
      drawW = targetW
      drawH = targetW / srcRatio
    } else {
      drawH = targetH
      drawW = targetH * srcRatio
    }
    const x = (targetW - drawW) / 2
    const y = (targetH - drawH) / 2
    ctx.drawImage(img, x, y, drawW, drawH)
  } else {
    let srcW: number, srcH: number, srcX: number, srcY: number
    if (srcRatio > targetRatio) {
      srcH = img.height
      srcW = img.height * targetRatio
      srcX = (img.width - srcW) / 2
      srcY = 0
    } else {
      srcW = img.width
      srcH = img.width / targetRatio
      srcX = 0
      srcY = (img.height - srcH) / 2
    }
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH)
  }
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement, format: OutputFormat, quality: number): Promise<Blob | null> {
  const mime = format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : 'image/webp'
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality)
  })
}

async function compressToTarget(canvas: HTMLCanvasElement, format: OutputFormat, maxBytes: number | null): Promise<Blob> {
  if (format === 'png' || !maxBytes) {
    const blob = await canvasToBlob(canvas, format, 0.92)
    return blob!
  }
  let quality = 0.92
  let blob = await canvasToBlob(canvas, format, quality)
  while (blob && blob.size > maxBytes && quality > 0.3) {
    quality -= 0.08
    blob = await canvasToBlob(canvas, format, quality)
  }
  return blob!
}

export default function ImageResizePage() {
  const [plan, setPlan] = useState<PlanType>('free')
  const [images, setImages] = useState<SourceImage[]>([])
  const [selectedPresets, setSelectedPresets] = useState<string[]>([PRESETS[0].id])
  const [fitMode, setFitMode] = useState<FitMode>('pad')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [format, setFormat] = useState<OutputFormat>('jpeg')
  const [renamePrefix, setRenamePrefix] = useState('')
  const [results, setResults] = useState<Record<string, ResultImage[]>>({})
  const [processing, setProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getPlan().then(setPlan)
  }, [])

  const isPro = plan === 'pro' || plan === 'pro_max'
  const isProMax = plan === 'pro_max'
  const mallLimit = isProMax ? PRESETS.length : isPro ? PRO_MALL_LIMIT : 1

  const togglePreset = (id: string) => {
    setResults({})
    setSelectedPresets((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id)
      if (prev.length >= mallLimit) {
        setErrorMsg(
          isProMax
            ? ''
            : isPro
            ? `Proプランは同時に${PRO_MALL_LIMIT}モールまで選択できます。全モール同時処理はPro Maxで利用できます。`
            : '無料版は同時に1モールまでです。複数モールを同時に処理するにはProへアップグレードしてください。'
        )
        return prev
      }
      setErrorMsg('')
      return [...prev, id]
    })
  }

  const handleFiles = (files: FileList | File[]) => {
    setErrorMsg('')
    setResults({})
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (arr.length === 0) {
      setErrorMsg('画像ファイルを選択してください。')
      return
    }
    const target = isPro ? arr : arr.slice(0, FREE_LIMIT)
    if (!isPro && arr.length > FREE_LIMIT) {
      setErrorMsg(`無料版は一度に${FREE_LIMIT}件までです。先頭${FREE_LIMIT}件のみ処理します。まとめて処理するにはProへアップグレードしてください。`)
    }
    const newImages: SourceImage[] = target.map((f, i) => ({
      id: `${Date.now()}_${i}`,
      file: f,
      url: URL.createObjectURL(f),
      size: f.size,
    }))
    setImages(newImages)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
  }

  const clearAll = () => {
    setImages([])
    setResults({})
    setErrorMsg('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const processAll = async () => {
    if (images.length === 0 || selectedPresets.length === 0) return
    setProcessing(true)
    const newResults: Record<string, ResultImage[]> = {}

    for (const presetId of selectedPresets) {
      const preset = PRESETS.find((p) => p.id === presetId)!
      const list: ResultImage[] = []
      for (let i = 0; i < images.length; i++) {
        try {
          const img = await loadImage(images[i].file)
          const canvas = drawToCanvas(img, preset.width, preset.height, fitMode, bgColor)
          const blob = await compressToTarget(canvas, format, preset.maxBytes)
          const url = URL.createObjectURL(blob)
          const label = renamePrefix
            ? `${renamePrefix}_${String(i + 1).padStart(2, '0')}`
            : String(i + 1).padStart(3, '0')
          list.push({ presetId, url, bytes: blob.size, label })
        } catch {
          // スキップ
        }
      }
      newResults[presetId] = list
      setResults({ ...newResults })
    }
    setProcessing(false)
  }

  const downloadSingle = (item: ResultImage) => {
    const ext = format === 'jpeg' ? 'jpg' : format
    const preset = PRESETS.find((p) => p.id === item.presetId)!
    const a = document.createElement('a')
    a.href = item.url
    a.download = `${preset.id}_${item.label}.${ext}`
    a.click()
  }

  const downloadZipAll = async () => {
    if (!isPro) return
    const entries = Object.entries(results)
    if (entries.length === 0) return
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    const ext = format === 'jpeg' ? 'jpg' : format
    for (const [presetId, list] of entries) {
      const folder = zip.folder(presetId)!
      for (const item of list) {
        const res = await fetch(item.url)
        const blob = await res.blob()
        folder.file(`${item.label}.${ext}`, blob)
      }
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nukitoru_images_${selectedPresets.join('_')}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasResults = Object.values(results).some((list) => list.length > 0)
  const totalResultCount = Object.values(results).reduce((s, list) => s + list.length, 0)

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-[10px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase hover:text-blue-600 transition-colors">← NUKITORU</Link>
        </div>

        <h1 className="text-[13px] tracking-[0.3em] text-gray-900 dark:text-white uppercase font-medium mb-2">商品画像リサイズ</h1>
        <p className="text-[11px] text-gray-500 leading-relaxed mb-2">
          複数の商品画像を、楽天・Yahoo!・Amazonなど各モールの推奨サイズにまとめて変換できます。すべてブラウザ内で処理され、サーバーには送信されません。
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-600 leading-relaxed mb-8">
          {isProMax
            ? '全モール同時選択・一括処理が可能です。'
            : isPro
            ? `同時に最大${PRO_MALL_LIMIT}モールまで選択して一括処理できます。全モール同時処理はPro Maxで利用できます。`
            : `無料版は一度に${FREE_LIMIT}件・1モールまで。複数モール同時処理はProで利用できます。`}
        </p>

        {images.length === 0 && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full border-2 border-dashed rounded p-8 text-center cursor-pointer transition-colors ${isDragging ? 'border-blue-600 bg-blue-600/5' : 'border-gray-200 dark:border-gray-800 hover:border-blue-600'}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => { if (e.target.files) handleFiles(e.target.files) }}
              className="hidden"
            />
            <p className="text-[11px] text-gray-500 mb-1">画像をドラッグ&ドロップ</p>
            <p className="text-[9px] text-gray-400 tracking-[0.1em] uppercase">またはクリックして選択（複数枚可）</p>
          </div>
        )}

        {errorMsg && (
          <p className="text-[10px] text-yellow-500 leading-relaxed my-4">
            {errorMsg}
            {!isProMax && <Link href="/upgrade" className="text-blue-500 hover:text-blue-600 underline ml-1">{isPro ? 'Pro Maxの詳細を見る' : 'Proにアップグレード'} →</Link>}
          </p>
        )}

        {images.length > 0 && (
          <>
            <div className="border border-gray-100 dark:border-gray-800 p-4 space-y-3 my-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] tracking-[0.1em] text-gray-500 uppercase">{images.length}枚を読み込みました</p>
                <button onClick={clearAll} className="text-[9px] tracking-[0.1em] text-gray-400 hover:text-red-500 uppercase">クリア</button>
              </div>

              <div className="text-[10px] text-gray-500 flex flex-col gap-1">
                出力先モール（{selectedPresets.length}/{mallLimit}選択中）
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  {PRESETS.map((p) => (
                    <label key={p.id} className={`flex items-center gap-1.5 border px-2 py-1.5 cursor-pointer transition-colors ${selectedPresets.includes(p.id) ? 'border-blue-600 text-blue-600 bg-blue-600/5' : 'border-gray-200 dark:border-gray-800 text-gray-500'}`}>
                      <input
                        type="checkbox"
                        checked={selectedPresets.includes(p.id)}
                        onChange={() => togglePreset(p.id)}
                        className="shrink-0"
                      />
                      <span className="text-[9px]">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="text-[10px] text-gray-500 flex flex-col gap-1">
                サイズの合わせ方
                <div className="flex gap-3">
                  <label className="flex items-center gap-1">
                    <input type="radio" checked={fitMode === 'pad'} onChange={() => setFitMode('pad')} />
                    余白追加（正方形にフィット）
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="radio" checked={fitMode === 'cover'} onChange={() => setFitMode('cover')} />
                    トリミング
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="radio" checked={fitMode === 'stretch'} onChange={() => setFitMode('stretch')} />
                    引き伸ばし
                  </label>
                </div>
              </div>

              {fitMode === 'pad' && (
                <label className="text-[10px] text-gray-500 flex items-center gap-2">
                  余白の色
                  <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-7 w-12 border border-gray-200 dark:border-gray-800" />
                </label>
              )}

              <label className="text-[10px] text-gray-500 flex flex-col gap-1">
                出力形式
                <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className="h-9 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 text-[11px] px-2">
                  <option value="jpeg">JPEG</option>
                  <option value="png">PNG</option>
                  <option value="webp">WebP</option>
                </select>
              </label>

              <label className="text-[10px] text-gray-500 flex flex-col gap-1">
                ファイル名の接頭辞（任意・例：商品コードなど）
                <input
                  type="text"
                  value={renamePrefix}
                  onChange={(e) => setRenamePrefix(e.target.value)}
                  placeholder="例：4901234567894"
                  className="h-9 px-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-700 text-[11px]"
                />
              </label>

              <button onClick={processAll} disabled={processing || selectedPresets.length === 0} className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[11px] tracking-[0.2em] uppercase transition-colors">
                {processing ? '処理中...' : `選択した${selectedPresets.length}モールに変換する`}
              </button>
            </div>

            {hasResults && isPro && (
              <button onClick={downloadZipAll} className="w-full h-10 border border-blue-600 text-blue-600 text-[10px] tracking-[0.15em] uppercase hover:bg-blue-600 hover:text-white transition-colors mb-4">
                ↓ 全モールまとめてZIPダウンロード（{totalResultCount}件）
              </button>
            )}

            {selectedPresets.map((presetId) => {
              const preset = PRESETS.find((p) => p.id === presetId)!
              const list = results[presetId]
              if (!list) return null
              return (
                <div key={presetId} className="space-y-2 mb-4">
                  <p className="text-[10px] tracking-[0.1em] text-gray-500 uppercase border-b border-gray-100 dark:border-gray-800 pb-1">{preset.name}</p>
                  {list.map((item, idx) => {
                    const src = images[idx]
                    return (
                      <div key={idx} className="border border-gray-100 dark:border-gray-800 p-3 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center gap-1">
                            <img src={src.url} alt="original" className="w-16 h-16 object-cover bg-gray-100 dark:bg-gray-900" />
                            <p className="text-[8px] text-gray-400">Before</p>
                            <p className="text-[8px] text-gray-400">{formatBytes(src.size)}</p>
                          </div>
                          <span className="text-gray-300 dark:text-gray-700">→</span>
                          <div className="flex flex-col items-center gap-1">
                            <img src={item.url} alt="result" className="w-16 h-16 object-cover bg-gray-100 dark:bg-gray-900" />
                            <p className="text-[8px] text-blue-500">After</p>
                            <p className="text-[8px] text-blue-500">{formatBytes(item.bytes)}</p>
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col items-end gap-1">
                            <p className="text-[9px] text-gray-500 truncate max-w-full">{src.file.name}</p>
                            <button onClick={() => downloadSingle(item)} className="text-[9px] tracking-[0.1em] text-blue-500 hover:text-blue-600 uppercase whitespace-nowrap">↓ ダウンロード</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
