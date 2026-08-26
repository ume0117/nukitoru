'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getPlan, type PlanType } from '@/lib/license'

const FREE_UPLOAD_LIMIT = 3
const PRO_UPLOAD_LIMIT = 20

type RestrictionLevel = 'block' | 'warn20' | 'free'

interface MallOption {
  id: string
  name: string
  level: RestrictionLevel
}

// モール別の1枚目/メイン画像に対する規約レベル
// block   = Amazon: テキスト・ロゴ・透かし等が完全禁止（違反で検索対象外）
// warn20  = 楽天・Yahoo!・auPAYマーケット・カウシェ・Qoo10: テキスト要素は画像の20%以内が目安
// free    = メルカリShops・BASE・汎用: 明確な面積制限なし
const MALLS: MallOption[] = [
  { id: 'amazon', name: 'Amazon', level: 'block' },
  { id: 'rakuten', name: '楽天市場', level: 'warn20' },
  { id: 'yahoo', name: 'Yahoo!ショッピング', level: 'warn20' },
  { id: 'aupay', name: 'auPAYマーケット', level: 'warn20' },
  { id: 'qoo10', name: 'Qoo10', level: 'warn20' },
  { id: 'kauche', name: 'カウシェ', level: 'warn20' },
  { id: 'mercari', name: 'メルカリShops', level: 'free' },
  { id: 'base', name: 'BASE', level: 'free' },
  { id: 'generic', name: '汎用（規約対象外）', level: 'free' },
]

type GridPos = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br'

const GRID_LABELS: GridPos[] = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br']

interface SourceImage {
  id: string
  file: File
  url: string
  watermarkOn: boolean // この画像に透かしを適用するか（1枚目をブロック時にOFFにする用途など）
}

interface WatermarkConfig {
  textEnabled: boolean
  text: string
  textColor: string
  textOpacity: number
  textPos: GridPos
  textOffsetX: number
  textOffsetY: number
  textBadge: boolean
  badgeColor: string
  logoEnabled: boolean
  logoUrl: string | null
  logoOpacity: number
  logoSizePct: number
  logoPos: GridPos
  logoOffsetX: number
  logoOffsetY: number
}

const DEFAULT_CONFIG: WatermarkConfig = {
  textEnabled: true,
  text: '',
  textColor: '#ffffff',
  textOpacity: 70,
  textPos: 'br',
  textOffsetX: 0,
  textOffsetY: 0,
  textBadge: false,
  badgeColor: '#e24b4a',
  logoEnabled: false,
  logoUrl: null,
  logoOpacity: 80,
  logoSizePct: 15,
  logoPos: 'br',
  logoOffsetX: 0,
  logoOffsetY: 0,
}

const TEXT_MAX_LEN = 30

