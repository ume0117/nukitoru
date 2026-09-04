// ============================================================
// recipe-evidence-pack.ts
//
// MISSION 2.41A — Real Recipe Evidence Pack Intake。
//
//   External Research Layer（Claude Code の外部）
//     ↓ Official Source を開く / Source Body を確認 / Rights を確認 / Fact を抽出
//   RecipeEvidencePack
//     ↓ validateEvidencePack（Schema + Rights + Identity + Process + Completeness）
//     ↓ canEnterRecipeImport（COMPLETE のときだけ true）
//     ↓ toRawSourceRecord（PRESENT の Fact だけを値として渡す。生成しない）
//   RawRecipeImportCandidate（MISSION 2.37）
//     ↓ 既存 importRecipeCandidate
//   SourceRecipeKnowledge
//
// 絶対ルール:
// - Evidence を生成しない。External Research Layer が確認した Fact を構造化・検証するだけ。
// - Commander / External Research Layer が渡したという理由だけで trusted / verified /
//   rightsAllowed にしない（Evidence Pack 自体を検証する）。
// - SOURCE_NOT_STATED（情報源が沈黙）≠ NOT_CAPTURED（まだ調べていない）を厳格に分離。
// - CONFLICT を平均・統合して単一値にしない。
// - SOURCE RIGHTS ≠ RECORD RIGHTS ≠ ASSET RIGHTS。third-party クレジット検出 = 自動 SKIP ではなく
//   record-level rights review が必要（確認できなければ fail-closed）。
// - Evidence Pack COMPLETE ≠ VERIFIED ≠ Publishable ≠ Practical Validated ≠ Allergy Safe。
// - Firewall: このモジュールは recipe-publishability / recipe-safety /
//   practical-cook-validation / recipe-catalog / mock-meal-provider / recipe-suggestion-engine /
//   from-now-to-table / ai-provider / food-matching / world-food-knowledge を一切 import しない。
//   RecipeVerification / PracticalCookValidation / Allergy Gate / Matching Truth を読み書きしない。
// - scraper / crawler / browser automation / 403 bypass / proxy は一切実装しない（§38）。
//   Source 取得は External Research Layer の責務。
// ============================================================

import type {
  EvidenceCompletenessReason,
  EvidenceFact,
  EvidencePackAdapterResult,
  EvidencePackValidation,
  QuantityStatement,
  RawRecipeImportCandidate,
  RecipeEvidencePack,
  RecipeImportResult,
  SourceCookingStep,
  SourceIngredientKnowledge,
  WorldFoodSource,
  WorldFoodSourceRecordRights,
  WorldRecipeIdentity,
} from '@/features/food/types'
import { WORLD_FOOD_SOURCE_REGISTRY } from './world-food-sources'
import { WORLD_RECIPE_IDENTITY_REGISTRY } from './world-recipe-identity'
import { importRecipeCandidate } from './world-recipe-import'

// ------------------------------------------------------------
// 固定文言（過剰解釈を防ぐ）
// ------------------------------------------------------------

/** §4 — Commander / External Research Layer が渡した = 真実ではない */
export const EVIDENCE_PACK_TRUST_MODEL =
  'RecipeEvidencePack は External Research Layer / Commander が渡す staging object です。'
  + '渡されたという理由だけで trusted / verified / rightsAllowed / publishable / practicallyValidated'
  + 'にはなりません。Evidence Pack 自体を validate してから既存 Import Pipeline へ渡します。'

/** §13 — COMPLETE の意味（Verified ではない） */
export const EVIDENCE_PACK_COMPLETE_MEANING =
  'COMPLETE は「External Evidence Pack として次の Import 段階へ渡せるだけの情報が揃っている」'
  + 'という意味だけです。COMPLETE ≠ Verified / Publishable / Practical Validated / Allergy Safe。'

/** Import 経由の knowledge notes へ足す来歴メモ */
export const EVIDENCE_PACK_INTAKE_NOTE =
  'INTAKE via MISSION 2.41A Recipe Evidence Pack. '
  + 'External Research Layer が Official Source Body で確認した Fact のみを構造化。'
  + 'Evidence Pack COMPLETE ≠ VERIFIED。分量・工程の人手検証は別 Gate。'

