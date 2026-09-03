// ============================================================
// world-food-knowledge.ts
//
// MISSION 2.35 — World Food Knowledge Foundation。
//
// 「世界にすでに存在する信頼できる料理知識（SOURCE RECIPE KNOWLEDGE）を、
// Evidence と出典を保持したまま、NUKITORU PRESENTATION（スマホで迷わない表示）へ
// 変換する」ための最小の純粋関数群。
//
// 絶対ルール（WORLD_FOOD_KNOWLEDGE_PRINCIPLES.md 参照）:
// - FACTS MUST NOT CHANGE: Presentation 生成は SOURCE RECIPE KNOWLEDGE の料理事実
//   （分量・火加減・時間・器具・工程）を一切変更しない。表示の作り直しだけを行う。
// - UNKNOWN は UNKNOWN: 情報源が火加減／時間を示していない手順で、Presentation に
//   heatAction / durationDisplay を勝手に埋めない（"medium" / "5分" 等にしない）。
// - Translation is not Evidence / Calculation is not Culinary Evidence /
//   Canonicalization is not Allergen Composition。
// - Presentation の各事実は SourceCookingStep へ追跡可能（sourceStepReference）。
// - Firewall: このモジュールは recipe-publishability.ts / recipe-suggestion-engine.ts /
//   recipe-catalog.ts / recipe-safety.ts / practical-cook-validation.ts /
//   mock-meal-provider.ts / from-now-to-table.ts を一切 import しない。
//   RecipeVerificationStatus / isRecipePublishable / PracticalCookValidation /
//   Allergy HARD EXCLUSION のいずれも読み書きしない。
// - fuzzy matching 禁止（名称解決は trim + lowercase の完全一致のみ）。
// ============================================================

import type {
  Locale,
  NukitoruPresentation,
  PresentationStep,
  ProductUnitConversion,
  QuantityStatement,
  RecipeEvidenceSource,
  SourceCookingStep,
  SourceHeatLevel,
  SourceHeatTransition,
  SourceIngredientKnowledge,
  SourceRecipeKnowledge,
  TimeValue,
  WorldRecipeCanonicalId,
  WorldRecipeIdentity,
} from '@/features/food/types'
import { EVIDENCE_SOURCE_CATALOG, getEvidenceSourceById } from './evidence-sources'
import { WORLD_RECIPE_IDENTITY_REGISTRY } from './world-recipe-identity'

// ------------------------------------------------------------
// World Recipe Identity 解決（表示名 ≠ Canonical Identity）
// ------------------------------------------------------------

function normalizeName(raw: string): string {
  return raw.trim().toLowerCase()
}

/** WorldRecipeIdentity の全「名前」（canonical / local / ja / en / aliases）を返す */
export function identityNameVariants(identity: WorldRecipeIdentity): string[] {
  const names = [
    identity.canonicalName,
    identity.localName,
    identity.japaneseName,
    identity.englishName,
    ...(identity.aliases ?? []),
  ]
  return names.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
}

/**
 * 日本語名・英語名・原語名のいずれからでも、同じ Canonical Recipe Identity を解決する。
 * 完全一致（trim + lowercase）のみ。fuzzy matching は一切行わない。
 * 未知の名前は undefined（勝手に近い料理へ割り当てない）。
 */
export function resolveWorldRecipeIdentity(
  name: string,
  registry: WorldRecipeIdentity[] = WORLD_RECIPE_IDENTITY_REGISTRY,
): WorldRecipeIdentity | undefined {
  const key = normalizeName(name)
  if (key.length === 0) return undefined
  return registry.find((identity) =>
    identityNameVariants(identity).some((variant) => normalizeName(variant) === key),
  )
}

export function getWorldRecipeIdentityById(
  id: WorldRecipeCanonicalId,
  registry: WorldRecipeIdentity[] = WORLD_RECIPE_IDENTITY_REGISTRY,
): WorldRecipeIdentity | undefined {
  return registry.find((identity) => identity.canonicalRecipeId === id)
}

/**
 * 2 つの名前が同一の Canonical Recipe Identity を指すか。
 * 表示文字列そのものではなく canonicalRecipeId の一致で判定する。
 * どちらかが未解決なら false。
 */
