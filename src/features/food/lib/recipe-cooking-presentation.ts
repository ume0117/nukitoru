// ============================================================
// recipe-cooking-presentation.ts
//
// PUBLIC BETA RELEASE SPRINT 2 — Recipe → Cooking Presentation Adapter。
//
// 既存の CookingModeView / cooking-navigation.ts は NukitoruPresentation
// （MISSION 2.35 World Food Knowledge層）だけを消費する。このファイルは、
// 実際にBetaで使われる古典的な Recipe型（recipe-catalog.ts）から、
// 新しい調理手順・時間・温度・分量・道具・安全事実を一切生成せずに
// NukitoruPresentationへ変換するだけの薄いadapterを提供する。
//
// 絶対ルール:
// - status !== 'verified' の Recipe は変換しない（undefinedを返す）。
//   Beta Runtime Evidence Gateと同じ基準をここでも独立に守る。
// - Recipe.preparation / Recipe.steps に無い heat / time / quantity / tool を
//   文字列解析で抽出・推測しない（heatAction / durationDisplay / toolAction /
//   completionCue は常にundefined。本文にすでに含まれる情報はshortInstruction
//   としてそのまま表示されるため、情報は失われない）。
// - Recipe.notes（食品安全に関する注意）は、最終stepのwarningとしてそのまま
//   引き継ぐ（自作の安全断定文を追加しない。Evidenceにある文言のみ）。
// - canonicalRecipeId は Recipe.id をそのまま使う（新しい identity を作らない）。
// - sourceEvidenceSourceId は、criticalStepsのfieldVerificationが指す
//   単一source anchorを優先する（Recipe processの実際の根拠と一致させる）。
// ============================================================

import type { NukitoruPresentation, PresentationStep, Recipe } from '@/features/food/types'

/** このAdapterが生成するNukitoruPresentationの生成日時（固定・決定論的） */
const PRESENTATION_GENERATED_AT = '2026-09-16'

/**
 * Recipeの実際のcooking process根拠となった単一source id。
 * criticalStepsのfieldVerification（複数sourceを混ぜないcomplete process anchor）を
 * 優先し、無ければverification.sourceIdsの先頭にfallbackする。
 */
function primaryEvidenceSourceId(recipe: Recipe): string | undefined {
  const v = recipe.verification
  if (!v) return undefined
  const criticalStepsFv = (v.fieldVerifications ?? []).find((fv) => fv.field === 'criticalSteps')
  if (criticalStepsFv && criticalStepsFv.sourceIds.length > 0) {
    return criticalStepsFv.sourceIds[0]
  }
  return v.sourceIds[0]
}

function toStep(text: string, sourceStepReference: number): PresentationStep {
  return {
    title: text,
    shortInstruction: text,
    ingredientActions: [],
    sourceStepReference,
  }
}

/**
 * このRecipeがCooking Modeへ変換可能か（status='verified' かつ steps が1件以上）。
 * isRecipePublishable()とは別の、Cooking Presentation固有の前提条件チェック
 * （publishability自体は変更しない・参照もしない。判定基準を独自に持つ）。
 */
export function canAdaptRecipeForCooking(recipe: Recipe): boolean {
  return recipe.verification?.status === 'verified' && (recipe.steps?.length ?? 0) > 0
}

/**
 * Recipe → NukitoruPresentation。変換できない場合はundefined
 * （Cooking Modeへ入れない・呼び出し側はこの結果でボタン表示を判断する）。
 */
export function recipeToCookingPresentation(recipe: Recipe): NukitoruPresentation | undefined {
  if (!canAdaptRecipeForCooking(recipe)) return undefined

  const evidenceSourceId = primaryEvidenceSourceId(recipe)
  if (!evidenceSourceId) return undefined

  let order = 0
  const steps: PresentationStep[] = [
    ...(recipe.preparation ?? []).map((p) => toStep(p.text, ++order)),
    ...(recipe.steps ?? []).map((s) => toStep(s, ++order)),
  ]
  if (steps.length === 0) return undefined

  // Recipe.notes（食品安全等の注意）はEvidenceにある文言のまま、最終stepのwarningへ
  // 引き継ぐ（自作の安全断定は追加しない・削除もしない）。
  if (recipe.notes && recipe.notes.length > 0) {
    const lastIndex = steps.length - 1
    steps[lastIndex] = { ...steps[lastIndex], warning: recipe.notes.join(' ') }
  }

  return {
    canonicalRecipeId: recipe.id,
    sourceEvidenceSourceId: evidenceSourceId,
    displayName: recipe.name,
    displayLocale: { language: 'ja', country: 'JP' },
    steps,
    generatedAt: PRESENTATION_GENERATED_AT,
  }
}
