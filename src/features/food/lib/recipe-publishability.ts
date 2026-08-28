// ============================================================
// recipe-publishability.ts
//
// MISSION 2.11 PHASE D.6 — Recipe Provenance & Fact/Evidence Gate。
//
// 「VERIFIEDのみ将来の本番Recipeとして扱える」を判定する唯一の関数
// isRecipePublishable()を提供する。ここはcandidate ranking
// （recipe-suggestion-engine.ts / mock-meal-provider.ts）とは完全に
// 非依存・非結合。development/mock flowは今まで通りunverified Recipeを
// 使用し続けられる（production catalog公開判定とcandidate生成ロジックを
// 密結合させない、というPHASE D.6の絶対要件）。
//
// 絶対ルール（EVIDENCE_POLICY.md参照）:
// - AI knowledge is not evidence。sourceTypeにAI/推測を表す値は存在しない。
// - source間差異の平均値化・欠落値の推測補完はここでは一切行わない
//   （行うのは常に人間によるEvidence Audit側であり、この関数は
//   「その結果として記録されたverification構造が完全か」だけを機械的に検査する）。
// ============================================================

import type {
  Recipe,
  RecipeEvidenceSource,
  RecipeSourceType,
  RecipeVerifiableField,
  RecipeVerificationStatus,
} from '@/features/food/types'
import { EVIDENCE_SOURCE_CATALOG, getEvidenceSourceById, isPlaceholderUrl } from './evidence-sources'

const VALID_STATUSES: readonly RecipeVerificationStatus[] = ['unverified', 'review', 'verified', 'blocked']

/**
 * sourceTypeとして正当な値はこの5種のみ（government/public-institution/
 * manufacturer/professional/other-trusted）。AI・推測・自己申告等を表す
 * 値はここに存在しない＝型システム上「AI推測をEvidenceとして登録できない」
 * （Gate BF）。
 */
const VALID_SOURCE_TYPES: readonly RecipeSourceType[] = [
  'government',
  'public-institution',
  'manufacturer',
  'professional',
  'other-trusted',
]

export function isValidVerificationStatus(status: string): status is RecipeVerificationStatus {
  return (VALID_STATUSES as readonly string[]).includes(status)
}

export function isValidSourceType(sourceType: string): sourceType is RecipeSourceType {
  return (VALID_SOURCE_TYPES as readonly string[]).includes(sourceType)
}

export function isValidCheckedAt(checkedAt: string): boolean {
  if (!checkedAt || checkedAt.trim().length === 0) return false
  return !Number.isNaN(new Date(checkedAt).getTime())
}

/** Source metadataの完全性チェック（URLが存在するだけではEvidence成立とみなさない） */
export function isValidEvidenceSource(source: RecipeEvidenceSource): boolean {
  return (
    source.url.trim().length > 0 &&
    !isPlaceholderUrl(source.url) &&
    source.publisher.trim().length > 0 &&
    source.title.trim().length > 0 &&
    isValidCheckedAt(source.checkedAt) &&
    isValidSourceType(source.sourceType)
  )
}

/** Recipe.verification未設定は実効的にunverifiedとして扱う */
export function getVerificationStatus(recipe: Recipe): RecipeVerificationStatus {
  return recipe.verification?.status ?? 'unverified'
}

/**
 * Recipeの内容に応じて、Evidence追跡が必須となるfieldを決定する。
 * seasonings/cookingLiquids/equipmentは、そのRecipeに実在する場合のみ必須にする
 * （存在しないfieldにまでEvidenceを要求しない）。
 */
export function applicableFieldsFor(recipe: Recipe): RecipeVerifiableField[] {
  const fields: RecipeVerifiableField[] = [
    'requiredIngredients',
    'ingredientAmounts',
    'cookingTimeMinutes',
    'servingsBase',
    'criticalSteps',
    'allergyIdentity',
  ]
  if (recipe.seasonings && recipe.seasonings.length > 0) {
    fields.push('seasonings', 'seasoningAmounts')
  }
  if (recipe.cookingLiquids && recipe.cookingLiquids.length > 0) {
    fields.push('cookingLiquids')
  }
  if (recipe.equipment && recipe.equipment.length > 0) {
    fields.push('equipment')
  }
  return fields
}