export function namesResolveToSameWorldRecipe(
  nameA: string,
  nameB: string,
  registry: WorldRecipeIdentity[] = WORLD_RECIPE_IDENTITY_REGISTRY,
): boolean {
  const a = resolveWorldRecipeIdentity(nameA, registry)
  const b = resolveWorldRecipeIdentity(nameB, registry)
  if (!a || !b) return false
  return a.canonicalRecipeId === b.canonicalRecipeId
}

// ------------------------------------------------------------
// Evidence Traceability（SOURCE KNOWLEDGE → Evidence Source）
// ------------------------------------------------------------

/**
 * SourceRecipeKnowledge の evidenceSourceId が EVIDENCE_SOURCE_CATALOG に実在するか。
 * URL 文字列を持っているだけでは不十分（既存 Evidence モデルの実在チェックを再利用）。
 */
export function sourceKnowledgeHasValidEvidence(
  knowledge: SourceRecipeKnowledge,
  catalog: RecipeEvidenceSource[] = EVIDENCE_SOURCE_CATALOG,
): boolean {
  return getEvidenceSourceById(knowledge.evidenceSourceId, catalog) !== undefined
}

/** SourceRecipeKnowledge を裏付ける Evidence Source を返す（Traceability） */
export function getEvidenceForSourceKnowledge(
  knowledge: SourceRecipeKnowledge,
  catalog: RecipeEvidenceSource[] = EVIDENCE_SOURCE_CATALOG,
): RecipeEvidenceSource | undefined {
  return getEvidenceSourceById(knowledge.evidenceSourceId, catalog)
}

// ------------------------------------------------------------
// Canonicalization firewall（Canonicalization ≠ Allergen Composition ≠ Evidence 変更）
// ------------------------------------------------------------

/**
 * 食材知識へ canonicalIngredientId / normalizedName を「後付け」する。
 * sourceIngredientName・quantity・role・preparationState は一切変更しない
 * （元オブジェクトも変更しない。新しいコピーを返す）。
 * Canonicalization は Evidence（原文の分量・名前）を書き換えない。
 */
export function attachCanonicalIngredientId(
  ingredient: SourceIngredientKnowledge,
  canonicalIngredientId: string,
  normalizedName?: string,
): SourceIngredientKnowledge {
  return {
    ...ingredient,
    canonicalIngredientId,
    ...(normalizedName !== undefined ? { normalizedName } : {}),
  }
}

/** 情報源の原文の分量表記（displayText）をそのまま返す。無ければ undefined */
export function sourceQuantityText(ingredient: SourceIngredientKnowledge): string | undefined {
  return ingredient.quantity?.displayText
}

// ------------------------------------------------------------
// 表示ヘルパー（UNKNOWN は UNKNOWN）
// ------------------------------------------------------------

const HEAT_LEVEL_LABELS: Record<Exclude<SourceHeatLevel, 'unknown'>, string> = {
  off: '火を止める',
  'very-low': 'ごく弱火',
  low: '弱火',
  'medium-low': '弱めの中火',
  medium: '中火',
  'medium-high': '強めの中火',
  high: '強火',
}

const HEAT_TRANSITION_LABELS: Record<Exclude<SourceHeatTransition, 'unknown'>, string> = {
  'turn-on': '火をつける',
  keep: 'そのまま',
  lower: '火を弱める',
  raise: '火を強める',
  'turn-off': '火を止める',
}

function isKnownHeatLevel(
  heat: SourceHeatLevel | undefined,
): heat is Exclude<SourceHeatLevel, 'unknown'> {
  return heat !== undefined && heat !== 'unknown'
}

function isKnownHeatTransition(
  transition: SourceHeatTransition | undefined,
): transition is Exclude<SourceHeatTransition, 'unknown'> {
  return transition !== undefined && transition !== 'unknown'
}

/**
 * 火の操作の表示文字列。情報源が火加減も火加減変化も示していない場合は undefined
 * （"medium" 等で埋めない）。level と transition の両方があれば併記する。
 */
export function describeSourceHeat(step: SourceCookingStep): string | undefined {
  const parts: string[] = []
  if (isKnownHeatLevel(step.heat)) {
    parts.push(HEAT_LEVEL_LABELS[step.heat])
  }
  if (isKnownHeatTransition(step.heatTransition)) {
    parts.push(HEAT_TRANSITION_LABELS[step.heatTransition])
  }
  if (parts.length === 0) return undefined
  return parts.join(' → ')
}

