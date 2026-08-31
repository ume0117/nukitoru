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
  ProcessDimension,
  Recipe,
  RecipeEvidenceSource,
  RecipeSourceType,
  RecipeVerifiableField,
  RecipeVerification,
  RecipeVerificationStatus,
  SourceProcessNote,
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
    'servingsBase',
    'criticalSteps',
    'allergyIdentity',
  ]
  // MISSION 2.26 — Decision B: cookingTimeMinutes は「Product Time が established の
  // Recipe」でのみ VERIFIED の Critical Field。productTimeStatus が review/unknown の
  // Recipe は Recipe-Evidence VERIFIED になれる（Product Time は別 dimension）。
  // 未設定（legacy）の Recipe は従来どおり cookingTimeMinutes を必須にする＝挙動不変。
  if (recipe.verification?.timeVerification?.productTimeStatus !== 'review' &&
      recipe.verification?.timeVerification?.productTimeStatus !== 'unknown') {
    fields.push('cookingTimeMinutes')
  }
  if (recipe.seasonings && recipe.seasonings.length > 0) {
    fields.push('seasonings', 'seasoningAmounts')
  }
  if (recipe.cookingLiquids && recipe.cookingLiquids.length > 0) {
    fields.push('cookingLiquids')
  }
  if (recipe.equipment && recipe.equipment.length > 0) {
    fields.push('equipment')
  }
  // MISSION 2.20 — preparation を持つ Recipe は、その準備工程も Evidence 追跡対象にする
  // （steps と同じく Recipe fact）。未設定の Recipe は対象外＝publishability 挙動は不変。
  if (recipe.preparation && recipe.preparation.length > 0) {
    fields.push('preparation')
  }
  return fields
}

/**
 * MISSION 2.26 — process coherence の対象にしない「非プロセス系」Critical Field。
 * これらの field だけを支持する Evidence Source は「Recipe process を記述する source」
 * ではないため、coherenceReview.sourceProcessNotes への記載を要求しない。
 * - allergyIdentity: 食品表示制度・製造者アレルギー表示に基づく安全分類の derived Evidence
 *   （ingredient-allergens.ts）。加熱手順・火加減・ふた等の process fact は支持しない。
 * cookingTimeMinutes は conditional applicability（applicableFieldsFor）で扱うためここには入れない。
 */
const NON_PROCESS_COHERENCE_FIELDS: ReadonlySet<RecipeVerifiableField> = new Set<RecipeVerifiableField>([
  'allergyIdentity',
])

/**
 * MISSION 2.14B — Recipe Coherence Review。
 *
 * このRecipeの、direct/derivedで「解決済み」として扱われているapplicable
 * fieldが実際に参照しているsourceIdの集合を返す（range/variant/未設定の
 * fieldは対象外＝Coherence Reviewの対象にする必要がない）。
 * MISSION 2.26: NON_PROCESS_COHERENCE_FIELDS（allergyIdentity 等）「のみ」を支持する
 * source は process-coherence contributor にしない。process field も支持する source は
 * 引き続き contributor（＝ここで process field 側から拾われる）。
 */
function coherenceContributingSourceIds(recipe: Recipe, v: RecipeVerification): Set<string> {
  const ids = new Set<string>()
  const fieldVerificationMap = new Map((v.fieldVerifications ?? []).map((fv) => [fv.field, fv]))
  for (const field of applicableFieldsFor(recipe)) {
    if (NON_PROCESS_COHERENCE_FIELDS.has(field)) continue
    const fv = fieldVerificationMap.get(field)
    if (!fv) continue
    if (fv.supportType !== 'direct' && fv.supportType !== 'derived') continue
    for (const sourceId of fv.sourceIds) {
      ids.add(sourceId)
    }
  }
  return ids
}

/**
 * MISSION 2.14B — FINAL COHERENCE ATTESTATION HARDENING。
 *
 * ProcessDimensionとSourceProcessNoteの対応する具体的fieldの、決定論的な
 * マッピング。動的推測は一切行わない。'flip-or-turn'は既存の型定義
 * （`SourceProcessNote.flip`）に合わせて`flip`へ対応させる（schema変更を
 * 避けるため、フィールド名自体は変更しない）。
 */
const DIMENSION_FIELD_MAP: Record<ProcessDimension, keyof SourceProcessNote> = {
  equipment: 'equipment',
  'fat-or-oil': 'fatOrOil',
  'liquid-or-water': 'liquidOrWater',
  lid: 'lid',
  'heat-sequence': 'heatSequence',
  'flip-or-turn': 'flip',
  'rest-or-residual-heat': 'restOrResidualHeat',
  'seasoning-sequence': 'seasoningSequence',
  'major-preparation-sequence': 'preparationSequence',
}

