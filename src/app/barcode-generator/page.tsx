'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { checkIsPro } from '@/lib/license'

const FREE_LIMIT = 2

type CodeFormat = 'BARCODE' | 'QR'
type InputMode = 'MANUAL' | 'CSV'
type NumberMode = 'auto' | 'column'

interface GeneratedCode {
  value: string
  dataUrl: string
  productName?: string
  label: string
}

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

export default function BarcodeGeneratorPage() {
  const [format, setFormat] = useState<CodeFormat>('BARCODE')
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
  const [numberMode, setNumberMode] = useState<NumberMode>('auto')
  const [numberColIndex, setNumberColIndex] = useState<number>(-1)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    checkIsPro().then(setIsPro)
  }, [])

  const switchFormat = (next: CodeFormat) => {
    setFormat(next)
    setCodes([])
    setErrorMsg('')
  }

  const switchInputMode = (next: InputMode) => {
    setInputMode(next)
    setCodes([])
    setErrorMsg('')
  }

  const clearManual = () => {
    setInput('')
    setCodes([])
    setErrorMsg('')
  }

  const clearCsv = () => {
    setCsvRows(null)
    setCsvFileName('')
    setCsvHasHeader(true)
    setCodeColIndex(0)
    setNameColIndex(-1)
    setNumberMode('auto')
    setNumberColIndex(-1)
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
      const firstRow = rows[0]
      const looksLikeData = firstRow.every(cell => {
        const v = cell.trim()
        if (!v) return false
        return format === 'BARCODE' ? /^[0-9]{6,}$/.test(v) : /^https?:\/\//.test(v) || v.length > 0
      })
      const guessedHasHeader = format === 'BARCODE' ? !looksLikeData : rows.length > 1 && !/^https?:\/\//.test(firstRow[0]?.trim() || '')

      setCsvRows(rows)
      setCsvFileName(file.name)
      setCsvHasHeader(guessedHasHeader)
      setCodeColIndex(0)
      setNameColIndex(rows[0].length > 1 ? 1 : -1)
      setNumberMode('auto')
      setNumberColIndex(-1)
      setErrorMsg('')
      setCodes([])
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
      const dataUrl = await renderCode(value)
      if (dataUrl) generated.push({ value, dataUrl, label: value })
    }
    setCodes(generated)
  }

  const handleGenerateFromCsv = async () => {
    setErrorMsg('')
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
      let label: string
      if (numberMode === 'column' && numberColIndex >= 0) {
        label = (row[numberColIndex] || '').trim() || String(seq).padStart(3, '0')
      } else {
        label = String(seq).padStart(3, '0')
      }
      seq++

      const dataUrl = await renderCode(value)
      if (dataUrl) generated.push({ value, dataUrl, productName, label })
    }
    setCodes(generated)
  }

  const renderCode = async (value: string): Promise<string | null> => {
    try {
      if (format === 'QR') {
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

  const downloadSingle = (code: GeneratedCode) => {
    const prefix = format === 'QR' ? 'qrcode' : 'barcode'
    const a = document.createElement('a')
    a.href = code.dataUrl
    a.download = `${prefix}_${code.label}.png`
    a.click()
  }

  const downloadZip = async () => {
    if (!isPro) return
    const prefix = format === 'QR' ? 'qrcode' : 'barcode'
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    for (const code of codes) {
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

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-[10px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase hover:text-blue-600 transition-colors">← NUKITORU</Link>
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
              {format === 'QR'
                ? 'URLやテキストを1行ずつ入力すると、QRコード画像を生成します。'
                : '数字やコードを1行ずつ入力すると、バーコード画像を生成します。'}
              {!isPro && `無料版は一度に${FREE_LIMIT}件まで。`}
            </p>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={format === 'QR' ? 'https://nukitoru.pages.dev\nhttps://example.com' : '4901234567894\n1234567890128'}
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
            <p className="text-[11px] text-gray-500 leading-relaxed mb-4">
              CSVファイルをアップロードすると、まとめて{format === 'QR' ? 'QRコード' : 'バーコード'}を生成できます。
              {!isPro && `無料版は一度に${FREE_LIMIT}件まで。`}
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
            {isPro && codes.length > 1 && (
              <button onClick={downloadZip} className="w-full h-10 border border-blue-600 text-blue-600 text-[10px] tracking-[0.15em] uppercase hover:bg-blue-600 hover:text-white transition-colors">
                ↓ まとめてZIPダウンロード（{codes.length}件）
              </button>
            )}
            <div className="space-y-3">
              {codes.map((code, i) => (
                <div key={i} className="border border-gray-100 dark:border-gray-800 p-3 flex items-center justify-between gap-3">
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