function gridToXY(pos: GridPos, canvasW: number, canvasH: number, elW: number, elH: number, margin: number) {
  const col = pos === 'tl' || pos === 'ml' || pos === 'bl' ? 0 : pos === 'tc' || pos === 'mc' || pos === 'bc' ? 1 : 2
  const row = pos === 'tl' || pos === 'tc' || pos === 'tr' ? 0 : pos === 'ml' || pos === 'mc' || pos === 'mr' ? 1 : 2
  const x = col === 0 ? margin : col === 1 ? (canvasW - elW) / 2 : canvasW - elW - margin
  const y = row === 0 ? margin : row === 1 ? (canvasH - elH) / 2 : canvasH - elH - margin
  return { x, y }
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function estimateOccupancy(
  canvasW: number,
  canvasH: number,
  config: WatermarkConfig,
  textBoxWpx: number,
  textBoxHpx: number
): number {
  let area = 0
  if (config.textEnabled && config.text.trim()) area += textBoxWpx * textBoxHpx
  if (config.logoEnabled && config.logoUrl) {
    const logoW = (canvasW * config.logoSizePct) / 100
    area += logoW * logoW
  }
  return (area / (canvasW * canvasH)) * 100
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  config: WatermarkConfig,
  logoImg: HTMLImageElement | null
): { textBoxW: number; textBoxH: number } {
  const margin = Math.max(canvasW, canvasH) * 0.03
  let textBoxW = 0
  let textBoxH = 0

  if (config.textEnabled && config.text.trim()) {
    const fontSize = Math.max(14, Math.min(canvasW, canvasH) * 0.055)
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.textBaseline = 'top'
    const metrics = ctx.measureText(config.text)
    const padX = fontSize * 0.4
    const padY = fontSize * 0.28
    textBoxW = metrics.width + padX * 2
    textBoxH = fontSize + padY * 2
    const offX = (canvasW * config.textOffsetX) / 100
    const offY = (canvasH * config.textOffsetY) / 100
    const { x, y } = gridToXY(config.textPos, canvasW, canvasH, textBoxW, textBoxH, margin)
    const fx = x + offX
    const fy = y + offY

    ctx.save()
    ctx.globalAlpha = config.textOpacity / 100
    if (config.textBadge) {
      ctx.fillStyle = config.badgeColor
      const r = fontSize * 0.25
      ctx.beginPath()
      ctx.moveTo(fx + r, fy)
      ctx.arcTo(fx + textBoxW, fy, fx + textBoxW, fy + textBoxH, r)
      ctx.arcTo(fx + textBoxW, fy + textBoxH, fx, fy + textBoxH, r)
      ctx.arcTo(fx, fy + textBoxH, fx, fy, r)
      ctx.arcTo(fx, fy, fx + textBoxW, fy, r)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = config.textColor
    } else {
      ctx.fillStyle = config.textColor
      ctx.shadowColor = 'rgba(0,0,0,0.6)'
      ctx.shadowBlur = fontSize * 0.15
    }
    ctx.fillText(config.text, fx + padX, fy + padY)
    ctx.restore()
  }

  if (config.logoEnabled && logoImg) {
    const logoW = canvasW * (config.logoSizePct / 100)
    const logoH = (logoImg.height / logoImg.width) * logoW
    const offX = (canvasW * config.logoOffsetX) / 100
    const offY = (canvasH * config.logoOffsetY) / 100
    const { x, y } = gridToXY(config.logoPos, canvasW, canvasH, logoW, logoH, margin)
    ctx.save()
    ctx.globalAlpha = config.logoOpacity / 100
    ctx.drawImage(logoImg, x + offX, y + offY, logoW, logoH)
    ctx.restore()
  }

  return { textBoxW, textBoxH }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92))
}

