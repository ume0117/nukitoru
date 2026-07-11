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
      <input ref={ref} type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
      <button onClick={() => ref.current?.click()} className={cn('w-full h-12 border',
