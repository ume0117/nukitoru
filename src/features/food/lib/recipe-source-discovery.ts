// ============================================================
// recipe-source-discovery.ts
//
// MISSION 2.41F — Rights-Clear Recipe Source Discovery & Rights Gate Foundation。
//
//   Candidate Discovery
//     ↓ RecipeSourceCandidateInput（生の評価済み Fact。Evidence 付き）
//   classifyRecipeSourceCandidate（決定論的 Rights Gate）
//     ↓
//   RecipeSourceCandidate（classification 確定）
//
// 絶対ルール:
// - Source Discovery ≠ Recipe Import（§8）。ここで RIGHTS_CLEAR_CANDIDATE になっても
//   実 Recipe を Import しない・WorldFoodSource へ自動登録しない・Matching / Presentation /
//   RecipeVerification に一切接続しない。
// - License が存在すること ≠ 対象 Recipe へ License が適用されること（§2）。
//   commercialUse === 'allowed' だけで PASS にしない。recipeApplicability === 'confirmed' も必須。
// - UNKNOWN を PASS へ変換しない。third-party signal を自動で allowed / prohibited に倒さない。
// - CC BY-NC 系は Primary Recipe Import Source として常に REJECTED（商用サービス前提のため）。
// - Photo / External Content の rights 不明は、Recipe Facts 側の rights が別途 confirmed であれば
//   Recipe Facts の classification を道連れにしない（§11 content-scope separation）。
//   ただし Recipe Facts 自体の rights が不明なら当然 block する。
// - Firewall: このモジュールは recipe-publishability / recipe-safety / practical-cook-validation /
//   recipe-catalog / ai-provider / food-matching / world-food-knowledge / world-recipe-import を
//   import しない。RecipeVerification / PracticalCookValidation / Allergy Gate / Matching Truth /
//   WorldFoodSource 登録簿を変更しない。ネットワーク・スクレイピングを実装しない。
// ============================================================

import type {
  ApplicabilityState,
  AssetApplicabilityState,
  AttributionRequirement,
  RecipeSourceCandidate,
  RecipeSourceCandidateClassification,
  RecipeSourceCandidateInput,
  RecipeSourceCapability,
  RecipeSourceLicenseType,
  RightsFlag,
  ThirdPartyRightsState,
} from '@/features/food/types'

// ------------------------------------------------------------
// 固定文言（過剰解釈を防ぐ）
// ------------------------------------------------------------

/** §9 — Rights PASS の意味（Recipe Verification とは別）。Discovery ≠ Import の firewall 文言 */
export const RIGHTS_CLEAR_CANDIDATE_MEANING =
  'RIGHTS_CLEAR_CANDIDATE は「Source 単位で商用 structured-fact reuse の条件が Evidence で確認できた」'
  + 'という意味だけです。RIGHTS_CLEAR_CANDIDATE ≠ Recipe Import 実行 ≠ Recipe VERIFIED ≠ Allergy Safe ≠ '
  + 'Taste Verified。実 Recipe の Import・Canonicalization・Matching・Presentation は別 MISSION で行う。'

/** §4 — CC BY-NC 系は商用サービスである NUKITORU の Primary Import Source として常に REJECTED */
const NONCOMMERCIAL_LICENSES: RecipeSourceLicenseType[] = ['CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0', 'CC-BY-NC-ND-4.0']

// ------------------------------------------------------------
// §10 — Third-Party Rights Signal 検出（自動 PASS も自動 prohibited もしない）
// ------------------------------------------------------------

const THIRD_PARTY_SIGNAL_PATTERNS: RegExp[] = [
  /提供元?/,
  /写真提供/,
  /資料提供/,
  /出典/,
  /監修/,
  /著者/,
  /レシピ提供/,
  /外部サイト/,
  /転載/,
  /©/,
  /copyright/i,
]

/**
 * §10 — テキスト中に第三者権利の表示・示唆（提供 / 提供元 / 写真提供 / 出典 / 監修 / 著者 /
 * レシピ提供 / 外部サイト / 転載 / © / Copyright）が含まれるかを検出する。
 * 検出 = Signal の記録のみ。allowed / prohibited への自動変換はしない（呼び出し側が
 * thirdPartyRights を 'unresolved' 等へ倒すかは別途 Evidence で判断する）。
 */
export function detectThirdPartyRightsSignal(text: string): boolean {
  return THIRD_PARTY_SIGNAL_PATTERNS.some((re) => re.test(text))
}

// ------------------------------------------------------------
// Rights Gate（§9）— 決定論的・純粋関数
// ------------------------------------------------------------

