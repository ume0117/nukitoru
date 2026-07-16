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
  onCameraClick?: () => void
}

export function UploadArea({ onFileSelect, isScanning, onCameraClick }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (file: File) => {
      if (!isScanning) onFileSelect(file)
    },
    [onFileSelect, isScanning],
  )

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
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      Array.from(files).forEach(file => handleFile(file))
    }
  }

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      Array.from(files).forEach(file => handleFile(file))
    }
    e.target.value = ''
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
        'relative w-full border',
        'flex flex-col items-center justify-center gap-4',
        'min-h-[200px] py-8',
        'cursor-pointer select-none transition-all duration-300',
        'focus-visible:outline-none',
        isDragging
          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/10'
          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-black hover:border-blue-600 dark:hover:border-blue-600',
        isScanning && 'opacity-40 cursor-not-allowed pointer-events-none',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp"
        multiple
        onChange={onChange}
        className="sr-only"
        tabIndex={-1}
      />

      <svg
        className={cn(
          'w-6 h-6 transition-colors',
          isDragging ? 'text-blue-600' : 'text-gray-300 dark:text-gray-700',
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
        />
      </svg>

      <div className="text-center space-y-1.5">
        <p className="text-[11px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">
          {isDragging ? 'Drop here' : (
            <>
              <span className="hidden md:inline">Drag & drop or </span>
              <span className="text-blue-600">Select file</span>
            </>
          )}
        </p>
        <p className="text-[10px] tracking-widest text-gray-300 dark:text-gray-700 uppercase">
          PDF 50mb · JPG / PNG / WEBP 20mb
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {['QR', 'JAN / EAN-13', 'EAN-8', 'CODE 128'].map((label) => (
          <span
            key={label}
            className="text-[9px] tracking-[0.15em] px-2 py-0.5 border border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-600 uppercase"
          >
            {label}
          </span>
        ))}
      </div>

      {onCameraClick && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onCameraClick()
          }}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] tracking-[0.15em] uppercase transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Camera Scan
        </button>
      )}
    </div>
  )
}
