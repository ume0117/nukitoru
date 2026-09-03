// ============================================================
// recipe-evidence-pack-fixtures.ts
//
// MISSION 2.41A — Recipe Evidence Pack の検証用 Fixture。
//
// 2 種類:
//   1. SYNTHETIC_* — Gate の経路（COMPLETE / RIGHTS_BLOCKED / IDENTITY_REVIEW /
//      PROCESS_REVIEW / SOURCE_NOT_STATED）を検証するためのダミー。
//      料理事実は実在の情報源に基づかない。SOURCE_RECIPE_KNOWLEDGE_FIXTURES へ混ぜない。
//   2. MAFF_CANDIDATE_* — MISSION 2.41 §28〜§31 の 4 候補（肉じゃが / 芋煮 / 呉の肉じゃが /
//      けんちん汁）。**まだ Import しない**。External Research Layer から完全な Structured
//      Facts が届くまで canEnterRecipeImport === false であることを固定する。
//      ここに書いてよいのは Commander が §28〜§31 で明示的に確認済みと述べた Fact だけ。
//      それ以外はすべて NOT_CAPTURED（推測補完しない — §39）。
// ============================================================

import type {
  EvidenceFact,
  QuantityStatement,
  RecipeEvidencePack,
  RecipeEvidencePackRecipe,
} from '@/features/food/types'

const MISSION_DATE = '2026-09-03'

// ------------------------------------------------------------
// helpers
// ------------------------------------------------------------

function present<T>(value: T, evidenceReference?: string): EvidenceFact<T> {
  return { status: 'PRESENT', value, ...(evidenceReference ? { evidenceReference } : {}) }
}
function notCaptured<T>(): EvidenceFact<T> {
  return { status: 'NOT_CAPTURED' }
}
function sourceNotStated<T>(): EvidenceFact<T> {
  return { status: 'SOURCE_NOT_STATED' }
}
function conflict<T>(conflictingValues: T[], notes?: string): EvidenceFact<T> {
  return { status: 'CONFLICT', conflictingValues, ...(notes ? { notes } : {}) }
}

function exactQty(displayText: string, value: number, unit: string): QuantityStatement {
  return { displayText, semantics: { kind: 'exact', value, unit } }
}
function rangeQty(displayText: string, min: number, max: number, unit: string): QuantityStatement {
  return { displayText, semantics: { kind: 'range', min, max, unit } }
}

// ============================================================
// 1. SYNTHETIC — Gate 経路検証専用（実在の料理事実ではない）
// ============================================================

const SYNTHETIC_NOTE =
  'SYNTHETIC — MISSION 2.41A Gate 経路検証専用。この料理事実は実在の情報源に基づかない。'

/** COMPLETE の recipe body（synthetic）。個別 fixture がここから派生する */
function syntheticCompleteRecipe(): RecipeEvidencePackRecipe {
  return {
    sourceRecipeName: 'synthetic complete dish',
    sourceLanguage: 'en',
    servings: present(exactQty('2 servings', 2, 'servings')),
    ingredientListStatus: 'PRESENT',
    ingredients: [
      { sourceIngredientName: 'potato', role: 'required', amount: present(exactQty('2 potatoes', 2, 'piece')) },
      { sourceIngredientName: 'olive oil', role: 'seasoning', amount: present(exactQty('2 tbsp olive oil', 2, 'tbsp')) },
      // 情報源が塩の分量を述べていない — SOURCE_NOT_STATED（それでも COMPLETE）
      { sourceIngredientName: 'salt', role: 'seasoning', amount: sourceNotStated() },
    ],
    stepListStatus: 'PRESENT',
    steps: [
      {
        order: 1,
        factSummary: present('heat oil, add potato'),
        ingredientsUsed: ['potato', 'olive oil'],
        heat: present('medium'),
        duration: present({ kind: 'range', minMinutes: 3, maxMinutes: 4 }),
      },
      {
        order: 2,
        factSummary: present('season and finish'),
        ingredientsUsed: ['salt'],
        // 情報源が火加減も時間も述べていない
        heat: sourceNotStated(),
      },
    ],
    preparation: present(['peel and slice the potato']),
    completionCues: present(['potato is tender']),
    equipmentConditions: present(['frying pan']),
  }
}

