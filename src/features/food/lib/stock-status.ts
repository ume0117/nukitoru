// ============================================================
// stock-status.ts
//
// 「今、実際に家にあるか」を表すStockStatusの純粋関数。
// 「常備品として登録しているか（ON/OFF）」とは完全に独立した概念であり、
// Pantry.staples / regularFoods / frozenFoods / pantryFoods の配列は
// 一切参照・変更しない。
// ============================================================

import type { StockStatus, StockStatusEntry } from '@/features/food/types'

const DEFAULT_STATUS: StockStatus = 'available'

export function isValidStockStatus(value: unknown): value is StockStatus {
  return value === 'available' || value === 'low' || value === 'out'
}

/**
 * 在庫状態を取得する。
 * エントリが存在しない場合（新規常備品・在庫status未導入の旧データ）は
 * 安全側の既定値として 'available' を返す。この関数はlocalStorageへの
 * 書き込みを一切行わない（読み取っただけで永久保存しない）。
 */
export function getStockStatus(map: Record<string, StockStatusEntry>, itemName: string): StockStatus {
  const entry = map[itemName]
  if (entry && isValidStockStatus(entry.status)) {
    return entry.status
  }
  return DEFAULT_STATUS
}

/**
 * 在庫状態を更新した新しいmapを返す（非破壊）。
 * nowを省略した場合のみ現在時刻を使用し、テストでは固定値を注入できる。
 */
export function setStockStatus(
  map: Record<string, StockStatusEntry>,
  itemName: string,
  status: StockStatus,
  now: string = new Date().toISOString(),
): Record<string, StockStatusEntry> {
  return {
    ...map,
    [itemName]: { status, updatedAt: now },
  }
}
