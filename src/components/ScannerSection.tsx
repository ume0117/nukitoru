'use client'

import { useRef, useEffect, useState } from 'react'
import { useFileProcessor } from '@/hooks/useFileProcessor'
import { UploadArea } from '@/components/upload/UploadArea'
import { ManualSearch } from '@/components/search/ManualSearch'
import { CameraScanner } from '@/components/camera/CameraScanner'
import { ScanProgress } from '@/components/scanner/ScanProgress'
import { ResultList } from '@/components/results/ResultList'
import { cn } from '@/lib/utils/cn'
import type { ScanResult } from '@/types'

// ============================================================
// コンパクトアップロードボタン（結果表示後に使用）
// ============================================================
function CompactUploadButton({ onFile }: { onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
      <button
        onClick={() => ref.current?.click()}
        className={cn(
          'w-full h-12 rounded-xl border-2 border-dashed',
          'flex items-center justify-center gap-2',
          'text-sm text-gray-400 dark:text-gray-500',
          'border-gray-200 dark:border-gray-700',
          'hover:border-blue-400 hover:text-blue-600',
          'dark:hover:border-blue-500 dark:hover:text-blue-400',
          'transition-all duration-200',
        )}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        別のPDF・画像を選択
      </button>
    </>
  )
}

// ============================================================
// エラー表示
// ============================================================
function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 p-4 rounded-xl text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400"
    >
      <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <span>{message}</span>
    </div>
  )
}

// ============================================================
// メインコンポーネント
// ============================================================
export function ScannerSection() {
  const {
    results,
    progress,
    error,
    isScanning,
    processFile,
    addResults,
    deleteResult,
    clearAll,
  } = useFileProcessor()

  const resultRef = useRef<HTMLDivElement>(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  const isIdle    = progress.status === 'idle'
  const isDone    = progress.status === 'done'
  const hasResults = results.length > 0

  const handleCameraResult = (newResults: ScanResult[]) => {
    addResults(newResults)
  }

  // スキャン完了時に結果セクションへ smooth scroll
  useEffect(() => {
    if (isDone && hasResults && resultRef.current) {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }
  }, [isDone, hasResults])

  return (
    <div>

      {/* ── ヒーローセクション（idle のみ表示・それ以外は折りたたむ） ── */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-500 ease-in-out',
          isIdle
            ? 'max-h-[500px] opacity-100 pt-2 pb-2'
            : 'max-h-0 opacity-0 pointer-events-none',
        )}
        aria-hidden={!isIdle}
      >
        <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
          PDF・画像からURLを一発抽出
        </h1>
<div className="flex flex-wrap gap-2 mt-4">
          {[
            '🔗 URLをすぐ開ける',
            '📄 PDF全ページ対応',
            '🔒 プライバシー安全',
            '⚡ ブラウザ内処理',
          ].map((label) => (
            <span
              key={label}
              className="text-xs px-3 py-1 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 shadow-sm"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── スキャン中・idle: アップロードエリア + 進捗 ── */}
      {!isDone && (
        <div className="space-y-4">
          {/* カメラスキャンボタン */}
          <button
            onClick={() => setCameraOpen(true)}
            className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 flex items-center justify-center gap-2 text-sm font-semibold text-white transition-colors shadow-sm"
          >
            <span className="text-base">📷</span>
            カメラでスキャン
          </button>
          <UploadArea onFileSelect={processFile} isScanning={isScanning} />
          <ManualSearch />
          {error && <ErrorAlert message={error} />}
          {progress.status !== 'idle' && (
            <ScanProgress
              current={progress.current}
              total={progress.total}
              message={progress.message}
              status={progress.status}
            />
          )}
        </div>
      )}

      {/* ── スキャン完了: 結果が主役 ── */}
      {isDone && (
        <div ref={resultRef} className="space-y-4 pt-2">

          {/* 結果なし：フルアップロードエリアを表示（ドラッグ&ドロップ対応） */}
          {!hasResults && (
            <div className="space-y-3">
              <div className="text-center space-y-2 py-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  コードが見つかりませんでした
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-600">
                  画像が小さい・ぼけている場合は高解像度の画像をお試しください
                </p>
                <button
                  onClick={clearAll}
                  className="text-xs text-blue-500 dark:text-blue-400 underline underline-offset-2 hover:text-blue-700 transition-colors"
                >
                  ← トップに戻る
                </button>
              </div>
              <UploadArea onFileSelect={processFile} isScanning={isScanning} />
            </div>
          )}

          {/* 結果リスト（URL > QR > JAN > CODE128 の順） */}
          {hasResults && (
            <div className="space-y-2">
              <ResultList
                results={results}
                onDelete={deleteResult}
                onClear={clearAll}
              />
              <div className="text-center pt-1">
                <button
                  onClick={clearAll}
                  className="text-xs text-blue-500 dark:text-blue-400 underline underline-offset-2 hover:text-blue-700 transition-colors"
                >
                  ← トップに戻る
                </button>
              </div>
            </div>
          )}

          {/* 区切り + 別ファイル選択（結果ありの場合） */}
          {hasResults && (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-4">
              <ManualSearch />
              <UploadArea onFileSelect={processFile} isScanning={isScanning} />
            </div>
          )}
        </div>
      )}
      {/* カメラスキャナー */}
      {cameraOpen && (
        <CameraScanner
          onResult={handleCameraResult}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  )
}
