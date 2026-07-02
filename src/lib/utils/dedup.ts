import type { ScanResult } from '@/types'

/**
 * type + value の組み合わせで重複を除外する。
 * 最初に出現した結果を優先し、後続の重複は除去する。
 */
export function deduplicateResults(results: ScanResult[]): ScanResult[] {
  const seen = new Set<string>()
  const urlBaseSeen = new Set<string>() // URLのベースパス（クエリパラメータなし）

  // 長いURLを優先するためにURLの長さでソート（降順）
  const sorted = [...results].sort((a, b) => b.value.length - a.value.length)

  return sorted.filter((r) => {
    const val = r.value.trim()
    const key = `${r.type}::${val}`
    if (seen.has(key)) return false

    // QRコードのURL重複チェック（クエリパラメータを除いた基本URLで比較）
    if (r.type === 'QR_CODE') {
      try {
        const url = new URL(val)
        const base = `${url.hostname}${url.pathname}`
        if (urlBaseSeen.has(base)) return false
        urlBaseSeen.add(base)
      } catch {
        // URL形式でない場合は通常の比較
      }
    }

    seen.add(key)
    return true
  })
}

/** ユニークIDを生成（タイムスタンプ + ランダム文字列） */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}
