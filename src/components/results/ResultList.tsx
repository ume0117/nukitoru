'use client'

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
  QR_CODE:  'QRコード',
  EAN_13:   'JANコード',
  EAN_8:    'EAN-8',
  CODE_128: 'CODE128',
}

function downloadCSV(results: ScanResult[]) {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const datetime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  const filename = `nukitoru_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.csv`

  const header = 'コード種別,コード値,ページ番号,検出日時'
  const rows = results.map(r => {
    const type = TYPE_LABEL[r.type] ?? r.type
    const page = r.page != null ? String(r.page) : ''
    const value = r.value.includes(',') ? `"${r.value}"` : r.value
    return `${type},${value},${page},${datetime}`
  })

  // UTF-8 BOM付き（Excelで文字化けなし）
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

export function ResultList({ results, onDelete, onClear }: ResultListProps) {
  const [allCopied, setAllCopied] = useState(false)

  if (results.length === 0) return null

  const sorted = [...results].sort(
    (a, b) =>
      getResultPriority(a.type, a.value) - getResultPriority(b.type, b.value),
  )

  const handleCopyAll = async () => {
    const text = sorted.map((r) => r.value).join('\n')
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

  return (
    <section aria-label="見つかったURL・コード" className="space-y-3">
      {/* ヘッダー行 */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          見つかったURL・コード{' '}
          <span className="text-blue-600 dark:text-blue-400">
            {results.length} 件
          </span>
        </h2>

        <div className="flex items-center gap-2">
          {/* CSV出力ボタン */}
          <button
            onClick={() => downloadCSV(sorted)}
            className="h-8 px-3 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            aria-label="CSVダウンロード"
          >
            ↓ CSV
          </button>

          <button
            onClick={handleCopyAll}
            className={cn(
              'h-8 px-3 rounded-lg text-xs font-medium transition-all duration-150',
              allCopied
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300',
            )}
            aria-label="全ての結果をコピー"
          >
            {allCopied ? '✓ コピー済' : '全てコピー'}
          </button>

          <button
            onClick={onClear}
            className="h-8 px-3 rounded-lg text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-950/30 transition-all duration-150"
            aria-label="結果をクリア"
          >
            クリア
          </button>
        </div>
      </div>

      {/* 結果カードリスト */}
      <ul className="space-y-2" role="list">
        {sorted.map((result) => (
          <li key={result.id}>
            <ResultItem result={result} onDelete={onDelete} />
          </li>
        ))}
      </ul>
    </section>
  )
}