export type RecipeSourceBlockingReason =
  | 'LICENSE_NONCOMMERCIAL'
  | 'COMMERCIAL_USE_PROHIBITED'
  | 'MODIFICATION_PROHIBITED'
  | 'LICENSE_UNKNOWN'
  | 'COMMERCIAL_USE_NOT_CONFIRMED_ALLOWED'
  | 'MODIFICATION_CONDITIONAL'
  | 'MODIFICATION_UNKNOWN'
  | 'RECIPE_APPLICABILITY_NOT_CONFIRMED'
  | 'THIRD_PARTY_RIGHTS_UNRESOLVED'
  | 'THIRD_PARTY_RIGHTS_UNKNOWN'
  | 'ATTRIBUTION_REQUIREMENT_UNKNOWN'
  | 'RECIPE_FACTS_RIGHTS_UNRESOLVED'

/**
 * §9 — RIGHTS_CLEAR_CANDIDATE になれる最低条件（すべて満たす場合のみ）:
 * commercialUse === 'allowed' AND modification !== 'prohibited' AND
 * recipeApplicability === 'confirmed' AND thirdPartyRights が unresolved blocking を含まない
 * （'none' または 'cleared'）AND attribution の要否が判明している（'unknown' でない）。
 *
 * photoApplicability / externalContentApplicability はこの判定に使わない（§11 content-scope
 * separation。画像・外部リンク Content の rights 不明は Recipe Facts の classification を道連れにしない）。
 */
export function classifyRecipeSourceCandidate(
  input: RecipeSourceCandidateInput,
): { classification: RecipeSourceCandidateClassification; blockingReasons: RecipeSourceBlockingReason[] } {
  const reasons: RecipeSourceBlockingReason[] = []

  // ---- 確定的 REJECT（§4 policy）----
  if (NONCOMMERCIAL_LICENSES.includes(input.licenseType)) reasons.push('LICENSE_NONCOMMERCIAL')
  if (input.commercialUse === 'prohibited') reasons.push('COMMERCIAL_USE_PROHIBITED')
  if (input.modification === 'prohibited') reasons.push('MODIFICATION_PROHIBITED')
  if (reasons.length > 0) {
    return { classification: 'REJECTED', blockingReasons: reasons }
  }

  // ---- RIGHTS_CLEAR_CANDIDATE gate ----
  const thirdPartyClear = input.thirdPartyRights === 'none' || input.thirdPartyRights === 'cleared'
  const gatePass =
    input.commercialUse === 'allowed'
    && input.modification !== 'prohibited'
    && input.recipeApplicability === 'confirmed'
    && thirdPartyClear
    && input.attribution !== 'unknown'

  if (gatePass) {
    return { classification: 'RIGHTS_CLEAR_CANDIDATE', blockingReasons: [] }
  }

  // ---- ライセンス自体が不明 → 現状 Recipe Data として再利用する Evidence が不足 ----
  if (input.licenseType === 'unknown') {
    return { classification: 'RESEARCH_ONLY', blockingReasons: ['LICENSE_UNKNOWN'] }
  }

  // ---- ライセンスは判明しているが、適用範囲・第三者・attribution 等に不明点が残る ----
  if (input.commercialUse !== 'allowed') reasons.push('COMMERCIAL_USE_NOT_CONFIRMED_ALLOWED')
  if (input.modification === 'conditional') reasons.push('MODIFICATION_CONDITIONAL')
  if (input.modification === 'unknown') reasons.push('MODIFICATION_UNKNOWN')
  if (input.recipeApplicability !== 'confirmed') reasons.push('RECIPE_APPLICABILITY_NOT_CONFIRMED')
  if (input.thirdPartyRights === 'unresolved') reasons.push('THIRD_PARTY_RIGHTS_UNRESOLVED')
  if (input.thirdPartyRights === 'unknown') reasons.push('THIRD_PARTY_RIGHTS_UNKNOWN')
  if (input.attribution === 'unknown') reasons.push('ATTRIBUTION_REQUIREMENT_UNKNOWN')

  return { classification: 'REVIEW_REQUIRED', blockingReasons: reasons }
}

/**
 * `RecipeSourceCandidateInput` から `classification` / `blockingReasons` を導出して
 * 完全な `RecipeSourceCandidate` を組み立てる。classification を手で矛盾させて渡せないようにする。
 */
export function buildRecipeSourceCandidate(input: RecipeSourceCandidateInput): RecipeSourceCandidate {
  const { classification, blockingReasons } = classifyRecipeSourceCandidate(input)
  return { ...input, classification, blockingReasons }
}

