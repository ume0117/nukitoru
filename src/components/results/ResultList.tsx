'use client'

import { useState } from 'react'
import type { ScanResult } from '@/types'
import { ResultItem } from './ResultItem'
import { cn } from '@/lib/utils/cn'

interface ResultListProps {
  results: ScanResult[]
  onDelete: (id: string) => void
  onClear: () => void
}

export function ResultList({ results, onDelete, onClear }: ResultListProps) {
  const [allCopied, setAllCopied] = useState(false)

  if (results.length === 0) return null

  const handleCopyAll = async () => {
    const text = results.map((r) => r.value).join('\n')
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
    <section aria-label="検出結果" className="space-y-3">
      {/* ヘッダー行 */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          検出結果{' '}
          <span className="text-blue-600 dark:text-blue-400">
            {results.length} 件
          </span>
        </h2>

        <div className="flex items-center gap-2">
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
            aria-label="結果を全てクリア"
          >
            クリア
          </button>
        </div>
      </div>

      {/* 結果カードリスト */}
      <ul className="space-y-2" role="list">
        {results.map((result) => (
          <li key={result.id}>
            <ResultItem result={result} onDelete={onDelete} />
          </li>
        ))}
      </ul>
    </section>
  )
}