function syntheticPack(
  overrides: {
    id: string
    candidateCanonicalRecipeId?: string
    sourceId?: string
    rights?: Partial<RecipeEvidencePack['rights']>
    recipe?: Partial<RecipeEvidencePackRecipe>
    evidenceMethod?: RecipeEvidencePack['provenance']['evidenceMethod']
    classification?: Partial<RecipeEvidencePack['classification']>
  },
): RecipeEvidencePack {
  return {
    identity: {
      id: overrides.id,
      ...(overrides.candidateCanonicalRecipeId !== undefined
        ? { candidateCanonicalRecipeId: overrides.candidateCanonicalRecipeId }
        : {}),
    },
    source: {
      sourceId: overrides.sourceId ?? 'synthetic-cleared-open-source',
      sourceOrganization: 'SYNTHETIC / NUKITORU internal test',
      sourceTitle: 'SYNTHETIC test recipe page',
      sourceUrl: 'https://example.invalid/synthetic-cleared-open-source/recipes/' + overrides.id,
      sourceRecordId: overrides.id,
      accessedAt: MISSION_DATE,
    },
    rights: {
      sourceRightsStatus: 'allowed',
      recordRightsStatus: 'allowed',
      structuredFactStorageStatus: 'allowed',
      verbatimTextStatus: 'conditional',
      imageAssetStatus: 'prohibited',
      rightsEvidenceReference: 'https://example.invalid/synthetic-cleared-open-source/terms',
      ...overrides.rights,
    },
    recipe: { ...syntheticCompleteRecipe(), ...overrides.recipe },
    classification: {
      country: sourceNotStated(),
      cuisine: sourceNotStated(),
      mealOccasions: sourceNotStated(),
      ...overrides.classification,
    },
    provenance: {
      providedBy: 'external-research-layer',
      evidenceMethod: overrides.evidenceMethod ?? 'official-source-body-review',
      capturedAt: MISSION_DATE,
      notes: SYNTHETIC_NOTE,
    },
  }
}

/** A. すべて揃っている → COMPLETE / importEligible。identity は登録済みの es-tortilla-espanola */
export const SYNTHETIC_COMPLETE_PACK: RecipeEvidencePack = syntheticPack({
  id: 'evp-synthetic-complete',
  candidateCanonicalRecipeId: 'es-tortilla-espanola',
})

/** B. structuredFactStorage prohibited + do-not-ingest source → RIGHTS_BLOCKED */
export const SYNTHETIC_RIGHTS_BLOCKED_PACK: RecipeEvidencePack = syntheticPack({
  id: 'evp-synthetic-rights-blocked',
  candidateCanonicalRecipeId: 'es-tortilla-espanola',
  sourceId: 'synthetic-scrape-dataset', // classification: 'do-not-ingest'
  rights: { structuredFactStorageStatus: 'prohibited', recordRightsStatus: 'prohibited' },
})

/** C. Fact は揃っているが candidateCanonicalRecipeId が無い → IDENTITY_REVIEW */
export const SYNTHETIC_IDENTITY_REVIEW_PACK: RecipeEvidencePack = syntheticPack({
  id: 'evp-synthetic-identity-review',
  // candidateCanonicalRecipeId を意図的に未設定
})

