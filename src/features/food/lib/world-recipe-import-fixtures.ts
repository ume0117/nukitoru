// ============================================================
// world-recipe-import-fixtures.ts
//
// MISSION 2.37 — Import Pipeline 検証用の最小 Fixture。
//
// **重要 — SYNTHETIC**:
// - ここに含まれる「料理事実」（ingredients / cookingSteps 等）は Rights Gate の
//   検証専用のダミーであり、実在の情報源に基づかない。
// - NUKITORU Knowledge / Presentation の実データとして扱わない。
// - SOURCE_RECIPE_KNOWLEDGE_FIXTURES（MISSION 2.35 の実データ）には決して混ぜない。
// - 権利状態（recordRights）だけが検証対象。cookingSteps は「heat unknown を補完しない」
//   等の fact-preservation を確認できる最小構成にしてある。
// ============================================================

import type {
  RawRecipeImportCandidate,
  WorldFoodSourceRecordRights,
} from '@/features/food/types'

const SYNTHETIC_NOTE =
  'SYNTHETIC — MISSION 2.37 Rights Gate 検証専用。この料理事実は実在の情報源に基づかない。'

const RIGHTS_CHECKED_AT = '2026-09-03'

/** すべての候補で共有する最小の「料理事実」（synthetic・fact preservation 検証用） */
function syntheticCookingBody(): Pick<
  RawRecipeImportCandidate,
  'sourceRecipeName' | 'sourceLanguage' | 'servings' | 'ingredients' | 'preparation' | 'equipment' | 'cookingSteps' | 'sourceStatedTotalTime'
> {
  return {
    sourceRecipeName: 'synthetic test dish',
    sourceLanguage: 'en',
    servings: { displayText: '2 servings', semantics: { kind: 'exact', value: 2, unit: 'servings' } },
    ingredients: [
      {
        sourceIngredientName: 'egg',
        role: 'required',
        // range quantity — Import は midpoint 化してはいけない
        quantity: { displayText: '2–3 eggs', semantics: { kind: 'range', min: 2, max: 3, unit: 'piece' } },
      },
      {
        sourceIngredientName: 'salt',
        role: 'seasoning',
        // 情報源が数値化していない — Import は数値化してはいけない
        quantity: { displayText: 'a pinch', semantics: { kind: 'culinary-term', term: 'pinch' } },
      },
      {
        // 既存 CanonicalFoodId に一致しない食材 — Import 失敗にしない・undefined のまま
        sourceIngredientName: 'gochugaru',
        role: 'seasoning',
        quantity: { displayText: 'to taste', semantics: { kind: 'to-taste' } },
      },
    ],
    preparation: [{ text: 'beat the eggs' }],
    equipment: ['frying pan'],
    cookingSteps: [
      {
        order: 1,
        factSummary: 'heat the pan and add the eggs',
        ingredientsUsed: ['egg'],
        heat: 'medium',
        duration: { kind: 'range', minMinutes: 2, maxMinutes: 3 },
      },
      {
        order: 2,
        factSummary: 'fold and finish',
        // 情報源が火加減も時間も示していない → Import/Presentation は補完しない
      },
    ],
    sourceStatedTotalTime: { kind: 'approximate', minutes: 10 },
  }
}

function candidate(
  canonicalRecipeId: string | undefined,
  recordRights: WorldFoodSourceRecordRights,
  extra?: Partial<RawRecipeImportCandidate>,
): RawRecipeImportCandidate {
  return {
    ...syntheticCookingBody(),
    ...(canonicalRecipeId !== undefined ? { canonicalRecipeId } : {}),
    notes: [SYNTHETIC_NOTE],
    recordRights,
    ...extra,
  }
}

