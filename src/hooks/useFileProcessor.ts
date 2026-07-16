'use client'

import { useState, useCallback, useEffect } from 'react'
import type { ScanResult, ScanProgress } from '@/types'
import { validateFile } from '@/lib/utils/validation'
import { scanCanvas, imageFileToCanvas } from '@/lib/scanner/scanner'
import { processPdf } from '@/lib/pdf/processor'
import { deduplicateResults } from '@/lib/utils/dedup'

// ============================================================
// localStorage キー・ヘルパー
// ============================================================
const STORAGE_KEY = 'nukitoru_results'

function saveResults(results: ScanResult[]) {
  try {
    if (results.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(results))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {}
}

function loadResults(): ScanResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ScanResult[]
  } catch {
    return []
  }
}

// ============================================================
// 型定義
// ============================================================
interface ProcessorState {
  results: ScanResult[]
  progress: ScanProgress
  error: string | null
}

const INITIAL_STATE: ProcessorState = {
  results: [],
  progress: { current: 0, total: 0, status: 'idle', message: '' },
  error: null,
}

// ============================================================
// フック
// ============================================================
export function useFileProcessor() {
  // 初回レンダリング時にlocalStorageから直接読み込む（IDLE状態を表示しない）
  const [state, setState] = useState<ProcessorState>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      if (raw) {
        const saved = JSON.parse(raw) as ScanResult[]
        if (saved.length > 0) {
          return {
            results: saved,
            error: null,
            progress: {
              current: 1,
              total: 1,
              status: 'done' as const,
              message: `${saved.length} 件のコードを検出しました`,
            },
          }
        }
      }
    } catch {}
    return INITIAL_STATE
  })

  // 起動時にlocalStorageから結果を復元
  useEffect(() => {
    const saved = loadResults()
    if (saved.length > 0) {
      setState({
        results: saved,
        error: null,
        progress: {
          current: 1,
          total: 1,
          status: 'done',
          message: `${saved.length} 件のコードを検出しました`,
        },
      })
    }
  }, [])

  // PWAが前面に戻った時にlocalStorageから復元（iOS対応）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const saved = loadResults()
        if (saved.length > 0) {
          setState(prev => {
            if (prev.results.length === 0) {
              return {
                results: saved,
                error: null,
                progress: {
                  current: 1,
                  total: 1,
                  status: 'done',
                  message: `${saved.length} 件のコードを検出しました`,
                },
              }
            }
            return prev
          })
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // ページ離脱時に確実に保存（beforeunload）
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveResults(state.results)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [state.results])

  /** ファイルを受け取ってスキャンを実行する */
  const processFile = useCallback(async (file: File) => {
    const validation = validateFile(file)
    if (!validation.valid) {
      setState((prev) => ({ ...prev, error: validation.error ?? 'ファイルエラー' }))
      return
    }

    setState((prev) => ({
      ...prev,
      error: null,
      progress: { current: 0, total: 1, status: 'scanning', message: '解析を開始しています...' },
    }))

    const startMs = Date.now()

    try {
      let results: ScanResult[]

      if (validation.fileType === 'pdf') {
        results = await processPdf(file, (current, total, message) => {
          setState((prev) => ({
            ...prev,
            progress: { current, total, status: 'scanning', message },
          }))
        })
      } else {
        setState((prev) => ({
          ...prev,
          progress: { ...prev.progress, message: '画像を解析中...' },
        }))
        const canvas = await imageFileToCanvas(file)
        results = await scanCanvas(canvas)
      }

      const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1)
      const dedupedResults = deduplicateResults(results)

      // 即座にlocalStorageに同期保存（ページ離脱前に確実に保存）
      setState((prev) => {
        const merged = [...prev.results, ...dedupedResults]
        saveResults(merged)
        return {
          results: merged,
        error: null,
        progress: {
          current: 1,
          total: 1,
          status: 'done',
          message:
            dedupedResults.length > 0
              ? `${dedupedResults.length} 件のコードを検出しました（${elapsedSec} 秒）`
              : `コードが見つかりませんでした（${elapsedSec} 秒）`,
          },
        }
      })
    } catch (err) {
      setState({
        results: [],
        error: err instanceof Error ? err.message : '解析中にエラーが発生しました',
        progress: { current: 0, total: 0, status: 'error', message: '' },
      })
    }
  }, [])

  /** 特定の結果を削除する */
  const deleteResult = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      results: prev.results.filter((r) => r.id !== id),
    }))
  }, [])

  /** カメラスキャン結果を追加する */
  const addResults = useCallback((newResults: ScanResult[]) => {
    saveResults(newResults)
    setState({
      results: newResults,
      error: null,
      progress: {
        current: 1,
        total: 1,
        status: 'done',
        message: `${newResults.length} 件のコードを検出しました`,
      },
    })
  }, [])

  /** 全結果をクリアして初期状態に戻す */
  const clearAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setState(INITIAL_STATE)
  }, [])

  return {
    results: state.results,
    progress: state.progress,
    error: state.error,
    isScanning: state.progress.status === 'scanning',
    processFile,
    addResults,
    deleteResult,
    clearAll,
  }
}
