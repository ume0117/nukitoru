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

// ============================================================
// 3. MISSION 2.41B — Batch #1 / EGG branch（親子丼・玉子焼き）
//
// External Research Layer が農林水産省「うちの郷土料理」の Source Body を
// 逐語確認した実 Recipe。書いてよいのは MISSION 2.41B §3〜§12 で明示された Fact だけ。
// Source Body を確認したが明示が無い Fact は SOURCE_NOT_STATED（NOT_CAPTURED ではない）。
//
// **両 Recipe とも第三者提供元（近藤 惠津子『食材選びからわかるおうちごはん』より）**があり、
// thirdPartyIndication = true / thirdPartyRightsReview = 'not-reviewed'。
// 今回の Evidence だけで cleared にしない（§7 / §12 / §19 — Rights 不明なら fail-closed）。
//
// SOURCE_RECIPE_KNOWLEDGE_FIXTURES / RECIPE_CATALOG / 既存 review oyako-don へは一切流さない。
// ============================================================

function culinaryTermQty(displayText: string, term: string): QuantityStatement {
  return { displayText, semantics: { kind: 'culinary-term', term } }
}

const KONDO_CREDIT = '近藤 惠津子（『食材選びからわかるおうちごはん』より）'
const MAFF_RIGHTS_EVIDENCE = 'https://www.maff.go.jp/j/use/link.html'

/**
 * §3〜§7 — 親子丼 / 東京都 / 農林水産省「うちの郷土料理」。
 * URL: 34_12_tokyo.html。2人分。第三者提供元あり。
 */