/** D. 分量に CONFLICT（400ml vs 600ml）→ PROCESS_REVIEW。平均して 500ml にしない */
export const SYNTHETIC_PROCESS_REVIEW_PACK: RecipeEvidencePack = syntheticPack({
  id: 'evp-synthetic-process-review',
  candidateCanonicalRecipeId: 'es-tortilla-espanola',
  recipe: {
    ingredients: [
      { sourceIngredientName: 'potato', role: 'required', amount: present(exactQty('2 potatoes', 2, 'piece')) },
      {
        sourceIngredientName: 'water',
        role: 'cooking-liquid',
        amount: conflict<QuantityStatement>(
          [exactQty('water 400ml', 400, 'ml'), exactQty('water 600ml', 600, 'ml')],
          'SYNTHETIC: 同一 Evidence scope 内で水量が両立しない',
        ),
      },
    ],
  },
})

/** E. 火加減が SOURCE_NOT_STATED でも COMPLETE（§18）。adapter は heat を省略する */
export const SYNTHETIC_SOURCE_SILENCE_PACK: RecipeEvidencePack = syntheticPack({
  id: 'evp-synthetic-source-silence',
  candidateCanonicalRecipeId: 'es-tortilla-espanola',
  recipe: {
    steps: [
      {
        order: 1,
        factSummary: present('cook the potato'),
        ingredientsUsed: ['potato'],
        heat: sourceNotStated(), // 情報源が火加減を述べていない（まだ調べていない = ではない）
        duration: sourceNotStated(),
      },
    ],
  },
})

/** F. EvidenceFact 形状違反（SOURCE_NOT_STATED なのに value がある）→ FACT_PRESENCE_INVALID */
export const SYNTHETIC_INVALID_FACT_SHAPE_PACK: RecipeEvidencePack = syntheticPack({
  id: 'evp-synthetic-invalid-fact-shape',
  candidateCanonicalRecipeId: 'es-tortilla-espanola',
  recipe: {
    // SOURCE_NOT_STATED なのに value がある = §7 形状違反。型としては通るが
    // factHasValidShape / validateEvidencePack が FACT_PRESENCE_INVALID として検出する。
    servings: { status: 'SOURCE_NOT_STATED', value: exactQty('2 servings', 2, 'servings') },
  },
})

/** G. summary のみ（body 未確認）→ EVIDENCE_METHOD_NOT_SOURCE_BODY → INCOMPLETE */
export const SYNTHETIC_SUMMARY_ONLY_PACK: RecipeEvidencePack = syntheticPack({
  id: 'evp-synthetic-summary-only',
  candidateCanonicalRecipeId: 'es-tortilla-espanola',
  evidenceMethod: 'official-source-summary',
})

// ============================================================
// 2. MAFF CANDIDATES（MISSION 2.41 §28〜§31）— まだ Import しない
// ============================================================

/**
 * §28 A: 肉じゃが（農林水産省 めざましごはん レシピ）。
 * NOTE: この URL は「うちの郷土料理」(jp-maff-kyodo-ryori) とは別セクション。
 * その source の rights 監査（MISSION 2.36 / 2.36A）は未実施 → SOURCE_NOT_REGISTERED。
 */
