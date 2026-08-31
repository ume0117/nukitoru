// ============================================================
// ingredient-taxonomy.ts
//
// MISSION 2.21 — Canonical Ingredient Relation Minimal Foundation。
//
// MISSION 2.19E-RESUME の INGREDIENT_CANONICALIZATION_BLOCKER を解消する。
//
// canonicalization（ingredient-normalization.ts）と taxonomy（このモジュール）は
// 別レイヤーである:
//   - canonicalization: 同じ意味の表記ゆれのみ（chicken → 鶏肉）。canonical string を
//     同じ値へ潰す。
//   - taxonomy: 異なる概念だが broader / narrower 関係を持つ（鶏肉 ⊃ 鶏もも肉）。
//     canonical string は潰さない（鶏もも肉・鶏むね肉・鶏肉 はすべて別の canonical）。
//
// 絶対ルール:
// - fuzzy / substring / Levenshtein / AI 推論 / implicit hierarchy は一切使わない。
//   人間が確認した明示的な relation table のみ。
// - relation table にないものは broader を持たない（[] を返す。近い食材へ寄せない）。
// - STOCK MATCHING と ALLERGY COVERAGE で同じ relation を無条件に使わない:
//   - 在庫「鶏肉がある」だけでは「鶏もも肉」を満たさない（generic → specific の
//     自動確定禁止。stockSatisfiesRecipeIngredient は完全一致のみ）。
//   - アレルギー「鶏肉」は「鶏もも肉」も危険対象（broader allergy が既知の narrower
//     ingredient を覆う。allergyExcludesIngredient は broader 方向のみ true）。
// - narrower allergy（例: 鶏もも肉アレルギー）を別の narrower（鶏むね肉）へ
//   自動拡張しない（食物アレルギー医学の新しい推測ロジックを作らない）。
// ============================================================

import { canonicalizeIngredientName } from './ingredient-normalization'

/**
 * 人間が確認した broader（上位概念）関係のみ。
 * key / value はすべて canonical 名（canonicalizeIngredientName 適用後）。
 *
 * scope: MISSION 2.19E-RESUME blocker の解消に必要な鶏系 + 形状がまったく同一の
 * 既存 latent allergy gap（豚ひき肉）だけ。大量 taxonomy は作らない。
 * 追加は「同じ明確な broader/narrower 関係があり、安全に追加できる」ものに限る。
 */
const INGREDIENT_BROADER_RELATIONS: Record<string, readonly string[]> = {
  鶏もも肉: ['鶏肉'],
  鶏むね肉: ['鶏肉'],
  鶏ひき肉: ['鶏肉'],
  豚ひき肉: ['豚肉'],
}

/**
 * name の broader（上位）canonical 名一覧を返す。
 * 現状の relation はすべて1段（例: 鶏もも肉 → 鶏肉。鶏肉 → 肉 のような上位はまだ無い）
 * なので直接の親のみを返す。多段関係を追加する場合はここを推移閉包へ拡張する。
 */
export function broaderIngredientNames(name: string): string[] {
  const canonical = canonicalizeIngredientName(name)
  return [...(INGREDIENT_BROADER_RELATIONS[canonical] ?? [])]
}

/**
 * 2つの食材名が broader/narrower の関係にあるか（どちらの向きでも）。
 * 完全一致は false（それは「同一」であって「関係」ではない）。テスト・監査用。
 */
export function isBroaderNarrowerRelated(a: string, b: string): boolean {
  const ca = canonicalizeIngredientName(a)
  const cb = canonicalizeIngredientName(b)
  if (ca === cb) return false
  return broaderIngredientNames(ca).includes(cb) || broaderIngredientNames(cb).includes(ca)
}

/**
 * STOCK / 在庫・input マッチ用。
 * 在庫名がレシピ食材を満たすのは canonical 完全一致のときのみ。
 * broader → specific の自動確定はしない（「鶏肉がある」だけでは「鶏もも肉」を満たさない）。
 * specific 在庫 → generic レシピ（鶏もも肉 → 鶏肉 recipe）も、このMISSIONでは
 * taxonomy で自動 MATCH にしない（legacy generic Recipe の意味を再定義しない。Section 5）。
 */
export function stockSatisfiesRecipeIngredient(stockName: string, recipeIngredientName: string): boolean {
  return canonicalizeIngredientName(stockName) === canonicalizeIngredientName(recipeIngredientName)
}

/**
 * ALLERGY 用。あるアレルギー名が、あるレシピ食材を危険対象として除外するか。
 * - canonical 完全一致 → true
 * - アレルギー名がレシピ食材の broader（上位）→ true（鶏肉アレルギー → 鶏もも肉 recipe を除外）
 * - それ以外 → false（鶏もも肉アレルギー → 鶏むね肉 recipe は自動除外しない）
 */
export function allergyExcludesIngredient(allergyName: string, recipeIngredientName: string): boolean {
  const allergy = canonicalizeIngredientName(allergyName)
  const ingredient = canonicalizeIngredientName(recipeIngredientName)
  if (allergy === ingredient) return true
  return broaderIngredientNames(ingredient).includes(allergy)
}

/**
 * レシピ食材名のいずれかが、与えられたアレルギー名のいずれかで危険対象として
 * 除外されるか（基本Recipeの HARD EXCLUSION 判定用）。
 */
export function recipeIngredientsHitAllergy(
  recipeIngredientNames: string[],
  allergyNames: string[],
): boolean {
  return recipeIngredientNames.some((ingredient) =>
    allergyNames.some((allergy) => allergyExcludesIngredient(allergy, ingredient)),
  )
}