export const OYAKODON_EVIDENCE_PACK: RecipeEvidencePack = {
  identity: {
    id: 'evp-maff-oyakodon-tokyo',
    // §17 — 既存 WorldRecipeIdentity 'jp-oyakodon'（canonicalName「親子丼」）へ exact 一致。
    // 既存 review repo Recipe(oyako-don) とは別レイヤー・別 anchor（§18）。
    candidateCanonicalRecipeId: 'jp-oyakodon',
  },
  source: {
    sourceId: 'jp-maff-kyodo-ryori',
    sourceOrganization: '農林水産省',
    sourceTitle: '親子丼 東京都 — うちの郷土料理',
    sourceUrl:
      'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/menu/34_12_tokyo.html',
    accessedAt: '2026-09-03',
  },
  rights: {
    // MAFF「うちの郷土料理」source default（PDL1.0・MAFF-held facts は商用 USE 可）
    sourceRightsStatus: 'allowed',
    // MAFF hosting record の default。ただし第三者提供 Recipe のため review 必須（下記）
    recordRightsStatus: 'allowed',
    structuredFactStorageStatus: 'allowed',
    verbatimTextStatus: 'prohibited',
    imageAssetStatus: 'prohibited',
    thirdPartyIndication: true,
    thirdPartyRightsReview: 'not-reviewed',
    rightsEvidenceReference: MAFF_RIGHTS_EVIDENCE,
    rightsNotes:
      `レシピ提供元: ${KONDO_CREDIT}。MAFF 掲載 ≠ Record Rights 自動 allowed。`
      + '第三者提供 Recipe を NUKITORU 商用サービス内で Structured Facts として再利用可能かは未確定。'
      + 'thirdPartyRightsReview を勝手に cleared にしない（fail-closed）。',
  },
  recipe: {
    sourceRecipeName: '親子丼',
    sourceLanguage: 'ja',
    servings: present(exactQty('2人分', 2, '人分')),
    ingredientListStatus: 'PRESENT',
    ingredients: [
      {
        sourceIngredientName: '鶏もも肉',
        role: 'required',
        amount: present(exactQty('150g', 150, 'g')),
        preparationState: present('一口大のそぎ切り'),
      },
      {
        // §4 — 醤油は「鶏肉の下味」用途。合わせ調味料の醤油とは別エントリ（合算しない）
        sourceIngredientName: '醤油',
        role: 'seasoning',
        amount: {
          status: 'PRESENT',
          value: exactQty('小さじ1/2', 0.5, '小さじ'),
          notes: '用途: 鶏肉の下味（合わせ調味料の醤油とは別。合算しない）',
        },
      },
      {
        sourceIngredientName: '酒',
        role: 'seasoning',
        amount: {
          status: 'PRESENT',
          value: exactQty('小さじ1/2', 0.5, '小さじ'),
          notes: '用途: 鶏肉の下味',
        },
      },
      {
        sourceIngredientName: '玉ねぎ',
        role: 'required',
        amount: present(exactQty('1/2個（100g）', 0.5, '個')),
        preparationState: present('縦半分に切ってから薄切り'),
      },
      {
        sourceIngredientName: '卵',
        role: 'required',
        amount: present(exactQty('2個', 2, '個')),
        preparationState: present('軽くほぐすように溶く'),
      },
      {
        sourceIngredientName: '三つ葉',
        role: 'garnish',
        amount: present(rangeQty('4〜5本', 4, 5, '本')),
        preparationState: present('2cmに切る'),
      },
      {
        sourceIngredientName: 'だし',
        role: 'cooking-liquid',
        amount: present(exactQty('100ml', 100, 'ml')),
      },
      {
        sourceIngredientName: 'ご飯',
        role: 'required',
        amount: present(exactQty('2人分', 2, '人分')),
      },
      {
        // §4 — 合わせ調味料の醤油。下味の醤油とは別エントリ
        sourceIngredientName: '醤油',
        role: 'seasoning',
        amount: {
          status: 'PRESENT',
          value: exactQty('大さじ1', 1, '大さじ'),
          notes: '用途: 合わせ調味料（鶏肉の下味の醤油とは別。合算しない）',
        },
      },
      {
        sourceIngredientName: '砂糖',
        role: 'seasoning',
        amount: {
          status: 'PRESENT',
          value: exactQty('大さじ1/2', 0.5, '大さじ'),
          notes: '用途: 合わせ調味料',
        },
      },
      {
        sourceIngredientName: 'みりん',
        role: 'seasoning',
        amount: {
          status: 'PRESENT',
          value: exactQty('大さじ1/2', 0.5, '大さじ'),
          notes: '用途: 合わせ調味料',
        },
      },
    ],
    stepListStatus: 'PRESENT',
    steps: [
      {
        order: 1,
        factSummary: present('鶏肉に醤油（小さじ1/2）と酒（小さじ1/2）をまぶして下味をつける'),
        ingredientsUsed: ['鶏もも肉', '醤油', '酒'],
      },
      {
        order: 2,
        factSummary: present('鍋にだしと合わせ調味料を入れて中火にかける。煮立ってきたら玉ねぎと鶏肉を入れる'),
        ingredientsUsed: ['だし', '醤油', '砂糖', 'みりん', '玉ねぎ', '鶏もも肉'],
        heat: present('medium'),
        heatTransition: present('turn-on'),
      },
      {
        order: 3,
        factSummary: present(
          '蓋をして、鶏肉に火が通るまで2〜3分煮る。その後、卵を鍋の中心から外側へ円を描くように回し入れる',
        ),
        ingredientsUsed: ['卵'],
        duration: present({ kind: 'range', minMinutes: 2, maxMinutes: 3 }),
        completionCue: present('鶏肉に火が通るまで'),
      },
      {
        order: 4,
        factSummary: present(
          '卵の周囲が固まりかけたら火を止める。三つ葉を散らし、再び蓋をして30秒蒸らす',
        ),
        ingredientsUsed: ['三つ葉'],
        heatTransition: present('turn-off'),
        completionCue: present('卵の周囲が固まりかけたら'),
      },
      {
        order: 5,
        factSummary: present('丼にご飯をよそい、STEP 4 の具をのせる'),
        ingredientsUsed: ['ご飯'],
      },
    ],
    // §6 — Source に独立した下準備セクションは無い（下ごしらえは ingredient preparationState と STEP 1）
    preparation: sourceNotStated(),
    // レシピ全体の完成目安は各 STEP の completionCue が保持
    completionCues: sourceNotStated(),
    // Source が名指しした器具のみ。鍋サイズ・材質は推測しない（§6）
    equipmentConditions: present(['鍋', '蓋', '丼']),
  },
  classification: {
    // §17 / §39 — Source Body に国・cuisine・meal occasion の明示は無い。推測しない
    country: sourceNotStated(),
    cuisine: sourceNotStated(),
    mealOccasions: sourceNotStated(),
  },
  provenance: {
    providedBy: 'external-research-layer',
    evidenceMethod: 'official-source-body-review',
    capturedAt: '2026-09-03',
    notes:
      'MISSION 2.41B §3〜§7。農林水産省「うちの郷土料理」親子丼（東京都）Source Body 逐語確認。'
      + `第三者提供元: ${KONDO_CREDIT}。鍋のサイズ/材質・食材の中心温度・全体の所要時間・事前準備の所要時間は Source に記載が無く推測しない。`,
  },
}

