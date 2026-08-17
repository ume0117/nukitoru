'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { checkIsPro } from '@/lib/license'

const FREE_LIMIT = 2

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

interface ProcessedImage {
  id: string
  originalFile: File
  originalUrl: string
  originalSize: number
  resultUrl: string | null
  resultBytes: number | null
  label: string
  processing: boolean
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
  const [isPro, setIsPro] = useState(false)
  const [images, setImages] = useState<ProcessedImage[]>([])
  const [presetId, setPresetId] = useState(PRESETS[0].id)
  const [fitMode, setFitMode] = useState<FitMode>('pad')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [format, setFormat] = useState<OutputFormat>('jpeg')
  const [renamePrefix, setRenamePrefix] = useState('')
  const [processing, setProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    checkIsPro().then(setIsPro)
  }, [])

  const preset = PRESETS.find(p => p.id === presetId)!

  const handleFiles = (files: FileList | File[]) => {
    setErrorMsg('')
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (arr.length === 0) {
      setErrorMsg('画像ファイルを選択してください。')
      return
    }
    const target = isPro ? arr : arr.slice(0, FREE_LIMIT)
    if (!isPro && arr.length > FREE_LIMIT) {
      setErrorMsg(`無料版は一度に${FREE_LIMIT}件までです。先頭${FREE_LIMIT}件のみ処理します。まとめて処理するにはProへアップグレードしてください。`)
    }
    const newImages: ProcessedImage[] = target.map((f, i) => ({
      id: `${Date.now()}_${i}`,
      originalFile: f,
      originalUrl: URL.createObjectURL(f),
      originalSize: f.size,
      resultUrl: null,
      resultBytes: null,
      label: String(i + 1).padStart(3, '0'),
      processing: false,
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
    setErrorMsg('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const processAll = async () => {
    if (images.length === 0) return
    setProcessing(true)
    const updated = [...images]
    for (let i = 0; i < updated.length; i++) {
      const item = updated[i]
      try {
        const img = await loadImage(item.originalFile)
        const canvas = drawToCanvas(img, preset.width, preset.height, fitMode, bgColor)
        const blob = await compressToTarget(canvas, format, preset.maxBytes)
        const url = URL.createObjectURL(blob)
        const label = renamePrefix
          ? `${renamePrefix}_${String(i + 1).padStart(2, '0')}`
          : String(i + 1).padStart(3, '0')
        updated[i] = { ...item, resultUrl: url, resultBytes: blob.size, label }
        setImages([...updated])
      } catch {
        // スキップ
      }
    }
    setProcessing(false)
  }

  const downloadSingle = (item: ProcessedImage) => {
    if (!item.resultUrl) return
    const ext = format === 'jpeg' ? 'jpg' : format
    const a = document.createElement('a')
    a.href = item.resultUrl
    a.download = `${item.label}.${ext}`
    a.click()
  }

  const downloadZip = async () => {
    if (!isPro) return
    const done = images.filter(i => i.resultUrl)
    if (done.length === 0) return
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    const ext = format === 'jpeg' ? 'jpg' : format
    for (const item of done) {
      const res = await fetch(item.resultUrl!)
      const blob = await res.blob()
      zip.file(`${item.label}.${ext}`, blob)
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nukitoru_images_${preset.id}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  const allDone = images.length > 0 && images.every(i => i.resultUrl)

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-[10px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase hover:text-blue-600 transition-colors">← NUKITORU</Link>
        </div>

        <h1 className="text-[13px] tracking-[0.3em] text-gray-900 dark:text-white uppercase font-medium mb-2">商品画像リサイズ</h1>
        <p className="text-[11px] text-gray-500 leading-relaxed mb-8">
          複数の商品画像を、楽天・Yahoo!・Amazonなど各モールの推奨サイズにまとめて変換できます。すべてブラウザ内で処理され、サーバーには送信されません。
          {!isPro && `無料版は一度に${FREE_LIMIT}件まで。`}
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
            {!isPro && <Link href="/upgrade" className="text-blue-500 hover:text-blue-600 underline ml-1">Proにアップグレード →</Link>}
          </p>
        )}

        {images.length > 0 && (
          <>
            <div className="border border-gray-100 dark:border-gray-800 p-4 space-y-3 my-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] tracking-[0.1em] text-gray-500 uppercase">{images.length}枚を読み込みました</p>
                <button onClick={clearAll} className="text-[9px] tracking-[0.1em] text-gray-400 hover:text-red-500 uppercase">クリア</button>
              </div>

              <label className="text-[10px] text-gray-500 flex flex-col gap-1">
                出力先モール
                <select value={presetId} onChange={(e) => setPresetId(e.target.value)} className="h-9 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 text-[11px] px-2">
                  {PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>

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

              <button onClick={processAll} disabled={processing} className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[11px] tracking-[0.2em] uppercase transition-colors">
                {processing ? '処理中...' : `${preset.width}×${preset.height}pxに変換する`}
              </button>
            </div>

            {allDone && isPro && images.length > 1 && (
              <button onClick={downloadZip} className="w-full h-10 border border-blue-600 text-blue-600 text-[10px] tracking-[0.15em] uppercase hover:bg-blue-600 hover:text-white transition-colors mb-4">
                ↓ まとめてZIPダウンロード（{images.length}件）
              </button>
            )}

            <div className="space-y-3">
              {images.map((item) => (
                <div key={item.id} className="border border-gray-100 dark:border-gray-800 p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <img src={item.originalUrl} alt="original" className="w-20 h-20 object-cover bg-gray-100 dark:bg-gray-900" />
                      <p className="text-[8px] text-gray-400">Before</p>
                      <p className="text-[8px] text-gray-400">{formatBytes(item.originalSize)}</p>
                    </div>
                    <span className="text-gray-300 dark:text-gray-700">→</span>
                    <div className="flex flex-col items-center gap-1">
                      {item.resultUrl ? (
                        <>
                          <img src={item.resultUrl} alt="result" className="w-20 h-20 object-cover bg-gray-100 dark:bg-gray-900" />
                          <p className="text-[8px] text-blue-500">After</p>
                          <p className="text-[8px] text-blue-500">{formatBytes(item.resultBytes!)}</p>
                        </>
                      ) : (
                        <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                          <p className="text-[8px] text-gray-300 dark:text-gray-700">未処理</p>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col items-end gap-1">
                      <p className="text-[9px] text-gray-500 truncate max-w-full">{item.originalFile.name}</p>
                      {item.resultUrl && (
                        <button onClick={() => downloadSingle(item)} className="text-[9px] tracking-[0.1em] text-blue-500 hover:text-blue-600 uppercase whitespace-nowrap">↓ ダウンロード</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
