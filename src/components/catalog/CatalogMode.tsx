'use client'

import { useState, useRef } from 'react'
import type { ScanResult } from '@/types'

const WORKER_URL = 'https://nukitoru-api.ume0117.workers.dev'

interface PriceResult {
  jan: string
  name: string
  rakutenMin: number | null
  yahooMin: number | null
  overallMin: number | null
  rakutenUrl: string | null
  yahooUrl: string | null
}

async function fetchPriceWithRetry(jan: string, maxRetry = 3): Promise<PriceResult> {
  let delay = 200
  for (let i = 0; i < maxRetry; i++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(WORKER_URL + '/?jan=' + jan, { signal: controller.signal })
      clearTimeout(timeout)
      if (res.status === 429) { await new Promise(r => setTimeout(r, 2000)); continue }
      const data = await res.json()
      const rakutenItems = data.rakuten || []
      const yahooItems = data.yahoo || []
      const rakutenMin = rakutenItems.length > 0 ? Math.min(...rakutenItems.map((i: {price: number}) => i.price)) : null
      const yahooMin = yahooItems.length > 0 ? Math.min(...yahooItems.map((i: {price: number}) => i.price)) : null
      const allPrices = [rakutenMin, yahooMin].filter(Boolean) as number[]
      return { jan, name: rakutenItems[0]?.name || yahooItems[0]?.name || '', rakutenMin, yahooMin, overallMin: allPrices.length > 0 ? Math.min(...allPrices) : null, rakutenUrl: rakutenItems[0]?.url || null, yahooUrl: yahooItems[0]?.url || null }
    } catch {
      await new Promise(r => setTimeout(r, delay))
      delay *= 2
    }
  }
  return { jan, name: '', rakutenMin: null, yahooMin: null, overallMin: null, rakutenUrl: null, yahooUrl: null }
}

function downloadCatalogCSV(results: PriceResult[]) {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const datetime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  const filename = `catalog_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.csv`
  const bom = '\uFEFF'
  const header = 'JANコード,商品名,楽天最安値,Yahoo最安値,総合最安値,楽天URL,Yahoo URL,取得日時'
  const rows = results.map(r => {
    const name = r.name ? `"${r.name.replace(/"/g, '""')}"` : ''
    const rakutenMin = r.rakutenMin ? `"¥${r.rakutenMin.toLocaleString()}"` : ''
    const yahooMin = r.yahooMin ? `"¥${r.yahooMin.toLocaleString()}"` : ''
    const overallMin = r.overallMin ? `"¥${r.overallMin.toLocaleString()}"` : ''
    return `${r.jan},${name},${rakutenMin},${yahooMin},${overallMin},${r.rakutenUrl || ''},${r.yahooUrl || ''},${datetime}`
  })
  const csv = bom + [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function CatalogMode({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'pricing' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' })
  const [results, setResults] = useState<PriceResult[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setPhase('scanning')
    setProgress({ current: 0, total: 1, message: 'PDFをスキャン中...' })
    try {
      const { processPdf } = await import('@/lib/pdf/processor')
      const scanned = await processPdf(file, (current, total, message) => {
        setProgress({ current, total, message })
      })
      const janOnly = scanned.filter((r: ScanResult) => r.type === 'EAN_13' || r.type === 'EAN_8')
      if (janOnly.length === 0) {
        setProgress({ current: 0, total: 0, message: 'JANコードが見つかりませんでした' })
        setPhase('error')
        return
      }
      setPhase('pricing')
      setProgress({ current: 0, total: janOnly.length, message: '価格を取得中...' })
      const priceResults: PriceResult[] = []
      for (let i = 0; i < janOnly.length; i++) {
        setProgress({ current: i + 1, total: janOnly.length, message: `価格取得中 ${i + 1} / ${janOnly.length} 件` })
        const result = await fetchPriceWithRetry(janOnly[i].value)
        priceResults.push(result)
        await new Promise(r => setTimeout(r, 100))
      }
      setResults(priceResults)
      setPhase('done')
      setProgress({ current: janOnly.length, total: janOnly.length, message: `完了：${janOnly.length}件のJANコードを処理しました` })
    } catch {
      setPhase('error')
      setProgress({ current: 0, total: 0, message: 'エラーが発生しました' })
    }
  }

  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 h-12 border-b border-gray-800">
        <span className="text-[11px] tracking-[0.2em] text-white uppercase">Catalog Mode</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-[10px] tracking-[0.15em] uppercase transition-colors">Close</button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
        {phase === 'idle' && (
          <>
            <div className="text-center space-y-2">
              <p className="text-[11px] tracking-[0.3em] text-gray-400 uppercase">PDF → JAN抽出 → 価格取得 → CSV</p>
              <p className="text-[10px] text-gray-600">メーカーカタログPDFを選択するだけで完了します</p>
            </div>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            <button onClick={() => fileRef.current?.click()} className="w-full max-w-xs h-12 bg-blue-600 hover:bg-blue-700 text-white text-[11px] tracking-[0.2em] uppercase transition-colors">PDFを選択</button>
          </>
        )}
        {(phase === 'scanning' || phase === 'pricing') && (
          <div className="w-full max-w-xs space-y-4">
            <p className="text-[10px] tracking-[0.15em] text-gray-400 uppercase text-center">{progress.message}</p>
            <div className="w-full bg-gray-900 h-1">
              <div className="bg-blue-600 h-1 transition-all duration-300" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-[9px] text-gray-600 text-center">{percent}%</p>
          </div>
        )}
        {phase === 'done' && (
          <div className="w-full max-w-xs space-y-4">
            <p className="text-[11px] tracking-[0.2em] text-blue-600 uppercase text-center">Complete</p>
            <p className="text-[10px] text-gray-400 text-center">{progress.message}</p>
            <button onClick={() => downloadCatalogCSV(results)} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-[11px] tracking-[0.2em] uppercase transition-colors">↓ CSVダウンロード</button>
            <button onClick={() => { setPhase('idle'); setResults([]) }} className="w-full h-10 border border-gray-800 text-gray-600 text-[10px] tracking-[0.15em] uppercase transition-colors">別のPDFを処理</button>
          </div>
        )}
        {phase === 'error' && (
          <div className="w-full max-w-xs space-y-4">
            <p className="text-[11px] tracking-[0.2em] text-red-500 uppercase text-center">Error</p>
            <p className="text-[10px] text-gray-400 text-center">{progress.message}</p>
            <button onClick={() => setPhase('idle')} className="w-full h-10 border border-gray-800 text-gray-600 text-[10px] tracking-[0.15em] uppercase transition-colors">やり直す</button>
          </div>
        )}
      </div>
    </div>
  )
}