/** undefined・空文字・空白のみの文字列を「値なし」として扱う（Section 3） */
function isNonEmptyProcessValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * MISSION 2.14B — Recipe Coherence Review（Gate: Section 6/13、FINAL HARDENING: Section 2〜4）。
 *
 * status==='coherent'であるだけでは不十分（naked boolean escape hatch禁止）。
 * 以下すべてを機械的に満たす場合のみtrueを返す：
 * - rationaleが空でない
 * - reviewedDimensionsが空でない
 * - sourceProcessNotesが空でない
 * - direct/derivedで解決済みのcritical fieldが参照する全sourceIdが
 *   sourceProcessNotesに漏れなく含まれる（Section 7: 関係ないsourceは対象外）
 * - sourceProcessNotesが参照するsourceIdはすべてEVIDENCE_SOURCE_CATALOGに
 *   実在し、metadataが完全であること
 * - FINAL HARDENING: reviewedDimensionsに列挙された各次元について、
 *   全ての「critical contributing source」のnoteに、対応するfieldの
 *   非空の値が実在すること（宣言した次元ぶんの事実が伴わない
 *   「中身のないcoherent宣言」を無効化する）。全9次元を要求するわけではなく、
 *   宣言した次元にだけ事実の裏付けを要求する（Section 4）。
 *
 * AI推測・自動prose比較は一切行わない（人間が入力した構造化metadataの
 * 機械的整合性チェックのみ）。Field Evidence判定・Variant判定・
 * Product Decisionを一切参照しない（Section 8/9/10のfirewall）。
 */
export function isCoherenceReviewValid(
  recipe: Recipe,
  catalog: RecipeEvidenceSource[] = EVIDENCE_SOURCE_CATALOG,
): boolean {
  const v = recipe.verification
  if (!v) return false
  const review = v.coherenceReview
  if (!review) return false
  if (review.status !== 'coherent') return false
  if (!review.rationale.trim()) return false
  if (review.reviewedDimensions.length === 0) return false
  if (review.sourceProcessNotes.length === 0) return false

  const notedSourceIds = new Set(review.sourceProcessNotes.map((n) => n.sourceId))
  const contributingSourceIds = coherenceContributingSourceIds(recipe, v)
  for (const sourceId of contributingSourceIds) {
    if (!notedSourceIds.has(sourceId)) return false
  }

  for (const note of review.sourceProcessNotes) {
    const source = getEvidenceSourceById(note.sourceId, catalog)
    if (!source) return false
    if (!isValidEvidenceSource(source)) return false
  }

  // FINAL HARDENING: 宣言された各次元について、全critical contributing sourceの
  // noteに対応する非空の事実が存在すること（Section 2〜4）。
  const contributingNotes = review.sourceProcessNotes.filter((n) => contributingSourceIds.has(n.sourceId))
  for (const dimension of review.reviewedDimensions) {
    const noteField = DIMENSION_FIELD_MAP[dimension]
    for (const note of contributingNotes) {
      if (!isNonEmptyProcessValue(note[noteField])) return false
    }
  }

  return true
}

/**
 * MISSION 2.14B — Coherence Reviewが'coherent'として妥当な状態にない場合にtrue。
 * hasUnresolvedRangeEvidence()と同じ設計意図（テスト・監査での可読性のための
 * 明示的ヘルパー）。isRecipePublishable内のロジックと同じ結論を返す。
 */
export function hasUnresolvedCoherenceReview(recipe: Recipe, catalog: RecipeEvidenceSource[] = EVIDENCE_SOURCE_CATALOG): boolean {
  return !isCoherenceReviewValid(recipe, catalog)
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

  // MISSION 2.26 — Decision B（Commander 承認）: Recipe Evidence VERIFIED ≠ Product Time VERIFIED。
  // productTimeStatus が review/unknown でも Recipe-Evidence VERIFIED は可能。
  // （MISSION 2.20 でここに入れていた productTimeStatus ブロックは削除。EVIDENCE_POLICY.md §
  //  「Publishability との分離」の元設計に戻す。）
  // 未確定 Product Time が「確定した時間」として表示・filter・ranking されないことは、
  // applicableFieldsFor（cookingTimeMinutes を非該当にする）と recipe-time.ts の
  // productCookingTimeMinutes()＝null／strict max-time／ranking +Infinity／UI「確認中」で
  // 引き続き担保される（これらは一切弱めていない）。

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

  // MISSION 2.13 — Evidence Variant Foundation。variantIdentityを設定する場合、
  // 空のvariantId・空のdefiningCharacteristicsという「中身のないvariant」を
  // VERIFIEDへ通さない（現在の44 RecipeはどれもまだvariantIdentityを設定して
  // いないため、この分岐は現時点では常に無害＝挙動を変えない）。
  if (v.recipeIdentity.variantIdentity) {
    const vi = v.recipeIdentity.variantIdentity
    if (!vi.variantId.trim() || vi.definingCharacteristics.length === 0) {
      return false
    }
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

  // MISSION 2.14B — Recipe Coherence Review（Gate: Section 11）。
  // 各fieldが個別にEvidence解決済みであっても、それらが互いに矛盾しない
  // 1つのRecipe process（Recipe Identity/Variant内）を構成すると人間が
  // 明示的に確認していなければpublishできない。既存recipeはこのfieldを
  // 設定していないため、この行を追加した時点で現在VERIFIED状態にある
  // Recipeも含め、明示的にCoherence Reviewされるまで一律publishableでは
  // なくなる（意図的な挙動。Section 12: 自動coherent移行は行わない）。
  if (!isCoherenceReviewValid(recipe, catalog)) return false

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
