// ============================================================
// recipe-safety.ts
//
// Recipe型に対する「どの食材がアレルギー判定対象か」を一箇所に定義する。
// mock-meal-provider.ts等、将来Recipeを使う側は必ずこの関数経由で
// アレルギー対象食材を取得し、requiredIngredients/seasoningsを直接
// 読み書きして独自に集合を作らない（判定漏れを防ぐ）。
//
// 絶対ルール:
// - 基本Recipeのハード除外対象は requiredIngredients + seasonings のみ。
// - arrangements.addIngredients は基本Recipeの除外判定には一切使わない
//   （アレンジのために基本料理そのものまで除外しない）。
// - 個別のアレンジ提案を表示するかどうかは、arrangementAllergyIngredients()
//   の結果を別途その日のアレルギー集合と突き合わせて判定する。
// ============================================================

import type { Recipe, RecipeArrangement } from '@/features/food/types'
import { canonicalizeIngredientName } from './ingredient-normalization'

/**
 * 基本Recipeのハード除外判定に使う食材名集合（requiredIngredients + seasonings）。
 * MISSION 2.11 PHASE D.3 — RecipeIngredient化後もamountは判定に一切使わず、
 * 必ず .name のみを対象にする。
 */
export function allergyRelevantIngredients(recipe: Recipe): string[] {
  return [
    ...recipe.requiredIngredients.map((i) => i.name),
    ...(recipe.seasonings ?? []).map((i) => i.name),
  ]
}

/** 個別のアレンジ提案の安全判定に使う食材集合（そのアレンジのaddIngredientsのみ） */
export function arrangementRelevantIngredients(arrangement: RecipeArrangement): string[] {
  return [...(arrangement.addIngredients ?? [])]
}

/**
 * MISSION 2.11 PHASE D — 基本Recipeが安全でも、arrangement.addIngredientsに
 * その日選択されているメンバーのアレルギーと一致する食材が1つでも含まれる
 * 場合は、そのアレンジだけを非表示にする（基本Recipe自体は影響を受けない）。
 * canonicalizeIngredientNameを経由するため、"卵"/"egg"/"たまご"等の
 * 表記ゆれがあっても正しく除外される。
 */
export function filterSafeArrangements(recipe: Recipe, allergyNames: string[]): RecipeArrangement[] {
  const allergyCanonical = new Set(allergyNames.map(canonicalizeIngredientName))
  return (recipe.arrangements ?? []).filter((arrangement) => {
    const relevant = arrangementRelevantIngredients(arrangement)
    return !relevant.some((ingredient) => allergyCanonical.has(canonicalizeIngredientName(ingredient)))
  })
}
