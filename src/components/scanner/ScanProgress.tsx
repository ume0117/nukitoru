import { cn } from '@/lib/utils/cn'
import type { ScanStatus } from '@/types'

interface ScanProgressProps {
  current: number
  total: number
  message: string
  status: ScanStatus
}

export function ScanProgress({ current, total, message, status }: ScanProgressProps) {
  if (status === 'idle') return null

  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full space-y-2.5 py-1"
    >
      {/* メッセージ行 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {status === 'scanning' && (
            <span
              className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0"
              aria-hidden="true"
            />
          )}
          {status === 'done' && (
            <span
              className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 12 12">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
              </svg>
            </span>
          )}
          {status === 'error' && (
            <span
              className="w-3.5 h-3.5 rounded-full bg-red-500 flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <span className="text-white text-[8px] font-bold leading-none">!</span>
            </span>
          )}

          <span
            className={cn(
              'text-sm font-medium truncate',
              status === 'scanning' && 'text-blue-600 dark:text-blue-400',
              status === 'done'     && 'text-emerald-600 dark:text-emerald-400',
              status === 'error'    && 'text-red-600 dark:text-red-400',
            )}
          >
            {message}
          </span>
        </div>

        {status === 'scanning' && total > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums shrink-0">
            {current} / {total}
          </span>
        )}
      </div>

      {/* プログレスバー（スキャン中のみ） */}
      {status === 'scanning' && (
        <div
          className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.max(4, pct)}%` }}
          />
        </div>
      )}
    </div>
  )
}
