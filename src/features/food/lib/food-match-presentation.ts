// ============================================================
// food-match-presentation.ts
//
// MISSION 2.40 — MISSION 2.39 の Matching Truth をユーザー向け Presentation へ
// 変換する純粋関数群。
//
// 絶対ルール:
// - 内部の matchClass（EXACT/LOW/MISSING/UNRESOLVED/AMBIGUOUS）を統合・破壊しない。
//   UNRESOLVED ≠ AMBIGUOUS は内部 count で別のまま保持する（表示だけ「確認が必要」へまとめる）。
// - 「家にある」= EXACT は「必要量が十分」ではない。quantityNote は常に 'not-evaluated'。
//   「十分あります」「これだけで作れます」を UI 文言で断定しない。
// - Source Fact（quantityDisplayText / servings / heat / time / occasion / country）を
//   UI 都合で生成・補完・変更しない。Presentation → Source Fact の mutation なし。
// - Meal Occasion は明示 metadata がある場合のみ表示（推測分類しない）。
// - Firewall: recipe-publishability / recipe-safety / practical-cook-validation /
//   recipe-catalog / recipe-suggestion-engine / mock-meal-provider / ai-provider を import しない。
// - deterministic pure function のみ（乱数・現在時刻・ネットワーク・AI なし）。
// ============================================================

import type {
  CountryCode,
  ForwardMatchListPresentation,
  IngredientAvailabilityLabel,
  IngredientAvailabilityPresentation,
  IngredientMatchClass,
  MealOccasion,
  NukitoruPresentation,
  RecipeDetailPresentation,
  RecipeFoodMatchResult,
  RecipeMatchHeadline,
  RecipeMatchPresentation,
  SourceRecipeKnowledge,
  WorldRecipeIdentity,
} from '@/features/food/types'
import { MEAL_OCCASION_JA_LABELS } from './meal-occasion'

// ------------------------------------------------------------
// Ingredient Match → ユーザー向けラベル
// ------------------------------------------------------------

/** 内部 matchClass → 表示ラベル（UNRESOLVED / AMBIGUOUS はどちらも 'needs-check'） */
export function availabilityLabel(matchClass: IngredientMatchClass): IngredientAvailabilityLabel {
  switch (matchClass) {
    case 'EXACT':
      return 'at-home'
    case 'LOW':
      return 'low'
    case 'MISSING':
      return 'missing'
    case 'UNRESOLVED':
    case 'AMBIGUOUS':
      return 'needs-check'
  }
}

const AVAILABILITY_LABEL_JA: Record<IngredientAvailabilityLabel, string> = {
  'at-home': '家にある',
  low: '少ない',
  missing: '足りない',
  'needs-check': '確認が必要',
}

export function availabilityLabelJa(label: IngredientAvailabilityLabel): string {
  return AVAILABILITY_LABEL_JA[label]
}

const HEADLINE_JA: Record<RecipeMatchHeadline, string> = {
  // §13 Quantity Truth: 「十分」「これだけで作れる」を断定しない
  ALL_LISTED_AT_HOME: '材料はすべて家にあります（分量は未確認）',
  SOME_MISSING: '足りない材料があります',
  NEEDS_CHECK_ONLY: '確認が必要な材料があります',
}

export function headlineJa(headline: RecipeMatchHeadline): string {
  return HEADLINE_JA[headline]
}

// ------------------------------------------------------------
// RecipeFoodMatchResult → RecipeMatchPresentation
// ------------------------------------------------------------

function occasionLabels(occasions: MealOccasion[]): string[] {
  return occasions.map((o) => MEAL_OCCASION_JA_LABELS[o])
}

export function toRecipeMatchPresentation(
  result: RecipeFoodMatchResult,
): RecipeMatchPresentation {
  const ingredients: IngredientAvailabilityPresentation[] = result.ingredientMatches.map((m) => ({
    sourceIngredientName: m.requirement.sourceIngredientName,
    ...(m.requirement.quantityDisplayText !== undefined
      ? { quantityDisplayText: m.requirement.quantityDisplayText }
      : {}),
    label: availabilityLabel(m.matchClass),
    internalMatchClass: m.matchClass,
    quantityNote: 'not-evaluated',
  }))

  const needsCheckCount = result.unresolvedCount + result.ambiguousCount

  let headline: RecipeMatchHeadline
  if (result.missingCount > 0) {
    headline = 'SOME_MISSING'
  } else if (needsCheckCount > 0) {
    headline = 'NEEDS_CHECK_ONLY'
  } else {
    headline = 'ALL_LISTED_AT_HOME'
  }

  return {
    canonicalRecipeId: result.canonicalRecipeId,
    recipeName: result.recipeName,
    mealOccasions: result.mealOccasions,
    mealOccasionLabels: result.mealOccasionKnown ? occasionLabels(result.mealOccasions) : [],
    ingredients,
    atHomeCount: result.exactCount,
    lowCount: result.lowCount,
    missingCount: result.missingCount,
    needsCheckCount,
    unresolvedCount: result.unresolvedCount,
    ambiguousCount: result.ambiguousCount,
    listedIngredientCount: result.listedIngredientCount,
    headline,
    shoppingHint: {
      missingCount: result.missingCount,
      missingCanonicalIngredientIds: result.missingCanonicalIngredientIds,
    },
  }
}

/** ラベルごとに材料をグループ化（表示順は at-home → low → missing → needs-check） */
export const AVAILABILITY_LABEL_ORDER: readonly IngredientAvailabilityLabel[] = [
  'at-home',
  'low',
  'missing',
  'needs-check',
]