// ------------------------------------------------------------
// A. allowed source + allowed record → Import 成功
// ------------------------------------------------------------
export const FIXTURE_A_PASS: RawRecipeImportCandidate = candidate('kr-kimchi-bokkeumbap', {
  sourceId: 'synthetic-cleared-open-source',
  sourceRecordId: 'A-001',
  sourceUrl: 'https://example.invalid/synthetic-cleared-open-source/recipes/A-001',
  thirdPartyRights: 'none',
  rightsStatus: 'use',
  rightsCheckedAt: RIGHTS_CHECKED_AT,
  rightsEvidenceUrl: 'https://example.invalid/synthetic-cleared-open-source/terms',
})

// ------------------------------------------------------------
// B. structuredFactStorage unknown（record override）→ BLOCK
// ------------------------------------------------------------
export const FIXTURE_B_STORAGE_UNKNOWN: RawRecipeImportCandidate = candidate('kr-kimchi-bokkeumbap', {
  sourceId: 'synthetic-cleared-open-source',
  sourceRecordId: 'B-001',
  sourceUrl: 'https://example.invalid/synthetic-cleared-open-source/recipes/B-001',
  thirdPartyRights: 'none',
  rightsStatus: 'use',
  rightsCheckedAt: RIGHTS_CHECKED_AT,
  rightsOverride: { structuredFactStorage: 'unknown' },
})

// ------------------------------------------------------------
// C. third-party rights unresolved → BLOCK
// ------------------------------------------------------------
export const FIXTURE_C_THIRD_PARTY_UNRESOLVED: RawRecipeImportCandidate = candidate('jp-tori-teriyaki', {
  sourceId: 'jp-maff-kyodo-ryori',
  sourceRecordId: 'C-dashi-yamagata',
  sourceUrl: 'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/menu/dashi_yamagata.html',
  originalContributor: '山形県グリーン・ツーリズム推進協議会（編集）/ 古田久子（監修）',
  originalSourceName: '山形県郷土料理探訪',
  thirdPartyRights: 'unresolved',
  rightsStatus: 'conditional',
  rightsCheckedAt: RIGHTS_CHECKED_AT,
  rightsNotes: ['MAFF-held の PDL1.0 は及ぶが、レシピ提供元の利用条件が未確認'],
})

// ------------------------------------------------------------
// D. do-not-ingest source → BLOCK
// ------------------------------------------------------------
export const FIXTURE_D_DO_NOT_INGEST: RawRecipeImportCandidate = candidate('kr-kimchi-bokkeumbap', {
  sourceId: 'synthetic-scrape-dataset',
  sourceRecordId: 'D-001',
  sourceUrl: 'https://example.invalid/synthetic-scrape-dataset/recipes/D-001',
  thirdPartyRights: 'unknown',
  rightsStatus: 'unknown',
  rightsCheckedAt: RIGHTS_CHECKED_AT,
})

// ------------------------------------------------------------
// E. imageReuse prohibited + structuredFactStorage allowed
//    → Recipe Knowledge Import 成功・画像は入らない
// ------------------------------------------------------------
export const FIXTURE_E_IMAGE_PROHIBITED: RawRecipeImportCandidate = candidate(
  'kr-kimchi-bokkeumbap',
  {
    sourceId: 'synthetic-cleared-open-source', // imageReuse: 'prohibited'
    sourceRecordId: 'E-001',
    sourceUrl: 'https://example.invalid/synthetic-cleared-open-source/recipes/E-001',
    thirdPartyRights: 'none',
    rightsStatus: 'use',
    rightsCheckedAt: RIGHTS_CHECKED_AT,
  },
  { imageUrl: 'https://example.invalid/synthetic-cleared-open-source/img/E-001.jpg' },
)