/**
 * 将来の本番Recipe catalogとして公開可能かどうかを判定する唯一の関数。
 * candidate ranking（rankRecipes等）からは一切呼ばれない・参照されない。
 */
export function isRecipePublishable(
  recipe: Recipe,
  catalog: RecipeEvidenceSource[] = EVIDENCE_SOURCE_CATALOG,
): boolean {
  const v = recipe.verification

  // 未置換のAI/人間推測値が残っている場合は他の条件に関わらず不可
  if (v?.hasUnsupportedInference === true) return false

  // verification未設定 or status !== 'verified' は不可（unverified/review/blockedはpublishableにならない）
  if (!v) return false
  if (!isValidVerificationStatus(v.status)) return false
  if (v.status !== 'verified') return false

  // VERIFIEDには最低1件以上のsourceが必要
  if (v.sourceIds.length === 0) return false

  // 同一source id重複なし・各sourceが実在しmetadataが完全であること
  const seenSourceIds = new Set<string>()
  for (const sourceId of v.sourceIds) {
    if (seenSourceIds.has(sourceId)) return false
    seenSourceIds.add(sourceId)

    const source = getEvidenceSourceById(sourceId, catalog)
    if (!source) return false
    if (!isValidEvidenceSource(source)) return false
  }

  // VERIFIEDなのにreviewNotesで未解決問題が残っている場合は不可
  if ((v.reviewNotes ?? []).length > 0) return false

  // MISSION 2.11 PHASE D.7-B — Gate BU: Recipe Identityが必須
  // （「同じ料理名なら同じRecipe」という扱いを防ぎ、variant混同を防止する）
  if (!v.recipeIdentity) return false
  if (
    !v.recipeIdentity.canonicalDish.trim() ||
    !v.recipeIdentity.variant.trim() ||
    !v.recipeIdentity.intendedTasteProfile.trim() ||
    !v.recipeIdentity.coreMethod.trim() ||
    v.recipeIdentity.definingIngredients.length === 0
  ) {
    return false
  }

  // 重要fieldのEvidenceが揃っていること（各fieldVerificationのsourceIdsは
  // 空でなく、かつverification.sourceIdsの部分集合であること）。
  // Gate BV: supportType='variant'（またはsupportType未設定）は「解決済み」として
  // カウントしない（variant不一致のsourceを直接支持として扱わない）。
  // Gate BQ: supportType='derived'はderivationが必須。
  // MISSION 2.11 PHASE D.7-B.1 — Gate CA（Evidence Range Integrity）:
  // supportType='range'は、derivationの有無に関わらず「解決済み」として
  // 絶対にカウントしない。「rangeの中央値を採用すればEvidence上のexact valueに
  // なる」という扱いを禁止する（Evidence Fact上、rangeは最後までrangeのまま）。
  // Recipeへ実際に採用した単一値はEvidenceではなくRecipeVerification.productDecisions
  // に記録されたProduct Decisionであり、ここでのEvidence解決判定には一切使わない。
  const fieldVerificationMap = new Map((v.fieldVerifications ?? []).map((fv) => [fv.field, fv]))
  for (const field of applicableFieldsFor(recipe)) {
    const fv = fieldVerificationMap.get(field)
    if (!fv || fv.sourceIds.length === 0) return false
    for (const sourceId of fv.sourceIds) {
      if (!v.sourceIds.includes(sourceId)) return false
    }
    if (fv.supportType === undefined || fv.supportType === 'variant' || fv.supportType === 'range') {
      return false
    }
    if (fv.supportType === 'derived' && !fv.derivation?.trim()) {
      return false
    }
  }

  return true
}

/**
 * MISSION 2.11 PHASE D.7-B.1 — Gate CA（Evidence Range Integrity）の単体チェック用。
 * 「rangeがVERIFIEDの解決済みとしてカウントされていないか」を明示的に検証できる
 * ヘルパー。isRecipePublishable内のロジックと同じ結論を返すが、テスト・監査で
 * 意図を読み取りやすくするために公開する。
 */
export function hasUnresolvedRangeEvidence(recipe: Recipe): boolean {
  const fieldVerifications = recipe.verification?.fieldVerifications ?? []
  return fieldVerifications.some((fv) => fv.supportType === 'range')
}
