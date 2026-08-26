// ============================================================
// stock-utils.ts
//
// 常備品リスト（string[]）に対する純粋関数。
// UIコンポーネントに依存しないため、React無しで単体テストできる。
// ============================================================

/** 一覧に値が含まれていればトグルで除外し、含まれていなければ追加する */
export function toggleItem(list: string[], value: string): string[] {
  if (list.includes(value)) {
    return list.filter((v) => v !== value)
  }
  return [...list, value]
}

/**
 * 自由入力された値を追加する。
 * - trim後に空文字なら追加しない
 * - すでに同じ値（trim後の完全一致）が存在すれば追加しない
 */
export function addCustomItem(list: string[], rawValue: string): string[] {
  const value = rawValue.trim()
  if (!value) return list
  if (list.includes(value)) return list
  return [...list, value]
}
