'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { getSavedLicenseKey, saveLicenseKey } from '@/lib/license'

const WORKER_URL = 'https://nukitoru-api.ume0117.workers.dev'
const WATCH_LIMIT = 20

interface WatchItem {
  jan: string
  threshold: number
  lastPrice: number | null
  name: string
  arrivalAlert?: boolean
  addedAt: number
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

export default function WatchPage() {
  const [licenseKey, setLicenseKey] = useState<string | null>(null)
  const [checkingKey, setCheckingKey] = useState(true)
  const [signupEmail, setSignupEmail] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupError, setSignupError] = useState('')

  const [list, setList] = useState<WatchItem[]>([])
  const [mode, setMode] = useState<'MANUAL' | 'CSV'>('MANUAL')
  const [jan, setJan] = useState('')
  const [threshold, setThreshold] = useState('')
  const [arrivalAlert, setArrivalAlert] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [csvFileName, setCsvFileName] = useState('')
  const [csvResultMsg, setCsvResultMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLicenseKey(getSavedLicenseKey())
    setCheckingKey(false)
  }, [])

  const loadList = async (key: string) => {
    try {
      const res = await fetch(WORKER_URL + '/watch?key=' + encodeURIComponent(key))
      const data = await res.json()
      if (Array.isArray(data.watchList)) setList(data.watchList)
    } catch {}
  }

  useEffect(() => {
    if (licenseKey) loadList(licenseKey)
  }, [licenseKey])

  const handleSignup = async () => {
    setSignupError('')
    const trimmed = signupEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setSignupError('正しいメールアドレスを入力してください。')
      return
    }
    setSignupLoading(true)
    try {
      const res = await fetch(WORKER_URL + '/free-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })
      const data = await res.json()
      if (data.licenseKey) {
        saveLicenseKey(data.licenseKey)
        setLicenseKey(data.licenseKey)
      } else {
        setSignupError('登録に失敗しました。')
      }
    } catch {
      setSignupError('登録に失敗しました。')
    }
    setSignupLoading(false)
  }

  const handleAdd = async () => {
    if (!licenseKey) return
    setErrorMsg('')
    const trimmed = jan.trim()
    if (!trimmed) {
      setErrorMsg('JANコードまたは型番を入力してください。')
      return
    }
    if (list.length >= WATCH_LIMIT) {
      setErrorMsg(`監視リストは${WATCH_LIMIT}件までです。`)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(WORKER_URL + '/watch?key=' + encodeURIComponent(licenseKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jan: trimmed, threshold: threshold ? Number(threshold) : 1, arrivalAlert }),
      })
      const data = await res.json()
      if (data.error) {
        setErrorMsg(data.error === 'already watching' ? 'すでに監視中のコードです。' : data.error === 'limit reached' ? `監視リストは${WATCH_LIMIT}件までです。` : '登録に失敗しました。')
      } else {
        setJan('')
        setThreshold('')
        setArrivalAlert(false)
        if (Array.isArray(data.watchList)) setList(data.watchList)
      }
    } catch {
      setErrorMsg('登録に失敗しました。')
    }
    setLoading(false)
  }

  const handleCsvFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorMsg('CSVファイル（.csv）を選択してください。')
      return
    }
    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      if (rows.length === 0) {
        setErrorMsg('CSVを読み取れませんでした。')
        return
      }
      const firstCell = (rows[0]?.[0] || '').trim()
      const hasHeader = !/^[0-9]{6,}$/.test(firstCell)
      const dataRows = hasHeader ? rows.slice(1) : rows

      const items = dataRows.map(r => ({
        code: (r[0] || '').trim(),
        threshold: r[1] ? Number(r[1]) : undefined,
        arrivalAlert: r[2] ? /^(true|1|する|はい|yes)$/i.test(r[2].trim()) : false,
      })).filter(i => i.code)

      if (items.length === 0) {
        setErrorMsg('CSVに有効な行が見つかりませんでした。')
        return
      }

      setCsvFileName(file.name)
      setErrorMsg('')
      setCsvResultMsg('登録中...')
      setLoading(true)
      try {
        const res = await fetch(WORKER_URL + '/watch?key=' + encodeURIComponent(licenseKey || ''), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        })
        const data = await res.json()
        if (data.error) {
          setCsvResultMsg('')
          setErrorMsg('登録に失敗しました。')
        } else {
          const addedCount = data.results?.added?.length || 0
          const skippedCount = data.results?.skipped?.length || 0
          setCsvResultMsg(`${addedCount}件を登録しました。${skippedCount > 0 ? `（${skippedCount}件はスキップ：上限超過または登録済み）` : ''}`)
          if (Array.isArray(data.watchList)) setList(data.watchList)
        }
      } catch {
        setCsvResultMsg('')
        setErrorMsg('登録に失敗しました。')
      }
      setLoading(false)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const downloadTemplate = () => {
    const rows = [
      ['コード', 'しきい値（任意）', '入荷通知（任意）'],
      ['4901234567894', '500', 'する'],
      ['MA-WPR16GM', '', ''],
    ]
    const bom = '\uFEFF'
    const csv = bom + rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nukitoru_watch_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = async (targetJan: string) => {
    if (!licenseKey) return
    try {
      const res = await fetch(WORKER_URL + '/watch?key=' + encodeURIComponent(licenseKey), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jan: targetJan }),
      })
      const data = await res.json()
      if (Array.isArray(data.watchList)) setList(data.watchList)
    } catch {}
  }

  if (checkingKey) {
    return <div className="min-h-screen bg-white dark:bg-black" />
  }

  if (!licenseKey) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-6">
        <div className="max-w-sm w-full space-y-4">
          <div className="text-center space-y-2">
            <p className="text-[11px] tracking-[0.3em] text-blue-500 uppercase">価格改定アラート</p>
            <h1 className="text-[13px] text-gray-900 dark:text-white tracking-wide">メールアドレスで無料登録</h1>
            <p className="text-[11px] text-gray-500 leading-relaxed">監視したい商品を登録すると、値下がり・入荷した時にメールでお知らせします。登録は無料です。</p>
          </div>
          <input
            type="email"
            value={signupEmail}
            onChange={(e) => setSignupEmail(e.target.value)}
            placeholder="メールアドレス"
            className="w-full h-11 px-3 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none focus:border-blue-600 transition-colors"
          />
          <button
            onClick={handleSignup}
            disabled={signupLoading || !signupEmail.trim()}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[11px] tracking-[0.2em] uppercase transition-colors"
          >
            {signupLoading ? '登録中...' : '無料で登録する'}
          </button>
          {signupError && <p className="text-[10px] text-red-500 text-center">{signupError}</p>}
          <p className="text-[9px] text-gray-400 dark:text-gray-600 text-center leading-relaxed">
            既にライセンスキーをお持ちの方は<Link href="/license" className="text-blue-500 hover:text-blue-600 underline">こちら</Link>から入力してください。
          </p>
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
        <p className="text-[11px] text-gray-500 leading-relaxed mb-6">JANコードや型番を登録すると、毎日自動で価格をチェックし、値下がり・入荷をメールでお知らせします（最大{WATCH_LIMIT}件・毎日朝9時にチェック）。</p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('MANUAL')}
            className={`flex-1 h-8 text-[9px] tracking-[0.15em] uppercase border transition-colors ${mode === 'MANUAL' ? 'border-blue-600 text-blue-600' : 'border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-600 hover:border-blue-600'}`}
          >
            手入力
          </button>
          <button
            onClick={() => setMode('CSV')}
            className={`flex-1 h-8 text-[9px] tracking-[0.15em] uppercase border transition-colors ${mode === 'CSV' ? 'border-blue-600 text-blue-600' : 'border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-600 hover:border-blue-600'}`}
          >
            CSVアップロード
          </button>
        </div>

        {mode === 'MANUAL' && (
          <div className="border border-gray-100 dark:border-gray-800 p-4 space-y-3 mb-8">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={jan}
                onChange={(e) => setJan(e.target.value)}
                placeholder="JANコードまたは型番"
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
            <label className="flex items-center gap-2 text-[10px] text-gray-500">
              <input type="checkbox" checked={arrivalAlert} onChange={(e) => setArrivalAlert(e.target.checked)} />
              入荷（在庫切れから復活）したら通知する
            </label>
            <button onClick={handleAdd} disabled={loading || !jan.trim()} className="w-full h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[10px] tracking-[0.2em] uppercase transition-colors">
              {loading ? '登録中...' : '監視リストに追加'}
            </button>
            {errorMsg && <p className="text-[10px] text-red-500">{errorMsg}</p>}
          </div>
        )}

        {mode === 'CSV' && (
          <div className="border border-gray-100 dark:border-gray-800 p-4 space-y-3 mb-8">
            <p className="text-[10px] text-gray-400 dark:text-gray-600 leading-relaxed">
              「コード」「しきい値（任意）」「入荷通知（任意・する/しない）」の3列のCSVをアップロードできます。テンプレート以外の形式でも取り込み可能です。
              <button onClick={downloadTemplate} className="text-blue-500 hover:text-blue-600 underline ml-1">テンプレートをダウンロード</button>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleCsvFile(file)
              }}
              className="w-full text-[11px] text-gray-500 file:mr-3 file:h-9 file:px-4 file:border file:border-gray-200 dark:file:border-gray-800 file:bg-white dark:file:bg-black file:text-gray-700 dark:file:text-gray-300 file:text-[10px] file:tracking-[0.1em] file:uppercase"
            />
            {csvFileName && <p className="text-[10px] text-blue-600">{csvFileName}</p>}
            {loading && mode === 'CSV' && <p className="text-[10px] text-gray-400">登録中...</p>}
            {csvResultMsg && <p className="text-[10px] text-blue-600">{csvResultMsg}</p>}
            {errorMsg && <p className="text-[10px] text-red-500">{errorMsg}</p>}
          </div>
        )}

        <p className="text-[9px] tracking-[0.15em] text-gray-400 dark:text-gray-600 uppercase mb-2">監視中（{list.length}/{WATCH_LIMIT}）</p>
        <div className="space-y-2">
          {list.length === 0 && (
            <p className="text-[11px] text-gray-400 dark:text-gray-600">監視中の商品はまだありません。</p>
          )}
          {list.map((item) => (
            <div key={item.jan} className="border border-gray-100 dark:border-gray-800 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-gray-900 dark:text-white truncate">{item.name || item.jan}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-600 font-mono">{item.jan} {item.lastPrice ? `・現在 ¥${item.lastPrice.toLocaleString()}` : '・在庫切れ中'} ・{item.threshold}円以上で通知{item.arrivalAlert ? '・入荷通知ON' : ''}</p>
              </div>
              <button onClick={() => handleDelete(item.jan)} className="shrink-0 text-[9px] tracking-[0.1em] text-gray-400 dark:text-gray-600 hover:text-red-500 uppercase">削除</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
