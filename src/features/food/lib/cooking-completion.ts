// ============================================================
// cooking-completion.ts
//
// 「料理を作った」後、実際に使った食材を確認してから在庫状態を更新するための
// 純粋関数。AIやアプリが勝手に在庫を減らすことは絶対にしない
// （呼び出し側がユーザー確認後に明示的に呼ぶことを前提とする）。
//
// 常備品登録（Pantry.staples / regularFoods / frozenFoods / pantryFoods）の
// ON/OFFとは無関係に動作する。非常備食品（例: 普段は常備しないが今日買った
// 豚肉）についても、在庫状態の更新対象として扱える。
// ============================================================

import type { MealSuggestion, StockStatus, StockStatusEntry } from '@/features/food/types'
import { setStockStatus } from './stock-status'

function normalize(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * 献立の使用食材名を重複除去して取得する。
 * pantryStaples（常備調味料として登録済みの名前）に該当するものは、
 * 毎回の確認対象から除外する（trim+小文字化の完全一致で判定。推測はしない）。
 */
export function getConfirmableIngredientNames(
  suggestion: MealSuggestion,
  pantryStaples: string[],
): string[] {
  const staplesSet = new Set(pantryStaples.map(normalize))
  const seen = new Set<string>()
  const result: string[] = []

  for (const dish of suggestion.dishes) {
    for (const ri of dish.requiredIngredients) {
      const key = normalize(ri.name)
      if (staplesSet.has(key)) continue
      if (seen.has(key)) continue
      seen.add(key)
      result.push(ri.name)
    }
  }

  return result
}

export interface StockUpdateEntry {
  itemName: string
  status: StockStatus
}

/**
 * 複数食品の在庫状態を一括更新した新しいmapを返す（非破壊）。
 * 既存の setStockStatus() を順に適用するだけで、マージロジックを再実装しない。
 * nowはこの呼び出し内で1回だけ決定し、全更新エントリへ同一値を渡す
 * （一括保存が同一時刻のupdatedAtになるようにするため）。
 */
export function applyStockUpdates(
  map: Record<string, StockStatusEntry>,
  updates: StockUpdateEntry[],
  now: string = new Date().toISOString(),
): Record<string, StockStatusEntry> {
  return updates.reduce(
    (acc, { itemName, status }) => setStockStatus(acc, itemName, status, now),
    map,
  )
}