/**
 * §8〜§12 — 玉子焼き / 東京都 / 農林水産省「うちの郷土料理」。
 * URL: 34_11_tokyo.html。1本分。第三者提供元あり。
 * 玉子焼きの WorldRecipeIdentity は未登録 → candidateCanonicalRecipeId 未設定（§17 — 卵料理だからで作らない）。
 */
export const TAMAGOYAKI_EVIDENCE_PACK: RecipeEvidencePack = {
  identity: {
    id: 'evp-maff-tamagoyaki-tokyo',
    // 玉子焼き / 卵焼き の WorldRecipeIdentity は存在しない。推論で作らない（§17）→ IDENTITY_REVIEW
  },
  source: {
    sourceId: 'jp-maff-kyodo-ryori',
    sourceOrganization: '農林水産省',
    sourceTitle: '玉子焼き 東京都 — うちの郷土料理',
    sourceUrl:
      'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/menu/34_11_tokyo.html',
    accessedAt: '2026-09-03',
  },
  rights: {
    sourceRightsStatus: 'allowed',
    recordRightsStatus: 'allowed',
    structuredFactStorageStatus: 'allowed',
    verbatimTextStatus: 'prohibited',
    imageAssetStatus: 'prohibited',
    thirdPartyIndication: true,
    thirdPartyRightsReview: 'not-reviewed',
    rightsEvidenceReference: MAFF_RIGHTS_EVIDENCE,
    rightsNotes:
      `レシピ提供元: ${KONDO_CREDIT}。親子丼と同様、今回の Evidence だけで thirdPartyRightsReview を cleared にしない。`,
  },
  recipe: {
    sourceRecipeName: '玉子焼き',
    sourceLanguage: 'ja',
    servings: present(exactQty('1本分', 1, '本')),
    ingredientListStatus: 'PRESENT',
    ingredients: [
      { sourceIngredientName: '卵', role: 'required', amount: present(exactQty('2個', 2, '個')) },
      { sourceIngredientName: 'だし', role: 'cooking-liquid', amount: present(exactQty('大さじ1', 1, '大さじ')) },
      { sourceIngredientName: '砂糖', role: 'seasoning', amount: present(exactQty('大さじ1/2', 0.5, '大さじ')) },
      {
        // §9 — 「少々」を数値へ変換しない
        sourceIngredientName: '塩',
        role: 'seasoning',
        amount: present(culinaryTermQty('少々', '少々')),
      },
      {
        sourceIngredientName: '醤油',
        role: 'seasoning',
        amount: present(culinaryTermQty('少々', '少々')),
      },
      {
        // §9 — 「適宜」を数値へ変換しない
        sourceIngredientName: '油',
        role: 'seasoning',
        amount: present(culinaryTermQty('適宜', '適宜')),
      },
    ],
    stepListStatus: 'PRESENT',
    steps: [
      {
        order: 1,
        factSummary: present('卵を割りほぐし、だしと調味料をすべて混ぜる'),
        ingredientsUsed: ['卵', 'だし', '砂糖', '塩', '醤油'],
      },
      {
        order: 2,
        factSummary: present(
          '卵焼き器に油を入れて熱し、余分な油をふき取る。卵液の1/4を流して均等に広げ、'
          + '周囲がかわいて半熟状になったら菜箸で巻く。再び油をなじませ、同様の操作を繰り返す',
        ),
        ingredientsUsed: ['油', '卵'],
        // §11 — Source は具体的火力レベルを述べていない
        heat: sourceNotStated(),
        // §11 — Source は加熱分数を述べていない
        duration: sourceNotStated(),
        completionCue: present('周囲がかわいて半熟状になったら'),
      },
      {
        order: 3,
        factSummary: present('焼きあがったら巻きすで巻き、粗熱が取れるまで置いてから切り分ける'),
        // §11 — Source は休ませ時間を述べていない
        duration: sourceNotStated(),
        completionCue: present('粗熱が取れるまで'),
      },
    ],
    preparation: sourceNotStated(),
    completionCues: sourceNotStated(),
    // Source が名指しした器具のみ。卵焼き器サイズ・油の ml 量は推測しない（§11）
    equipmentConditions: present(['卵焼き器', '巻きす']),
  },
  classification: {
    country: sourceNotStated(),
    cuisine: sourceNotStated(),
    mealOccasions: sourceNotStated(),
  },
  provenance: {
    providedBy: 'external-research-layer',
    evidenceMethod: 'official-source-body-review',
    capturedAt: '2026-09-03',
    notes:
      'MISSION 2.41B §8〜§12。農林水産省「うちの郷土料理」玉子焼き（東京都）Source Body 逐語確認。'
      + `第三者提供元: ${KONDO_CREDIT}。具体的火力・加熱分数・休ませ時間・卵焼き器サイズ・油の ml 量・完成中心温度は Source に無く SOURCE_NOT_STATED。`,
  },
}

