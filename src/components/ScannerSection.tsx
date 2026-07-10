'use client'

import { useRef, useEffect, useState } from 'react'
import { useFileProcessor } from '@/hooks/useFileProcessor'
import { UploadArea } from '@/components/upload/UploadArea'
import { ManualSearch } from '@/components/search/ManualSearch'
import { CameraScanner } from '@/components/camera/CameraScanner'
import { InventoryScanner, type InventorySession } from '@/components/camera/InventoryScanner'
import { InventoryHistory, saveToHistory } from '@/components/inventory/InventoryHistory'
import { ScanProgress } from '@/components/scanner/ScanProgress'
import { ResultList } from '@/components/results/ResultList'
import { cn } from '@/lib/utils/cn'
import { deduplicateResults } from '@/lib/utils/dedup'
import type { ScanResult } from '@/types'

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
          'w-full h-12 border',
          'flex items-center justify-center gap-2',
          'text-[11px] tracking-[0.2em] uppercase text-gray-400 dark:text-gray-600',
          'border-gray-100 dark:border-gray-800',
          'hover:border-blue-600 hover:text-blue-600',
          'transition-all duration-200',
        )}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Select another file
      </button>
    </>
  )
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 p-4 text-sm border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400"
    >
      <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <span>{message}</span>
    </div>
  )
}

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
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [inventoryResult, setInventoryResult] = useState<InventorySession | null>(null)
  const [showInventoryHistory, setShowInventoryHistory] = useState(false)
  const [showInventoryComplete, setShowInventoryComplete] = useState(false)

  const handleInventoryFinish = (session: InventorySession) => {
    setInventoryOpen(false)
    saveToHistory(session)
    setInventoryResult(session)
    setShowInventoryComplete(true)
  }

  const isIdle    = progress.status === 'idle'
  const isDone    = progress.status === 'done'
  const hasResults = results.length > 0

  const handleDelete = (id: string) => {
    if (results.length === 1) {
      clearAll()
    } else {
      deleteResult(id)
    }
  }

  const handleCameraResult = (newResults: ScanResult[]) => {
    const merged = deduplicateResults([...newResults, ...results])
    addResults(merged)
  }

  useEffect(() => {
    if (isDone && hasResults && resultRef.current) {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }
  }, [isDone, hasResults])

  return (
    <div>
      {/* ヒーロー */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-500 ease-in-out',
          isIdle
            ? 'max-h-[500px] opacity-100 pt-6 pb-4'
            : 'max-h-0 opacity-0 pointer-events-none',
        )}
        aria-hidden={!isIdle}
      >
        <h1 className="text-[11px] tracking-[0.3em] text-gray-400 dark:text-gray-600 uppercase">
          PDF · Image · Barcode Extractor
        </h1>
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            'URL open',
            'PDF all pages',
            'Privacy safe',
            'Browser only',
          ].map((label) => (
            <span
              key={label}
              className="text-[9px] tracking-[0.15em] px-2.5 py-1 border border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-600 uppercase"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* アップロード */}
      {!isDone && (
        <div className="space-y-3">
          <UploadArea onFileSelect={processFile} isScanning={isScanning} onCameraClick={() => setCameraOpen(true)} />
          <ManualSearch />
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setInventoryOpen(true)}
              className="flex-1 h-11 bg-black dark:bg-white hover:bg-gray-900 dark:hover:bg-gray-100 flex items-center justify-center gap-2 text-[11px] tracking-[0.2em] font-medium text-white dark:text-black uppercase transition-colors"
            >
              Inventory
            </button>
            <button
              onClick={() => setShowInventoryHistory(true)}
              className="h-11 px-4 border border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600 text-gray-400 dark:text-gray-600 text-[11px] tracking-[0.15em] uppercase transition-colors"
            >
              History
            </button>
          </div>
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

      {/* 結果 */}
      {isDone && (
        <div ref={resultRef} className="space-y-4 pt-2">
          {!hasResults && (
            <div className="space-y-3">
              <div className="text-center space-y-2 py-4">
                <p className="text-[11px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">
                  No code found
                </p>
                <p className="text-[10px] text-gray-300 dark:text-gray-700">
                  高解像度の画像をお試しください
                </p>
                <button
                  onClick={clearAll}
                  className="text-[10px] tracking-[0.15em] text-blue-600 uppercase underline underline-offset-2"
                >
                  ← Back
                </button>
              </div>
              <UploadArea onFileSelect={processFile} isScanning={isScanning} />
            </div>
          )}

          {hasResults && (
            <div className="space-y-2">
              <ResultList
                results={results}
                onDelete={handleDelete}
                onClear={clearAll}
              />
              <div className="text-center pt-1">
                <button
                  onClick={clearAll}
                  className="text-[10px] tracking-[0.15em] text-blue-600 uppercase underline underline-offset-2"
                >
                  ← Back
                </button>
              </div>
            </div>
          )}

          {hasResults && (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <ManualSearch />
            </div>
          )}
        </div>
      )}

      {/* 棚卸し履歴 */}
      {showInventoryHistory && (
        <InventoryHistory onClose={() => setShowInventoryHistory(false)} />
      )}

      {/* 棚卸し完了画面 */}
      {showInventoryComplete && inventoryResult && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-black flex flex-col items-center justify-center p-6 gap-5">
          <div className="text-[11px] tracking-[0.3em] text-gray-400 uppercase">Complete</div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white tracking-wide">
              棚卸しが完了しました
            </p>
            <p className="text-[10px] text-gray-400 tracking-wider">
              {new Date(inventoryResult.startedAt).toLocaleString('ja-JP')}<br/>
              {inventoryResult.items.reduce((s,i)=>s+i.count,0)} items · {inventoryResult.items.length} products
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <button
              onClick={() => {
                const bom = '\uFEFF'
                const header = 'JANコード,個数,最終スキャン日時'
                const rows = inventoryResult.items.map(i =>
                  `${i.result.value},${i.count},${new Date(i.lastScannedAt).toLocaleString('ja-JP')}`
                )
                const csv = bom + [header, ...rows].join('\n')
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                const d = new Date(inventoryResult.startedAt)
                a.download = `棚卸し_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.csv`
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-[11px] tracking-[0.2em] uppercase transition-colors"
            >
              Download CSV
            </button>
            <button
              onClick={() => { setShowInventoryComplete(false); setShowInventoryHistory(true) }}
              className="w-full h-12 border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 text-[11px] tracking-[0.2em] uppercase"
            >
              View History
            </button>
            <button
              onClick={() => { setShowInventoryComplete(false); setInventoryOpen(true) }}
              className="w-full h-12 border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 text-[11px] tracking-[0.2em] uppercase"
            >
              New Inventory
            </button>
            <button
              onClick={() => { setShowInventoryComplete(false); setInventoryResult(null) }}
              className="w-full h-10 text-gray-300 dark:text-gray-700 text-[10px] tracking-[0.15em] uppercase"
            >
              Back to top
            </button>
          </div>
        </div>
      )}

      {/* 棚卸しスキャナー */}
      {inventoryOpen && (
        <InventoryScanner
          onFinish={handleInventoryFinish}
          onClose={() => setInventoryOpen(false)}
        />
      )}

      {/* 棚卸し結果 */}
      {inventoryResult && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[11px] tracking-[0.2em] text-gray-600 dark:text-gray-400 uppercase">
                Inventory · <span className="text-blue-600">{inventoryResult.items.reduce((s,i)=>s+i.count,0)} items</span>
              </h2>
              <p className="text-[10px] text-gray-300 dark:text-gray-700 mt-0.5">
                {new Date(inventoryResult.startedAt).toLocaleString('ja-JP')}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const bom = '\uFEFF'
                  const header = 'JANコード,個数,最終スキャン日時'
                  const rows = inventoryResult.items.map(i =>
                    `${i.result.value},${i.count},${new Date(i.lastScannedAt).toLocaleString('ja-JP')}`
                  )
                  const csv = bom + [header, ...rows].join('\n')
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  const d = new Date(inventoryResult.startedAt)
                  a.download = `棚卸し_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="h-8 px-3 text-[10px] tracking-[0.15em] uppercase bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                CSV
              </button>
              <button
                onClick={() => { setInventoryResult(null); setInventoryOpen(true) }}
                className="h-8 px-3 text-[10px] tracking-[0.15em] uppercase border border-gray-100 dark:border-gray-800 text-gray-400"
              >
                Resume
              </button>
              <button
                onClick={() => setInventoryResult(null)}
                className="h-8 px-3 text-[10px] tracking-[0.15em] uppercase text-gray-300 dark:text-gray-700 hover:text-red-500 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            {inventoryResult.items.map((item, idx) => (
              <div key={idx} className="border border-gray-100 dark:border-gray-800 p-3 flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm text-gray-800 dark:text-gray-100 tracking-wider">{item.result.value}</p>
                  <p className="text-[10px] text-gray-300 dark:text-gray-700 tracking-wider mt-0.5">
                    {new Date(item.lastScannedAt).toLocaleTimeString('ja-JP')}
                  </p>
                </div>
                <span className="text-lg font-light text-blue-600 tracking-wider">×{item.count}</span>
              </div>
            ))}
          </div>
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
