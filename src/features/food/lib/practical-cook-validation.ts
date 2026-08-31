// ============================================================
// practical-cook-validation.ts
//
// MISSION 2.33 — Practical Cook Validation Foundation。
//
// LAYER B（実際に人間が作って再現性・分かりやすさを確認したか）を machine-readable
// に読み取るための最小ヘルパー。LAYER A（Recipe Evidence / isRecipePublishable）とは
// 完全に別。
//
// 絶対ルール:
// - この module は Recipe fact / verification / Product Time を一切変更しない
//   （読み取り専用のステータス判定のみ）。
// - isRecipePublishable() をここから呼んで practical と AND する
//   isRecipeBetaQualityReady() は「将来の Beta Gate 用の再利用可能ヘルパー」であって、
//   これ単体で Recipe を Beta-ready にはしない（Starter Set membership 等は別途必要）。
// - Starter Set / STARTER_SET_RECIPE_IDS を変更しない・参照しない。
// - observation を Recipe fact へ昇格させるロジックはここに置かない（存在しない）。
// ============================================================

import type { PracticalCookValidationStatus, Recipe } from '@/features/food/types'
import { isRecipePublishable } from './recipe-publishability'

/**
 * Recipe の実地調理検証ステータス。未設定は 'not-tested'（安全側の既定）。
 * catalog の 44 Recipe へ一律 { status: 'not-tested' } を書かず、この既定で表現する。
 */
export function practicalCookValidationStatusOf(recipe: Recipe): PracticalCookValidationStatus {
  return recipe.practicalCookValidation?.status ?? 'not-tested'
}

/**
 * 実地調理検証の観点で Beta 公開に足るか。
 * true: 'passed' / 'passed-with-observations'
 * false: 'not-tested' / 're-review-required' / 'safety-stop'
 *
 * これは「実地検証レイヤーの合否」だけを表す。Recipe が実際に Beta-ready かは
 * isRecipeBetaQualityReady()（＋ product 要件）で別途判定する。
 */
export function isPracticallyValidatedForBeta(recipe: Recipe): boolean {
  const status = practicalCookValidationStatusOf(recipe)
  return status === 'passed' || status === 'passed-with-observations'
}

/**
 * 'safety-stop' が未解決かどうか（Beta gating・監査用の明示ヘルパー）。
 * 'safety-stop' は Recipe Evidence を自動的に false にしないが、
 * この状態のまま Beta 公開してはならない。
 */
export function hasUnresolvedPracticalSafetyStop(recipe: Recipe): boolean {
  return practicalCookValidationStatusOf(recipe) === 'safety-stop'
}

/**
 * MISSION 2.33 — 将来の Beta Quality Gate 用の再利用可能ヘルパー。
 * 概念: Recipe Evidence publishable かつ 実地検証レイヤー合格。
 *
 * 注意: これだけで Recipe が Beta-ready になるわけではない。実際の Beta 公開は
 * さらに Starter Set membership・Safety・その他 product 要件を必要とする
 * （本 MISSION では Starter Set / Beta 挙動を変更しない）。
 */
export function isRecipeBetaQualityReady(recipe: Recipe): boolean {
  return isRecipePublishable(recipe) && isPracticallyValidatedForBeta(recipe)
}