// ------------------------------------------------------------
// F. aiMlUse unknown + structuredFactStorage allowed
//    → Recipe Knowledge Import 成功・AI 利用可能扱いにしない
//    （FIXTURE_A と同じ source。aiMlUse=unknown を明示的に検証するため別 fixture）
// ------------------------------------------------------------
export const FIXTURE_F_AI_UNKNOWN: RawRecipeImportCandidate = candidate('kr-kimchi-bokkeumbap', {
  sourceId: 'synthetic-cleared-open-source', // aiMlUse: 'unknown'
  sourceRecordId: 'F-001',
  sourceUrl: 'https://example.invalid/synthetic-cleared-open-source/recipes/F-001',
  thirdPartyRights: 'none',
  rightsStatus: 'use',
  rightsCheckedAt: RIGHTS_CHECKED_AT,
})

// ------------------------------------------------------------
// G. source classification unknown + record override で明示許可
//    → Import 成功（record override > source default を検証）
//    （MyPlate: 連邦職務著作物と record 単位で確認できたケース）
// ------------------------------------------------------------
export const FIXTURE_G_MYPLATE_FEDERAL_CONFIRMED: RawRecipeImportCandidate = candidate(
  'kr-kimchi-bokkeumbap',
  {
    sourceId: 'us-usda-myplate', // classification: 'unknown', rights 全部 unknown
    sourceRecordId: 'G-federal-recipe',
    sourceUrl: 'https://www.myplate.gov/recipes/example-federal-recipe',
    originalContributor: 'USDA Center for Nutrition Policy and Promotion',
    thirdPartyRights: 'none', // 連邦職員の職務著作物と record 単位で確認済み（synthetic 設定）
    rightsStatus: 'use',
    rightsCheckedAt: RIGHTS_CHECKED_AT,
    rightsEvidenceUrl: 'https://www.usda.gov/about-usda/policies-and-links',
    rightsOverride: {
      structuredFactStorage: 'allowed',
      commercialUse: 'allowed',
      verbatimTextStorage: 'allowed',
    },
    rightsNotes: [
      'SYNTHETIC: record 単位で「連邦職員の職務著作物（17 USC §105）」と確認できたと仮定したケース。',
      '実運用では各 recipe の provenance を一次確認してから override を設定する。',
    ],
  },
)

// ------------------------------------------------------------
// H. source classification unknown + override なし → BLOCK
//    （MyPlate: "adapted from" ONIE Project のような第三者由来 record）
// ------------------------------------------------------------
export const FIXTURE_H_MYPLATE_THIRD_PARTY: RawRecipeImportCandidate = candidate(
  'kr-kimchi-bokkeumbap',
  {
    sourceId: 'us-usda-myplate',
    sourceRecordId: 'H-2-step-chicken',
    sourceUrl: 'https://www.myplate.gov/recipes/supplemental-nutrition-assistance-program-snap/2-step-chicken',
    originalContributor: 'ONIE Project (University of Oklahoma Health Sciences Center)',
    originalSourceName: 'Simple Healthy Recipes',
    adaptedFrom: 'Simple Healthy Recipes — Oklahoma Nutrition Information and Education (ONIE Project)',
    thirdPartyRights: 'unresolved',
    rightsStatus: 'conditional',
    rightsCheckedAt: RIGHTS_CHECKED_AT,
    rightsNotes: ['grantee（州立大学）由来。17 USC §105 は自動適用されない（MISSION 2.36A §0.4 C2）'],
  },
)

// ------------------------------------------------------------
// I. missing rightsCheckedAt → BLOCK
// ------------------------------------------------------------
export const FIXTURE_I_NO_RIGHTS_DATE: RawRecipeImportCandidate = candidate('kr-kimchi-bokkeumbap', {
  sourceId: 'synthetic-cleared-open-source',
  sourceRecordId: 'I-001',
  sourceUrl: 'https://example.invalid/synthetic-cleared-open-source/recipes/I-001',
  thirdPartyRights: 'none',
  rightsStatus: 'use',
  // rightsCheckedAt を意図的に欠落
})