/** MISSION 2.41B Batch #1 — EGG branch。両方とも import-eligible ではない（Rights REVIEW_REQUIRED） */
export const EGG_BRANCH_BATCH1_EVIDENCE_PACKS: RecipeEvidencePack[] = [
  OYAKODON_EVIDENCE_PACK,
  TAMAGOYAKI_EVIDENCE_PACK,
]

// ============================================================
// 4. MISSION 2.41D — Batch #2 / 山形県 public-sector Record（芋煮・納豆汁・玉こんにゃく）
//
// External Research Layer が農林水産省「うちの郷土料理」の Source Body を逐語確認。
// **レシピ提供元名 = 「山形県」= public-sector provider**（近藤 惠津子・書籍 = private とは別分類）。
// ただし「都道府県提供 Record が MAFF の PDL1.0 grant に含まれる」ことを追加 Evidence が明示しないため、
// record-level PDL applicability を推測せずに Rights PASS にはしない → 3 件とも Rights REVIEW_REQUIRED（§22）。
// staging Candidate fixture として保持（§11 / §23 — 削除しない・将来 Rights Evidence 追加で再評価可能）。
// SOURCE_RECIPE_KNOWLEDGE_FIXTURES / RECIPE_CATALOG へは流さない。画像は一切利用しない（§15）。
// ============================================================

const YAMAGATA_CREDIT = '山形県'

