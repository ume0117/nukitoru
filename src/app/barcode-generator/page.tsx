'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { checkIsPro } from '@/lib/license'

const FREE_LIMIT = 2

type CodeFormat = 'BARCODE' | 'QR'

interface GeneratedCode {
  value: string
  dataUrl: string
}

export default function BarcodeGeneratorPage() {
  const [format, setFormat] = useState<CodeFormat>('BARCODE')
  const [input, setInput] = useState('')
  const [codes, setCodes] = useState<GeneratedCode[]>([])
  const [isPro, setIsPro] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    checkIsPro().then(setIsPro)
  }, [])

  const switchFormat = (next: CodeFormat) => {
    setFormat(next)
    setCodes([])
    setErrorMsg('')
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
      try {
        if (format === 'QR') {
          const dataUrl = await QRCode.toDataURL(value, {
            width: 300,
            margin: 2,
            errorCorrectionLevel: 'M',
          })
          generated.push({ value, dataUrl })
        } else {
          const canvas = document.createElement('canvas')
          JsBarcode(canvas, value, { format: 'CODE128', width: 2, height: 60, displayValue: true, fontSize: 14, margin: 8 })
          generated.push({ value, dataUrl: canvas.toDataURL('image/png') })
        }
      } catch {
        // 不正な値はスキップ
      }
    }
    setCodes(generated)
  }

  const downloadSingle = (code: GeneratedCode) => {
    const prefix = format === 'QR' ? 'qrcode' : 'barcode'
    const a = document.createElement('a')
    a.href = code.dataUrl
    a.download = `${prefix}_${code.value}.png`
    a.click()
  }

  const downloadZip = async () => {
    if (!isPro) return
    const prefix = format === 'QR' ? 'qrcode' : 'barcode'
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    for (const code of codes) {
      const base64 = code.dataUrl.split(',')[1]
      zip.file(`${prefix}_${code.value}.png`, base64, { base64: true })
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

        <div className="flex gap-2 mb-4">
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

        <button onClick={handleGenerate} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white text-[11px] tracking-[0.2em] uppercase transition-colors mb-2">
          生成する
        </button>

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
                  <img
                    src={code.dataUrl}
                    alt={code.value}
                    className={format === 'QR' ? 'h-24 w-24 bg-white' : 'h-14 bg-white'}
                  />
                  <div className="flex flex-col items-end gap-1">
                    {format === 'QR' && (
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
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}