// ------------------------------------------------------------
// 小さなユーティリティ
// ------------------------------------------------------------

function nonEmpty(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function dedupe<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

/**
 * EvidenceFact が §7 の形状ルールを守っているか。
 * - PRESENT           → value 必須
 * - SOURCE_NOT_STATED → value 禁止 / conflictingValues 禁止
 * - NOT_CAPTURED      → value 禁止 / conflictingValues 禁止
 * - CONFLICT          → value 禁止（単一確定値にしない。conflictingValues は任意）
 */
export function factHasValidShape<T>(fact: EvidenceFact<T>): boolean {
  switch (fact.status) {
    case 'PRESENT':
      return fact.value !== undefined
    case 'SOURCE_NOT_STATED':
    case 'NOT_CAPTURED':
      return fact.value === undefined && fact.conflictingValues === undefined
    case 'CONFLICT':
      return fact.value === undefined
    default:
      return false
  }
}

/** PRESENT のときだけ value を返す。それ以外は undefined（default 値を作らない） */
export function readPresentValue<T>(fact: EvidenceFact<T> | undefined): T | undefined {
  if (!fact) return undefined
  return fact.status === 'PRESENT' ? fact.value : undefined
}

function collectEvidenceFacts(pack: RecipeEvidencePack): EvidenceFact<unknown>[] {
  const facts: EvidenceFact<unknown>[] = [
    pack.recipe.servings,
    pack.recipe.preparation,
    pack.recipe.completionCues,
    pack.recipe.equipmentConditions,
    pack.classification.country,
    pack.classification.cuisine,
    pack.classification.mealOccasions,
  ]
  for (const ing of pack.recipe.ingredients) {
    facts.push(ing.amount)
    if (ing.preparationState) facts.push(ing.preparationState)
  }
  for (const step of pack.recipe.steps) {
    facts.push(step.factSummary)
    if (step.heat) facts.push(step.heat)
    if (step.heatTransition) facts.push(step.heatTransition)
    if (step.duration) facts.push(step.duration)
    if (step.completionCue) facts.push(step.completionCue)
  }
  return facts
}

// ------------------------------------------------------------
// Rights 評価（§9 / §10 / §11 / §15 / §20）
// ------------------------------------------------------------

interface RightsEvalOutcome {
  /** 決定的な Rights ブロック（RIGHTS_BLOCKED になる） */
  blocked: EvidenceCompletenessReason[]
  /** Rights 由来だが「まだ調べていない」= INCOMPLETE 扱い */
  pending: EvidenceCompletenessReason[]
}

/**
 * Evidence Pack が申告する Rights を評価する。
 *
 * 重要な設計:
 * - evidenceMethod が 'official-source-body-review' でない間は、Rights の hard block を
 *   原則行わない（要約から RIGHTS_BLOCKED は判定できない。full review が前提 — §2）。
 *   例外: 登録済み source の classification が 'do-not-ingest' の場合は要約でも hard block。
 * - full review 済みなら prohibited / unknown / conditional を fail-closed で hard block（§11）。
 * - third-party クレジットは「検出 = 自動 SKIP」ではない（§10）。
 *   review 'cleared' → 継続 / 'unresolved' → hard block / それ以外 → pending（INCOMPLETE）。
 */
function evaluateEvidencePackRights(
  pack: RecipeEvidencePack,
  source: WorldFoodSource | undefined,
): RightsEvalOutcome {
  const blocked: EvidenceCompletenessReason[] = []
  const pending: EvidenceCompletenessReason[] = []
  const r = pack.rights
  const fullReview = pack.provenance.evidenceMethod === 'official-source-body-review'

  if (!source) {
    // rights audit（MISSION 2.36 / 2.36A）が未実施の source。hard block ではなく
    // 「Evidence（rights 監査）が揃っていない」= INCOMPLETE。
    pending.push('SOURCE_NOT_REGISTERED')
  } else if (source.classification === 'do-not-ingest') {
    blocked.push('RIGHTS_SOURCE_BLOCKED')
  }

  // third-party クレジット（full review の有無に関わらず評価する）
  if (r.thirdPartyIndication === true) {
    if (r.thirdPartyRightsReview === 'unresolved') {
      blocked.push('THIRD_PARTY_RIGHTS_UNRESOLVED')
    } else if (r.thirdPartyRightsReview !== 'cleared') {
      pending.push('THIRD_PARTY_RIGHTS_REVIEW_PENDING')
    }
  }

  if (!fullReview) {
    pending.push('EVIDENCE_METHOD_NOT_SOURCE_BODY')
    return { blocked, pending }
  }

  // ---- ここから full review 済み。fail-closed で hard block ----
  const hardBlock = (flag: string, reason: EvidenceCompletenessReason) => {
    if (flag === 'prohibited' || flag === 'unknown') blocked.push(reason)
    else if (flag === 'conditional') blocked.push('RIGHTS_CONDITIONAL_UNMET')
  }
  hardBlock(r.sourceRightsStatus, 'RIGHTS_SOURCE_BLOCKED')
  hardBlock(r.recordRightsStatus, 'RIGHTS_RECORD_BLOCKED')
  hardBlock(r.structuredFactStorageStatus, 'RIGHTS_STRUCTURED_FACT_BLOCKED')

  // pack が source 登録簿より広い権利を主張していないか（§4 COMMANDER-PROVIDED ≠ TRUE）
  if (
    source &&
    r.structuredFactStorageStatus === 'allowed' &&
    source.rights.structuredFactStorage === 'prohibited'
  ) {
    blocked.push('RIGHTS_CLAIM_EXCEEDS_SOURCE')
  }

  return { blocked, pending }
}

// ------------------------------------------------------------
// validateEvidencePack（§12〜§19）
// ------------------------------------------------------------

export interface ValidateEvidencePackOptions {
  sourceRegistry?: WorldFoodSource[]
  identityRegistry?: WorldRecipeIdentity[]
}

/**
 * Evidence Pack を検証し、Schema / Rights / Identity / Process / Completeness を分類する。
 * result の優先順位（安全側・より強いブロックが勝つ）:
 *   RIGHTS_BLOCKED > INCOMPLETE > IDENTITY_REVIEW > PROCESS_REVIEW > COMPLETE
 * reasons には該当したすべての理由を（優先順位に関わらず）入れる。
 */
export function validateEvidencePack(
  pack: RecipeEvidencePack,
  options: ValidateEvidencePackOptions = {},
): EvidencePackValidation {
  const sourceRegistry = options.sourceRegistry ?? WORLD_FOOD_SOURCE_REGISTRY
  const identityRegistry = options.identityRegistry ?? WORLD_RECIPE_IDENTITY_REGISTRY

  const schema: EvidenceCompletenessReason[] = []
  const rightsBlocked: EvidenceCompletenessReason[] = []
  const incomplete: EvidenceCompletenessReason[] = []
  const identity: EvidenceCompletenessReason[] = []
  const process: EvidenceCompletenessReason[] = []

  // ---- Schema / provenance（§14）----
  const s = pack.source
  if (!nonEmpty(s.sourceId)) schema.push('SOURCE_ID_MISSING')
  if (!nonEmpty(s.sourceOrganization)) schema.push('SOURCE_ORGANIZATION_MISSING')
  if (!nonEmpty(s.sourceTitle)) schema.push('SOURCE_TITLE_MISSING')
  if (!nonEmpty(s.sourceUrl)) schema.push('SOURCE_URL_MISSING')
  if (!nonEmpty(s.accessedAt)) schema.push('ACCESSED_AT_MISSING')
  if (!nonEmpty(pack.recipe.sourceRecipeName)) schema.push('RECIPE_NAME_MISSING')

  const source = nonEmpty(s.sourceId)
    ? sourceRegistry.find((x) => x.sourceId === s.sourceId)
    : undefined

  // ---- EvidenceFact 形状（§7）----
  const shapeOk = collectEvidenceFacts(pack).every((f) => factHasValidShape(f))
  if (!shapeOk) schema.push('FACT_PRESENCE_INVALID')

  // ---- Rights（§9〜§11 / §15）----
  const rightsOutcome = evaluateEvidencePackRights(pack, source)
  rightsBlocked.push(...rightsOutcome.blocked)
  incomplete.push(...rightsOutcome.pending)

  // ---- Identity（§16）----
  const candidateId = pack.identity.candidateCanonicalRecipeId
  if (!nonEmpty(candidateId)) {
    identity.push('IDENTITY_CANDIDATE_MISSING')
  } else if (!identityRegistry.some((i) => i.canonicalRecipeId === candidateId)) {
    identity.push('IDENTITY_NOT_IN_REGISTRY')
  }

  // ---- Process CONFLICT / Coherence（§17）----
  if (pack.recipe.servings.status === 'CONFLICT') process.push('SERVINGS_CONFLICT')
  if (pack.recipe.ingredientListStatus === 'CONFLICT') process.push('PROCESS_FACT_CONFLICT')
  if (pack.recipe.stepListStatus === 'CONFLICT') process.push('PROCESS_FACT_CONFLICT')
  for (const ing of pack.recipe.ingredients) {
    if (ing.amount.status === 'CONFLICT') process.push('INGREDIENT_AMOUNT_CONFLICT')
    if (ing.preparationState?.status === 'CONFLICT') process.push('PROCESS_FACT_CONFLICT')
  }
  for (const step of pack.recipe.steps) {
    for (const f of [step.factSummary, step.heat, step.heatTransition, step.duration, step.completionCue]) {
      if (f && f.status === 'CONFLICT') process.push('STEP_FACT_CONFLICT')
    }
  }
  for (const f of [pack.recipe.preparation, pack.recipe.completionCues, pack.recipe.equipmentConditions]) {
    if (f.status === 'CONFLICT') process.push('PROCESS_FACT_CONFLICT')
  }

  // ---- Evidence capture completeness（§14 / §18）----
  if (pack.recipe.servings.status === 'NOT_CAPTURED') incomplete.push('SERVINGS_NOT_CAPTURED')
  if (
    pack.recipe.ingredients.length === 0 ||
    pack.recipe.ingredientListStatus === 'NOT_CAPTURED' ||
    pack.recipe.ingredientListStatus === 'SOURCE_NOT_STATED'
  ) {
    incomplete.push('INGREDIENTS_NOT_CAPTURED')
  }
  for (const ing of pack.recipe.ingredients) {
    if (ing.amount.status === 'NOT_CAPTURED') {
      incomplete.push('INGREDIENT_AMOUNT_NOT_CAPTURED')
      break
    }
  }
  if (pack.recipe.steps.length === 0 || pack.recipe.stepListStatus === 'NOT_CAPTURED') {
    incomplete.push('STEPS_NOT_CAPTURED')
  }
  if (pack.recipe.stepListStatus !== 'PRESENT') {
    // Primary Process Anchor = 手順の順序が Source から確認できていること（§18 / MISSION 2.41 §11）
    incomplete.push('PRIMARY_PROCESS_ANCHOR_MISSING')
  }

  const allReasons = dedupe([
    ...schema,
    ...rightsBlocked,
    ...incomplete,
    ...identity,
    ...process,
  ])

  let result: EvidencePackValidation['result']
  if (rightsBlocked.length > 0) result = 'RIGHTS_BLOCKED'
  else if (schema.length > 0 || incomplete.length > 0) result = 'INCOMPLETE'
  else if (identity.length > 0) result = 'IDENTITY_REVIEW'
  else if (process.length > 0) result = 'PROCESS_REVIEW'
  else result = 'COMPLETE'

  return { result, reasons: allReasons, importEligible: result === 'COMPLETE' }
}

/**
 * §19 — Evidence Pack が既存 Import Pipeline へ入ってよいか（pure）。
 * COMPLETE（Schema OK + Rights PASS + Identity review 不要 + Process review 不要 +
 * 必須 Evidence capture 済み）のときだけ true。
 */
export function canEnterRecipeImport(
  pack: RecipeEvidencePack,
  options: ValidateEvidencePackOptions = {},
): boolean {
  return validateEvidencePack(pack, options).result === 'COMPLETE'
}

// ------------------------------------------------------------
// Import adapter（§20 / §21）
// ------------------------------------------------------------

function mapRecordRightsStatus(flag: string): WorldFoodSourceRecordRights['rightsStatus'] {
  switch (flag) {
    case 'allowed':
      return 'use'
    case 'conditional':
      return 'conditional'
    case 'prohibited':
      return 'do-not-ingest'
    default:
      return 'unknown'
  }
}

function buildRecordRights(pack: RecipeEvidencePack): WorldFoodSourceRecordRights {
  const r = pack.rights
  const thirdPartyRights: WorldFoodSourceRecordRights['thirdPartyRights'] =
    r.thirdPartyIndication === true
      ? r.thirdPartyRightsReview === 'cleared'
        ? 'cleared'
        : 'unresolved'
      : 'none'

  return {
    sourceId: pack.source.sourceId,
    sourceRecordId: pack.source.sourceRecordId ?? pack.identity.id,
    sourceUrl: pack.source.sourceUrl,
    ...(r.thirdPartyIndication === true
      ? { originalContributor: r.rightsNotes ?? 'third-party credited (see Evidence Pack rightsNotes)' }
      : {}),
    thirdPartyRights,
    rightsStatus: mapRecordRightsStatus(r.recordRightsStatus),
    rightsOverride: {
      structuredFactStorage: r.structuredFactStorageStatus,
      verbatimTextStorage: r.verbatimTextStatus,
      imageReuse: r.imageAssetStatus,
    },
    rightsCheckedAt: pack.provenance.capturedAt,
    ...(nonEmpty(r.rightsEvidenceReference) ? { rightsEvidenceUrl: r.rightsEvidenceReference } : {}),
    ...(nonEmpty(r.rightsNotes) ? { rightsNotes: [r.rightsNotes as string] } : {}),
  }
}

/**
 * §20 / §21 — COMPLETE な Evidence Pack を MISSION 2.37 の RawRecipeImportCandidate へ変換する。
 * - Fact を生成しない。PRESENT の Fact だけを値として渡す。
 * - SOURCE_NOT_STATED を default 値へ変換しない（field を省略する）。
 * - NOT_CAPTURED / CONFLICT は COMPLETE なら現れない（validateEvidencePack が弾く）。防御的に ok:false。
 * - canonicalIngredientId は付けない（§22。Canonicalization は Import 後に既存 pipeline で行う）。
 */
export function toRawSourceRecord(
  pack: RecipeEvidencePack,
  options: ValidateEvidencePackOptions = {},
): EvidencePackAdapterResult {
  const validation = validateEvidencePack(pack, options)
  if (validation.result !== 'COMPLETE') {
    return { ok: false, reasons: validation.reasons }
  }

  const ingredients: SourceIngredientKnowledge[] = pack.recipe.ingredients.map((ing) => {
    const quantity = readPresentValue<QuantityStatement>(ing.amount)
    const preparationState = readPresentValue<string>(ing.preparationState)
    return {
      sourceIngredientName: ing.sourceIngredientName,
      role: ing.role,
      ...(quantity !== undefined ? { quantity } : {}),
      ...(preparationState !== undefined ? { preparationState } : {}),
      // canonicalIngredientId / normalizedName は付けない（§22）
    }
  })

  const cookingSteps: SourceCookingStep[] = pack.recipe.steps.map((step) => {
    const factSummary = readPresentValue<string>(step.factSummary)
    const heat = readPresentValue(step.heat)
    const heatTransition = readPresentValue(step.heatTransition)
    const duration = readPresentValue(step.duration)
    const completionSign = readPresentValue<string>(step.completionCue)
    return {
      order: step.order,
      ...(factSummary !== undefined ? { factSummary } : {}),
      ...(step.ingredientsUsed !== undefined ? { ingredientsUsed: step.ingredientsUsed } : {}),
      ...(heat !== undefined ? { heat } : {}),
      ...(heatTransition !== undefined ? { heatTransition } : {}),
      ...(duration !== undefined ? { duration } : {}),
      ...(completionSign !== undefined ? { completionSign } : {}),
    }
  })

  const servings = readPresentValue<QuantityStatement>(pack.recipe.servings)
  const preparationTexts = readPresentValue<string[]>(pack.recipe.preparation)
  const equipment = readPresentValue<string[]>(pack.recipe.equipmentConditions)

  const candidate: RawRecipeImportCandidate = {
    sourceRecipeName: pack.recipe.sourceRecipeName,
    sourceLanguage: pack.recipe.sourceLanguage,
    // COMPLETE なら candidateCanonicalRecipeId は必ず registry に存在する
    canonicalRecipeId: pack.identity.candidateCanonicalRecipeId,
    ...(servings !== undefined ? { servings } : {}),
    ingredients,
    ...(preparationTexts !== undefined && preparationTexts.length > 0
      ? { preparation: preparationTexts.map((text) => ({ text })) }
      : {}),
    ...(equipment !== undefined && equipment.length > 0 ? { equipment } : {}),
    cookingSteps,
    notes: [
      EVIDENCE_PACK_INTAKE_NOTE,
      ...(nonEmpty(pack.provenance.notes) ? [pack.provenance.notes as string] : []),
    ],
    recordRights: buildRecordRights(pack),
  }

  return { ok: true, candidate }
}

/**
 * §20 — Evidence Pack から既存 Import Pipeline まで一気に通す便宜関数。
 * adapter が ok:false ならそこで停止。ok なら MISSION 2.37 の importRecipeCandidate へ委譲。
 * この関数自体は Fact を一切生成・補完しない。
 */
export function runEvidencePackImport(
  pack: RecipeEvidencePack,
  options: ValidateEvidencePackOptions & { importedAt: string },
): RecipeImportResult | { ok: false; reasons: EvidenceCompletenessReason[] } {
  const adapted = toRawSourceRecord(pack, options)
  if (!adapted.ok) return adapted
  return importRecipeCandidate(adapted.candidate, {
    importedAt: options.importedAt,
    ...(options.sourceRegistry ? { sourceRegistry: options.sourceRegistry } : {}),
    ...(options.identityRegistry ? { identityRegistry: options.identityRegistry } : {}),
  })
}

// ------------------------------------------------------------
// Boundaries（§22 / §23 / §24）
// ------------------------------------------------------------

/**
 * §22 — Evidence Pack / adapter 出力は canonical ingredient id を持たない。
 * Canonicalization は Import 後に既存 MISSION 2.38 pipeline が RESOLVED / UNRESOLVED / AMBIGUOUS を判定する。
 */
export function adapterOutputHasNoCanonicalIds(candidate: RawRecipeImportCandidate): boolean {
  return candidate.ingredients.every(
    (i) => i.canonicalIngredientId === undefined && i.normalizedName === undefined,
  )
}

/**
 * §23 — Matching boundary。COMPLETE でない Evidence Pack を Matching Recipe へ変換してよいか。
 * INCOMPLETE / RIGHTS_BLOCKED / IDENTITY_REVIEW / PROCESS_REVIEW は false。
 * Matching Truth（MISSION 2.39）自体は変更しない。ここは gate のみ。
 */
export function evidencePackCanEnterMatching(
  pack: RecipeEvidencePack,
  options: ValidateEvidencePackOptions = {},
): boolean {
  return canEnterRecipeImport(pack, options)
}

/**
 * §24 — Presentation boundary marker。
 * Evidence Pack ≠ NukitoruPresentation。順序は Evidence Pack → Import → Canonicalization →
 * Knowledge → Presentation。Evidence Pack から直接 User-facing Recipe を作らない。
 */
export function evidencePackIsNotPresentation(): true {
  return true
}

// ------------------------------------------------------------
// State breakdown & Hold log（MISSION 2.41B §30 / §31）
//
// validateEvidencePack の単一 result を潰さず、Evidence / Rights / Identity / Process を
// 別々に読むための report 用 helper。Gate（canEnterRecipeImport）は一切変更しない。
// ------------------------------------------------------------

const RIGHTS_REVIEW_REASONS: EvidenceCompletenessReason[] = [
  'THIRD_PARTY_RIGHTS_REVIEW_PENDING',
  'SOURCE_NOT_REGISTERED',
]
const RIGHTS_BLOCK_REASONS: EvidenceCompletenessReason[] = [
  'RIGHTS_SOURCE_BLOCKED',
  'RIGHTS_RECORD_BLOCKED',
  'RIGHTS_STRUCTURED_FACT_BLOCKED',
  'RIGHTS_CONDITIONAL_UNMET',
  'RIGHTS_CLAIM_EXCEEDS_SOURCE',
  'THIRD_PARTY_RIGHTS_UNRESOLVED',
]
const IDENTITY_REVIEW_REASONS: EvidenceCompletenessReason[] = [
  'IDENTITY_CANDIDATE_MISSING',
  'IDENTITY_NOT_IN_REGISTRY',
]
const PROCESS_REVIEW_REASONS: EvidenceCompletenessReason[] = [
  'INGREDIENT_AMOUNT_CONFLICT',
  'STEP_FACT_CONFLICT',
  'SERVINGS_CONFLICT',
  'PROCESS_FACT_CONFLICT',
]

export interface EvidencePackStateBreakdown {
  /** Source Body の必須 Fact が揃っているか（Rights / Identity とは独立） */
  evidence: 'COMPLETE' | 'INCOMPLETE'
  /** PASS = 問題なし / REVIEW_REQUIRED = record-level review 待ち / BLOCKED = fail-closed */
  rights: 'PASS' | 'REVIEW_REQUIRED' | 'BLOCKED'
  identity: 'RESOLVED' | 'REVIEW_REQUIRED'
  process: 'OK' | 'REVIEW_REQUIRED'
  /** = validateEvidencePack(pack).result === 'COMPLETE' */
  importEligible: boolean
  reasons: EvidenceCompletenessReason[]
}

/**
 * MISSION 2.41B §30 — 各 Candidate の Evidence / Rights / Identity / Process / Import を
 * **一つの status へ潰さず**別々に返す report 用 helper。
 */
export function evidencePackStateBreakdown(
  pack: RecipeEvidencePack,
  options: ValidateEvidencePackOptions = {},
): EvidencePackStateBreakdown {
  const v = validateEvidencePack(pack, options)
  const has = (list: EvidenceCompletenessReason[]) => v.reasons.some((r) => list.includes(r))

  const evidenceIncomplete = v.reasons.some(
    (r) =>
      !RIGHTS_REVIEW_REASONS.includes(r) &&
      !RIGHTS_BLOCK_REASONS.includes(r) &&
      !IDENTITY_REVIEW_REASONS.includes(r) &&
      !PROCESS_REVIEW_REASONS.includes(r),
  )

  return {
    evidence: evidenceIncomplete ? 'INCOMPLETE' : 'COMPLETE',
    rights: has(RIGHTS_BLOCK_REASONS)
      ? 'BLOCKED'
      : has(RIGHTS_REVIEW_REASONS)
        ? 'REVIEW_REQUIRED'
        : 'PASS',
    identity: has(IDENTITY_REVIEW_REASONS) ? 'REVIEW_REQUIRED' : 'RESOLVED',
    process: has(PROCESS_REVIEW_REASONS) ? 'REVIEW_REQUIRED' : 'OK',
    importEligible: v.result === 'COMPLETE',
    reasons: v.reasons,
  }
}

/**
 * MISSION 2.41B §31 — Import できない Candidate の HOLD 理由（削除せず保持するため）。
 * import-eligible なら空配列。
 */
export function evidencePackHoldReasons(
  pack: RecipeEvidencePack,
  options: ValidateEvidencePackOptions = {},
): string[] {
  const b = evidencePackStateBreakdown(pack, options)
  if (b.importEligible) return []
  const holds: string[] = []
  if (b.rights === 'BLOCKED') holds.push('HOLD_RIGHTS_BLOCKED')
  if (b.rights === 'REVIEW_REQUIRED') holds.push('HOLD_RECORD_RIGHTS_REVIEW')
  if (b.identity === 'REVIEW_REQUIRED') holds.push('HOLD_IDENTITY_REVIEW')
  if (b.process === 'REVIEW_REQUIRED') holds.push('HOLD_PROCESS_REVIEW')
  if (b.evidence === 'INCOMPLETE') holds.push('HOLD_INCOMPLETE_EVIDENCE')
  return holds
}

// ------------------------------------------------------------
// 監査用ラベル
// ------------------------------------------------------------

export function describeEvidenceCompletenessReason(reason: EvidenceCompletenessReason): string {
  const map: Record<EvidenceCompletenessReason, string> = {
    SOURCE_ID_MISSING: 'source.sourceId が空',
    SOURCE_NOT_REGISTERED: 'source が WorldFoodSource 登録簿（MISSION 2.36 / 2.36A）に無い',
    SOURCE_ORGANIZATION_MISSING: 'source.sourceOrganization が空',
    SOURCE_TITLE_MISSING: 'source.sourceTitle が空',
    SOURCE_URL_MISSING: 'source.sourceUrl が空（provenance 欠落）',
    ACCESSED_AT_MISSING: 'source.accessedAt が空（本文確認日時未記録）',
    RECIPE_NAME_MISSING: 'recipe.sourceRecipeName が空',
    EVIDENCE_METHOD_NOT_SOURCE_BODY: 'evidenceMethod が official-source-body-review でない（要約は PRESENT の根拠にならない）',
    SERVINGS_NOT_CAPTURED: 'servings が NOT_CAPTURED',
    INGREDIENTS_NOT_CAPTURED: '食材リストが未 capture / 空',
    INGREDIENT_AMOUNT_NOT_CAPTURED: '少なくとも 1 食材の分量が NOT_CAPTURED',
    STEPS_NOT_CAPTURED: '手順リストが未 capture / 空',
    PRIMARY_PROCESS_ANCHOR_MISSING: '手順の順序（Primary Process Anchor）を Source から確認できていない',
    THIRD_PARTY_RIGHTS_REVIEW_PENDING: 'third-party クレジットあり・record-level rights review 未実施',
    FACT_PRESENCE_INVALID: 'EvidenceFact の status と value / conflictingValues の組合せが不正（§7）',
    RIGHTS_SOURCE_BLOCKED: 'SOURCE rights が prohibited / unknown / do-not-ingest',
    RIGHTS_RECORD_BLOCKED: 'RECORD rights が prohibited / unknown',
    RIGHTS_STRUCTURED_FACT_BLOCKED: 'structuredFactStorage が prohibited / unknown',
    RIGHTS_CONDITIONAL_UNMET: 'rights が conditional（条件充足を確認できない — fail-closed）',
    RIGHTS_CLAIM_EXCEEDS_SOURCE: 'Evidence Pack が source 登録簿より広い権利を主張している',
    THIRD_PARTY_RIGHTS_UNRESOLVED: 'third-party rights review が unresolved（fail-closed）',
    IDENTITY_CANDIDATE_MISSING: 'candidateCanonicalRecipeId が未設定（料理名の類似で決めない）',
    IDENTITY_NOT_IN_REGISTRY: 'candidateCanonicalRecipeId が WorldRecipeIdentity 登録簿に無い',
    INGREDIENT_AMOUNT_CONFLICT: '食材の分量に CONFLICT（平均・統合しない）',
    STEP_FACT_CONFLICT: '手順の Fact に CONFLICT',
    SERVINGS_CONFLICT: 'servings に CONFLICT',
    PROCESS_FACT_CONFLICT: '工程関連の Fact に CONFLICT',
  }
  return map[reason]
}