/** 山形県 public-sector Record 共通の rights（§21 — private HOLD と機械的に同一視しない） */
function yamagataPublicSectorRights(imageProviderNote?: string): RecipeEvidencePack['rights'] {
  return {
    sourceRightsStatus: 'allowed', // MAFF General Rule = PDL1.0（§2 / §5）
    recordRightsStatus: 'allowed', // MAFF hosting record default。ただし下記 review が gate する
    structuredFactStorageStatus: 'allowed',
    verbatimTextStatus: 'prohibited',
    imageAssetStatus: 'prohibited',
    thirdPartyIndication: true, // 非 MAFF の提供元クレジット（「山形県」）が存在する
    thirdPartyRightsReview: 'not-reviewed',
    rightsEvidenceReference: MAFF_RIGHTS_EVIDENCE,
    rightsNotes:
      `レシピ提供元 = ${YAMAGATA_CREDIT}（public-sector provider。classifyRecipeProvider → 'public-sector'）。`
      + 'MAFF General Rule は PDL1.0（商用可・出典 + 加工表示条件）だが、都道府県提供 Record への PDL1.0 適用を'
      + '追加 Evidence が明示していない。private third-party（書籍・個人）の HOLD とは別分類だが、record-level '
      + 'PDL applicability の確認が済むまで REVIEW_REQUIRED（§21 / §22 / §40）。'
      + (imageProviderNote ? ` ${imageProviderNote}` : ''),
  }
}

const YAMAGATA_CLASSIFICATION: RecipeEvidencePack['classification'] = {
  country: sourceNotStated(),
  cuisine: sourceNotStated(),
  mealOccasions: sourceNotStated(),
}

/**
 * §9〜§14 — 芋煮 / 山形県。Primary Candidate。
 * 醤油は Source total 大さじ4（工程で STEP4 大さじ1 + STEP5 大さじ3 に分割使用）。二重計上しない（§13）。
 */
export const IMONI_YAMAGATA_EVIDENCE_PACK: RecipeEvidencePack = {
  identity: {
    id: 'evp-maff-imoni-yamagata-v2',
    // 芋煮 の WorldRecipeIdentity は未登録。Rights が REVIEW_REQUIRED なので Identity 追加を提案しない（§24 / §16）
  },
  source: {
    sourceId: 'jp-maff-kyodo-ryori',
    sourceOrganization: '農林水産省',
    sourceTitle: '芋煮 山形県 — うちの郷土料理',
    sourceUrl:
      'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/menu/imoni_yamagata.html',
    accessedAt: '2026-09-04',
  },
  rights: yamagataPublicSectorRights(),
  recipe: {
    sourceRecipeName: '芋煮',
    sourceLanguage: 'ja',
    servings: present(rangeQty('丼または大きな椀で4〜5人分', 4, 5, '人分')),
    ingredientListStatus: 'PRESENT',
    ingredients: [
      { sourceIngredientName: '里芋（皮つき）', role: 'required', amount: present(exactQty('500g', 500, 'g')) },
      { sourceIngredientName: '板こんにゃく', role: 'required', amount: present(exactQty('1/2枚', 0.5, '枚')) },
      {
        sourceIngredientName: '牛肉',
        role: 'required',
        amount: present(exactQty('150g', 150, 'g')),
        preparationState: present('バラ肉・切り落とし肉など脂身の多い部位が好ましい（Source note）'),
      },
      { sourceIngredientName: '長ねぎ', role: 'required', amount: present(exactQty('1本', 1, '本')) },
      {
        sourceIngredientName: '醤油',
        role: 'seasoning',
        amount: {
          status: 'PRESENT',
          value: exactQty('大さじ4', 4, '大さじ'),
          notes: 'Source total。工程では STEP4 で大さじ1、STEP5 で残り大さじ3 に分けて使用（二重計上しない — §13）',
        },
      },
      { sourceIngredientName: '砂糖', role: 'seasoning', amount: present(exactQty('大さじ1・1/2', 1.5, '大さじ')) },
      {
        sourceIngredientName: '清酒（日本酒）',
        role: 'seasoning',
        amount: present(exactQty('大さじ3', 3, '大さじ')),
      },
      { sourceIngredientName: '水', role: 'cooking-liquid', amount: present(exactQty('800cc', 800, 'cc')) },
    ],
    stepListStatus: 'PRESENT',
    steps: [
      {
        order: 1,
        factSummary: present('里芋の皮を剥き、大きめの一口大に切る'),
        ingredientsUsed: ['里芋（皮つき）'],
      },
      {
        order: 2,
        factSummary: present('牛肉を約4cmに切る。ねぎを大きめの斜め切りにする'),
        ingredientsUsed: ['牛肉', '長ねぎ'],
      },
      {
        order: 3,
        factSummary: present(
          '板こんにゃくを手で一口大にちぎる（精粉こんにゃくの場合はゆでこぼし不要でもよい／生芋こんにゃくの場合はゆでこぼしが必要という条件付き）',
        ),
        ingredientsUsed: ['板こんにゃく'],
      },
      {
        order: 4,
        factSummary: present(
          '鍋に水・里芋・こんにゃくを入れて火にかける。軽く沸騰してきたら醤油大さじ1を加えて煮る',
        ),
        ingredientsUsed: ['水', '里芋（皮つき）', '板こんにゃく', '醤油'],
        heat: sourceNotStated(), // Source は「火にかける」のみで火力レベルを述べていない
        heatTransition: present('turn-on'),
      },
      {
        order: 5,
        factSummary: present(
          '里芋が柔らかくなったら、牛肉と残りの調味料（醤油大さじ3・砂糖・日本酒）を入れる。アクをすくいながら煮る',
        ),
        ingredientsUsed: ['牛肉', '醤油', '砂糖', '清酒（日本酒）'],
        completionCue: present('里芋が柔らかくなったら'),
      },
      {
        order: 6,
        factSummary: present('ねぎを加える。くたくたになるまで煮込み、味を染み込ませる'),
        ingredientsUsed: ['長ねぎ'],
        completionCue: present('くたくたになるまで'),
      },
    ],
    preparation: sourceNotStated(),
    completionCues: sourceNotStated(),
    equipmentConditions: present(['鍋']),
  },
  classification: YAMAGATA_CLASSIFICATION,
  provenance: {
    providedBy: 'external-research-layer',
    evidenceMethod: 'official-source-body-review',
    capturedAt: '2026-09-04',
    notes:
      'MISSION 2.41D §9〜§14。農林水産省「うちの郷土料理」芋煮（山形県）Source Body 逐語確認。'
      + 'Source Arrangement:「洗い里芋を使えば皮むきの手間を省ける」「七味唐辛子をかけても美味しい」→ Primary Recipe Fact へ混ぜない。'
      + '七味唐辛子は将来 CHOI-TASHI Evidence Candidate、洗い里芋は future preparation-shortcut / product-state candidate。'
      + '鍋のサイズ/材質・火力レベル・各工程の所要時間・食材の中心温度は Source に記載なく推測しない。',
  },
}

