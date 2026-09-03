// ============================================================
// world-recipe-import.ts
//
// MISSION 2.37 — Rights-Aware World Recipe Import Pipeline (MVP)。
//
//   RAW SOURCE DATA
//     ↓ normalizeRecipeCandidate（単位換算・翻訳・欠落補完を一切しない）
//   RawRecipeImportCandidate
//     ↓ evaluateRecipeImportRights（Rights Gate / fail-closed）
//     ↓ resolveImportIdentity（完全一致のみ・fuzzy 禁止・新規 Identity 生成禁止）
//   promoteCandidateToSourceKnowledge → SourceRecipeKnowledge (+ importProvenance)
//     ↓ MISSION 2.35 buildPresentation で NukitoruPresentation
//
// 絶対ルール:
// - SOURCE RIGHTS ≠ RECORD RIGHTS ≠ ASSET RIGHTS。inheritance: record override > source default。
// - fail-closed: unknown / conditional / prohibited / 欠落 は Import 不可。UNKNOWN を allowed へ昇格しない。
// - RIGHTS EVIDENCE（保存してよいか）≠ CULINARY EVIDENCE（分量・工程の根拠）。
// - Import 可能 ≠ VERIFIED / Publishable / Allergy-safe / Practically-validated / AI-training permitted。
// - Firewall: このモジュールは recipe-publishability.ts / recipe-safety.ts /
//   practical-cook-validation.ts / recipe-catalog.ts / mock-meal-provider.ts /
//   recipe-suggestion-engine.ts / from-now-to-table.ts / ai-provider.ts を一切 import しない。
//   RecipeVerification / PracticalCookValidation を読み書きしない。verifyRecipe / publishRecipe を呼ばない。
// - 画像の download / storage / render を実装しない。imageUrl は Knowledge へ転写しない。
// - fact preservation: heat unknown → unknown / duration 無し → 無し / range → range のまま /
//   単位換算しない / 翻訳しない。
// ============================================================

import type {
  EffectiveRecipeRights,
  ImportDecisionReason,
  RawRecipeImportCandidate,
  RecipeImportProvenance,
  RecipeImportRightsDecision,
  RecipeImportResult,
  SourceRecipeKnowledge,
  WorldFoodRightsProfile,
  WorldFoodSource,
  WorldFoodSourceRecordRights,
  WorldRecipeIdentity,
} from '@/features/food/types'
import { WORLD_FOOD_SOURCE_REGISTRY } from './world-food-sources'
import { WORLD_RECIPE_IDENTITY_REGISTRY } from './world-recipe-identity'
import { getWorldRecipeIdentityById } from './world-food-knowledge'

const RIGHTS_KEYS: (keyof WorldFoodRightsProfile)[] = [
  'commercialUse',
  'structuredFactStorage',
  'verbatimTextStorage',
  'imageReuse',
  'aiMlUse',
]

// ------------------------------------------------------------
// Source Registry lookup
// ------------------------------------------------------------

export function getWorldFoodSource(
  sourceId: string,
  registry: WorldFoodSource[] = WORLD_FOOD_SOURCE_REGISTRY,
): WorldFoodSource | undefined {
  return registry.find((s) => s.sourceId === sourceId)
}

// ------------------------------------------------------------
// Rights inheritance（override > source default）
// ------------------------------------------------------------

/**
 * source default と record override を合成した実効 rights。
 * record.rightsOverride に設定された flag のみ record 由来、それ以外は source 由来。
 * source 由来値が 'unknown' でも勝手に変えない（fail-closed は Gate 側で行う）。
 */
export function resolveEffectiveRights(
  source: WorldFoodSource,
  recordRights: WorldFoodSourceRecordRights,
): EffectiveRecipeRights {
  const override = recordRights.rightsOverride ?? {}
  const resolvedFrom = {} as EffectiveRecipeRights['resolvedFrom']
  const out = {} as EffectiveRecipeRights

  for (const key of RIGHTS_KEYS) {
    const overrideValue = override[key]
    if (overrideValue !== undefined) {
      out[key] = overrideValue
      resolvedFrom[key] = 'record-override'
    } else {
      out[key] = source.rights[key]
      resolvedFrom[key] = 'source-default'
    }
  }
  out.resolvedFrom = resolvedFrom
  return out
}

// ------------------------------------------------------------
// Rights Gate（fail-closed）
// ------------------------------------------------------------

function hasProvenance(recordRights: WorldFoodSourceRecordRights): boolean {
  return (
    recordRights.sourceId.trim().length > 0 &&
    recordRights.sourceRecordId.trim().length > 0 &&
    recordRights.sourceUrl.trim().length > 0
  )
}

