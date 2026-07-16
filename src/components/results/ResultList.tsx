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
  QR_CODE:  'QR Code',
  EAN_13:   'JAN Code',
  EAN_8:    'EAN-8',
  CODE_128: 'CODE128',
}

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

export function ResultList({ results, onDelete, onClear }: ResultListProps) {
  const [allCopied, setAllCopied] = useState(false)

  if (results.length === 0) return null

  const sorted = [...results].sort(
    (a, b) => getResultPriority(a.type, a.value) - getResultPriority(b.type, b.value),
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
    <section aria-label="Results" className="space-y-3">
      <div className="space-y-2">
        <span className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">
          Results <span className="text-blue-600">{results.length}</span>
        </span>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadCSV(sorted)} className="h-8 px-3 border border-blue-600 text-blue-600 text-[10px] tracking-[0.15em] uppercase font-medium hover:bg-blue-600 hover:text-white transition-colors">↓ CSV</button>
          <button onClick={handleCopyAll} className={cn('h-8 px-3 border text-[10px] tracking-[0.15em] uppercase font-medium transition-colors', allCopied ? 'border-blue-600 text-blue-600' : 'border-gray-400 dark:border-gray-600 text-gray-400 dark:text-gray-600 hover:border-blue-600 hover:text-blue-600')}>
            {allCopied ? '✓ Copied' : 'Copy All'}
          </button>
          <button onClick={onClear} className="h-8 px-3 border border-gray-400 dark:border-gray-600 text-gray-400 dark:text-gray-600 text-[10px] tracking-[0.15em] uppercase font-medium hover:border-red-500 hover:text-red-500 transition-colors">Clear</button>
        </div>
      </div>
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
