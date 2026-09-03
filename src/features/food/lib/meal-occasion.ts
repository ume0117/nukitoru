// ============================================================
// meal-occasion.ts
//
// MISSION 2.39 — Meal Occasion Foundation。
//
// breakfast / lunch / snack / dinner / late-night / bento を「明示 metadata」
// としてのみ扱う。料理名・食材からの推測分類はしない。
//
// 絶対ルール:
// - Meal Occasion は Recipe Identity ではない（別レイヤー）。
// - 同一 Recipe が複数 Occasion に属してよい。
// - 未設定 = unknown。unknown を breakfast 等へ自動分類しない。
//   unknown は「その occasion に向かない」という意味ではない（分類情報が無いだけ）。
// - snack（おやつ）は future placeholder ではなく 2.39 から正式 Foundation。
// - bento = お弁当。ただし「冷めても安全 / 保存可能」等を推測しない
//   （Food Safety / Storage Evidence は別レイヤー。Meal Occasion = bento ≠ Food Safety Guarantee）。
// - Firewall: このモジュールは AI / network / DB / recipe mutation / allergen / substitution /
//   unit conversion を一切扱わない。deterministic pure function のみ。
// ============================================================

import type {
  MealOccasion,
  MealOccasionFilterResult,
  MealOccasionMetadata,
  WorldRecipeCanonicalId,
} from '@/features/food/types'
import { MEAL_OCCASION_METADATA_FIXTURES } from './food-matching-fixtures'

export const ALL_MEAL_OCCASIONS: readonly MealOccasion[] = [
  'breakfast',
  'lunch',
  'snack',
  'dinner',
  'late-night',
  'bento',
]

/** 日本語ラベル（表示用。分類ロジックには使わない） */
export const MEAL_OCCASION_JA_LABELS: Record<MealOccasion, string> = {
  breakfast: '朝食',
  lunch: '昼食',
  snack: 'おやつ',
  dinner: '夕食',
  'late-night': '夜食',
  bento: 'お弁当',
}

export function isMealOccasion(value: string): value is MealOccasion {
  return (ALL_MEAL_OCCASIONS as readonly string[]).includes(value)
}

/**
 * ある Canonical Recipe Identity の明示 Meal Occasion metadata を返す。
 * 未登録 = undefined（unknown）。推測で生成しない。
 */
export function getMealOccasionMetadata(
  canonicalRecipeId: WorldRecipeCanonicalId,
  registry: Record<string, MealOccasionMetadata> = MEAL_OCCASION_METADATA_FIXTURES,
): MealOccasionMetadata | undefined {
  return registry[canonicalRecipeId]
}

/** 明示 occasion の一覧。metadata が無ければ []（unknown） */
export function mealOccasionsOf(
  canonicalRecipeId: WorldRecipeCanonicalId,
  registry: Record<string, MealOccasionMetadata> = MEAL_OCCASION_METADATA_FIXTURES,
): MealOccasion[] {
  const meta = getMealOccasionMetadata(canonicalRecipeId, registry)
  if (!meta) return []
  // 決定論的な安定順（ALL_MEAL_OCCASIONS の順）で返す
  return ALL_MEAL_OCCASIONS.filter((o) => meta.occasions.includes(o))
}

/** metadata が存在するか（occasion が空配列でも「登録済み」= known とする） */
export function isMealOccasionKnown(
  canonicalRecipeId: WorldRecipeCanonicalId,
  registry: Record<string, MealOccasionMetadata> = MEAL_OCCASION_METADATA_FIXTURES,
): boolean {
  return getMealOccasionMetadata(canonicalRecipeId, registry) !== undefined
}

/**
 * STRICT occasion filter（§19）。
 * - metadata があり requested を含む → INCLUDED
 * - metadata があり requested を含まない → EXCLUDED
 * - metadata が無い（unknown）→ EXCLUDED_FROM_STRICT_FILTER
 *   （unknown は「向かない」ではなく「分類情報が無い」）
 */
export function evaluateMealOccasionFilter(
  canonicalRecipeId: WorldRecipeCanonicalId,
  requested: MealOccasion,
  registry: Record<string, MealOccasionMetadata> = MEAL_OCCASION_METADATA_FIXTURES,
): MealOccasionFilterResult {
  const meta = getMealOccasionMetadata(canonicalRecipeId, registry)
  if (!meta) return 'EXCLUDED_FROM_STRICT_FILTER'
  return meta.occasions.includes(requested) ? 'INCLUDED' : 'EXCLUDED'
}

/** STRICT filter を通過するか（INCLUDED のみ true） */
export function matchesStrictOccasionFilter(
  canonicalRecipeId: WorldRecipeCanonicalId,
  requested: MealOccasion,
  registry: Record<string, MealOccasionMetadata> = MEAL_OCCASION_METADATA_FIXTURES,
): boolean {
  return evaluateMealOccasionFilter(canonicalRecipeId, requested, registry) === 'INCLUDED'
}