export const MAFF_CANDIDATE_NIKUJAGA: RecipeEvidencePack = {
  identity: { id: 'evp-maff-nikujaga-recipe112' }, // candidateCanonicalRecipeId 未確定
  source: {
    sourceId: 'jp-maff-mezamashi-gohan', // 登録簿に無い（うちの郷土料理とは別プログラム）
    sourceOrganization: '農林水産省',
    sourceTitle: '肉じゃが（農林水産省 めざましごはん レシピ recipe112）',
    sourceUrl: 'https://www.maff.go.jp/j/seisan/kakou/mezamasi/recipe/recipe112.html',
    accessedAt: MISSION_DATE,
  },
  rights: {
    sourceRightsStatus: 'unknown',
    recordRightsStatus: 'unknown',
    structuredFactStorageStatus: 'unknown',
    verbatimTextStatus: 'unknown',
    imageAssetStatus: 'unknown',
    rightsNotes:
      'MAFF めざましごはん プログラム。うちの郷土料理 (jp-maff-kyodo-ryori) とは別セクションで rights 監査未実施。',
  },
  recipe: {
    sourceRecipeName: '肉じゃが',
    sourceLanguage: 'ja',
    servings: present(exactQty('4人分', 4, '人分')),
    ingredientListStatus: 'NOT_CAPTURED',
    ingredients: [
      { sourceIngredientName: 'じゃがいも', role: 'required', amount: notCaptured() },
      { sourceIngredientName: 'にんじん', role: 'required', amount: notCaptured() },
      { sourceIngredientName: '玉ねぎ', role: 'required', amount: notCaptured() },
      { sourceIngredientName: '絹さや', role: 'required', amount: notCaptured() },
      { sourceIngredientName: '牛肉', role: 'required', amount: notCaptured() },
      { sourceIngredientName: 'だし', role: 'cooking-liquid', amount: notCaptured() },
      { sourceIngredientName: '砂糖', role: 'seasoning', amount: notCaptured() },
      { sourceIngredientName: '酒', role: 'seasoning', amount: notCaptured() },
      { sourceIngredientName: 'しょうゆ', role: 'seasoning', amount: notCaptured() },
      { sourceIngredientName: 'サラダ油', role: 'seasoning', amount: notCaptured() },
    ],
    stepListStatus: 'NOT_CAPTURED',
    steps: [],
    preparation: notCaptured(),
    completionCues: notCaptured(),
    equipmentConditions: notCaptured(),
  },
  classification: {
    country: notCaptured(),
    cuisine: notCaptured(),
    mealOccasions: notCaptured(),
  },
  provenance: {
    providedBy: 'commander',
    evidenceMethod: 'official-source-summary',
    capturedAt: MISSION_DATE,
    notes:
      'Commander 確認済み概要のみ（§28）。4人分。主要 Ingredient: じゃがいも/にんじん/玉ねぎ/絹さや/牛肉/だし/砂糖/酒/しょうゆ/サラダ油。'
      + 'Source 工程に「中火」「中火〜弱火」「約20分」の記載を確認。ただし全 Ingredient Amount / Steps は未 capture。',
  },
}

/** §29 B: 芋煮 山形県（農林水産省 うちの郷土料理）。レシピ提供元: 山形県 */
export const MAFF_CANDIDATE_IMONI_YAMAGATA: RecipeEvidencePack = {
  identity: { id: 'evp-maff-imoni-yamagata' },
  source: {
    sourceId: 'jp-maff-kyodo-ryori',
    sourceOrganization: '農林水産省',
    sourceTitle: '芋煮 山形県 — うちの郷土料理',
    sourceUrl:
      'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/menu/imoni_yamagata.html',
    accessedAt: MISSION_DATE,
  },
  rights: {
    sourceRightsStatus: 'allowed',
    recordRightsStatus: 'allowed',
    structuredFactStorageStatus: 'allowed',
    verbatimTextStatus: 'prohibited',
    imageAssetStatus: 'prohibited',
    thirdPartyIndication: true,
    thirdPartyRightsReview: 'not-reviewed',
    rightsEvidenceReference: 'https://www.maff.go.jp/j/use/link.html',
    rightsNotes:
      'レシピ提供元: 山形県。MAFF-held facts は PDL1.0 で商用 USE 可だが、レシピ提供元（山形県）の利用条件を record-level で未確認。',
  },
  recipe: {
    sourceRecipeName: '芋煮',
    sourceLanguage: 'ja',
    servings: present(rangeQty('4〜5人分', 4, 5, '人分')),
    ingredientListStatus: 'NOT_CAPTURED',
    ingredients: [
      { sourceIngredientName: '里芋', role: 'required', amount: present(exactQty('里芋 500g', 500, 'g')) },
      { sourceIngredientName: '水', role: 'cooking-liquid', amount: present(exactQty('水 800cc', 800, 'cc')) },
      { sourceIngredientName: 'こんにゃく', role: 'required', amount: notCaptured() },
      { sourceIngredientName: '牛肉', role: 'required', amount: notCaptured() },
      { sourceIngredientName: '長ねぎ', role: 'required', amount: notCaptured() },
      { sourceIngredientName: '醤油', role: 'seasoning', amount: notCaptured() },
      { sourceIngredientName: '砂糖', role: 'seasoning', amount: notCaptured() },
      { sourceIngredientName: '日本酒', role: 'seasoning', amount: notCaptured() },
    ],
    stepListStatus: 'NOT_CAPTURED',
    steps: [],
    preparation: notCaptured(),
    completionCues: notCaptured(),
    equipmentConditions: notCaptured(),
  },
  classification: {
    country: notCaptured(),
    cuisine: notCaptured(),
    mealOccasions: notCaptured(),
  },
  provenance: {
    providedBy: 'commander',
    evidenceMethod: 'official-source-summary',
    capturedAt: MISSION_DATE,
    notes:
      'Commander 確認済み概要（§29）。4〜5人分。里芋500g・水800cc。他 Ingredient（こんにゃく/牛肉/長ねぎ/醤油/砂糖/日本酒）は分量未 capture。'
      + '6工程が存在（内容・順序は未 capture）。七味唐辛子のアレンジ記載あり → MISSION 2.41 §34 CHOI-TASHI future。primary recipe には含めない。',
  },
}

