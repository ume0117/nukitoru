'use client'

const WORKER_URL = 'https://nukitoru-api.ume0117.workers.dev'
import * as XLSX from 'xlsx'

import { useState } from 'react'
import type { ScanResult } from '@/types'
import { ResultItem } from './ResultItem'
import { getResultPriority } from '@/lib/utils/qr-content'
import { cn } from '@/lib/utils/cn'

interface ResultListProps {
  results: ScanResult[]
  onDelete: (id: string) => void
  onClear: () => void
}

const TYPE_LABEL: Record<string, string> = {
  QR_CODE:  'QR Code',
  EAN_13:   'JAN Code',
  EAN_8:    'EAN-8',
  CODE_128: 'CODE128',
}

type FilterType = 'ALL' | 'JAN' | 'QR' | 'URL' | 'CODE128'

function downloadCSV(results: ScanResult[]) {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const datetime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  const filename = `nukitoru_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.csv`
  const header = 'Type,Value,Page,DateTime'
  const rows = results.map(r => {
    const type = TYPE_LABEL[r.type] ?? r.type
    const page = r.page != null ? String(r.page) : ''
    const value = r.value.includes(',') ? `"${r.value}"` : r.value
    return `${type},${value},${page},${datetime}`
  })
  const bom = '\uFEFF'
  const csv = bom + [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function applyFilter(results: ScanResult[], filter: FilterType): ScanResult[] {
  if (filter === 'ALL') return results
  if (filter === 'JAN') return results.filter(r => r.type === 'EAN_13' || r.type === 'EAN_8')
  if (filter === 'QR') return results.filter(r => r.type === 'QR_CODE')
  if (filter === 'URL') return results.filter(r => r.type === 'QR_CODE' && r.value.startsWith('http'))
  if (filter === 'CODE128') return results.filter(r => r.type === 'CODE_128')
  return results
}


function downloadExcel(results: ScanResult[]) {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const filename = `nukitoru_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.xlsx`
  const datetime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  const data = results.map(r => ({
    'Type': TYPE_LABEL[r.type] ?? r.type,
    'Value': r.value,
    'Page': r.page != null ? r.page : '',
    'DateTime': datetime,
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'NUKITORU')
  XLSX.writeFile(wb, filename)
}


async function downloadCSVWithPrice(results: ScanResult[]) {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const datetime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  const filename = `nukitoru_price_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.csv`

  const janResults = results.filter(r => r.type === 'EAN_13' || r.type === 'EAN_8')
  const otherResults = results.filter(r => r.type !== 'EAN_13' && r.type !== 'EAN_8')

  // JAN価格を並列取得
  const priceMap: Record<string, {name: string, rakutenMin: number | null, yahooMin: number | null, overallMin: number | null}> = {}
  await Promise.all(janResults.map(async (r) => {
    try {
      const res = await fetch(WORKER_URL + '/?jan=' + r.value)
      const data = await res.json()
      const rakutenMin = data.rakuten?.length > 0 ? Math.min(...data.rakuten.map((i: {price: number}) => i.price)) : null
      const yahooMin = data.yahoo?.length > 0 ? Math.min(...data.yahoo.map((i: {price: number}) => i.price)) : null
      const allPrices = [rakutenMin, yahooMin].filter(Boolean) as number[]
      priceMap[r.value] = {
        name: data.rakuten?.[0]?.name ?? '',
        rakutenMin,
        yahooMin,
        overallMin: allPrices.length > 0 ? Math.min(...allPrices) : null,
      }
    } catch {}
  }))

  const bom = '\uFEFF'
  const header = 'Type,Value,ProductName,RakutenMinPrice,YahooMinPrice,OverallMinPrice,Page,DateTime'
  const rows = results.map(r => {
    const type = TYPE_LABEL[r.type] ?? r.type
    const page = r.page != null ? String(r.page) : ''
    const value = r.value.includes(',') ? `"${r.value}"` : r.value
    const p = priceMap[r.value]
    const name = p?.name ? `"${p.name.replace(/"/g, '""')}"` : ''
    const rakutenMin = p?.rakutenMin ? `¥${p.rakutenMin.toLocaleString()}` : ''
    const yahooMin = p?.yahooMin ? `¥${p.yahooMin.toLocaleString()}` : ''
    const overallMin = p?.overallMin ? `¥${p.overallMin.toLocaleString()}` : ''
    return `${type},${value},${name},${rakutenMin},${yahooMin},${overallMin},${page},${datetime}`
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

function getInitialFilter(results: ScanResult[]): FilterType {
  const types = new Set(results.map(r => r.type))
  if (types.size === 1) {
    if (types.has('EAN_13') || types.has('EAN_8')) return 'JAN'
    if (types.has('QR_CODE')) {
      const allURL = results.every(r => r.value.startsWith('http'))
      if (allURL) return 'URL'
    }
    if (types.has('CODE_128')) return 'CODE128'
  }
  return 'ALL'
}

export function ResultList({ results, onDelete, onClear }: ResultListProps) {
  const [allCopied, setAllCopied] = useState(false)
  const [filter, setFilter] = useState<FilterType>(() => getInitialFilter(results))
  const [priceLoading, setPriceLoading] = useState(false)

  if (results.length === 0) return null

  const sorted = [...results].sort(
    (a, b) => getResultPriority(a.type, a.value) - getResultPriority(b.type, b.value),
  )

  const filtered = applyFilter(sorted, filter)

  const handleCopyAll = async () => {
    const text = filtered.map((r) => r.value).join('\n')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setAllCopied(true)
    setTimeout(() => setAllCopied(false), 2000)
  }

  const filters: { key: FilterType; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'JAN', label: 'JAN' },
    { key: 'URL', label: 'URL' },
    { key: 'QR', label: 'QR' },
    { key: 'CODE128', label: 'CODE128' },
  ]

  return (
    <section aria-label="Results" className="space-y-3">
      <div className="space-y-2">
        <span className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">
          Results <span className="text-blue-600">{filtered.length}</span>
          {filter !== 'ALL' && <span className="text-gray-400"> / {results.length}</span>}
        </span>

        {/* フィルタータブ */}
        <div className="flex gap-1.5 flex-wrap">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'h-7 px-2.5 text-[9px] tracking-[0.15em] uppercase font-medium transition-colors border',
                filter === f.key
                  ? 'border-blue-600 text-blue-600 bg-blue-600/10'
                  : 'border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-600 hover:border-blue-600 hover:text-blue-600'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* アクションボタン */}
        <div className="flex items-center gap-2">
          <button onClick={() => downloadCSV(filtered)} className="h-8 px-3 border border-blue-600 text-blue-600 text-[10px] tracking-[0.15em] uppercase font-medium hover:bg-blue-600 hover:text-white transition-colors">↓ CSV</button>
          <button onClick={async () => { setPriceLoading(true); await downloadCSVWithPrice(filtered); setPriceLoading(false) }} disabled={priceLoading} className="h-8 px-3 border border-blue-600 text-blue-600 text-[10px] tracking-[0.15em] uppercase font-medium hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-50">{priceLoading ? '取得中...' : '↓ CSV+価格'}</button>
          <button onClick={() => downloadExcel(filtered)} className="h-8 px-3 border border-green-600 text-green-600 text-[10px] tracking-[0.15em] uppercase font-medium hover:bg-green-600 hover:text-white transition-colors">↓ Excel</button>
          <button onClick={handleCopyAll} className={cn('h-8 px-3 border text-[10px] tracking-[0.15em] uppercase font-medium transition-colors', allCopied ? 'border-blue-600 text-blue-600' : 'border-gray-400 dark:border-gray-600 text-gray-400 dark:text-gray-600 hover:border-blue-600 hover:text-blue-600')}>
            {allCopied ? '✓ Copied' : 'Copy All'}
          </button>
          <button onClick={onClear} className="h-8 px-3 border border-gray-400 dark:border-gray-600 text-gray-400 dark:text-gray-600 text-[10px] tracking-[0.15em] uppercase font-medium hover:border-red-500 hover:text-red-500 transition-colors">Clear</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-[10px] tracking-[0.15em] text-gray-400 dark:text-gray-600 uppercase py-4 text-center">No results for this filter</p>
      ) : (
        <ul className="space-y-2" role="list">
          {filtered.map((result) => (
            <li key={result.id}>
              <ResultItem result={result} onDelete={onDelete} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
