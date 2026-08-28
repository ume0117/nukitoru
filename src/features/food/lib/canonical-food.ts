// ============================================================
// canonical-food.ts
//
// MISSION 2.11 PHASE E.1 — Global Foundation。
//
// 表示文字列（米/rice/riz等）そのものをFood Identityとして扱わないための、
// 最小限のcanonicalFoodId proof layer。
//
// 絶対ルール:
// - fuzzy matching禁止。人間が確認した明示的なlabel/synonymのみで解決する
//   （ingredient-normalization.tsと同じ設計方針）。
// - 辞書にない表示文字列は勝手にどのcanonicalFoodIdにも割り当てない
//   （unknownはunknownのまま。undefinedを返す）。
// - このモジュールはingredient-normalization.ts/recipe-safety.ts等の
//   既存の食材マッチング・アレルギー判定パスには一切接続しない
//   （PHASE E.1時点ではproof目的の独立したlayerに留める）。
// - 大規模なfood DBを構築しない。ここに置くのは構造を証明するための
//   最小限のsample dataのみ。
// ============================================================

import type { CanonicalFoodId, CanonicalFoodLabel, Locale } from '@/features/food/types'

function normalizeLabel(raw: string): string {
  return raw.trim().toLowerCase()
}

function sameLocale(a: Locale, b: Locale): boolean {
  return a.language === b.language && a.country === b.country
}

/**
 * 最小限のproof dataset（4 canonical food × ja-JP/en-US）。
 * PHASE D.2で確立した「米（生米）」と「ごはん（炊飯済み）」の区別を、
 * canonicalFoodIdレベルでも別id（rice_raw / rice_cooked）として保持する。
 */
export const CANONICAL_FOOD_SAMPLE: CanonicalFoodLabel[] = [
  { canonicalFoodId: 'chicken', locale: { language: 'ja', country: 'JP' }, label: '鶏肉' },
  { canonicalFoodId: 'chicken', locale: { language: 'en', country: 'US' }, label: 'chicken' },

  { canonicalFoodId: 'onion', locale: { language: 'ja', country: 'JP' }, label: '玉ねぎ' },
  { canonicalFoodId: 'onion', locale: { language: 'en', country: 'US' }, label: 'onion' },

  { canonicalFoodId: 'rice_raw', locale: { language: 'ja', country: 'JP' }, label: '米' },
  { canonicalFoodId: 'rice_raw', locale: { language: 'en', country: 'US' }, label: 'rice' },

  { canonicalFoodId: 'rice_cooked', locale: { language: 'ja', country: 'JP' }, label: 'ごはん' },
  { canonicalFoodId: 'rice_cooked', locale: { language: 'en', country: 'US' }, label: 'cooked rice' },
]

/**
 * labelとlocaleから、それが指すcanonicalFoodIdを解決する。
 * 完全一致（trim + lowercase）のみで判定し、fuzzy matchingは一切行わない。
 * 未知のlabelはundefinedを返す（勝手に近い食材へ割り当てない）。
 */
export function resolveCanonicalFoodId(
  label: string,
  locale: Locale,
  catalog: CanonicalFoodLabel[] = CANONICAL_FOOD_SAMPLE,
): CanonicalFoodId | undefined {
  const key = normalizeLabel(label)
  const match = catalog.find((entry) => {
    if (!sameLocale(entry.locale, locale)) return false
    if (normalizeLabel(entry.label) === key) return true
    return (entry.synonyms ?? []).some((synonym) => normalizeLabel(synonym) === key)
  })
  return match?.canonicalFoodId
}

/** 指定したcanonicalFoodIdに紐づくすべてのlocalized labelを返す */
export function getLabelsForCanonicalFood(
  id: CanonicalFoodId,
  catalog: CanonicalFoodLabel[] = CANONICAL_FOOD_SAMPLE,
): CanonicalFoodLabel[] {
  return catalog.filter((entry) => entry.canonicalFoodId === id)
}

/**
 * 2つの(label, locale)の組が同一のcanonicalFoodIdを指すかどうかを判定する。
 * 表示文字列そのものではなく、canonicalFoodIdの一致で判定する。
 */
export function labelsResolveToSameCanonicalFood(
  labelA: string,
  localeA: Locale,
  labelB: string,
  localeB: Locale,
  catalog: CanonicalFoodLabel[] = CANONICAL_FOOD_SAMPLE,
): boolean {
  const idA = resolveCanonicalFoodId(labelA, localeA, catalog)
  const idB = resolveCanonicalFoodId(labelB, localeB, catalog)
  if (idA === undefined || idB === undefined) return false
  return idA === idB
}
