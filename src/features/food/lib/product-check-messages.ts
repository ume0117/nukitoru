// ============================================================
// product-check-messages.ts
//
// MISSION 2.11 PHASE D.5 — Allergen Alert Foundation。
//
// しょうゆ・味噌・だしの素等、レシピ上は単純な調味料名だが実際の商品に
// よって原材料・アレルゲンが異なり得るものへの表示文言を1箇所に集約する。
//
// 絶対ルール:
// - ここは既存のAllergy HARD EXCLUSION（recipe-safety.ts / recipe-suggestion-engine.ts）
//   とは完全に別レイヤー。この関数の戻り値をallergy判定・candidate A/B判定に
//   一切使わない。
// - 文言はテンプレート1種類のみとし、特定のアレルゲン名（卵・小麦・大豆等）を
//   一切明記しない。「含みません」「安全です」等の安全断定表現も使わない。
// - AI推測・商品固有情報の取得は行わない。あくまで「原材料表示を確認してください」
//   という一般的な注意喚起にとどめる。
// ============================================================

import { canonicalizeIngredientName } from './ingredient-normalization'

/**
 * PRODUCT CHECK ALERT対象のingredient一覧（PHASE D.5時点の44 Recipe監査結果）。
 * 過剰警告を避けるため、「商品によって原材料・アレルゲンが大きく異なり得る、
 * かつ実用上確認する価値が高い」加工調味料のみに限定する。
 * 片栗粉・小麦粉（名前自体がアレルゲンを明示）・油・バター・酢・ケチャップ等、
 * 商品差による実用的リスクが低いものは含めない。
 */
export const PRODUCT_CHECK_TARGET_INGREDIENTS = [
  'しょうゆ',
  '味噌',
  'だしの素',
  'カレールー',
  'コンソメ',
  'マヨネーズ',
  '豆板醤',
] as const

const TARGET_CANONICAL_SET = new Set(PRODUCT_CHECK_TARGET_INGREDIENTS.map((t) => canonicalizeIngredientName(t)))

/** ingredientNameがPRODUCT CHECK ALERT対象かどうか */
export function isProductCheckTarget(ingredientName: string): boolean {
  return TARGET_CANONICAL_SET.has(canonicalizeIngredientName(ingredientName))
}

/**
 * 対象ingredientの表示文言を生成する。対象外の場合はundefinedを返す。
 * 文言はテンプレート1種類のみ（特定アレルゲン名・安全断定表現を含めない）。
 */
export function productCheckMessage(ingredientName: string): string | undefined {
  if (!isProductCheckTarget(ingredientName)) return undefined
  return `使用する「${ingredientName}」は商品によって原材料が異なる場合があります。パッケージの原材料・アレルギー表示を確認してください。`
}
