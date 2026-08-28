// ============================================================
// recipe-labels.ts
//
// MISSION 2.11 PHASE D — Recipe.cuisineの表示ラベル変換のみを扱う。
// Recipe型・RECIPE_CATALOGの値そのもの（内部識別子）は変更しない。
// ここはUI表示専用の変換層であり、将来英語UI/i18nへ切り替える際は
// このマップ（または同等のi18nキー変換）だけを差し替えればよい構造にする。
// ============================================================

import type { RecipeCuisine } from '@/features/food/types'

export const CUISINE_LABELS: Record<RecipeCuisine, string> = {
  japanese: '和食',
  chinese: '中華',
  korean: '韓国',
  italian: 'イタリア',
  french: 'フレンチ',
  thai: 'タイ',
  vietnamese: 'ベトナム',
  indian: 'インド',
  mexican: 'メキシコ',
  american: 'アメリカ',
  spanish: 'スペイン',
  other: 'その他',
}

export function cuisineLabel(cuisine: RecipeCuisine | undefined): string | undefined {
  if (!cuisine) return undefined
  return CUISINE_LABELS[cuisine]
}

/**
 * MISSION 2.12 PHASE A — 内部開発用語「A」「B」を一般ユーザーへそのまま
 * 表示しないための自然な文言。判定ロジック自体（isFullyAvailable）は
 * 変更しない。表示文言のみをここに集約する。
 */
export function candidateAvailabilityLabel(isFullyAvailable: boolean): string {
  return isFullyAvailable ? '家にあるもので作れます' : 'あと1つで作れます'
}