export function groupIngredientsByLabel(
  presentation: RecipeMatchPresentation,
): Record<IngredientAvailabilityLabel, IngredientAvailabilityPresentation[]> {
  const groups = {
    'at-home': [] as IngredientAvailabilityPresentation[],
    low: [] as IngredientAvailabilityPresentation[],
    missing: [] as IngredientAvailabilityPresentation[],
    'needs-check': [] as IngredientAvailabilityPresentation[],
  }
  for (const ing of presentation.ingredients) {
    groups[ing.label].push(ing)
  }
  return groups
}

// ------------------------------------------------------------
// Forward list（家にあるもので作る）
// ------------------------------------------------------------

/** §40: 候補ゼロを「作れる料理はありません」と断定しない中立文言 */
export const NO_CANDIDATES_TEXT =
  '現在登録されている料理の中では、条件に合う候補が見つかりませんでした'

export function toForwardMatchListPresentation(
  results: RecipeFoodMatchResult[],
): ForwardMatchListPresentation {
  const items = results.map(toRecipeMatchPresentation)
  return {
    items,
    rankingMeaning: 'availability-fit',
    ...(items.length === 0 ? { emptyStateText: NO_CANDIDATES_TEXT } : {}),
  }
}

/** ranking の意味を UI に出すための固定文言（「おすすめ順」ではない） */
export const RANKING_MEANING_TEXT = '家にある食材との一致状況で並んでいます（おすすめ順ではありません）'

// ------------------------------------------------------------
// Recipe Detail Presentation（Source Fact を変更しない）
// ------------------------------------------------------------

function formatTimeValueDisplay(
  value: SourceRecipeKnowledge['sourceStatedTotalTime'],
): string | undefined {
  if (!value) return undefined
  switch (value.kind) {
    case 'exact':
      return `${value.minutes}分`
    case 'range':
      return `${value.minMinutes}〜${value.maxMinutes}分`
    case 'approximate':
      return `約${value.minutes}分`
    case 'unknown':
      return undefined
  }
}

export interface RecipeDetailPresentationInput {
  knowledge: SourceRecipeKnowledge
  /** あれば工程は NukitoruPresentation.steps を使う（Source 由来の heat/time のみ） */
  presentation?: NukitoruPresentation
  /** あれば材料に availability を付与 */
  matchResult?: RecipeFoodMatchResult
  /** あれば国/地域を表示（identityEvidenceSourceIds がある場合のみ） */
  identity?: WorldRecipeIdentity
}

export function toRecipeDetailPresentation(
  input: RecipeDetailPresentationInput,
): RecipeDetailPresentation {
  const { knowledge, presentation, matchResult, identity } = input

  const availabilityByName = new Map<string, IngredientAvailabilityLabel>()
  if (matchResult) {
    for (const m of matchResult.ingredientMatches) {
      availabilityByName.set(m.requirement.sourceIngredientName, availabilityLabel(m.matchClass))
    }
  }

  const ingredients = knowledge.ingredients.map((ing) => ({
    sourceIngredientName: ing.sourceIngredientName,
    ...(ing.quantity?.displayText !== undefined
      ? { quantityDisplayText: ing.quantity.displayText }
      : {}),
    ...(ing.preparationState !== undefined ? { preparationState: ing.preparationState } : {}),
    ...(availabilityByName.has(ing.sourceIngredientName)
      ? { availability: availabilityByName.get(ing.sourceIngredientName) }
      : {}),
  }))

  const steps: RecipeDetailPresentation['steps'] = presentation
    ? presentation.steps.map((s, i) => ({
        displayNumber: i + 1,
        title: s.title,
        shortInstruction: s.shortInstruction,
        ingredientActions: [...s.ingredientActions],
        ...(s.heatAction !== undefined ? { heatAction: s.heatAction } : {}),
        ...(s.durationDisplay !== undefined ? { durationDisplay: s.durationDisplay } : {}),
        ...(s.completionCue !== undefined ? { completionCue: s.completionCue } : {}),
        ...(s.warning !== undefined ? { warning: s.warning } : {}),
        sourceStepReference: s.sourceStepReference,
      }))
    : knowledge.cookingSteps.map((s, i) => ({
        displayNumber: i + 1,
        title: s.factSummary ?? `手順 ${s.order}`,
        shortInstruction: s.factSummary ?? '',
        ingredientActions: [],
        sourceStepReference: s.order,
      }))

  // 国/地域は identity に Evidence がある場合のみ
  const hasIdentityEvidence =
    identity !== undefined && (identity.identityEvidenceSourceIds ?? []).length > 0
  const originCountry: CountryCode | undefined = hasIdentityEvidence ? identity!.country : undefined
  const originRegion: string | undefined = hasIdentityEvidence ? identity!.region : undefined

  const occasionLabelsList =
    matchResult && matchResult.mealOccasionKnown
      ? occasionLabels(matchResult.mealOccasions)
      : []

  return {
    canonicalRecipeId: knowledge.canonicalRecipeId,
    recipeName: knowledge.sourceRecipeName,
    ...(originCountry !== undefined ? { originCountry } : {}),
    ...(originRegion !== undefined ? { originRegion } : {}),
    mealOccasionLabels: occasionLabelsList,
    ...(knowledge.servings?.displayText !== undefined
      ? { servingsDisplayText: knowledge.servings.displayText }
      : {}),
    ingredients,
    preCookPreparation: (knowledge.preCookPreparation ?? []).map((p) => p.text),
    preparation: (knowledge.preparation ?? []).map((p) => p.text),
    steps,
    ...(formatTimeValueDisplay(knowledge.sourceStatedTotalTime) !== undefined
      ? { sourceStatedTotalTimeDisplay: formatTimeValueDisplay(knowledge.sourceStatedTotalTime) }
      : {}),
    evidence: {
      evidenceSourceId: knowledge.evidenceSourceId,
      imported: knowledge.importProvenance !== undefined,
    },
  }
}