/**
 * §15〜§17 — 納豆汁 / 山形県。Secondary Candidate。
 * 画像提供元「やまがたの広報写真ライブラリー」は Recipe Record provider（山形県）とは別（§15）。画像は利用しない。
 * ゴボウ・人参・里芋は Source 上「好みで」→ role 'optional'（required へ昇格しない — §26）。
 */
export const NATTOJIRU_YAMAGATA_EVIDENCE_PACK: RecipeEvidencePack = {
  identity: { id: 'evp-maff-nattojiru-yamagata' },
  source: {
    sourceId: 'jp-maff-kyodo-ryori',
    sourceOrganization: '農林水産省',
    sourceTitle: '納豆汁 山形県 — うちの郷土料理',
    sourceUrl:
      'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/menu/nattojiru_yamagata.html',
    accessedAt: '2026-09-04',
  },
  rights: yamagataPublicSectorRights(
    'Recipe image provider =「やまがたの広報写真ライブラリー」（Recipe Record provider の山形県とは別・§15）。画像は利用しない。',
  ),
  recipe: {
    sourceRecipeName: '納豆汁',
    sourceLanguage: 'ja',
    servings: present(exactQty('5人分', 5, '人分')),
    ingredientListStatus: 'PRESENT',
    ingredients: [
      { sourceIngredientName: '納豆', role: 'required', amount: present(exactQty('200g', 200, 'g')) },
      { sourceIngredientName: '豆腐', role: 'required', amount: present(exactQty('1/5丁（80g）', 0.2, '丁')) },
      { sourceIngredientName: 'いもがら', role: 'required', amount: present(exactQty('8g', 8, 'g')) },
      { sourceIngredientName: '油揚げ', role: 'required', amount: present(exactQty('2枚', 2, '枚')) },
      { sourceIngredientName: 'こんにゃく', role: 'required', amount: present(exactQty('1/5枚（50g）', 0.2, '枚')) },
      { sourceIngredientName: 'きのこ', role: 'required', amount: present(culinaryTermQty('適宜', '適宜')) },
      { sourceIngredientName: '山菜', role: 'required', amount: present(culinaryTermQty('適宜', '適宜')) },
      { sourceIngredientName: 'だし汁', role: 'cooking-liquid', amount: present(exactQty('5カップ', 5, 'カップ')) },
      { sourceIngredientName: '味噌', role: 'seasoning', amount: present(exactQty('大さじ5', 5, '大さじ')) },
      { sourceIngredientName: 'ねぎ', role: 'garnish', amount: present(exactQty('10cm', 10, 'cm')) },
      { sourceIngredientName: 'せり', role: 'garnish', amount: present(culinaryTermQty('少々', '少々')) },
      // §26 — Source 上「好みで」。required へ昇格しない
      { sourceIngredientName: 'ゴボウ', role: 'optional', amount: sourceNotStated() },
      { sourceIngredientName: '人参', role: 'optional', amount: sourceNotStated() },
      { sourceIngredientName: '里芋', role: 'optional', amount: sourceNotStated() },
    ],
    stepListStatus: 'PRESENT',
    steps: [
      { order: 1, factSummary: present('納豆をすり鉢でよくすりつぶす'), ingredientsUsed: ['納豆'] },
      {
        order: 2,
        factSummary: present(
          'いもがらをぬるま湯で戻し、水気を絞り1cm角に切る。油揚げは熱湯をかけ油抜き。こんにゃくはさっとゆでる。豆腐・油揚げ・こんにゃくを1cmのさいの目切り',
        ),
        ingredientsUsed: ['いもがら', '油揚げ', 'こんにゃく', '豆腐'],
      },
      {
        order: 3,
        factSummary: present('きのこが塩蔵品なら塩出し。山菜も同様。食べやすい大きさにする'),
        ingredientsUsed: ['きのこ', '山菜'],
      },
      {
        order: 4,
        factSummary: present('だし汁でいもがらを煮る。柔らかくなったら、こんにゃく・油揚げ・山菜などを加える'),
        ingredientsUsed: ['だし汁', 'いもがら', 'こんにゃく', '油揚げ', '山菜'],
        heatTransition: present('turn-on'),
        completionCue: present('いもがらが柔らかくなったら'),
      },
      {
        order: 5,
        factSummary: present('最後に豆腐を加える。味噌で味付けする'),
        ingredientsUsed: ['豆腐', '味噌'],
      },
      {
        order: 6,
        factSummary: present('火を止め、すりつぶした納豆を溶かし入れる'),
        ingredientsUsed: ['納豆'],
        heatTransition: present('turn-off'),
      },
      {
        order: 7,
        factSummary: present('煮立てないよう再び火にかけ、沸騰直前に火を止める'),
        heatTransition: present('turn-off'),
        completionCue: present('沸騰直前'),
      },
      {
        order: 8,
        factSummary: present('刻みねぎ・せりを添える'),
        ingredientsUsed: ['ねぎ', 'せり'],
      },
    ],
    preparation: sourceNotStated(),
    completionCues: sourceNotStated(),
    equipmentConditions: present(['すり鉢']),
  },
  classification: YAMAGATA_CLASSIFICATION,
  provenance: {
    providedBy: 'external-research-layer',
    evidenceMethod: 'official-source-body-review',
    capturedAt: '2026-09-04',
    notes:
      'MISSION 2.41D §15〜§17。農林水産省「うちの郷土料理」納豆汁（山形県）Source Body 逐語確認。'
      + 'ゴボウ・人参・里芋は Source 上「好みで」= role optional（required へ昇格しない）。「適宜」「少々」は数値化しない。'
      + 'Source の「味噌味はほんの少し濃いめ」「熱々を食べる」は taste / serving expression であり、客観的 Safety Fact へ変換しない。'
      + '火力レベル・加熱分数・完成中心温度は Source に記載なく推測しない。',
  },
}