/** §9 — Discovery ≠ Import の boundary。RIGHTS_CLEAR_CANDIDATE でも true にならない（別 MISSION の判断） */
export function isEligibleForImportPipeline(): false {
  return false
}

// ------------------------------------------------------------
// §11 — Content-Scope Separation の可読ラベル
// ------------------------------------------------------------

export function describeApplicability(state: ApplicabilityState): string {
  const map: Record<ApplicabilityState, string> = {
    confirmed: '対象 Recipe（または Asset）への適用を Evidence で確認済み',
    partial: '一部のみ確認できた（全 Record に一律適用とは言えない）',
    unclear: '適用されるかどうか不明',
    notApplicable: 'このスコープには適用されない（別ライセンス管轄）',
  }
  return map[state]
}

export function describeAssetApplicability(state: AssetApplicabilityState): string {
  const map: Record<AssetApplicabilityState, string> = {
    confirmed: '再利用可能と確認済み（本 MISSION では画像等を利用しない）',
    separate: 'Recipe Facts とは別ライセンス管轄（未確認）',
    prohibited: '再利用禁止',
    unknown: '不明',
  }
  return map[state]
}

export function describeBlockingReason(reason: RecipeSourceBlockingReason): string {
  const map: Record<RecipeSourceBlockingReason, string> = {
    LICENSE_NONCOMMERCIAL: 'ライセンスが NonCommercial 系（商用サービスである NUKITORU の Primary Import Source として不可）',
    COMMERCIAL_USE_PROHIBITED: '商用利用が禁止されている',
    MODIFICATION_PROHIBITED: '改変・翻案が禁止されている',
    LICENSE_UNKNOWN: 'ライセンス種別が不明',
    COMMERCIAL_USE_NOT_CONFIRMED_ALLOWED: '商用利用が allowed と確認できていない',
    MODIFICATION_CONDITIONAL: '改変が条件付き（例: share-alike）で無条件 PASS にできない',
    MODIFICATION_UNKNOWN: '改変可否が不明',
    RECIPE_APPLICABILITY_NOT_CONFIRMED: 'ライセンスが対象 Recipe へ適用されると確認できていない',
    THIRD_PARTY_RIGHTS_UNRESOLVED: '第三者権利の表示があり未解決',
    THIRD_PARTY_RIGHTS_UNKNOWN: '第三者権利の有無自体が不明',
    ATTRIBUTION_REQUIREMENT_UNKNOWN: 'attribution の要否が不明',
    RECIPE_FACTS_RIGHTS_UNRESOLVED: 'Recipe Facts 自体の rights が未解決（Photo 等の分離では救えない）',
  }
  return map[reason]
}

// ------------------------------------------------------------
// MISSION 2.41F-2 §7 — Source Capability Model（Rights classification とは独立）
// ------------------------------------------------------------

export function describeCapability(capability: RecipeSourceCapability): string {
  const map: Record<RecipeSourceCapability, string> = {
    FULL_RECIPE: '材料・分量・調理工程を備えた完成レシピとして利用できる',
    RECIPE_INGREDIENT_GRAPH: '料理名と材料構成（分量含む場合あり）のみ。調理工程・servings は含まない',
    NUTRITION_REFERENCE: '栄養価等の参照情報のみ',
    FOOD_SAFETY_REFERENCE: '食品安全に関する参照情報のみ',
    CULINARY_IDENTITY_REFERENCE: '料理名・由来・地域性等の識別情報のみ',
    HISTORICAL_RECIPE: '歴史資料としてのレシピ（現代の家庭料理としての実用性は別評価）',
    DISCOVERY_ONLY: '存在・名称の把握にのみ使える。Structured Fact の抽出根拠にはまだならない',
  }
  return map[capability]
}

/**
 * §13 test 7 — Source 名や resource 名に "Recipe" が含まれることは FULL_RECIPE を意味しない。
 * capabilities に FULL_RECIPE が明示的に含まれる場合のみ true。
 */
export function isFullRecipeCapable(candidate: Pick<RecipeSourceCandidateInput, 'capabilities'>): boolean {
  return (candidate.capabilities ?? []).includes('FULL_RECIPE')
}

// ------------------------------------------------------------
// §9 — Rights Evidence Chain（途中 1 つでも unknown なら無理に PASS しない）
// ------------------------------------------------------------

export type EvidenceChainLink =
  | 'SOURCE_ORGANIZATION'
  | 'SOURCE_RECORD'
  | 'ACTUAL_RESOURCE'
  | 'LICENSE'
  | 'LICENSE_URL'
  | 'COMMERCIAL_USE'
  | 'MODIFICATION'
  | 'ATTRIBUTION'
  | 'LICENSE_APPLICABILITY'
  | 'THIRD_PARTY_RIGHTS'
  | 'CONTENT_SCOPE'