/**
 * 時間の表示文字列。range は "2〜3分"、approximate は "約30分"、exact は "15分"。
 * unknown / 未設定は undefined（"5分" 等で埋めない・range を midpoint 化しない）。
 */
export function formatDurationDisplay(value: TimeValue | undefined): string | undefined {
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

/** step の能動時間（優先）または受動時間の表示。両方 unknown/無しなら undefined */
export function stepDurationDisplay(step: SourceCookingStep): string | undefined {
  return formatDurationDisplay(step.duration) ?? formatDurationDisplay(step.passiveDuration)
}

// ------------------------------------------------------------
// Presentation 生成（FACTS MUST NOT CHANGE / traceable）
// ------------------------------------------------------------

/**
 * 人間が用意する Presentation の「表示テキスト」部分。
 * これは SOURCE KNOWLEDGE の料理事実（火加減・時間・完成合図）を含まない。
 * 事実は buildPresentationStep が SourceCookingStep からのみ導出する。
 */
export interface AuthoredPresentationText {
  title: string
  shortInstruction: string
  ingredientActions: string[]
  toolAction?: string
  warning?: string
}

/**
 * 1 つの SourceCookingStep から 1 つの PresentationStep を組み立てる（本 MISSION の中核）。
 *
 * - heatAction / durationDisplay / completionCue は sourceStep からのみ導出する。
 *   sourceStep がその事実を示していなければ undefined のまま（発明しない）。
 * - title / shortInstruction / ingredientActions / toolAction / warning は
 *   authored（人間による表示の作り直し）をそのまま使う。ここに火加減・時間・
 *   完成合図などの「事実」を混ぜてはならない（それらは上記フィールドが担う）。
 * - sourceStepReference は必ず sourceStep.order。
 */
export function buildPresentationStep(
  sourceStep: SourceCookingStep,
  authored: AuthoredPresentationText,
): PresentationStep {
  const heatAction = describeSourceHeat(sourceStep)
  const durationDisplay = stepDurationDisplay(sourceStep)
  const completionCue =
    typeof sourceStep.completionSign === 'string' && sourceStep.completionSign.trim().length > 0
      ? sourceStep.completionSign
      : undefined

  return {
    title: authored.title,
    shortInstruction: authored.shortInstruction,
    ingredientActions: [...authored.ingredientActions],
    ...(authored.toolAction !== undefined ? { toolAction: authored.toolAction } : {}),
    ...(heatAction !== undefined ? { heatAction } : {}),
    ...(durationDisplay !== undefined ? { durationDisplay } : {}),
    ...(completionCue !== undefined ? { completionCue } : {}),
    ...(authored.warning !== undefined ? { warning: authored.warning } : {}),
    sourceStepReference: sourceStep.order,
  }
}

// ------------------------------------------------------------
// Presentation 検証（Evidence を増やしていないことの機械チェック）
// ------------------------------------------------------------

/**
 * 1 つの PresentationStep が、対応する SourceCookingStep に対して
 * 「事実を追加していない」ことを検査する。違反理由の配列を返す（空 = OK）。
 */
export function presentationStepViolations(
  sourceStep: SourceCookingStep,
  presentationStep: PresentationStep,
): string[] {
  const violations: string[] = []

  if (presentationStep.sourceStepReference !== sourceStep.order) {
    violations.push(
      `sourceStepReference(${presentationStep.sourceStepReference}) が SourceCookingStep.order(${sourceStep.order}) と一致しない`,
    )
  }

  const sourceHasHeat =
    isKnownHeatLevel(sourceStep.heat) || isKnownHeatTransition(sourceStep.heatTransition)
  if (presentationStep.heatAction !== undefined && !sourceHasHeat) {
    violations.push('情報源が火加減を示していない手順に heatAction を付与している（UNKNOWN を具体化）')
  }

  const sourceHasDuration =
    (sourceStep.duration !== undefined && sourceStep.duration.kind !== 'unknown') ||
    (sourceStep.passiveDuration !== undefined && sourceStep.passiveDuration.kind !== 'unknown')
  if (presentationStep.durationDisplay !== undefined && !sourceHasDuration) {
    violations.push('情報源が時間を示していない手順に durationDisplay を付与している（UNKNOWN を具体化）')
  }

  const sourceHasCompletionSign =
    typeof sourceStep.completionSign === 'string' && sourceStep.completionSign.trim().length > 0
  if (presentationStep.completionCue !== undefined && !sourceHasCompletionSign) {
    violations.push('情報源が完成の目安を示していない手順に completionCue を付与している')
  }

  // range を midpoint 化していないか（durationDisplay が range 表記を保っているか）
  if (presentationStep.durationDisplay !== undefined) {
    const expected = stepDurationDisplay(sourceStep)
    if (expected !== undefined && presentationStep.durationDisplay !== expected) {
      violations.push(
        `durationDisplay("${presentationStep.durationDisplay}") が SOURCE 由来の表記("${expected}") と一致しない`,
      )
    }
  }

  return violations
}

export interface PresentationFactCheckResult {
  ok: boolean
  violations: string[]
}

/**
 * NukitoruPresentation 全体が SourceRecipeKnowledge の料理事実を変更していないこと、
 * かつすべての PresentationStep が SOURCE へ追跡可能であることを検査する。
 */
export function presentationPreservesSourceFacts(
  knowledge: SourceRecipeKnowledge,
  presentation: NukitoruPresentation,
): PresentationFactCheckResult {
  const violations: string[] = []

  if (presentation.canonicalRecipeId !== knowledge.canonicalRecipeId) {
    violations.push('canonicalRecipeId が SourceRecipeKnowledge と一致しない')
  }
  if (presentation.sourceEvidenceSourceId !== knowledge.evidenceSourceId) {
    violations.push('sourceEvidenceSourceId が SourceRecipeKnowledge.evidenceSourceId と一致しない')
  }

  const stepByOrder = new Map(knowledge.cookingSteps.map((s) => [s.order, s]))
  for (const [index, presentationStep] of presentation.steps.entries()) {
    const sourceStep = stepByOrder.get(presentationStep.sourceStepReference)
    if (!sourceStep) {
      violations.push(
        `steps[${index}] の sourceStepReference(${presentationStep.sourceStepReference}) に対応する SourceCookingStep が存在しない`,
      )
      continue
    }
    for (const violation of presentationStepViolations(sourceStep, presentationStep)) {
      violations.push(`steps[${index}]: ${violation}`)
    }
  }

  return { ok: violations.length === 0, violations }
}

/**
 * ある PresentationStep から、依拠した SourceCookingStep と Evidence Source を辿る。
 * 「なぜこの手順・この時間・この火加減なのか」に答えられる構造（Traceability）。
 */
export function tracePresentationStep(
  presentation: NukitoruPresentation,
  stepIndex: number,
  knowledge: SourceRecipeKnowledge,
  catalog: RecipeEvidenceSource[] = EVIDENCE_SOURCE_CATALOG,
): { sourceStep: SourceCookingStep; evidence: RecipeEvidenceSource } | undefined {
  const presentationStep = presentation.steps[stepIndex]
  if (!presentationStep) return undefined
  const sourceStep = knowledge.cookingSteps.find(
    (s) => s.order === presentationStep.sourceStepReference,
  )
  if (!sourceStep) return undefined
  const evidence = getEvidenceSourceById(knowledge.evidenceSourceId, catalog)
  if (!evidence) return undefined
  return { sourceStep, evidence }
}

// ------------------------------------------------------------
// Unit conversion 境界（SOURCE FACT ≠ PRODUCT CONVERSION）
// ------------------------------------------------------------

/**
 * Product 換算値を作る（本 MISSION では実換算は行わない。境界の型を提供するのみ）。
 * sourceStatement（情報源の原文の分量）は決して書き換えない。
 * 「計算できる ≠ Evidence である」。
 */
export function makeProductUnitConversion(
  sourceStatement: QuantityStatement,
  convertedValue: number,
  convertedUnit: string,
  conversionNote: string,
): ProductUnitConversion {
  return { sourceStatement, convertedValue, convertedUnit, conversionNote }
}

// ------------------------------------------------------------
// Locale ヘルパー（Locale ≠ Country ≠ Language ≠ Cuisine）
// ------------------------------------------------------------

export function sameLocale(a: Locale, b: Locale): boolean {
  return a.language === b.language && a.country === b.country
}
