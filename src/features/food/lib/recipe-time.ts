// ============================================================
// recipe-time.ts
//
// MISSION 2.15 — Cooking Time Semantics Foundation。
//
// Evidence Time（情報源が実際に述べる時間）とUser Decision Time
// （「15分以内」等のユーザー向け意思決定に使う時間）を明確に分離する。
//
// 絶対ルール:
// - TimeValueの精度を保持する。3〜4分をmidpoint化しない。約10分をexact化しない。
// - elapsedToReadyMinutesはProduct Decisionであり、derivationが必須
//   （no hidden arithmetic・no automatic overlap guessing）。
// - Recipe Coherenceとは独立したgateだが、既知のincoherent判定は
//   time-filter eligibilityを阻害する（Section 11/19）。
// - Recipe publishability（isRecipePublishable）とは完全に独立。
//   このモジュールはrecipe-publishability.tsを一切参照しない。
// - 既存のlegacy `cookingTimeMinutes` field・candidate ranking
//   （recipe-suggestion-engine.ts）・15分/30分クイックフィルタ
//   （QuickConditionSelector.tsx）には一切触れない・参照しない。
// ============================================================

import type { Recipe, TimeComponentFact, TimeValue } from '@/features/food/types'

/** kind==='unknown'以外、すなわち何らかのEvidence Timeが存在するかどうか */
export function isKnownTimeValue(value: TimeValue): boolean {
  return value.kind !== 'unknown'
}

/**
 * 保守的フィルタリング用の上限値を返す（Section 7）。
 * - exact: その値そのもの
 * - range: maxMinutes（上限値。rangeの中央値は使わない）
 * - approximate: null（既定では自動的に適格としない。Evidenceが裏付ける
 *   保守的な上限を別途明示するメカニズムは本MISSIONでは実装しない）
 * - unknown: null
 */
export function resolvedUpperBoundMinutes(value: TimeValue): number | null {
  switch (value.kind) {
    case 'exact':
      return value.minutes
    case 'range':
      return value.maxMinutes
    case 'approximate':
      return null
    case 'unknown':
      return null
  }
}

/**
 * elapsedToReadyの導出が実際に使用したsourceIdに対応するtime componentのうち、
 * variantIdが設定されているものを集める。2種類以上の異なるvariantIdを跨いだ
 * 合算をNo cross-Variant arithmeticとして検出するための補助。
 */
function usedVariantIds(components: TimeComponentFact[] | undefined, contributingSourceIds: string[]): Set<string> {
  const ids = new Set<string>()
  if (!components) return ids
  const sourceIdSet = new Set(contributingSourceIds)
  for (const component of components) {
    if (!component.variantId) continue
    if (component.sourceIds.some((id) => sourceIdSet.has(id))) {
      ids.add(component.variantId)
    }
  }
  return ids
}

/**
 * elapsedToReadyの導出が、異なるvariantIdを持つcomponentを跨いで合算して
 * いないかを検査する（Section 12: No cross-Variant arithmetic）。
 * 2つ以上の異なるvariantIdが同時に使われていればtrue（無効）。
 */
export function hasCrossVariantArithmetic(
  components: TimeComponentFact[] | undefined,
  contributingSourceIds: string[],
): boolean {
  return usedVariantIds(components, contributingSourceIds).size > 1
}

/**
 * MISSION 2.15の唯一の公開判定関数: あるRecipeが「maxMinutes以内」という
 * ユーザー向け時間フィルタに適格かどうかを決定論的に判定する。
 *
 * isRecipePublishable()とは完全に独立（Section 18: publishability vs
 * time-filter eligibilityの分離）。既存のcandidate ranking・15分/30分
 * クイックフィルタ（recipe.cookingTimeMinutesを直接使う既存実装）には
 * 一切影響しない・参照されない、まったく新しい並行の判定である。
 */
export function isEligibleForMaxElapsedTime(recipe: Recipe, maxMinutes: number): boolean {
  const elapsed = recipe.verification?.timeVerification?.elapsedToReady
  if (!elapsed) return false
  if (!elapsed.derivation.trim()) return false
  if (elapsed.contributingSourceIds.length === 0) return false

  // Section 11/19: Recipe Coherenceが明示的にcoherent以外と判定されている
  // 場合、その時間主張の基盤となるprocessが不整合である可能性があるため
  // 適格にしない。coherenceReview自体が未設定（=多くのlegacy Recipe）の
  // 場合はここではブロックしない（elapsedToReady自体が未設定であれば
  // 上のガードで既にfalseになっているため、実質的な影響はない）。
  const coherence = recipe.verification?.coherenceReview
  if (coherence && coherence.status !== 'coherent') return false

  // Section 12: No cross-Variant arithmetic
  if (hasCrossVariantArithmetic(recipe.verification?.timeVerification?.components, elapsed.contributingSourceIds)) {
    return false
  }

  const upperBound = resolvedUpperBoundMinutes(elapsed.value)
  if (upperBound === null) return false

  return upperBound <= maxMinutes
}
