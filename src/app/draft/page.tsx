'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

const WORKER_URL = 'https://nukitoru-api.ume0117.workers.dev'

interface DraftResult {
  jan: string
  name: string
  price: number | null
  rakutenTitle: string
  amazonTitle: string
  yahooTitle: string
  description: string
}

async function fetchProductInfo(jan: string, maxRetry = 3): Promise<{ name: string; price: number | null }> {
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
      const name = rakutenItems[0]?.name || yahooItems[0]?.name || ''
      const price = typeof data.minPrice === 'number' ? data.minPrice : null
      return { name, price }
    } catch {
      await new Promise(r => setTimeout(r, delay))
      delay *= 2
    }
  }
  return { name: '', price: null }
}

function buildDraft(jan: string, name: string, price: number | null): DraftResult {
  const cleanName = name.trim()
  const shortName = cleanName.length > 60 ? cleanName.slice(0, 60) : cleanName
  const priceText = price ? `¥${price.toLocaleString()}` : ''

  const rakutenTitle = cleanName ? `${shortName}` : ''
  const amazonTitle = cleanName ? `${cleanName}` : ''
  const yahooTitle = cleanName ? `${shortName} JAN:${jan}` : ''

  const description = cleanName
    ? `${cleanName}\n\n■商品コード\nJAN: ${jan}\n\n■価格\n${priceText}（参考価格・変動あり）\n\n■商品説明\n（ここに商品の特徴・使用シーン・サイズなどを追記してください）\n\n■注意事項\n・画像はイメージです\n・仕様は予告なく変更される場合があります`
    : ''

  return { jan, name: cleanName, price, rakutenTitle, amazonTitle, yahooTitle, description }
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

function downloadDraftCSV(results: DraftResult[]) {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const filename = `draft_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.csv`
  const bom = '\uFEFF'
  const header = 'JANコード,商品名,参考価格,楽天タイトル案,Amazon商品名案,Yahooタイトル案,商品説明文雛形'
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const rows = results.map(r => {
    const price = r.price ? `¥${r.price.toLocaleString()}` : ''
    return [r.jan, esc(r.name), price, esc(r.rakutenTitle), esc(r.amazonTitle), esc(r.yahooTitle), esc(r.description)].join(',')
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

export default function DraftPage() {
  const [phase, setPhase] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState<DraftResult[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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
      const draftResults: DraftResult[] = []
      for (let i = 0; i < codes.length; i++) {
        setProgress({ current: i + 1, total: codes.length })
        const info = await fetchProductInfo(codes[i])
        draftResults.push(buildDraft(codes[i], info.name, info.price))
        await new Promise(r => setTimeout(r, 100))
      }
      setResults(draftResults)
      setPhase('done')
    } catch {
      setErrorMsg('ファイルの読み込みに失敗しました。')
      setPhase('error')
    }
  }

  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-[10px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase hover:text-blue-600 transition-colors">← NUKITORU</Link>
        </div>

        <h1 className="text-[13px] tracking-[0.3em] text-gray-900 dark:text-white uppercase font-medium mb-2">出品下書き生成</h1>
        <p className="text-[11px] text-gray-500 leading-relaxed mb-2">過去にダウンロードしたCSVを選択すると、楽天・Amazon・Yahoo!向けのタイトル案と商品説明文の雛形をまとめて生成します。</p>
        <p className="text-[10px] text-gray-400 dark:text-gray-600 leading-relaxed mb-8">※生成されるのは下書きです。各モールの規約・カテゴリ要件に合わせて内容を調整してからご利用ください。</p>

        {phase === 'idle' && (
          <div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            <button onClick={() => fileRef.current?.click()} className="w-full h-12 border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-[11px] tracking-[0.2em] uppercase hover:border-blue-600 hover:text-blue-600 transition-colors">CSVファイルを選択</button>
          </div>
        )}

        {phase === 'processing' && (
          <div className="space-y-3">
            <p className="text-[10px] tracking-[0.15em] text-gray-400 uppercase text-center">下書きを生成中 {progress.current} / {progress.total} 件</p>
            <div className="w-full bg-gray-100 dark:bg-gray-900 h-1">
              <div className="bg-blue-600 h-1 transition-all duration-300" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-4">
            <p className="text-[11px] text-blue-600 uppercase tracking-[0.15em]">完了：{results.length}件の下書きを生成しました</p>
            <button onClick={() => downloadDraftCSV(results)} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white text-[11px] tracking-[0.2em] uppercase transition-colors">↓ 下書きCSVをダウンロード</button>
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
