'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { checkIsPro } from '@/lib/license'
import { trackEvent } from '@/lib/utils/analytics'

const FREE_LIMIT = 2

type CodeFormat = 'BARCODE' | 'QR' | null
type InputMode = 'MANUAL' | 'CSV'
type NumberMode = 'auto' | 'column'

interface GeneratedCode {
  value: string
  dataUrl: string
  productName?: string
  label: string
  selected: boolean
}

interface LabelPreset {
  id: string
  name: string
  cols: number
  rows: number
  cellWidthMm: number
  cellHeightMm: number
  marginLeftMm: number
  marginTopMm: number
}

const LABEL_PRESETS: LabelPreset[] = [
  { id: '72265', name: 'エーワン 72265（65面 / 38.1×21.2mm）', cols: 5, rows: 13, cellWidthMm: 38.1, cellHeightMm: 21.2, marginLeftMm: 9.75, marginTopMm: 10.7 },
  { id: '72244', name: 'エーワン 72244・31516（44面 / 48.3×25.4mm）', cols: 4, rows: 11, cellWidthMm: 48.3, cellHeightMm: 25.4, marginLeftMm: 8.4, marginTopMm: 8.8 },
  { id: '72212', name: 'エーワン 72212（12面 / 86.4×42.3mm）', cols: 2, rows: 6, cellWidthMm: 86.4, cellHeightMm: 42.3, marginLeftMm: 18.6, marginTopMm: 21.2 },
]

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else {
        field += c
      }
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++
        row.push(field); field = ''
        if (row.some(v => v !== '')) rows.push(row)
        row = []
      } else {
        field += c
      }
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.some(v => v !== '')) rows.push(row)
  }
  return rows
}

function getImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 1, height: 1 })
    img.src = dataUrl
  })
}

function analyzeCsvRows(rows: string[][]): { hasHeader: boolean; detectedFormat: 'BARCODE' | 'QR' } {
  const firstCellRaw = (rows[0]?.[0] || '').trim()
  const firstCellLooksLikeCode = /^[0-9]{6,}$/.test(firstCellRaw) || /^https?:\/\//i.test(firstCellRaw)
  const hasHeader = !firstCellLooksLikeCode

  const sampleRows = hasHeader ? rows.slice(1) : rows
  const sampleValues = sampleRows.map(r => (r[0] || '').trim()).filter(Boolean)
  const numericCount = sampleValues.filter(v => /^[0-9]{6,}$/.test(v)).length
  const detectedFormat: 'BARCODE' | 'QR' = sampleValues.length > 0 && numericCount / sampleValues.length >= 0.5 ? 'BARCODE' : 'QR'

  return { hasHeader, detectedFormat }
}

