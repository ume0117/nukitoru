// ============================================================
// recipe-evidence-summary.ts
//
// PUBLIC BETA RELEASE SPRINT 1 — Evidence UI用の表示専用データ導出。
//
// isRecipePublishable()（recipe-publishability.ts）がGate（true/false）であるのに対し、
// ここはGateを通過したRecipeについて「何を・どの情報源で確認したか」をユーザーへ
// 簡潔に見せるための表示データを組み立てるだけ。新しいSafety/Rights判定はしない。
//
// 絶対ルール:
// - verification.status !== 'verified' の Recipe には null を返す
//   （「確認済み」表現は verified 以外に一切出さない）。
// - 表示するsourceは recipe.verification.sourceIds が実際に参照する
//   EVIDENCE_SOURCE_CATALOG entryのみ（存在しないsourceIdは静かに無視する）。
// - 「何を確認したか」はapplicableFieldsFor()が機械的に返すfield集合から
//   導出する（このRecipeについて実際にEvidence追跡対象とされているfieldのみ。
//   推測や一般的な安心文言を追加しない）。
// ============================================================

import type { Recipe, RecipeVerifiableField } from '@/features/food/types'
import { applicableFieldsFor } from './recipe-publishability'
import { EVIDENCE_SOURCE_CATALOG, getEvidenceSourceById } from './evidence-sources'

const FIELD_LABELS: Record<RecipeVerifiableField, string> = {
  requiredIngredients: '材料',
  ingredientAmounts: '材料の分量',
  seasonings: '調味料',
  seasoningAmounts: '調味料の分量',
  cookingLiquids: '水・湯の分量',
  cookingTimeMinutes: '調理時間',
  servingsBase: '人数の目安',
  criticalSteps: '作り方の手順',
  equipment: '調理器具',
  allergyIdentity: 'アレルギー表示',
  preparation: '下ごしらえ',
}

export interface RecipeEvidenceSourceSummary {
  publisher: string
  title: string
  url: string
}

export interface RecipeEvidenceSummary {
  sources: RecipeEvidenceSourceSummary[]
  verifiedFieldLabels: string[]
}

/**
 * Evidence UIに表示する要約データを組み立てる。
 * verification.status !== 'verified' の Recipe には必ず null を返す
 * （「レシピ確認済み」表現をverified以外に一切出さないための唯一の分岐点）。
 */
export function recipeEvidenceSummaryFor(
  recipe: Recipe,
  catalog = EVIDENCE_SOURCE_CATALOG,
): RecipeEvidenceSummary | null {
  const v = recipe.verification
  if (!v || v.status !== 'verified') return null

  const seen = new Set<string>()
  const sources: RecipeEvidenceSourceSummary[] = []
  for (const sourceId of v.sourceIds) {
    const source = getEvidenceSourceById(sourceId, catalog)
    if (!source) continue
    const key = `${source.publisher}|${source.title}|${source.url}`
    if (seen.has(key)) continue
    seen.add(key)
    sources.push({ publisher: source.publisher, title: source.title, url: source.url })
  }

  const verifiedFieldLabels = applicableFieldsFor(recipe).map((field) => FIELD_LABELS[field])

  return { sources, verifiedFieldLabels }
}
