'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import type { ScanResult } from '@/types'
import { BARCODE_LABELS } from '@/types'

// コード種別ごとのスタイル定義
const TYPE_STYLE: Record<
  string,
  { badge: string; dot: string }
> = {
  QR_CODE: {
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    dot:   'bg-violet-500',
  },
  EAN_13: {
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    dot:   'bg-blue-500',
  },
  EAN_8: {
    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    dot:   'bg-teal-500',
  },
  CODE_128: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    dot:   'bg-amber-500',
  },
}

interface ResultItemProps {
  result: ScanResult
  onDelete: (id: string) => void
}

export function ResultItem({ result, onDelete }: ResultItemProps) {
  const [copied, setCopied] = useState(false)

  const style = TYPE_STYLE[result.type] ?? TYPE_STYLE.CODE_128
  const label = BARCODE_LABELS[result.type] ?? result.type

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // フォールバック（古い Android 等）
      const ta = document.createElement('textarea')
      ta.value = result.value
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-3.5 rounded-xl',
        'bg-white dark:bg-gray-900',
        'border border-gray-100 dark:border-gray-800',
        'shadow-sm hover:shadow-md transition-shadow duration-150',
      )}
    >
      {/* 種別バッジ */}
      <div className="shrink-0 pt-0.5">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
            'text-[11px] font-semibold border whitespace-nowrap',
            style.badge,
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', style.dot)} aria-hidden="true" />
          {label}
        </span>
        {result.page != null && (
          <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1 pl-1">
            P.{result.page}
          </p>
        )}
      </div>

      {/* 値（モノスペースフォント） */}
      <p
        className="flex-1 min-w-0 font-mono text-sm text-gray-800 dark:text-gray-100 break-all leading-relaxed pt-0.5"
        aria-label={`コード値: ${result.value}`}
      >
        {result.value}
      </p>

      {/* アクション */}
      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
        <button
          onClick={handleCopy}
          aria-label={copied ? 'コピー済み' : 'コードをコピー'}
          className={cn(
            'min-w-[64px] h-8 px-3 rounded-lg text-xs font-medium transition-all duration-150',
            copied
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
              : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300',
          )}
        >
          {copied ? '✓ コピー済' : 'コピー'}
        </button>

        <button
          onClick={() => onDelete(result.id)}
          aria-label="この結果を削除"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-150"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