export default function WatermarkPage() {
  const [plan, setPlan] = useState<PlanType>('free')
  const [images, setImages] = useState<SourceImage[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [mallId, setMallId] = useState<string>('generic')
  const [config, setConfig] = useState<WatermarkConfig>(DEFAULT_CONFIG)
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null)
  const [occupancy, setOccupancy] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [resultUrls, setResultUrls] = useState<Record<string, string>>({})
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragThumbIdx, setDragThumbIdx] = useState<number | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getPlan().then(setPlan)
  }, [])

  const isPro = plan === 'pro' || plan === 'pro_max'
  const uploadLimit = isPro ? PRO_UPLOAD_LIMIT : FREE_UPLOAD_LIMIT
  const mall = MALLS.find((m) => m.id === mallId)!
  // 選択中の画像が1枚目（インデックス0）かどうかで規約チェックを自動判定
  const isMainImage = activeIdx === 0
  const restrictionActive = isMainImage ? mall.level : 'free'

  const addFiles = (files: FileList | File[]) => {
    setErrorMsg('')
    setResultUrls({})
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (arr.length === 0) {
      setErrorMsg('画像ファイルを選択してください。')
      return
    }
    setImages((prev) => {
      const spaceLeft = uploadLimit - prev.length
      if (spaceLeft <= 0) {
        setErrorMsg(
          isPro
            ? `一度に扱えるのは${PRO_UPLOAD_LIMIT}枚までです。`
            : `無料版は${FREE_UPLOAD_LIMIT}枚までです。まとめて扱うにはProへアップグレードしてください。`
        )
        return prev
      }
      const target = arr.slice(0, spaceLeft)
      if (arr.length > spaceLeft) {
        setErrorMsg(
          isPro
            ? `一度に扱えるのは${PRO_UPLOAD_LIMIT}枚までです。先頭${spaceLeft}件のみ追加しました。`
            : `無料版は${FREE_UPLOAD_LIMIT}枚までです。先頭${spaceLeft}件のみ追加しました。まとめて扱うにはProへアップグレードしてください。`
        )
      }
      const added: SourceImage[] = target.map((f, i) => ({
        id: `${Date.now()}_${i}_${f.name}`,
        file: f,
        url: URL.createObjectURL(f),
        watermarkOn: true,
      }))
      return [...prev, ...added]
    })
  }

  const removeImage = (id: string) => {
    setImages((prev) => {
      const next = prev.filter((im) => im.id !== id)
      return next
    })
    setResultUrls({})
  }

  const clearAll = () => {
    setImages([])
    setResultUrls({})
    setErrorMsg('')
    setActiveIdx(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // --- アップロードエリアのドラッグ&ドロップ ---
  const handleUploadDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }
  const handleUploadDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }
  const handleUploadDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
  }

  // --- サムネイル並び替え（ドラッグ&ドロップで順番入れ替え） ---
  const handleThumbDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragThumbIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleThumbDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault()
    if (dragThumbIdx === null || dragThumbIdx === idx) return
    setImages((prev) => {
      const next = [...prev]
      const [moved] = next.splice(dragThumbIdx, 1)
      next.splice(idx, 0, moved)
      return next
    })
    setDragThumbIdx(idx)
    if (activeIdx === dragThumbIdx) setActiveIdx(idx)
  }
  const handleThumbDragEnd = () => {
    setDragThumbIdx(null)
  }

  const handleLogoFile = async (file: File) => {
    const url = URL.createObjectURL(file)
    const img = await loadImage(url)
    setLogoImg(img)
    setConfig((c) => ({ ...c, logoUrl: url, logoEnabled: true }))
  }

  const applyTemplate = (kind: 'copyright' | 'sale') => {
    if (kind === 'copyright') {
      setConfig((c) => ({ ...c, textEnabled: true, text: c.text || '無断転載禁止', textColor: '#ffffff', textOpacity: 55, textPos: 'br', textBadge: false }))
    } else {
      setConfig((c) => ({ ...c, textEnabled: true, text: c.text || 'SALE', textColor: '#ffffff', textOpacity: 100, textPos: 'tl', textBadge: true, badgeColor: '#e24b4a' }))
    }
  }

  const redrawPreview = useCallback(async () => {
    const canvas = previewCanvasRef.current
    if (!canvas || images.length === 0) return
    const src = images[activeIdx]
    if (!src) return
    const img = await loadImage(src.url)
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    if (src.watermarkOn) {
      const { textBoxW, textBoxH } = drawWatermark(ctx, canvas.width, canvas.height, config, logoImg)
      setOccupancy(estimateOccupancy(canvas.width, canvas.height, config, textBoxW, textBoxH))
    } else {
      setOccupancy(0)
    }
  }, [images, activeIdx, config, logoImg])

  useEffect(() => {
    redrawPreview()
  }, [redrawPreview])

  const processAll = async () => {
    if (images.length === 0) return
    if (restrictionActive === 'block' && images[0]?.watermarkOn) {
      setErrorMsg('1枚目（メイン画像）に選択中のモールで透かしが規約違反になります。1枚目の「透かしを適用」をOFFにするか、別のモールを選択してください。')
      return
    }
    setProcessing(true)
    setErrorMsg('')
    const newResults: Record<string, string> = {}
    for (const src of images) {
      try {
        const img = await loadImage(src.url)
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        if (src.watermarkOn) drawWatermark(ctx, canvas.width, canvas.height, config, logoImg)
        const blob = await canvasToBlob(canvas)
        if (blob) newResults[src.id] = URL.createObjectURL(blob)
      } catch {
        // スキップ
      }
    }
    setResultUrls(newResults)
    setProcessing(false)
  }

  const downloadZipAll = async () => {
    const entries = images.filter((im) => resultUrls[im.id])
    if (entries.length === 0) return
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    for (let i = 0; i < entries.length; i++) {
      const url = resultUrls[entries[i].id]
      const res = await fetch(url)
      const blob = await res.blob()
      zip.file(`${String(i + 1).padStart(2, '0')}.jpg`, blob)
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nukitoru_watermark.zip'
    a.click()
  }

  const downloadSingle = (id: string, idx: number) => {
    const url = resultUrls[id]
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `${String(idx + 1).padStart(2, '0')}.jpg`
    a.click()
  }

  const gridButton = (current: GridPos, onChange: (p: GridPos) => void) => (
    <div className="grid grid-cols-3 gap-1 w-24">
      {GRID_LABELS.map((pos) => (
        <button
          key={pos}
          onClick={() => onChange(pos)}
          className={`aspect-square border transition-colors ${
            current === pos ? 'border-blue-600 bg-blue-600/10' : 'border-gray-200 dark:border-gray-800 hover:border-gray-400'
          }`}
        />
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link href="/scan" className="text-[10px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase hover:text-blue-600 transition-colors">← NUKITORU SCAN</Link>
          <span className="text-[9px] tracking-[0.15em] text-gray-400 dark:text-gray-600 uppercase">
            {isPro ? (plan === 'pro_max' ? 'PRO MAX' : 'PRO') : 'FREE'}
          </span>
        </div>

        <h1 className="text-[13px] tracking-[0.3em] text-gray-900 dark:text-white uppercase font-medium mb-1">ウォーターマーク追加</h1>
        <p className="text-[11px] text-gray-500 leading-relaxed mb-6">
          商品画像をまとめてアップロードし、順番（1枚目=メイン画像）を並び替えながら透かしを設定できます。1枚目に選ぶ画像はモール規約を自動チェックします。
        </p>

        {images.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleUploadDragOver}
            onDragLeave={handleUploadDragLeave}
            onDrop={handleUploadDrop}
            className={`border border-dashed aspect-[3/1] flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
              isDragOver ? 'border-blue-500 bg-blue-500/5' : 'border-gray-300 dark:border-gray-700 hover:border-blue-500'
            }`}
          >
            <p className="text-[12px] text-gray-400">クリック、またはここに画像をドラッグ&ドロップ</p>
            <p className="text-[10px] text-gray-400">
              一度に最大{uploadLimit}枚まで{!isPro && '（Proで最大20枚）'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_320px] gap-6">
            {/* サムネイル一覧（並び替え） */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] tracking-[0.1em] text-gray-400 uppercase">画像の順番（ドラッグで並び替え）</p>
                <button onClick={clearAll} className="text-[9px] text-gray-400 hover:text-red-500">全消去</button>
              </div>
              <div
                onDragOver={handleUploadDragOver}
                onDragLeave={handleUploadDragLeave}
                onDrop={handleUploadDrop}
                className={`space-y-1.5 max-h-[520px] overflow-y-auto pr-1 border ${isDragOver ? 'border-blue-500 bg-blue-500/5' : 'border-transparent'}`}
              >
                {images.map((im, i) => (
                  <div
                    key={im.id}
                    draggable
                    onDragStart={handleThumbDragStart(i)}
                    onDragOver={handleThumbDragOver(i)}
                    onDragEnd={handleThumbDragEnd}
                    onClick={() => setActiveIdx(i)}
                    className={`flex items-center gap-2 p-1.5 border cursor-move transition-colors ${
                      i === activeIdx ? 'border-blue-600 bg-blue-600/5' : 'border-gray-100 dark:border-gray-800 hover:border-gray-300'
                    }`}
                  >
                    <span className={`text-[9px] w-8 text-center flex-shrink-0 ${i === 0 ? 'text-purple-500 font-bold' : 'text-gray-400'}`}>
                      {i === 0 ? 'メイン' : i + 1}
                    </span>
                    <img src={im.url} className="w-10 h-10 object-cover flex-shrink-0" alt="" />
                    <span className={`text-[9px] flex-1 truncate ${im.watermarkOn ? 'text-gray-400' : 'text-gray-300 dark:text-gray-600'}`}>
                      {im.watermarkOn ? '透かしあり' : '透かしなし'}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeImage(im.id) }}
                      className="text-[10px] text-gray-300 hover:text-red-500 flex-shrink-0 px-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-8 mt-2 border border-gray-200 dark:border-gray-800 text-[10px] text-gray-500 hover:border-blue-600 hover:text-blue-600 transition-colors"
              >
                + 画像を追加
              </button>
            </div>

            {/* プレビュー */}
            <div>
              <canvas ref={previewCanvasRef} className="w-full border border-gray-100 dark:border-gray-800" />
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-gray-400">
                  {activeIdx === 0 ? 'メイン画像（1枚目）を編集中' : `${activeIdx + 1}枚目を編集中`}
                </p>
                <label className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <input
                    type="checkbox"
                    checked={images[activeIdx]?.watermarkOn ?? true}
                    onChange={(e) => setImages((prev) => prev.map((im, i) => (i === activeIdx ? { ...im, watermarkOn: e.target.checked } : im)))}
                  />
                  この画像に透かしを適用
                </label>
              </div>

              {config.text.trim() && images[activeIdx]?.watermarkOn && (
                <div className="mt-3 text-[10px]">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">テキスト占有率（目安）</span>
                    <span className={occupancy > 20 && restrictionActive === 'warn20' ? 'text-red-500 font-medium' : 'text-gray-500'}>{occupancy.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                    <div className={`h-full ${occupancy > 20 && restrictionActive === 'warn20' ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, occupancy)}%` }} />
                  </div>
                </div>
              )}

              {isMainImage && restrictionActive === 'block' && images[activeIdx]?.watermarkOn && (
                <div className="mt-3 p-3 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-[10px] text-red-600 dark:text-red-400 leading-relaxed">
                  {mall.name}のメイン画像は、テキスト・ロゴ・透かしなどの掲載が規約で完全に禁止されています。この設定のまま出力すると検索対象外になるリスクがあります。「この画像に透かしを適用」をOFFにするか、別のモールを選択してください。
                </div>
              )}
              {isMainImage && restrictionActive === 'warn20' && occupancy > 20 && images[activeIdx]?.watermarkOn && (
                <div className="mt-3 p-3 border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30 text-[10px] text-orange-600 dark:text-orange-400 leading-relaxed">
                  {mall.name}の1枚目/メイン画像はテキスト要素が画像全体の20%以内に収めるルールが目安です。占有率が目安を超えています。テキストを短くするか、フォントサイズ・不透明度を調整してください。
                </div>
              )}

              {errorMsg && <p className="text-[10px] text-red-500 mt-3">{errorMsg}</p>}

              <button
                onClick={processAll}
                disabled={processing}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[11px] tracking-[0.2em] uppercase transition-colors mt-4"
              >
                {processing ? '処理中...' : `${images.length}枚に適用`}
              </button>

              {Object.keys(resultUrls).length > 0 && (
                <div className="mt-2 space-y-2">
                  {isPro && Object.keys(resultUrls).length > 1 ? (
                    <button onClick={downloadZipAll} className="w-full h-9 border border-blue-600 text-blue-600 text-[10px] tracking-[0.1em] uppercase hover:bg-blue-600 hover:text-white transition-colors">
                      ZIPで一括ダウンロード（順番通り01, 02...）
                    </button>
                  ) : (
                    images.map((im, i) => resultUrls[im.id] && (
                      <button key={im.id} onClick={() => downloadSingle(im.id, i)} className="w-full h-9 border border-gray-200 dark:border-gray-800 text-[10px] hover:border-blue-600 transition-colors">
                        {i + 1}枚目をダウンロード
                      </button>
                    ))
                  )}
                </div>
              )}

              {!isPro && (
                <p className="text-[10px] text-gray-400 leading-relaxed mt-3">
                  無料版は最大{FREE_UPLOAD_LIMIT}枚・個別ダウンロードのみです。最大20枚のまとめ処理・ZIP一括ダウンロードは
                  <Link href="/upgrade" className="text-blue-500 hover:underline mx-1">Pro</Link>
                  で利用できます。
                </p>
              )}
            </div>

            {/* 設定パネル */}
            <div className="space-y-5">
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-[0.1em] block mb-1.5">対象モール（1枚目に適用時のみ規約チェック）</label>
                <select value={mallId} onChange={(e) => setMallId(e.target.value)} className="w-full h-9 border border-gray-200 dark:border-gray-800 bg-transparent text-[11px] px-2">
                  {MALLS.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-[0.1em] block mb-1.5">テンプレート</label>
                <div className="flex gap-2">
                  <button onClick={() => applyTemplate('copyright')} className="flex-1 h-8 text-[10px] border border-gray-200 dark:border-gray-800 hover:border-blue-600 transition-colors">著作権表記</button>
                  <button onClick={() => applyTemplate('sale')} className="flex-1 h-8 text-[10px] border border-gray-200 dark:border-gray-800 hover:border-blue-600 transition-colors">セールバッジ</button>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <label className="flex items-center gap-2 text-[10px] text-gray-500 uppercase tracking-[0.1em] mb-2">
                  <input type="checkbox" checked={config.textEnabled} onChange={(e) => setConfig((c) => ({ ...c, textEnabled: e.target.checked }))} />
                  テキスト
                </label>
                {config.textEnabled && (
                  <div className="space-y-2 pl-1">
                    <input
                      type="text"
                      value={config.text}
                      maxLength={TEXT_MAX_LEN}
                      onChange={(e) => setConfig((c) => ({ ...c, text: e.target.value }))}
                      placeholder="例: 4REAL SHOP"
                      className="w-full h-9 border border-gray-200 dark:border-gray-800 bg-transparent text-[11px] px-2"
                    />
                    <p className="text-[9px] text-gray-400">{config.text.length}/{TEXT_MAX_LEN}文字</p>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-400 w-14">色</span>
                      <input type="color" value={config.textColor} onChange={(e) => setConfig((c) => ({ ...c, textColor: e.target.value }))} className="h-7 w-10" />
                      <label className="flex items-center gap-1.5 text-[10px] text-gray-400">
                        <input type="checkbox" checked={config.textBadge} onChange={(e) => setConfig((c) => ({ ...c, textBadge: e.target.checked }))} />
                        背景バッジ
                      </label>
                      {config.textBadge && <input type="color" value={config.badgeColor} onChange={(e) => setConfig((c) => ({ ...c, badgeColor: e.target.value }))} className="h-7 w-10" />}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-400 w-14">不透明度</span>
                      <input type="range" min={10} max={100} value={config.textOpacity} onChange={(e) => setConfig((c) => ({ ...c, textOpacity: Number(e.target.value) }))} className="flex-1" />
                      <span className="text-[10px] text-gray-400 w-8">{config.textOpacity}%</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-[10px] text-gray-400 w-14 pt-1">配置</span>
                      {gridButton(config.textPos, (p) => setConfig((c) => ({ ...c, textPos: p })))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <label className="flex items-center gap-2 text-[10px] text-gray-500 uppercase tracking-[0.1em] mb-2">
                  <input type="checkbox" checked={config.logoEnabled} onChange={(e) => setConfig((c) => ({ ...c, logoEnabled: e.target.checked }))} disabled={!config.logoUrl} />
                  ロゴ画像
                </label>
                <div className="pl-1 space-y-2">
                  <button onClick={() => logoInputRef.current?.click()} className="w-full h-9 border border-gray-200 dark:border-gray-800 text-[10px] hover:border-blue-600 transition-colors">
                    {config.logoUrl ? 'ロゴを変更' : '画像を選択'}
                  </button>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleLogoFile(e.target.files[0])} />
                  {config.logoEnabled && config.logoUrl && (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-gray-400 w-14">サイズ</span>
                        <input type="range" min={5} max={40} value={config.logoSizePct} onChange={(e) => setConfig((c) => ({ ...c, logoSizePct: Number(e.target.value) }))} className="flex-1" />
                        <span className="text-[10px] text-gray-400 w-8">{config.logoSizePct}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-gray-400 w-14">不透明度</span>
                        <input type="range" min={10} max={100} value={config.logoOpacity} onChange={(e) => setConfig((c) => ({ ...c, logoOpacity: Number(e.target.value) }))} className="flex-1" />
                        <span className="text-[10px] text-gray-400 w-8">{config.logoOpacity}%</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-[10px] text-gray-400 w-14 pt-1">配置</span>
                        {gridButton(config.logoPos, (p) => setConfig((c) => ({ ...c, logoPos: p })))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>
    </div>
  )
}
