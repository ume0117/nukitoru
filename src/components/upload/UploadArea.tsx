'use client'

import {
  useRef,
  useState,
  useCallback,
  type DragEvent,
  type ChangeEvent,
} from 'react'
import { cn } from '@/lib/utils/cn'

interface UploadAreaProps {
  onFileSelect: (file: File) => void
  isScanning: boolean
}

export function UploadArea({ onFileSelect, isScanning }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (file: File) => {
      if (!isScanning) onFileSelect(file)
    },
    [onFileSelect, isScanning],
  )

  // ---- Drag & Drop (PC のみ) ----
  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // ---- File input ----
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = '' // 同一ファイルの再選択を許可
  }

  const onClick = () => {
    if (!isScanning) inputRef.current?.click()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="ファイルを選択するかドラッグ&ドロップ"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={cn(
        'relative w-full rounded-2xl border-2 border-dashed',
        'flex flex-col items-center justify-center gap-3',
        'min-h-[200px] md:min-h-[240px]',
        'cursor-pointer select-none transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        // 通常状態
        'bg-white dark:bg-gray-900',
        'border-gray-300 dark:border-gray-700',
        'hover:border-blue-400 dark:hover:border-blue-500',
        'hover:bg-blue-50/40 dark:hover:bg-blue-950/20',
        // ドラッグ中
        isDragging && [
          'border-blue-500 dark:border-blue-400',
          'bg-blue-50 dark:bg-blue-950/30',
          'scale-[1.01]',
        ],
        // スキャン中は無効化
        isScanning && 'opacity-50 cursor-not-allowed pointer-events-none',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp"
        onChange={onChange}
        className="sr-only"
        tabIndex={-1}
      />

      {/* アップロードアイコン */}
      <div
        className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center transition-colors',
          isDragging
            ? 'bg-blue-100 dark:bg-blue-900/50'
            : 'bg-gray-100 dark:bg-gray-800',
        )}
      >
        <svg
          className={cn(
            'w-7 h-7 transition-colors',
            isDragging
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-400 dark:text-gray-500',
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
      </div>

      {/* テキスト */}
      <div className="text-center px-6">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {isDragging ? (
            'ここにドロップ'
          ) : (
            <>
              <span className="hidden md:inline">ドラッグ&ドロップ、または</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">
                {' '}ファイルを選択
              </span>
            </>
          )}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 text-center leading-relaxed">
          PDF（最大 50 MB）<br />
          JPG / PNG / WEBP（最大 20 MB）
        </p>
      </div>

      {/* 対応フォーマットバッジ */}
      <div className="flex flex-wrap justify-center gap-1.5 px-6">
        {['QR Code', 'JAN / EAN-13', 'EAN-8', 'CODE 128'].map((label) => (
          <span
            key={label}
            className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
