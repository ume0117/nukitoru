'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { checkIsPro, getSavedLicenseKey } from '@/lib/license'

const WORKER_URL = 'https://nukitoru-api.ume0117.workers.dev'
const WATCH_LIMIT = 20

interface WatchItem {
  jan: string
  threshold: number
  lastPrice: number | null
  name: string
  addedAt: number
}

export default function WatchPage() {
  const [isPro, setIsPro] = useState<boolean | null>(null)
  const [list, setList] = useState<WatchItem[]>([])
  const [jan, setJan] = useState('')
  const [threshold, setThreshold] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const licenseKey = getSavedLicenseKey()

  const loadList = async () => {
    if (!licenseKey) return
    try {
      const res = await fetch(WORKER_URL + '/watch?key=' + encodeURIComponent(licenseKey))
      const data = await res.json()
      if (Array.isArray(data.watchList)) setList(data.watchList)
    } catch {}
  }

  useEffect(() => {
    checkIsPro().then(setIsPro)
    loadList()
  }, [])

  const handleAdd = async () => {
    setErrorMsg('')
    const trimmed = jan.trim()
    if (!/^\d{8}$|^\d{13}$/.test(trimmed)) {
      setErrorMsg('JANコードは8桁または13桁の数字で入力してください。')
      return
    }
    if (list.length >= WATCH_LIMIT) {
      setErrorMsg(`監視リストは${WATCH_LIMIT}件までです。`)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(WORKER_URL + '/watch?key=' + encodeURIComponent(licenseKey || ''), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jan: trimmed, threshold: threshold ? Number(threshold) : 1 }),
      })
      const data = await res.json()
      if (data.error) {
        setErrorMsg(data.error === 'already watching' ? 'すでに監視中のJANコードです。' : data.error === 'limit reached' ? `監視リストは${WATCH_LIMIT}件までです。` : '登録に失敗しました。')
      } else {
        setJan('')
        setThreshold('')
        if (Array.isArray(data.watchList)) setList(data.watchList)
      }
    } catch {
      setErrorMsg('登録に失敗しました。')
    }
    setLoading(false)
  }

  const handleDelete = async (targetJan: string) => {
    try {
      const res = await fetch(WORKER_URL + '/watch?key=' + encodeURIComponent(licenseKey || ''), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jan: targetJan }),
      })
      const data = await res.json()
      if (Array.isArray(data.watchList)) setList(data.watchList)
    } catch {}
  }

  if (isPro === null) {
    return <div className="min-h-screen bg-white dark:bg-black" />
  }

  if (!isPro) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-[11px] tracking-[0.3em] text-blue-500 uppercase">PRO限定機能</p>
          <h1 className="text-[13px] text-gray-900 dark:text-white tracking-wide">価格改定アラートはPRO会員限定です</h1>
          <p className="text-[11px] text-gray-500 leading-relaxed">監視したい商品を登録すると、値下がりした時にメールでお知らせします。</p>
          <Link href="/upgrade" className="inline-block h-10 px-6 leading-[40px] bg-blue-600 hover:bg-blue-700 text-white text-[10px] tracking-[0.2em] uppercase transition-colors">Proを見る</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-[10px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase hover:text-blue-600 transition-colors">← NUKITORU</Link>
        </div>

        <h1 className="text-[13px] tracking-[0.3em] text-gray-900 dark:text-white uppercase font-medium mb-2">価格改定アラート</h1>
        <p className="text-[11px] text-gray-500 leading-relaxed mb-8">監視したいJANコードを登録すると、毎日自動で価格をチェックし、値下がりしたらメールでお知らせします（最大{WATCH_LIMIT}件・毎日朝9時にチェック）。</p>

        <div className="border border-gray-100 dark:border-gray-800 p-4 space-y-3 mb-8">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={jan}
              onChange={(e) => setJan(e.target.value)}
              placeholder="JANコード"
              className="h-10 px-3 text-sm font-mono border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none focus:border-blue-600 transition-colors"
            />
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="◯円以上下がったら通知（任意）"
              className="h-10 px-3 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none focus:border-blue-600 transition-colors"
            />
          </div>
          <button onClick={handleAdd} disabled={loading || !jan.trim()} className="w-full h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[10px] tracking-[0.2em] uppercase transition-colors">
            {loading ? '登録中...' : '監視リストに追加'}
          </button>
          {errorMsg && <p className="text-[10px] text-red-500">{errorMsg}</p>}
        </div>

        <p className="text-[9px] tracking-[0.15em] text-gray-400 dark:text-gray-600 uppercase mb-2">監視中（{list.length}/{WATCH_LIMIT}）</p>
        <div className="space-y-2">
          {list.length === 0 && (
            <p className="text-[11px] text-gray-400 dark:text-gray-600">監視中の商品はまだありません。</p>
          )}
          {list.map((item) => (
            <div key={item.jan} className="border border-gray-100 dark:border-gray-800 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-gray-900 dark:text-white truncate">{item.name || item.jan}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-600 font-mono">{item.jan} {item.lastPrice ? `・現在 ¥${item.lastPrice.toLocaleString()}` : ''} ・{item.threshold}円以上で通知</p>
              </div>
              <button onClick={() => handleDelete(item.jan)} className="shrink-0 text-[9px] tracking-[0.1em] text-gray-400 dark:text-gray-600 hover:text-red-500 uppercase">削除</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