/** §30 C: 呉の肉じゃが 広島県（農林水産省 うちの郷土料理）。通常の肉じゃがと同一 Identity にしない */
export const MAFF_CANDIDATE_KURE_NIKUJAGA: RecipeEvidencePack = {
  identity: { id: 'evp-maff-kure-nikujaga' },
  source: {
    sourceId: 'jp-maff-kyodo-ryori',
    sourceOrganization: '農林水産省',
    sourceTitle: '呉の肉じゃが 広島県 — うちの郷土料理',
    sourceUrl:
      'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/menu/42_20_hiroshima.html',
    accessedAt: MISSION_DATE,
  },
  rights: {
    sourceRightsStatus: 'allowed',
    recordRightsStatus: 'allowed',
    structuredFactStorageStatus: 'allowed',
    verbatimTextStatus: 'prohibited',
    imageAssetStatus: 'prohibited',
    thirdPartyIndication: true,
    thirdPartyRightsReview: 'not-reviewed',
    rightsEvidenceReference: 'https://www.maff.go.jp/j/use/link.html',
    rightsNotes:
      'うちの郷土料理 の record は一般に都道府県・団体のレシピ提供元表示がある（source registry notes 参照）。この record の個別の提供元は未 capture・未 review。',
  },
  recipe: {
    sourceRecipeName: '呉の肉じゃが',
    sourceLanguage: 'ja',
    servings: present(exactQty('4人分', 4, '人分')),
    ingredientListStatus: 'NOT_CAPTURED',
    ingredients: [
      { sourceIngredientName: '牛肉', role: 'required', amount: present(exactQty('牛肉 160g', 160, 'g')) },
      { sourceIngredientName: 'じゃがいも', role: 'required', amount: present(exactQty('じゃがいも 6個', 6, '個')) },
      { sourceIngredientName: '玉ねぎ', role: 'required', amount: present(exactQty('玉ねぎ 1個', 1, '個')) },
      { sourceIngredientName: '糸こんにゃく', role: 'required', amount: present(exactQty('糸こんにゃく 240g', 240, 'g')) },
    ],
    stepListStatus: 'NOT_CAPTURED',
    steps: [],
    preparation: notCaptured(),
    completionCues: notCaptured(),
    equipmentConditions: notCaptured(),
  },
  classification: {
    country: notCaptured(),
    cuisine: notCaptured(),
    mealOccasions: notCaptured(),
  },
  provenance: {
    providedBy: 'commander',
    evidenceMethod: 'official-source-summary',
    capturedAt: MISSION_DATE,
    notes:
      'Commander 確認済み概要（§30）。4人分。牛肉160g・じゃがいも6個・玉ねぎ1個・糸こんにゃく240g。'
      + '5工程が存在（内容・順序未 capture）。調味料の分量未 capture。'
      + '「呉の肉じゃが」は通常の肉じゃがと名前だけで同一 Identity にしない（Variant / separate identity review 対象）。',
  },
}