/**
 * §18〜§19 — 玉こんにゃく / 山形県。Tertiary Candidate。
 * 串は equipment（Ingredient ではない — §27）。火力・時間は Source 未記載 → SOURCE_NOT_STATED（§19）。
 */
export const TAMAKONNYAKU_YAMAGATA_EVIDENCE_PACK: RecipeEvidencePack = {
  identity: { id: 'evp-maff-tamakonnyaku-yamagata' },
  source: {
    sourceId: 'jp-maff-kyodo-ryori',
    sourceOrganization: '農林水産省',
    sourceTitle: '玉こんにゃく 山形県 — うちの郷土料理',
    sourceUrl:
      'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/menu/tamakonnyaku_yamagata.html',
    accessedAt: '2026-09-04',
  },
  rights: yamagataPublicSectorRights(),
  recipe: {
    sourceRecipeName: '玉こんにゃく',
    sourceLanguage: 'ja',
    servings: present(exactQty('4本分', 4, '本')),
    ingredientListStatus: 'PRESENT',
    ingredients: [
      { sourceIngredientName: '玉こんにゃく', role: 'required', amount: present(exactQty('20個', 20, '個')) },
      { sourceIngredientName: '醤油', role: 'seasoning', amount: present(exactQty('大さじ3', 3, '大さじ')) },
      // §18 — スルメイカ・練り辛子は「適量」= culinary-term、optional 扱い
      { sourceIngredientName: 'スルメイカ', role: 'optional', amount: present(culinaryTermQty('適量', '適量')) },
      { sourceIngredientName: '練り辛子', role: 'optional', amount: present(culinaryTermQty('適量', '適量')) },
    ],
    stepListStatus: 'PRESENT',
    steps: [
      {
        order: 1,
        factSummary: present('鍋で玉こんにゃくを軽くから炒りする'),
        ingredientsUsed: ['玉こんにゃく'],
        heat: sourceNotStated(), // §19 — 具体的火力は Source に無い
        duration: sourceNotStated(), // §19 — 時間も無い
      },
      {
        order: 2,
        factSummary: present('醤油と裂いたスルメイカを入れ、炒りつける'),
        ingredientsUsed: ['醤油', 'スルメイカ'],
        heat: sourceNotStated(),
        duration: sourceNotStated(),
      },
      {
        order: 3,
        factSummary: present('串に刺す。好みで辛子を付けて食べる'),
        ingredientsUsed: ['練り辛子'],
      },
    ],
    preparation: sourceNotStated(),
    completionCues: sourceNotStated(),
    // §27 — 串は Food ではなく equipment / serving tool
    equipmentConditions: present(['鍋', '串']),
  },
  classification: YAMAGATA_CLASSIFICATION,
  provenance: {
    providedBy: 'external-research-layer',
    evidenceMethod: 'official-source-body-review',
    capturedAt: '2026-09-04',
    notes:
      'MISSION 2.41D §18〜§19。農林水産省「うちの郷土料理」玉こんにゃく（山形県）Source Body 逐語確認。'
      + '串は Ingredient ではなく equipment / serving tool。具体的火力・時間は Source に明示なく SOURCE_NOT_STATED（推測禁止）。',
  },
}

/** MISSION 2.41D Batch #2 — 山形県 public-sector Record。3 件とも import-eligible ではない（Rights REVIEW_REQUIRED） */
export const YAMAGATA_BATCH2_EVIDENCE_PACKS: RecipeEvidencePack[] = [
  IMONI_YAMAGATA_EVIDENCE_PACK,
  NATTOJIRU_YAMAGATA_EVIDENCE_PACK,
  TAMAKONNYAKU_YAMAGATA_EVIDENCE_PACK,
]