// ------------------------------------------------------------
// J. missing provenance（sourceUrl 空）→ BLOCK
// ------------------------------------------------------------
export const FIXTURE_J_NO_PROVENANCE: RawRecipeImportCandidate = candidate('kr-kimchi-bokkeumbap', {
  sourceId: 'synthetic-cleared-open-source',
  sourceRecordId: 'J-001',
  sourceUrl: '', // provenance 欠落
  thirdPartyRights: 'none',
  rightsStatus: 'use',
  rightsCheckedAt: RIGHTS_CHECKED_AT,
})

// ------------------------------------------------------------
// K. rights OK だが Identity 未解決 → BLOCK
// ------------------------------------------------------------
export const FIXTURE_K_IDENTITY_UNRESOLVED: RawRecipeImportCandidate = candidate(
  'unknown-dish-not-in-registry',
  {
    sourceId: 'synthetic-cleared-open-source',
    sourceRecordId: 'K-001',
    sourceUrl: 'https://example.invalid/synthetic-cleared-open-source/recipes/K-001',
    thirdPartyRights: 'none',
    rightsStatus: 'use',
    rightsCheckedAt: RIGHTS_CHECKED_AT,
  },
)

// ------------------------------------------------------------
// L. record rightsStatus unknown → BLOCK
// ------------------------------------------------------------
export const FIXTURE_L_RECORD_RIGHTS_UNKNOWN: RawRecipeImportCandidate = candidate('kr-kimchi-bokkeumbap', {
  sourceId: 'synthetic-cleared-open-source',
  sourceRecordId: 'L-001',
  sourceUrl: 'https://example.invalid/synthetic-cleared-open-source/recipes/L-001',
  thirdPartyRights: 'none',
  rightsStatus: 'unknown',
  rightsCheckedAt: RIGHTS_CHECKED_AT,
})

// ------------------------------------------------------------
// M. source が registry に無い → BLOCK
// ------------------------------------------------------------
export const FIXTURE_M_SOURCE_NOT_REGISTERED: RawRecipeImportCandidate = candidate('kr-kimchi-bokkeumbap', {
  sourceId: 'source-that-does-not-exist',
  sourceRecordId: 'M-001',
  sourceUrl: 'https://example.invalid/unknown/recipes/M-001',
  thirdPartyRights: 'none',
  rightsStatus: 'use',
  rightsCheckedAt: RIGHTS_CHECKED_AT,
})

export const IMPORT_CANDIDATE_FIXTURES: Record<string, RawRecipeImportCandidate> = {
  A_PASS: FIXTURE_A_PASS,
  B_STORAGE_UNKNOWN: FIXTURE_B_STORAGE_UNKNOWN,
  C_THIRD_PARTY_UNRESOLVED: FIXTURE_C_THIRD_PARTY_UNRESOLVED,
  D_DO_NOT_INGEST: FIXTURE_D_DO_NOT_INGEST,
  E_IMAGE_PROHIBITED: FIXTURE_E_IMAGE_PROHIBITED,
  F_AI_UNKNOWN: FIXTURE_F_AI_UNKNOWN,
  G_MYPLATE_FEDERAL_CONFIRMED: FIXTURE_G_MYPLATE_FEDERAL_CONFIRMED,
  H_MYPLATE_THIRD_PARTY: FIXTURE_H_MYPLATE_THIRD_PARTY,
  I_NO_RIGHTS_DATE: FIXTURE_I_NO_RIGHTS_DATE,
  J_NO_PROVENANCE: FIXTURE_J_NO_PROVENANCE,
  K_IDENTITY_UNRESOLVED: FIXTURE_K_IDENTITY_UNRESOLVED,
  L_RECORD_RIGHTS_UNKNOWN: FIXTURE_L_RECORD_RIGHTS_UNKNOWN,
  M_SOURCE_NOT_REGISTERED: FIXTURE_M_SOURCE_NOT_REGISTERED,
}

export const SYNTHETIC_IMPORT_NOTE = SYNTHETIC_NOTE