/** §31 D: けんちん汁。Source page 存在は確認済みだが Fact capture が最も不足 */
export const MAFF_CANDIDATE_KENCHINJIRU: RecipeEvidencePack = {
  identity: { id: 'evp-kenchinjiru' },
  source: {
    sourceId: 'jp-maff-kyodo-ryori',
    sourceOrganization: '農林水産省',
    sourceTitle: 'けんちん汁 — うちの郷土料理',
    sourceUrl: '', // §31: URL 未提供。推測補完しない
    accessedAt: '', // 本文は未確認（page 存在確認のみ）
  },
  rights: {
    sourceRightsStatus: 'unknown',
    recordRightsStatus: 'unknown',
    structuredFactStorageStatus: 'unknown',
    verbatimTextStatus: 'unknown',
    imageAssetStatus: 'unknown',
    thirdPartyIndication: true,
    thirdPartyRightsReview: 'not-reviewed',
    rightsNotes: 'Source page 存在のみ確認。rights は未確認。',
  },
  recipe: {
    sourceRecipeName: 'けんちん汁',
    sourceLanguage: 'ja',
    servings: notCaptured(),
    ingredientListStatus: 'NOT_CAPTURED',
    ingredients: [], // §31: Ingredient は未提供。AI 補完しない（§39）
    stepListStatus: 'NOT_CAPTURED',
    steps: [],
    preparation: notCaptured(),
    completionCues: notCaptured(),
    equipmentConditions: notCaptured(),
  },
  classification: {
    country: notCaptured(),
    cuisine: notCaptured(),
    mealOccasions: notCaptured(),
  },
  provenance: {
    providedBy: 'commander',
    evidenceMethod: 'not-yet-captured',
    capturedAt: MISSION_DATE,
    notes:
      '§31 — Official Source page の存在は確認済み。ただし Ingredient Amount / Primary Process Anchor に必要な Fact capture が不足。URL・本文未取得。推測補完しない。',
  },
}

/** §28〜§31 の 4 候補。すべて canEnterRecipeImport === false であること */
export const MAFF_CANDIDATE_EVIDENCE_PACKS: RecipeEvidencePack[] = [
  MAFF_CANDIDATE_NIKUJAGA,
  MAFF_CANDIDATE_IMONI_YAMAGATA,
  MAFF_CANDIDATE_KURE_NIKUJAGA,
  MAFF_CANDIDATE_KENCHINJIRU,
]

export const SYNTHETIC_EVIDENCE_PACK_FIXTURES: Record<string, RecipeEvidencePack> = {
  COMPLETE: SYNTHETIC_COMPLETE_PACK,
  RIGHTS_BLOCKED: SYNTHETIC_RIGHTS_BLOCKED_PACK,
  IDENTITY_REVIEW: SYNTHETIC_IDENTITY_REVIEW_PACK,
  PROCESS_REVIEW: SYNTHETIC_PROCESS_REVIEW_PACK,
  SOURCE_SILENCE: SYNTHETIC_SOURCE_SILENCE_PACK,
  INVALID_FACT_SHAPE: SYNTHETIC_INVALID_FACT_SHAPE_PACK,
  SUMMARY_ONLY: SYNTHETIC_SUMMARY_ONLY_PACK,
}

export const SYNTHETIC_EVIDENCE_PACK_NOTE = SYNTHETIC_NOTE