/**
 * Rights Evidence Chain の各 link が確認済みか。1 つでも欠落 / unknown なら
 * `RIGHTS_CLEAR_CANDIDATE` にしないことの根拠を可視化する（gate 自体は
 * `classifyRecipeSourceCandidate` が行う。これは監査用の補助関数）。
 */
export function evidenceChainMissingLinks(input: RecipeSourceCandidateInput): EvidenceChainLink[] {
  const missing: EvidenceChainLink[] = []
  if (!input.organization.trim()) missing.push('SOURCE_ORGANIZATION')
  if (!input.id.trim()) missing.push('SOURCE_RECORD')
  if (!input.recipeIndexUrl) missing.push('ACTUAL_RESOURCE')
  if (input.licenseType === 'unknown') missing.push('LICENSE')
  if (!input.licenseUrl) missing.push('LICENSE_URL')
  if (input.commercialUse === 'unknown') missing.push('COMMERCIAL_USE')
  if (input.modification === 'unknown') missing.push('MODIFICATION')
  if (input.attribution === 'unknown') missing.push('ATTRIBUTION')
  if (input.recipeApplicability !== 'confirmed') missing.push('LICENSE_APPLICABILITY')
  if (input.thirdPartyRights === 'unresolved' || input.thirdPartyRights === 'unknown') missing.push('THIRD_PARTY_RIGHTS')
  if (input.photoApplicability === 'unknown' && input.externalContentApplicability === 'unknown' && input.recipeApplicability !== 'confirmed') {
    missing.push('CONTENT_SCOPE')
  }
  return missing
}

// ------------------------------------------------------------
// MISSION 2.41F-2A §1 / §5 — Rights ≠ Completeness ≠ Product Value の分離を明示する view
// ------------------------------------------------------------

export interface GapSeparationView {
  /** Rights Gap のみ（blockingReasons + Evidence Chain の欠落 link）。データ完全性は含まない */
  rightsGaps: string[]
  /** 実データ / レシピの完全性の欠落（Rights ではない） */
  dataCompletenessGaps: string[]
  /** Rights でもデータ完全性でもない Product Value の注記 */
  productValueNotes: string[]
}

/**
 * §5 — Candidate の Gap を Rights / Data Completeness / Product Value の 3 系統へ分けて返す。
 * `rightsGaps` は gate（blockingReasons）と Evidence Chain の欠落のみから構成される
 * （dataCompletenessGaps / productValueNotes は絶対に混ざらない）。
 */
export function gapSeparationFor(candidate: RecipeSourceCandidate): GapSeparationView {
  const rightsGaps = [
    ...candidate.blockingReasons,
    ...evidenceChainMissingLinks(candidate).map((l) => `EVIDENCE_CHAIN:${l}`),
  ]
  return {
    rightsGaps: Array.from(new Set(rightsGaps)),
    dataCompletenessGaps: [...(candidate.dataCompletenessGaps ?? [])],
    productValueNotes: [...(candidate.productValueNotes ?? [])],
  }
}

/**
 * §8 test 1 / 4 / 5 — データ完全性（CSV schema 等）が埋まっても Rights Gap は自動解消しない。
 * Rights Gap が 1 つでも残っていれば true。
 */
export function hasUnresolvedRightsGap(candidate: RecipeSourceCandidate): boolean {
  return gapSeparationFor(candidate).rightsGaps.length > 0
}

// ------------------------------------------------------------
// §10 — Attribution Preview（正式 UI ではない。Evidence から導出できる範囲のみ）
// ------------------------------------------------------------

export interface AttributionPreview {
  source: string
  dataset: string
  licence: string
  licenceUrl?: string
  modifiedNote: string
}

/**
 * もし将来この Candidate を利用するとしたら何を表示・保存する必要があるかの preview。
 * 正式文言を推測で確定しない — Evidence（organization / name / licenseType / licenseUrl）から
 * 導出できる範囲だけを組み立てる。
 */
export function buildAttributionPreview(candidate: RecipeSourceCandidateInput): AttributionPreview {
  return {
    source: candidate.organization,
    dataset: candidate.name,
    licence: candidate.licenseType,
    ...(candidate.licenseUrl ? { licenceUrl: candidate.licenseUrl } : {}),
    modifiedNote: 'NUKITORU normalized ingredient names / structured facts（原文からの改変を明示）',
  }
}
