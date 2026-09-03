// ============================================================
// cooked-meal-record.ts
//
// MISSION 2.40B — 「実際にこの料理を作った」記録の純粋関数群。
//
// 絶対ルール:
// - Cooked Meal Record は「NUKITORU 上で完成操作まで到達した」Product Event。
//   それ以上を意味しない（本当に食べた / 美味しかった / 安全だった / Recipe が正しかった
//   / 再現可能だった、とは断定しない）。
// - Cooked Meal Record ≠ Recipe Verification ≠ Practical Cook Validation。
// - Repeat Intent ≠ Taste Fact ≠ Recipe Evidence（Household Preference）。
// - 料理名から Recipe Identity を再推測しない（canonicalRecipeId を保持）。
// - source object を mutate しない。
// - Firewall: このモジュールは recipe-publishability / recipe-safety /
//   practical-cook-validation / recipe-catalog / world-recipe-import / ai-provider を
//   import しない。RecipeVerification / PracticalCookValidation を読み書きしない。
// - AI・ネットワーク・位置情報メタデータの解析をしない。
// ============================================================

import type {
  CookedMealPresentation,
  CookedMealRecord,
  RepeatIntent,
  WorldRecipeCanonicalId,
} from '@/features/food/types'

/** Cooked Meal Record が意味すること（過剰解釈を防ぐための固定文言） */
export const COOKED_MEAL_RECORD_MEANING =
  'NUKITORU で料理を最後まで進めた記録です。実際に食べたこと・美味しかったこと・'
  + 'レシピが正しいことを保証するものではありません。'

export interface CreateCookedMealRecordInput {
  canonicalRecipeId: WorldRecipeCanonicalId
  /** 完成時点の表示名（snapshot 用途） */
  recipeDisplayName: string
  /** どの SourceRecipeKnowledge から作ったか（あれば） */
  evidenceSourceIdSnapshot?: string
  completionPhotoId?: string
  repeatIntent?: RepeatIntent
}

/** id は (now, canonicalRecipeId) から決定論的に導出（外部乱数を使わない） */
function deriveRecordId(now: string, canonicalRecipeId: string): string {
  return `cmr_${now.replace(/[^0-9]/g, '')}_${canonicalRecipeId}`
}

/**
 * Cooked Meal Record を組み立てる純粋関数（localStorage へは触れない）。
 * `now` を渡せばテストで決定論的に固定できる（既存 buildMealDecision と同じ方針）。
 * 入力 object は変更しない。
 */
export function createCookedMealRecord(
  input: CreateCookedMealRecordInput,
  options: { now?: string; id?: string } = {},
): CookedMealRecord {
  const now = options.now ?? new Date().toISOString()
  return {
    id: options.id ?? deriveRecordId(now, input.canonicalRecipeId),
    canonicalRecipeId: input.canonicalRecipeId,
    recipeDisplayNameSnapshot: input.recipeDisplayName,
    completedAt: now,
    ...(input.evidenceSourceIdSnapshot !== undefined
      ? { evidenceSourceIdSnapshot: input.evidenceSourceIdSnapshot }
      : {}),
    ...(input.completionPhotoId !== undefined ? { completionPhotoId: input.completionPhotoId } : {}),
    ...(input.repeatIntent !== undefined ? { repeatIntent: input.repeatIntent } : {}),
    createdAt: now,
  }
}

/**
 * 既存 record に repeatIntent（また作りたい）を設定した新しい record を返す（非破壊）。
 * これは Household Preference であって Recipe Evidence / Taste Fact ではない。
 */
export function withRepeatIntent(
  record: CookedMealRecord,
  repeatIntent: RepeatIntent,
): CookedMealRecord {
  return { ...record, repeatIntent }
}

/**
 * 既存 record に完成写真 metadata id を関連付けた新しい record を返す（非破壊）。
 * 写真の有無は Recipe fact に一切影響しない。
 */
export function withCompletionPhoto(
  record: CookedMealRecord,
  completionPhotoId: string,
): CookedMealRecord {
  return { ...record, completionPhotoId }
}

/** 食卓アルバム表示用の最小 presentation（History 画面は作らない） */
export function toCookedMealPresentation(record: CookedMealRecord): CookedMealPresentation {
  return {
    id: record.id,
    canonicalRecipeId: record.canonicalRecipeId,
    recipeDisplayName: record.recipeDisplayNameSnapshot,
    completedAt: record.completedAt,
    hasPhoto: record.completionPhotoId !== undefined,
    ...(record.repeatIntent !== undefined ? { repeatIntent: record.repeatIntent } : {}),
    disclaimer: COOKED_MEAL_RECORD_MEANING,
  }
}

/**
 * MISSION 2.41+ の集計 boundary（本 MISSION では集計しない）。
 * ある canonicalRecipeId が「作られた回数」を数えるだけの純粋関数。
 * Social Proof には使わない（公開条件 / minimum cohort / privacy は別途決定）。
 */
export function countCookedByRecipe(
  records: CookedMealRecord[],
  canonicalRecipeId: WorldRecipeCanonicalId,
): number {
  return records.filter((r) => r.canonicalRecipeId === canonicalRecipeId).length
}