function nonEmpty(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * MISSION 2.37 の Rights Gate。決定論的な純粋関数。
 *
 * Import を許可する条件（すべて満たす）:
 * - source が registry に登録されている
 * - source.classification !== 'do-not-ingest'
 * - source.classification が 'unknown' / 'research-only' の場合、record.rightsOverride で
 *   structuredFactStorage を明示的に 'allowed' へ上書きしている
 * - source.checkedAt が存在
 * - record の provenance（sourceId / sourceRecordId / sourceUrl）が揃っている
 * - record.rightsStatus が 'do-not-ingest' / 'unknown' ではない
 * - record.rightsCheckedAt が存在
 * - record.thirdPartyRights が 'unresolved' / 'unknown' ではない
 * - 実効 structuredFactStorage === 'allowed'（'conditional' / 'unknown' / 'prohibited' は不可）
 *
 * commercialUse が allowed でも Import は許可しない。aiMlUse は Import 可否に使わない。
 */
export function evaluateRecipeImportRights(
  candidate: RawRecipeImportCandidate,
  sourceRegistry: WorldFoodSource[] = WORLD_FOOD_SOURCE_REGISTRY,
): RecipeImportRightsDecision {
  const reasons: ImportDecisionReason[] = []
  const recordRights = candidate.recordRights

  const source = getWorldFoodSource(recordRights.sourceId, sourceRegistry)
  if (!source) {
    return {
      allowed: false,
      reasons: ['SOURCE_NOT_REGISTERED'],
      imageImportAllowed: false,
      aiMlUse: 'unknown',
    }
  }

  const effectiveRights = resolveEffectiveRights(source, recordRights)
  const overrideAllowsStorage = recordRights.rightsOverride?.structuredFactStorage === 'allowed'

  // ---- Source-level ----
  if (source.classification === 'do-not-ingest') {
    reasons.push('SOURCE_DO_NOT_INGEST')
  } else if (source.classification === 'unknown' && !overrideAllowsStorage) {
    reasons.push('SOURCE_CLASSIFICATION_UNKNOWN')
  } else if (source.classification === 'research-only' && !overrideAllowsStorage) {
    reasons.push('SOURCE_RESEARCH_ONLY')
  }
  if (!nonEmpty(source.checkedAt)) {
    reasons.push('SOURCE_RIGHTS_CHECK_DATE_MISSING')
  }

  // ---- Record-level ----
  if (!hasProvenance(recordRights)) {
    reasons.push('RECORD_PROVENANCE_MISSING')
  }
  if (recordRights.rightsStatus === 'do-not-ingest') {
    reasons.push('RECORD_RIGHTS_DO_NOT_INGEST')
  } else if (recordRights.rightsStatus === 'unknown') {
    reasons.push('RECORD_RIGHTS_UNKNOWN')
  }
  if (!nonEmpty(recordRights.rightsCheckedAt)) {
    reasons.push('RECORD_RIGHTS_CHECK_DATE_MISSING')
  }
  if (
    recordRights.thirdPartyRights === 'unresolved' ||
    recordRights.thirdPartyRights === 'unknown'
  ) {
    reasons.push('THIRD_PARTY_RIGHTS_UNRESOLVED')
  }

  // ---- Structured fact storage（Import の核心条件・fail-closed）----
  switch (effectiveRights.structuredFactStorage) {
    case 'allowed':
      break
    case 'prohibited':
      reasons.push('STRUCTURED_FACT_STORAGE_PROHIBITED')
      break
    case 'conditional':
      reasons.push('STRUCTURED_FACT_STORAGE_CONDITIONAL_UNMET')
      break
    case 'unknown':
      reasons.push('STRUCTURED_FACT_STORAGE_UNKNOWN')
      break
  }

  const allowed = reasons.length === 0
  return {
    allowed,
    reasons,
    effectiveRights,
    structuredFactStorageBasis: allowed
      ? effectiveRights.resolvedFrom.structuredFactStorage
      : undefined,
    imageImportAllowed: effectiveRights.imageReuse === 'allowed',
    aiMlUse: effectiveRights.aiMlUse,
  }
}

// ------------------------------------------------------------
// Identity Resolution（完全一致のみ・fuzzy 禁止・新規生成禁止）
// ------------------------------------------------------------

/**
 * candidate.canonicalRecipeId を WorldRecipeIdentity へ解決する。
 * 完全一致のみ。未設定 or 未登録 id は undefined を返す（新しい Identity を生成しない）。
 */
export function resolveImportIdentity(
  candidate: RawRecipeImportCandidate,
  identityRegistry: WorldRecipeIdentity[] = WORLD_RECIPE_IDENTITY_REGISTRY,
): WorldRecipeIdentity | undefined {
  if (!candidate.canonicalRecipeId) return undefined
  return getWorldRecipeIdentityById(candidate.canonicalRecipeId, identityRegistry)
}

// ------------------------------------------------------------
// Normalize（fact を一切変更しない）
// ------------------------------------------------------------

/**
 * RawRecipeImportCandidate の最小整形。
 * - 文字列 trim のみ（名前・言語コード等）。
 * - cookingSteps を order 昇順へ整列（重複 order はそのまま）。
 * - 単位換算・翻訳・欠落補完・range の midpoint 化は **一切しない**。
 * - imageUrl はそのまま保持（Knowledge へ入れるのは promote 側で拒否する）。
 * 元オブジェクトは変更しない（新しいオブジェクトを返す）。
 */
export function normalizeRecipeCandidate(
  candidate: RawRecipeImportCandidate,
): RawRecipeImportCandidate {
  return {
    ...candidate,
    sourceRecipeName: candidate.sourceRecipeName.trim(),
    sourceLanguage: candidate.sourceLanguage.trim(),
    cookingSteps: [...candidate.cookingSteps].sort((a, b) => a.order - b.order),
  }
}

// ------------------------------------------------------------
// Promote（Rights Gate + Identity を通過したときだけ SourceRecipeKnowledge を返す）
// ------------------------------------------------------------

const IMPORT_KNOWLEDGE_NOTE =
  'IMPORTED via MISSION 2.37 Rights-Aware Import Pipeline. '
  + 'Import ≠ VERIFIED / Publishable / Allergy-safe / Practically-validated / AI-training permitted. '
  + 'この knowledge は Rights Gate（保存してよいか）を通過しただけであり、'
  + 'Culinary Evidence（分量・工程の正しさ）の人手検証は経ていない。'

function buildImportProvenance(
  candidate: RawRecipeImportCandidate,
  decision: RecipeImportRightsDecision,
  importedAt: string,
): RecipeImportProvenance {
  const r = candidate.recordRights
  return {
    worldFoodSourceId: r.sourceId,
    sourceRecordId: r.sourceRecordId,
    sourceUrl: r.sourceUrl,
    sourceLanguage: candidate.sourceLanguage,
    rightsCheckedAt: r.rightsCheckedAt as string,
    ...(r.rightsEvidenceUrl ? { rightsEvidenceUrl: r.rightsEvidenceUrl } : {}),
    effectiveRights: decision.effectiveRights as EffectiveRecipeRights,
    structuredFactStorageBasis:
      decision.structuredFactStorageBasis as 'source-default' | 'record-override',
    importedAt,
  }
}

/**
 * Rights Gate と Identity Resolution を通過した candidate のみ SourceRecipeKnowledge へ昇格する。
 * - 料理事実（ingredients / cookingSteps / servings / preparation / time）は **verbatim コピー**。
 *   単位換算・翻訳・欠落補完をしない。
 * - imageUrl は転写しない（画像は Knowledge へ入れない）。
 * - evidenceSourceId には WorldFoodSource.sourceId を入れる（importProvenance も設定）。
 * - notes に「Import ≠ VERIFIED …」の firewall 文言を必ず付ける。
 */
export function promoteCandidateToSourceKnowledge(
  candidate: RawRecipeImportCandidate,
  identity: WorldRecipeIdentity,
  decision: RecipeImportRightsDecision,
  importedAt: string,
): SourceRecipeKnowledge {
  const normalized = normalizeRecipeCandidate(candidate)
  return {
    canonicalRecipeId: identity.canonicalRecipeId,
    sourceRecipeName: normalized.sourceRecipeName,
    evidenceSourceId: candidate.recordRights.sourceId,
    importProvenance: buildImportProvenance(candidate, decision, importedAt),
    sourceLanguage: normalized.sourceLanguage,
    ...(candidate.servings !== undefined ? { servings: candidate.servings } : {}),
    ingredients: candidate.ingredients,
    ...(candidate.preCookPreparation !== undefined
      ? { preCookPreparation: candidate.preCookPreparation }
      : {}),
    ...(candidate.preparation !== undefined ? { preparation: candidate.preparation } : {}),
    ...(candidate.equipment !== undefined ? { equipment: candidate.equipment } : {}),
    cookingSteps: normalized.cookingSteps,
    ...(candidate.sourceStatedTotalTime !== undefined
      ? { sourceStatedTotalTime: candidate.sourceStatedTotalTime }
      : {}),
    structuredAt: importedAt,
    notes: [...(candidate.notes ?? []), IMPORT_KNOWLEDGE_NOTE],
  }
}

// ------------------------------------------------------------
// Top-level pipeline
// ------------------------------------------------------------

/**
 * SOURCE → RIGHTS → RECORD → IDENTITY → KNOWLEDGE。
 * この順番を絶対に逆転させない。Rights Gate を通らなければ SourceRecipeKnowledge を返さない。
 */
export function importRecipeCandidate(
  candidate: RawRecipeImportCandidate,
  options: {
    sourceRegistry?: WorldFoodSource[]
    identityRegistry?: WorldRecipeIdentity[]
    importedAt: string
  },
): RecipeImportResult {
  const sourceRegistry = options.sourceRegistry ?? WORLD_FOOD_SOURCE_REGISTRY
  const identityRegistry = options.identityRegistry ?? WORLD_RECIPE_IDENTITY_REGISTRY

  const decision = evaluateRecipeImportRights(candidate, sourceRegistry)
  if (!decision.allowed) {
    return { ok: false, reasons: decision.reasons, decision }
  }

  const identity = resolveImportIdentity(candidate, identityRegistry)
  if (!identity) {
    return { ok: false, reasons: ['IDENTITY_UNRESOLVED'], decision }
  }

  const knowledge = promoteCandidateToSourceKnowledge(
    candidate,
    identity,
    decision,
    options.importedAt,
  )
  return { ok: true, knowledge, identity, decision }
}

// ------------------------------------------------------------
// Helpers（RIGHTS EVIDENCE ≠ CULINARY EVIDENCE の可視化）
// ------------------------------------------------------------

/** この knowledge が Import Pipeline 経由か（人手構造化と区別） */
export function isImportedKnowledge(knowledge: SourceRecipeKnowledge): boolean {
  return knowledge.importProvenance !== undefined
}

/**
 * import された knowledge の rights provenance が最低限そろっているか。
 * これは「保存してよいか」の確認であって「料理として正しいか」ではない。
 */
export function importedKnowledgeHasRightsProvenance(
  knowledge: SourceRecipeKnowledge,
  sourceRegistry: WorldFoodSource[] = WORLD_FOOD_SOURCE_REGISTRY,
): boolean {
  const p = knowledge.importProvenance
  if (!p) return false
  if (!nonEmpty(p.rightsCheckedAt)) return false
  if (!nonEmpty(p.sourceUrl)) return false
  return getWorldFoodSource(p.worldFoodSourceId, sourceRegistry) !== undefined
}

/** decision reason の人間可読ラベル（監査 UI / ログ用） */
export function describeImportDecisionReason(reason: ImportDecisionReason): string {
  const map: Record<ImportDecisionReason, string> = {
    SOURCE_NOT_REGISTERED: 'source が WorldFoodSource 登録簿に無い',
    SOURCE_DO_NOT_INGEST: 'source classification が do-not-ingest',
    SOURCE_CLASSIFICATION_UNKNOWN: 'source classification が unknown（record override で structuredFactStorage=allowed が必要）',
    SOURCE_RESEARCH_ONLY: 'source classification が research-only（record override で structuredFactStorage=allowed が必要）',
    SOURCE_RIGHTS_CHECK_DATE_MISSING: 'source.checkedAt が無い（一次情報の確認日未記録）',
    RECORD_PROVENANCE_MISSING: 'record の provenance（sourceId / sourceRecordId / sourceUrl）が欠落',
    RECORD_RIGHTS_DO_NOT_INGEST: 'record.rightsStatus が do-not-ingest',
    RECORD_RIGHTS_UNKNOWN: 'record.rightsStatus が unknown',
    RECORD_RIGHTS_CHECK_DATE_MISSING: 'record.rightsCheckedAt が無い',
    THIRD_PARTY_RIGHTS_UNRESOLVED: 'record の第三者権利が unresolved / unknown',
    STRUCTURED_FACT_STORAGE_PROHIBITED: '実効 structuredFactStorage が prohibited',
    STRUCTURED_FACT_STORAGE_UNKNOWN: '実効 structuredFactStorage が unknown',
    STRUCTURED_FACT_STORAGE_CONDITIONAL_UNMET: '実効 structuredFactStorage が conditional（本 MVP では allowed のみ通す）',
    IDENTITY_UNRESOLVED: 'canonicalRecipeId が WorldRecipeIdentity へ完全一致で解決しない',
  }
  return map[reason]
}

export { RIGHTS_KEYS }
