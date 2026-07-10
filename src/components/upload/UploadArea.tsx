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
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
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
        onChange={onChange}
        className="sr-only"
        tabIndex={-1}
      />

      {/* アイコン */}
      <svg
        className={cn(
          'w-6 h-6 transition-colors',
