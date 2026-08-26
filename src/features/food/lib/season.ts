// ============================================================
// season.ts
//
// 外部Weather APIを使わず、日付から季節を決定する純粋関数。
// 旬情報は SeasonalIngredient[] という差し替え可能な静的データ構造を想定し、
// 中身のデータ投入は本MISSIONの範囲外（AIプロンプトへの直接hardcodeもしない）。
// ============================================================

import type { Season } from '@/features/food/types'

/**
 * 日本の一般的な季節区分（気象庁の3ヶ月区分に準拠）:
 * 3-5月 春 / 6-8月 夏 / 9-11月 秋 / 12-2月 冬
 */
export function getSeasonFromDate(date: Date): Season {
  const month = date.getMonth() + 1
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

export interface SeasonalIngredient {
  name: string
  seasons: Season[]
}

/**
 * 旬データの差し替え可能な入れ物。
 * 中身は未投入（本MISSIONのスコープ外）。将来、静的JSON等に置き換え可能な設計とする。
 */
export const SEASONAL_INGREDIENTS: SeasonalIngredient[] = []