function downloadTemplate(fmt: 'BARCODE' | 'QR') {
  const rows = fmt === 'QR'
    ? [
        ['コード', '商品名', '枚数'],
        ['https://nukitoru.pages.dev', 'NUKITORU公式サイト', '1'],
        ['https://example.com/product/001', 'サンプル商品ページ（5枚欲しい場合の例）', '5'],
      ]
    : [
        ['コード', '商品名', '枚数'],
        ['4901234567894', 'サンプル商品A', '1'],
        ['4901234567895', 'サンプル商品B（20枚欲しい場合の例）', '20'],
      ]
  const bom = '\uFEFF'
  const csv = bom + rows.map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fmt === 'QR' ? 'nukitoru_csv_template_qrcode.csv' : 'nukitoru_csv_template_barcode.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function BarcodeGeneratorPage() {
  const [format, setFormat] = useState<CodeFormat>(null)
  const [inputMode, setInputMode] = useState<InputMode>('MANUAL')
  const [input, setInput] = useState('')
  const [codes, setCodes] = useState<GeneratedCode[]>([])
  const [isPro, setIsPro] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [csvRows, setCsvRows] = useState<string[][] | null>(null)
  const [csvFileName, setCsvFileName] = useState('')
  const [csvHasHeader, setCsvHasHeader] = useState(true)
  const [codeColIndex, setCodeColIndex] = useState(0)
  const [nameColIndex, setNameColIndex] = useState<number>(-1)
  const [qtyColIndex, setQtyColIndex] = useState<number>(-1)
  const [numberMode, setNumberMode] = useState<NumberMode>('auto')
  const [numberColIndex, setNumberColIndex] = useState<number>(-1)
  const [isDragging, setIsDragging] = useState(false)
  const [csvAutoNote, setCsvAutoNote] = useState<'BARCODE' | 'QR' | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedPreset, setSelectedPreset] = useState(LABEL_PRESETS[0].id)
  const [startPosition, setStartPosition] = useState(1)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  useEffect(() => {
    checkIsPro().then(setIsPro)
  }, [])

  const switchFormat = (next: 'BARCODE' | 'QR') => {
    setFormat(next)
    setCodes([])
    setErrorMsg('')
    setCsvAutoNote(null)
  }

  const switchInputMode = (next: InputMode) => {
    setInputMode(next)
    setFormat(null)
    setCodes([])
    setErrorMsg('')
    setCsvAutoNote(null)
  }

  const clearManual = () => {
    setInput('')
    setFormat(null)
    setCodes([])
    setErrorMsg('')
  }

  const clearCsv = () => {
    setCsvRows(null)
    setCsvFileName('')
    setCsvHasHeader(true)
    setCodeColIndex(0)
    setNameColIndex(-1)
    setQtyColIndex(-1)
    setNumberMode('auto')
    setNumberColIndex(-1)
    setFormat(null)
    setCsvAutoNote(null)
    setCodes([])
    setErrorMsg('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCsvFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorMsg('CSVファイル（.csv）を選択してください。')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      if (rows.length === 0) {
        setErrorMsg('CSVを読み取れませんでした。')
        return
      }
      const { hasHeader, detectedFormat } = analyzeCsvRows(rows)

      setCsvRows(rows)
      setCsvFileName(file.name)
      setCsvHasHeader(hasHeader)
      setCodeColIndex(0)
      setNameColIndex(rows[0].length > 1 ? 1 : -1)
      setQtyColIndex(-1)
      setNumberMode('auto')
      setNumberColIndex(-1)
      setErrorMsg('')
      setCodes([])
      setFormat(detectedFormat)
      setCsvAutoNote(detectedFormat)
    }
    reader.readAsText(file, 'UTF-8')
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
    const file = e.dataTransfer.files?.[0]
    if (file) handleCsvFile(file)
  }

  const dataRows = () => {
    if (!csvRows) return []
    return csvHasHeader ? csvRows.slice(1) : csvRows
  }

  const headerLabels = () => {
    if (!csvRows) return []
    if (csvHasHeader) return csvRows[0]
    return csvRows[0].map((_, i) => `列${i + 1}`)
  }

  const handleGenerate = async () => {
    setErrorMsg('')
    if (!format) {
      setErrorMsg('先にバーコードかQRコードを選んでください。')
      return
    }
    const lines = input.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) {
      setErrorMsg('コードまたはテキストを1行以上入力してください。')
      return
    }
    if (!isPro && lines.length > FREE_LIMIT) {
      setErrorMsg(`無料版は一度に${FREE_LIMIT}件までです。先頭${FREE_LIMIT}件のみ生成します。まとめて生成するにはProへアップグレードしてください。`)
    }
    const target = isPro ? lines : lines.slice(0, FREE_LIMIT)
    const generated: GeneratedCode[] = []

    for (const value of target) {
      const dataUrl = await renderCode(value, format)
      if (dataUrl) generated.push({ value, dataUrl, label: value, selected: true })
    }
    setCodes(generated)
    trackEvent('generate_code', { format: format, mode: 'manual', count: generated.length })
  }

  const handleGenerateFromCsv = async () => {
    setErrorMsg('')
    if (!format) {
      setErrorMsg('先にバーコードかQRコードを選んでください。')
      return
    }
    const rows = dataRows()
    if (rows.length === 0) {
      setErrorMsg('CSVにデータ行がありません。')
      return
    }
    if (!isPro && rows.length > FREE_LIMIT) {
      setErrorMsg(`無料版は一度に${FREE_LIMIT}件までです。先頭${FREE_LIMIT}件のみ生成します。まとめて生成するにはProへアップグレードしてください。`)
    }
    const target = isPro ? rows : rows.slice(0, FREE_LIMIT)
    const generated: GeneratedCode[] = []

    let seq = 1
    for (const row of target) {
      const value = (row[codeColIndex] || '').trim()
      if (!value) continue
      const productName = nameColIndex >= 0 ? (row[nameColIndex] || '').trim() : undefined
      const qtyRaw = qtyColIndex >= 0 ? parseInt((row[qtyColIndex] || '').trim(), 10) : 1
      const qty = qtyRaw > 0 ? qtyRaw : 1

      const dataUrl = await renderCode(value, format)
      if (!dataUrl) continue

      for (let k = 0; k < qty; k++) {
        let label: string
        if (numberMode === 'column' && numberColIndex >= 0) {
          const base = (row[numberColIndex] || '').trim() || String(seq).padStart(3, '0')
          label = qty > 1 ? `${base}-${k + 1}` : base
        } else {
          label = String(seq).padStart(3, '0')
        }
        seq++
        generated.push({ value, dataUrl, productName, label, selected: true })
      }
    }
    setCodes(generated)
    trackEvent('generate_code', { format: format, mode: 'csv', count: generated.length })
  }

  const renderCode = async (value: string, fmt: 'BARCODE' | 'QR'): Promise<string | null> => {
    try {
      if (fmt === 'QR') {
        return await QRCode.toDataURL(value, { width: 300, margin: 2, errorCorrectionLevel: 'M' })
      } else {
        const canvas = document.createElement('canvas')
        JsBarcode(canvas, value, { format: 'CODE128', width: 2, height: 60, displayValue: true, fontSize: 14, margin: 8 })
        return canvas.toDataURL('image/png')
      }
    } catch {
      return null
    }
  }

  const toggleSelect = (index: number) => {
    setCodes(prev => prev.map((c, i) => i === index ? { ...c, selected: !c.selected } : c))
  }

  const selectAll = () => setCodes(prev => prev.map(c => ({ ...c, selected: true })))
  const selectNone = () => setCodes(prev => prev.map(c => ({ ...c, selected: false })))

  const selectedCodes = codes.filter(c => c.selected)
  const selectedCount = selectedCodes.length

  const downloadSingle = (code: GeneratedCode) => {
    const prefix = format === 'QR' ? 'qrcode' : 'barcode'
    const a = document.createElement('a')
    a.href = code.dataUrl
    a.download = `${prefix}_${code.label}.png`
    a.click()
  }

  const downloadZip = async () => {
    if (!isPro) return
    const targets = selectedCount > 0 ? selectedCodes : codes
    trackEvent('download_zip', { format: format || 'unknown', count: targets.length })
    const prefix = format === 'QR' ? 'qrcode' : 'barcode'
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    for (const code of targets) {
      const base64 = code.dataUrl.split(',')[1]
      zip.file(`${prefix}_${code.label}.png`, base64, { base64: true })
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = format === 'QR' ? 'qrcodes.zip' : 'barcodes.zip'
    a.click()
    URL.revokeObjectURL(url)
  }

  const generateLabelSheetPdf = async () => {
    if (!isPro || codes.length === 0) return
    const preset = LABEL_PRESETS.find(p => p.id === selectedPreset)
    if (!preset) return

    const targets = selectedCount > 0 ? selectedCodes : codes
    const perPage = preset.cols * preset.rows
    const offset = Math.max(0, Math.min(perPage - 1, (startPosition || 1) - 1))

    trackEvent('download_label_pdf', { preset: preset.id, count: targets.length })
    setGeneratingPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const cellPadding = 1.5
      const showNumber = format === 'QR' && inputMode === 'CSV'
      const numberAreaHeight = showNumber ? 3.2 : 0
      const maxImgW = preset.cellWidthMm - cellPadding * 2
      const maxImgH = preset.cellHeightMm - cellPadding * 2 - numberAreaHeight

      let currentPage = 0

      for (let i = 0; i < targets.length; i++) {
        const code = targets[i]
        const globalPos = i + offset
        const pageIndex = Math.floor(globalPos / perPage)
        const posInPage = globalPos % perPage

        if (pageIndex > currentPage) {
          doc.addPage()
          currentPage = pageIndex
        }

        const row = Math.floor(posInPage / preset.cols)
        const col = posInPage % preset.cols
        const cellX = preset.marginLeftMm + col * preset.cellWidthMm
        const cellY = preset.marginTopMm + row * preset.cellHeightMm

        const { width: imgW, height: imgH } = await getImageSize(code.dataUrl)
        const scale = Math.min(maxImgW / imgW, maxImgH / imgH)
        const drawW = imgW * scale
        const drawH = imgH * scale
        const drawX = cellX + (preset.cellWidthMm - drawW) / 2
        const drawY = cellY + cellPadding + (maxImgH - drawH) / 2

        doc.addImage(code.dataUrl, 'PNG', drawX, drawY, drawW, drawH)

        if (showNumber) {
          doc.setFontSize(7)
          doc.text(code.label, cellX + preset.cellWidthMm / 2, cellY + preset.cellHeightMm - 1, { align: 'center' })
        }
      }

      const prefix = format === 'QR' ? 'qrcodes' : 'barcodes'
      doc.save(`${prefix}_${preset.id}.pdf`)
    } finally {
      setGeneratingPdf(false)
    }
  }

  const selectedPresetInfo = LABEL_PRESETS.find(p => p.id === selectedPreset)
  const maxStartPosition = selectedPresetInfo ? selectedPresetInfo.cols * selectedPresetInfo.rows : 1

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/scan" className="text-[10px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase hover:text-blue-600 transition-colors">← NUKITORU SCAN</Link>
        </div>

        <h1 className="text-[13px] tracking-[0.3em] text-gray-900 dark:text-white uppercase font-medium mb-2">バーコード / QRコード生成</h1>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => switchFormat('BARCODE')}
            className={`flex-1 h-9 text-[10px] tracking-[0.15em] uppercase border transition-colors ${format === 'BARCODE' ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 dark:border-gray-800 text-gray-500 hover:border-blue-600'}`}
          >
            バーコード
          </button>
          <button
            onClick={() => switchFormat('QR')}
            className={`flex-1 h-9 text-[10px] tracking-[0.15em] uppercase border transition-colors ${format === 'QR' ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 dark:border-gray-800 text-gray-500 hover:border-blue-600'}`}
          >
            QRコード
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => switchInputMode('MANUAL')}
            className={`flex-1 h-8 text-[9px] tracking-[0.15em] uppercase border transition-colors ${inputMode === 'MANUAL' ? 'border-blue-600 text-blue-600' : 'border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-600 hover:border-blue-600'}`}
          >
            手入力
          </button>
          <button
            onClick={() => switchInputMode('CSV')}
            className={`flex-1 h-8 text-[9px] tracking-[0.15em] uppercase border transition-colors ${inputMode === 'CSV' ? 'border-blue-600 text-blue-600' : 'border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-600 hover:border-blue-600'}`}
          >
            CSVアップロード
          </button>
        </div>

        {inputMode === 'MANUAL' && (
          <>
            <p className="text-[11px] text-gray-500 leading-relaxed mb-6">
              {!format
                ? '上のボタンでバーコードかQRコードを選んでから入力してください。'
                : format === 'QR'
                ? 'URLやテキストを1行ずつ入力すると、QRコード画像を生成します。'
                : '数字やコードを1行ずつ入力すると、バーコード画像を生成します。'}
              {!isPro && `無料版は一度に${FREE_LIMIT}件まで。`}
            </p>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={format === 'QR' ? 'https://nukitoru.pages.dev\nhttps://example.com' : format === 'BARCODE' ? '4901234567894\n1234567890128' : 'バーコードかQRコードを選んでください'}
              rows={5}
              className="w-full p-3 text-sm font-mono border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none focus:border-blue-600 transition-colors mb-3"
            />

            <div className="flex gap-2 mb-2">
              <button onClick={handleGenerate} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white text-[11px] tracking-[0.2em] uppercase transition-colors">
                生成する
              </button>
              {(input || codes.length > 0) && (
                <button onClick={clearManual} className="h-11 px-4 border border-gray-200 dark:border-gray-800 text-gray-500 hover:border-red-500 hover:text-red-500 text-[10px] tracking-[0.15em] uppercase transition-colors">
                  クリア
                </button>
              )}
            </div>
          </>
        )}

        {inputMode === 'CSV' && (
          <>
            <p className="text-[11px] text-gray-500 leading-relaxed mb-2">
              CSVファイルをアップロードすると、まとめてバーコード/QRコードを生成できます（内容から自動判定します）。
              {!isPro && `無料版は一度に${FREE_LIMIT}件まで。`}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-600 leading-relaxed mb-4">
              テンプレート以外の形式のCSVでも取り込みできます。列の意味はアップロード後に指定できます。
              <button onClick={() => downloadTemplate(format || 'BARCODE')} className="text-blue-500 hover:text-blue-600 underline ml-1">テンプレートをダウンロード</button>
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`w-full border-2 border-dashed rounded p-6 mb-4 text-center cursor-pointer transition-colors ${isDragging ? 'border-blue-600 bg-blue-600/5' : 'border-gray-200 dark:border-gray-800 hover:border-blue-600'}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleCsvFile(file)
                }}
                className="hidden"
              />
              {csvFileName ? (
                <p className="text-[11px] text-blue-600 break-all">{csvFileName}</p>
              ) : (
                <>
                  <p className="text-[11px] text-gray-500 mb-1">CSVファイルをドラッグ&ドロップ</p>
                  <p className="text-[9px] text-gray-400 tracking-[0.1em] uppercase">またはクリックして選択</p>
                </>
              )}
            </div>

            {csvAutoNote && (
              <p className="text-[9px] text-blue-500 mb-4">
                内容から「{csvAutoNote === 'QR' ? 'QRコード' : 'バーコード'}」と自動判定しました。違う場合は上のボタンで切り替えてください。
              </p>
            )}

            {csvRows && (
              <div className="space-y-4 mb-4 border border-gray-100 dark:border-gray-800 p-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-[10px] text-gray-500">
                    <input type="checkbox" checked={csvHasHeader} onChange={(e) => setCsvHasHeader(e.target.checked)} />
                    1行目をヘッダー（列名）として扱う
                  </label>
                  <button onClick={clearCsv} className="text-[9px] tracking-[0.1em] text-gray-400 hover:text-red-500 uppercase whitespace-nowrap">
                    クリア
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <label className="text-[10px] text-gray-500 flex flex-col gap-1">
                    コード列（{format === 'QR' ? 'URL・テキスト' : 'JANなど数字'}）
                    <select
                      value={codeColIndex}
                      onChange={(e) => setCodeColIndex(Number(e.target.value))}
                      className="h-8 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 text-[11px] px-2"
                    >
                      {headerLabels().map((h, i) => (
                        <option key={i} value={i}>{h || `列${i + 1}`}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-[10px] text-gray-500 flex flex-col gap-1">
                    商品名列（画面表示用・任意）
                    <select
                      value={nameColIndex}
                      onChange={(e) => setNameColIndex(Number(e.target.value))}
                      className="h-8 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 text-[11px] px-2"
                    >
                      <option value={-1}>なし</option>
                      {headerLabels().map((h, i) => (
                        <option key={i} value={i}>{h || `列${i + 1}`}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-[10px] text-gray-500 flex flex-col gap-1">
                    枚数列（同じコードを複数枚生成したい場合・任意）
                    <select
                      value={qtyColIndex}
                      onChange={(e) => setQtyColIndex(Number(e.target.value))}
                      className="h-8 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 text-[11px] px-2"
                    >
                      <option value={-1}>なし（1コード=1枚）</option>
                      {headerLabels().map((h, i) => (
                        <option key={i} value={i}>{h || `列${i + 1}`}</option>
                      ))}
                    </select>
                  </label>

                  <div className="text-[10px] text-gray-500 flex flex-col gap-1">
                    画像下に表示する番号
                    <div className="flex gap-3 mb-1">
                      <label className="flex items-center gap-1">
                        <input type="radio" checked={numberMode === 'auto'} onChange={() => setNumberMode('auto')} />
                        自動連番（001, 002…）
                      </label>
                      <label className="flex items-center gap-1">
                        <input type="radio" checked={numberMode === 'column'} onChange={() => setNumberMode('column')} />
                        CSVの列を使う
                      </label>
                    </div>
                    {numberMode === 'column' && (
                      <select
                        value={numberColIndex}
                        onChange={(e) => setNumberColIndex(Number(e.target.value))}
                        className="h-8 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 text-[11px] px-2"
                      >
                        <option value={-1}>選択してください</option>
                        {headerLabels().map((h, i) => (
                          <option key={i} value={i}>{h || `列${i + 1}`}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <p className="text-[9px] text-gray-400">{dataRows().length}件のデータ行を検出しました。</p>

                <button onClick={handleGenerateFromCsv} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white text-[11px] tracking-[0.2em] uppercase transition-colors">
                  CSVから生成する
                </button>
              </div>
            )}
          </>
        )}

        {errorMsg && (
          <p className="text-[10px] text-yellow-500 leading-relaxed mb-4">
            {errorMsg}
            {!isPro && <Link href="/upgrade" className="text-blue-500 hover:text-blue-600 underline ml-1">Proにアップグレード →</Link>}
          </p>
        )}

        {codes.length > 0 && (
          <div className="space-y-4 mt-6">
            <div className="flex items-center justify-between border border-gray-100 dark:border-gray-800 px-3 py-2">
              {codes.length > 1 ? (
                <>
                  <span className="text-[10px] text-gray-500">{selectedCount}/{codes.length}件を選択中</span>
                  <div className="flex gap-3">
                    <button onClick={selectAll} className="text-[9px] tracking-[0.1em] text-blue-500 hover:text-blue-600 uppercase">全選択</button>
                    <button onClick={selectNone} className="text-[9px] tracking-[0.1em] text-gray-400 hover:text-red-500 uppercase">全解除</button>
                    <button onClick={() => setCodes([])} className="text-[9px] tracking-[0.1em] text-gray-400 hover:text-red-500 uppercase">結果をクリア</button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-[10px] text-gray-500">生成結果</span>
                  <button onClick={() => setCodes([])} className="text-[9px] tracking-[0.1em] text-gray-400 hover:text-red-500 uppercase">結果をクリア</button>
                </>
              )}
            </div>

            {isPro && codes.length > 1 && (
              <div className="space-y-2">
                <button onClick={downloadZip} className="w-full h-10 border border-blue-600 text-blue-600 text-[10px] tracking-[0.15em] uppercase hover:bg-blue-600 hover:text-white transition-colors">
                  ↓ {selectedCount > 0 ? `選択した${selectedCount}件` : `全${codes.length}件`}をZIPダウンロード
                </button>

                <div className="border border-gray-100 dark:border-gray-800 p-3 space-y-2">
                  <p className="text-[10px] tracking-[0.1em] text-gray-500 uppercase">ラベルシートに印刷する</p>
                  <select
                    value={selectedPreset}
                    onChange={(e) => setSelectedPreset(e.target.value)}
                    className="w-full h-9 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 text-[11px] px-2"
                  >
                    {LABEL_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <label className="text-[10px] text-gray-500 flex items-center gap-2">
                    開始位置（何番目のマスから印刷するか。使いかけのシートに続きから印刷したい場合）
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={maxStartPosition}
                    value={startPosition}
                    onChange={(e) => setStartPosition(Math.max(1, Math.min(maxStartPosition, Number(e.target.value) || 1)))}
                    className="h-8 w-24 px-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 text-[11px]"
                  />
                  <button
                    onClick={generateLabelSheetPdf}
                    disabled={generatingPdf}
                    className="w-full h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[10px] tracking-[0.15em] uppercase transition-colors"
                  >
                    {generatingPdf ? '作成中...' : `↓ ${selectedCount > 0 ? `選択した${selectedCount}件` : `全${codes.length}件`}を印刷用PDFに`}
                  </button>
                  <p className="text-[9px] text-gray-400 leading-relaxed">
                    対応ラベルシート：エーワン 72265・72244（31516と同サイズ）・72212。他の型番のご要望があればお問い合わせください。対応可能であれば追加します。
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {codes.map((code, i) => (
                <div key={i} className={`border p-3 flex items-center justify-between gap-3 transition-colors ${code.selected ? 'border-gray-100 dark:border-gray-800' : 'border-gray-50 dark:border-gray-900 opacity-40'}`}>
                  <input
                    type="checkbox"
                    checked={code.selected}
                    onChange={() => toggleSelect(i)}
                    className="shrink-0"
                  />
                  <div className="flex flex-col items-center gap-1">
                    <img
                      src={code.dataUrl}
                      alt={code.value}
                      className={format === 'QR' ? 'h-24 w-24 bg-white' : 'h-14 bg-white'}
                    />
                    {inputMode === 'CSV' && (
                      <p className="text-[9px] text-gray-500 font-mono">{code.label}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-1 min-w-0">
                    {code.productName && (
                      <p className="text-[10px] text-gray-600 dark:text-gray-300 text-right break-words">{code.productName}</p>
                    )}
                    {format === 'QR' && !code.productName && (
                      <p className="text-[9px] text-gray-400 max-w-[160px] truncate">{code.value}</p>
                    )}
                    <button onClick={() => downloadSingle(code)} className="shrink-0 text-[9px] tracking-[0.1em] text-blue-500 hover:text-blue-600 uppercase whitespace-nowrap">↓ PNG</button>
                  </div>
                </div>
              ))}
            </div>
            {format === 'QR' && (
              <p className="text-[10px] text-gray-400 leading-relaxed">
                スマートフォンでは画像を長押しすると「写真に保存」できます。印刷する場合は「↓ PNG」からダウンロードしてください。
              </p>
            )}
            {inputMode === 'CSV' && (
              <p className="text-[10px] text-gray-400 leading-relaxed">
                印刷物には商品名の代わりに番号のみ表示されます。番号と商品名の対応はアップロードしたCSVをご確認ください。
              </p>
            )}
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}
