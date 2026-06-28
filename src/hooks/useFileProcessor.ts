'use client'

import { useState, useCallback } from 'react'
import type { ScanResult, ScanProgress } from '@/types'
import { validateFile } from '@/lib/utils/validation'
import { scanCanvas, imageFileToCanvas } from '@/lib/scanner/scanner'
import { processPdf } from '@/lib/pdf/processor'

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
  const [state, setState] = useState<ProcessorState>(INITIAL_STATE)

  /** ファイルを受け取ってスキャンを実行する */
  const processFile = useCallback(async (file: File) => {
    // バリデーション
    const validation = validateFile(file)
    if (!validation.valid) {
      setState((prev) => ({ ...prev, error: validation.error ?? 'ファイルエラー' }))
      return
    }

    // スキャン開始（結果をリセット）
    setState({
      results: [],
      error: null,
      progress: { current: 0, total: 1, status: 'scanning', message: '解析を開始しています...' },
    })

    const startMs = Date.now()

    try {
      let results: ScanResult[]

      if (validation.fileType === 'pdf') {
        // PDF: 全ページを逐次処理
        results = await processPdf(file, (current, total, message) => {
          setState((prev) => ({
            ...prev,
            progress: { current, total, status: 'scanning', message },
          }))
        })
      } else {
        // 画像: 単一 Canvas に変換してスキャン
        setState((prev) => ({
          ...prev,
          progress: { ...prev.progress, message: '画像を解析中...' },
        }))
        const canvas = await imageFileToCanvas(file)
        results = await scanCanvas(canvas)
      }

      const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1)

      setState({
        results,
        error: null,
        progress: {
          current: 1,
          total: 1,
          status: 'done',
          message:
            results.length > 0
              ? `${results.length} 件のコードを検出しました（${elapsedSec} 秒）`
              : `コードが見つかりませんでした（${elapsedSec} 秒）`,
        },
      })
    } catch (err) {
      setState({
        results: [],
        error: err instanceof Error ? err.message : '解析中にエラーが発生しました',
        progress: { current: 0, total: 0, status: 'error', message: '' },
      })
    }
  }, [])

  /** 特定の結果を削除する（個別削除ボタン） */
  const deleteResult = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      results: prev.results.filter((r) => r.id !== id),
    }))
  }, [])

  /** カメラスキャン結果を追加する */
  const addResults = useCallback((newResults: ScanResult[]) => {
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
