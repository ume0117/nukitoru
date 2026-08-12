'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { checkIsPro } from '@/lib/license'

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

function extractJanCodes(csvText: string): string[] {
  const lines = csvText.split(/\r?\n/)
  const found: string[] = []
  for (const line of lines) {
    const match = line.match(/\b(\d{13}|\d{8})\b/)
    if (match && !found.includes(match[1])) {
      found.push(match[1])
    }
  }
  return found
}

function downloadRecheckCSV(results: PriceResult[]) {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const datetime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  const filename = `recheck_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.csv`
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

export default function RecheckPage() {
  const [isPro, setIsPro] = useState<boolean | null>(null)
  const [phase, setPhase] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState<PriceResult[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    checkIsPro().then(setIsPro)
  }, [])

  const handleFile = async (file: File) => {
    setPhase('processing')
    setErrorMsg('')
    try {
      const text = await file.text()
      const codes = extractJanCodes(text)
      if (codes.length === 0) {
        setErrorMsg('JAN/EANコードが見つかりませんでした。NUKITORUで出力したCSVをご利用ください。')
        setPhase('error')
        return
      }
      setProgress({ current: 0, total: codes.length })
      const priceResults: PriceResult[] = []
      for (let i = 0; i < codes.length; i++) {
        setProgress({ current: i + 1, total: codes.length })
        const result = await fetchPriceWithRetry(codes[i])
        priceResults.push(result)
        await new Promise(r => setTimeout(r, 100))
      }
      setResults(priceResults)
      setPhase('done')
    } catch {
      setErrorMsg('ファイルの読み込みに失敗しました。')
      setPhase('error')
    }
  }

  if (isPro === null) {
    return <div className="min-h-screen bg-white dark:bg-black" />
  }

  if (!isPro) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-[11px] tracking-[0.3em] text-blue-500 uppercase">PRO限定機能</p>
          <h1 className="text-[13px] text-gray-900 dark:text-white tracking-wide">一括再チェックはPRO会員限定です</h1>
          <p className="text-[11px] text-gray-500 leading-relaxed">過去にダウンロードしたCSVを再アップロードするだけで、含まれる商品の最新価格をまとめて再取得できます。</p>
          <Link href="/upgrade" className="inline-block h-10 px-6 leading-[40px] bg-blue-600 hover:bg-blue-700 text-white text-[10px] tracking-[0.2em] uppercase transition-colors">Proを見る</Link>
        </div>
      </div>
    )
  }

  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-[10px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase hover:text-blue-600 transition-colors">← NUKITORU</Link>
        </div>

        <h1 className="text-[13px] tracking-[0.3em] text-gray-900 dark:text-white uppercase font-medium mb-2">一括再チェック</h1>
        <p className="text-[11px] text-gray-500 leading-relaxed mb-8">過去にダウンロードしたCSVを選択すると、含まれる商品の最新価格をまとめて再取得します。</p>

        {phase === 'idle' && (
          <div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            <button onClick={() => fileRef.current?.click()} className="w-full h-12 border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-[11px] tracking-[0.2em] uppercase hover:border-blue-600 hover:text-blue-600 transition-colors">CSVファイルを選択</button>
          </div>
        )}

        {phase === 'processing' && (
          <div className="space-y-3">
            <p className="text-[10px] tracking-[0.15em] text-gray-400 uppercase text-center">価格を再取得中 {progress.current} / {progress.total} 件</p>
            <div className="w-full bg-gray-100 dark:bg-gray-900 h-1">
              <div className="bg-blue-600 h-1 transition-all duration-300" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-4">
            <p className="text-[11px] text-blue-600 uppercase tracking-[0.15em]">完了：{results.length}件を再チェックしました</p>
            <button onClick={() => downloadRecheckCSV(results)} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white text-[11px] tracking-[0.2em] uppercase transition-colors">↓ 最新価格CSVをダウンロード</button>
            <button onClick={() => { setPhase('idle'); setResults([]) }} className="w-full h-10 border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-500 text-[10px] tracking-[0.15em] uppercase transition-colors">別のCSVを処理</button>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-4">
            <p className="text-[11px] text-red-500 uppercase tracking-[0.15em]">エラー</p>
            <p className="text-[10px] text-gray-500">{errorMsg}</p>
            <button onClick={() => setPhase('idle')} className="w-full h-10 border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-500 text-[10px] tracking-[0.15em] uppercase transition-colors">やり直す</button>
          </div>
        )}
      </div>
    </div>
  )
}
