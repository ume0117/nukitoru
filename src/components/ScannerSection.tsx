'use client'

import { useFileProcessor } from '@/hooks/useFileProcessor'
import { UploadArea } from '@/components/upload/UploadArea'
import { ScanProgress } from '@/components/scanner/ScanProgress'
import { ResultList } from '@/components/results/ResultList'

/**
 * ScannerSection
 *
 * クライアントサイドのスキャン機能を一箇所に集約するコンポーネント。
 * page.tsx（サーバーコンポーネント）からここだけを 'use client' として分離することで
 * SEO 用の静的テキストをサーバーレンダリングしながら、
 * インタラクティブ部分はクライアントで動作させる。
 */
export function ScannerSection() {
  const {
    results,
    progress,
    error,
    isScanning,
    processFile,
    deleteResult,
    clearAll,
  } = useFileProcessor()

  return (
    <div className="space-y-4">
      {/* ── アップロードエリア ── */}
      <UploadArea onFileSelect={processFile} isScanning={isScanning} />

      {/* ── エラーメッセージ ── */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-4 rounded-xl text-sm
            bg-red-50 dark:bg-red-950/30
            border border-red-200 dark:border-red-900
            text-red-700 dark:text-red-400"
        >
          <svg
            className="w-4 h-4 mt-0.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* ── 進捗インジケーター ── */}
      {progress.status !== 'idle' && (
        <ScanProgress
          current={progress.current}
          total={progress.total}
          message={progress.message}
          status={progress.status}
        />
      )}

      {/* ── 検出結果なし（スキャン完了後のみ表示） ── */}
      {progress.status === 'done' && results.length === 0 && (
        <div className="text-center py-8 space-y-2">
          <div
            className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto"
            aria-hidden="true"
          >
            <svg
              className="w-6 h-6 text-gray-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            コードが見つかりませんでした
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-600">
            画像が小さい・ぼけている場合は高解像度の画像をお試しください
          </p>
        </div>
      )}

      {/* ── 検出結果リスト ── */}
      <ResultList
        results={results}
        onDelete={deleteResult}
        onClear={clearAll}
      />
    </div>
  )
}
