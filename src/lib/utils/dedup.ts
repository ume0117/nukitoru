import type { ScanResult } from '@/types'

/**
 * type + value の組み合わせで重複を除外する。
 * 最初に出現した結果を優先し、後続の重複は除去する。
 */
export function deduplicateResults(results: ScanResult[]): ScanResult[] {
  const seen = new Set<string>()
  return results.filter((r) => {
    const key = `${r.type}::${r.value.trim()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** ユニークIDを生成（タイムスタンプ + ランダム文字列） */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}
