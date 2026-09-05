// ============================================================
// recipe-source-candidates.ts
//
// MISSION 2.41F — 実 Recipe Source Candidate 3 件 + Rights Gate 経路検証用 SYNTHETIC fixture。
//
// 重要:
// - ここに列挙する 3 件は実在の Source について External Research（本日実施した一次資料の
//   確認・WebFetch）に基づく評価であり、Recipe Import は一切していない（§8）。
// - 「0 RIGHTS_CLEAR_CANDIDATE も正しい結果」（§14）。無理に A 判定を作らない。
//   実際、本 MISSION の 3 実候補はいずれも RIGHTS_CLEAR_CANDIDATE ではない
//   （Wikibooks Cookbook = REVIEW_REQUIRED / TheMealDB = REJECTED / USDA MyPlate = RESEARCH_ONLY）。
// - Rights Gate の PASS 経路自体は SYNTHETIC fixture で検証する（既存 MISSION 2.37 / 2.41A と同じ方針）。
// ============================================================

import type { RecipeSourceCandidateInput } from '@/features/food/types'
import { buildRecipeSourceCandidate } from './recipe-source-discovery'

const RETRIEVED_AT = '2026-09-05'

// ------------------------------------------------------------
// 1. Wikibooks Cookbook — CC BY-SA 4.0（share-alike のため条件レビュー・§4 policy）
// ------------------------------------------------------------

const WIKIBOOKS_COOKBOOK_INPUT: RecipeSourceCandidateInput = {
  id: 'wikibooks-cookbook',
  name: 'Wikibooks Cookbook',
  organization: 'Wikimedia Foundation',
  country: 'INTL',
  sourceType: 'encyclopedia',
  homepageUrl: 'https://en.wikibooks.org/wiki/Cookbook',
  recipeIndexUrl: 'https://en.wikibooks.org/wiki/Cookbook:Recipes',
  termsUrl: 'https://en.wikibooks.org/wiki/Wikibooks:Copyrights',
  licenseUrl: 'https://en.wikibooks.org/wiki/Wikibooks:Creative_Commons_Attribution-ShareAlike_4.0_International_License',
  licenseType: 'CC-BY-SA-4.0',
  commercialUse: 'allowed',
  // share-alike: 改変・追加した内容は同ライセンスで公開する義務がある → 無条件 allowed ではない
  modification: 'conditional',
  attribution: 'required',
  // text 本体は wiki 執筆者全員が CC BY-SA 4.0 に同意して投稿する枠組み内 → 未解決の第三者権利はない
  thirdPartyRights: 'none',
  // Cookbook は多数の執筆者による wiki。個別レシピページの完成度（分量・工程の充足）は一様に
  // 確認できていない（ライセンス自体は全ページに及ぶが、Recipe Fact としての充足度は page ごと）
  recipeApplicability: 'partial',
  // 画像は「メディア説明ページ」ごとに別ライセンス（text ライセンスを自動継承しない）
  photoApplicability: 'separate',
  // 個別レシピページが外部サイトへリンクする場合、その外部 Content は Wikibooks ライセンスを継承しない
  externalContentApplicability: 'unknown',
  evidence: [
    {
      sourceUrl: 'https://en.wikibooks.org/wiki/Wikibooks:Copyrights',
      documentTitle: 'Wikibooks:Copyrights',
      publisher: 'Wikimedia Foundation',
      retrievedAt: RETRIEVED_AT,
      ruleSummary:
        'Wikibooks のテキストは CC BY-SA 4.0（+ GFDL）のデュアルライセンス。商用利用・改変・再配布は許可されるが、'
        + '改変・追加した内容は同ライセンス（またはそれ以上に copyleft な互換ライセンス）で公開する義務がある。'
        + '出典（ページへのハイパーリンク等）の記載が必須。非テキストメディア（画像等）は各メディア説明ページで'
        + '別途ライセンスが定められ、テキストのライセンスを自動継承しない。',
      evidenceType: 'terms-of-use',
      licenseIdentifier: 'CC BY-SA 4.0 / GFDL',
      applicabilityNote:
        'サイト全体の text ページに対するライセンス表明。個別 Cookbook レシピページの分量・工程の'
        + '記載充足度（Recipe Fact としての完全性）は本ページからは確認できず、page 単位で別途確認が必要。',
    },
  ],
  reviewNotes: [
    'MISSION 2.41F: share-alike 条件（改変内容の同ライセンス公開義務）は NUKITORU の Structured Facts 抽出・'
      + '独自 UI 表示モデルとどう両立させるか Product Decision が必要（Fact 自体は著作物性が低いが、'
      + '抽出・構造化の粒度次第では派生物として扱われ得る）。今回は判断せず REVIEW_REQUIRED のまま保持する。',
    'Cookbook は数千ページ規模の wiki で、レシピごとの品質・完成度（分量欠落・工程不足等）にばらつきがある。'
      + '個別レシピを Evidence Pack へ入れる場合は Source Body の逐語確認が改めて必要。',
  ],
  reviewedAt: RETRIEVED_AT,
}
export const WIKIBOOKS_COOKBOOK_CANDIDATE = buildRecipeSourceCandidate(WIKIBOOKS_COOKBOOK_INPUT)

// ------------------------------------------------------------
// 2. TheMealDB — 無料枠は商用/公開アプリでの利用を禁止（有料 Tier 必須）→ REJECTED
// ------------------------------------------------------------

const THEMEALDB_INPUT: RecipeSourceCandidateInput = {
  id: 'themealdb',
  name: 'TheMealDB',
  organization: 'TheMealDB（独立運営プロジェクト）',
  country: 'INTL',
  sourceType: 'commercial-api',
  homepageUrl: 'https://www.themealdb.com/',
  recipeIndexUrl: 'https://www.themealdb.com/api.php',
  termsUrl: 'https://www.themealdb.com/terms_of_use.php',
  licenseUrl: 'https://www.themealdb.com/terms_of_use.php',
  licenseType: 'all-rights-reserved',
  // 無料利用では「App Store 等への公開（＝一般公開する商用/公開サービス）」自体が禁止されており、
  // 公開するには Patreon/PayPal の有料 Supporter 登録が必須。NUKITORU は有料 API 契約を前提にしない方針。
  commercialUse: 'prohibited',
  // API から返る内容の複製・改変は許可されるが、著作権/商標表示の改変は禁止（条件付き）
  modification: 'conditional',
  attribution: 'required',
  // アートワークの大半はユーザー投稿・カスタム作成で、権利者が一様に確認できない
  thirdPartyRights: 'unresolved',
  recipeApplicability: 'partial',
  // 画像は大半がカスタム/ユーザー作成（"must not claim ownership"）。一部のみ Creative Commons タグ付き
  photoApplicability: 'unknown',
  externalContentApplicability: 'unknown',
  evidence: [
    {
      sourceUrl: 'https://www.themealdb.com/terms_of_use.php',
      documentTitle: 'TheMealDB.com - Terms Of Use',
      publisher: 'TheMealDB',
      retrievedAt: RETRIEVED_AT,
      ruleSummary:
        'API を使ったアプリ・サービス開発はレート制限内で許可されるが、無料利用者は App Store 等へ'
        + '公開すること自体ができない。一般公開（商用・公開サービス化）するには Patreon または PayPal の'
        + '有料 Supporter 登録が必須。API から返るコンテンツの scrape・複製・改変は公式エンドポイント経由なら'
        + '許可されるが、著作権/商標表示は改変不可。アートワークの大半はユーザー投稿のカスタム作成物で、'
        + '自分の作品として主張してはならず、サイトへリンクバックする必要がある（商用利用者はデータ出典を'
        + 'クレジットする必要あり）。サイト自体のスクレイピングは明示的に禁止。',
      evidenceType: 'terms-of-use',
      licenseIdentifier: 'Custom Terms of Use（有料 Supporter Tier 前提の商用条件）',
      applicabilityNote:
        '「NUKITORU が商用 Web Service として公開する」ケースには、この Terms の商用/公開条件が'
        + '直接適用される（API 経由データそのものに関する条件のため recipeApplicability は confirmed 寄りだが、'
        + '根拠となる recipe 自体の著作者性が crowd-sourced で不明瞭なため partial とする）。',
    },
  ],
  reviewNotes: [
    'MISSION 2.41F: 無料利用では商用/公開サービスとしての利用が明示的に禁止されており、可能にするには'
      + '有料 Supporter 登録が必要。NUKITORU は有料 API 契約を前提にしない方針のため、Primary Recipe Import '
      + 'Source としては REJECTED（§4 の CC BY-NC 系と同様の「商用利用不可」に相当する扱い）。',
    'この判定はライセンス名ではなく Terms 本文の商用条件に基づく（ライセンス名だけで PASS/REJECT させない）。',
  ],
  reviewedAt: RETRIEVED_AT,
}
export const THEMEALDB_CANDIDATE = buildRecipeSourceCandidate(THEMEALDB_INPUT)

// ------------------------------------------------------------
// 3. USDA MyPlate Kitchen — 一次資料を本日確認できず。既存 MISSION 2.37 registry の
//    'unknown' 判断を Source Discovery 層でも維持（RESEARCH_ONLY）
// ------------------------------------------------------------

const USDA_MYPLATE_INPUT: RecipeSourceCandidateInput = {
  id: 'us-usda-myplate',
  name: 'USDA MyPlate Kitchen',
  organization: 'U.S. Department of Agriculture (Food and Nutrition Service)',
  country: 'US',
  sourceType: 'government',
  homepageUrl: 'https://www.myplate.gov/myplate-kitchen',
  termsUrl: 'https://ask.usda.gov/s/article/Am-I-permitted-to-use-content-or-materials-from-ChooseMyPlate-gov',
  licenseType: 'unknown',
  commercialUse: 'unknown',
  modification: 'unknown',
  attribution: 'unknown',
  // MISSION 2.36A で記録済み: ONIE Project 等 grantee（州立大学 SNAP-Ed）由来の record が確認されている
  thirdPartyRights: 'unresolved',
  recipeApplicability: 'unclear',
  photoApplicability: 'unknown',
  externalContentApplicability: 'unknown',
  evidence: [
    {
      sourceUrl: 'https://ask.usda.gov/s/article/Am-I-permitted-to-use-content-or-materials-from-ChooseMyPlate-gov',
      documentTitle: 'Am I permitted to use content or materials from ChooseMyPlate.gov?',
      publisher: 'USDA (ask.usda.gov)',
      retrievedAt: RETRIEVED_AT,
      ruleSummary:
        '本日 WebFetch を試行したが TLS 証明書検証エラーで本文を取得できず（一次資料未確認）。'
        + 'usda.gov/about-usda/policies-and-links も HTTP 403 で取得不可（MAFF と同様の取得阻害パターン）。'
        + '検索結果の要約では「元の USDA レシピは 17 USC §105 により連邦職務著作物として public domain」'
        + 'とする言及があるが、これは二次情報（検索エンジンの要約）でありそのまま Evidence として採用しない'
        + '（§1「検索結果 snippet だけで Rights 判定しない」）。',
      evidenceType: 'other',
      applicabilityNote:
        'MISSION 2.36A で既に記録済み: MyPlate の recipe には grantee（州立大学 SNAP-Ed 等）が提供した'
        + 'record（例: ONIE Project "2-Step Chicken"）が存在し、17 USC §105 の連邦職務著作物 PD が'
        + '自動適用されない record が混在する。record 単位の確認が必要という結論を維持する。',
    },
  ],
  reviewNotes: [
    'MISSION 2.41F: 検索結果には「myplate.gov の MyPlate Kitchen は 2026年1月に RealFood.gov へ移行し、'
      + 'myplate.food という別ドメイン（非 .gov）がレシピを引き継いでいる」との言及があったが、いずれも'
      + '一次資料で確認できていない。myplate.food は公式 USDA ドメインではない可能性があり、その'
      + 'ライセイン主張を Evidence として採用しない。',
    '既存 world-food-sources.ts の us-usda-myplate（MISSION 2.37）と同一の実世界 Source を指す。'
      + 'この Candidate は Source Discovery 層の再評価であり、既存 WorldFoodSource 登録簿の内容は変更していない。',
  ],
  reviewedAt: RETRIEVED_AT,
}
export const USDA_MYPLATE_CANDIDATE = buildRecipeSourceCandidate(USDA_MYPLATE_INPUT)

// ------------------------------------------------------------
// 実候補 3 件
// ------------------------------------------------------------

export const REAL_RECIPE_SOURCE_CANDIDATES = [
  WIKIBOOKS_COOKBOOK_CANDIDATE,
  THEMEALDB_CANDIDATE,
  USDA_MYPLATE_CANDIDATE,
]

// ------------------------------------------------------------
// SYNTHETIC — Rights Gate 経路（PASS 側）検証専用。実在の情報源に基づかない。
// ------------------------------------------------------------

const SYNTHETIC_NOTE = 'SYNTHETIC — MISSION 2.41F Rights Gate 経路検証専用。実在の Source ではない。'

function syntheticInput(overrides: Partial<RecipeSourceCandidateInput> = {}): RecipeSourceCandidateInput {
  return {
    id: 'synthetic-source',
    name: 'SYNTHETIC test source',
    organization: 'SYNTHETIC / NUKITORU internal test',
    country: 'INTL',
    sourceType: 'open-dataset',
    homepageUrl: 'https://example.invalid/synthetic-source',
    termsUrl: 'https://example.invalid/synthetic-source/terms',
    licenseUrl: 'https://example.invalid/synthetic-source/license',
    licenseType: 'CC-BY-4.0',
    commercialUse: 'allowed',
    modification: 'allowed',
    attribution: 'required',
    thirdPartyRights: 'none',
    recipeApplicability: 'confirmed',
    photoApplicability: 'unknown', // §11 test: photo unknown は recipe facts の classification を道連れにしない
    externalContentApplicability: 'unknown',
    evidence: [
      {
        sourceUrl: 'https://example.invalid/synthetic-source/terms',
        documentTitle: 'SYNTHETIC terms',
        publisher: 'SYNTHETIC',
        retrievedAt: '2026-09-05',
        ruleSummary: SYNTHETIC_NOTE,
        evidenceType: 'terms-of-use',
      },
    ],
    reviewNotes: [SYNTHETIC_NOTE],
    reviewedAt: '2026-09-05',
    ...overrides,
  }
}

/** A. すべて gate 条件を満たす → RIGHTS_CLEAR_CANDIDATE */
export const SYNTHETIC_RIGHTS_CLEAR_CANDIDATE = buildRecipeSourceCandidate(
  syntheticInput({ id: 'synthetic-a-clear' }),
)

/** B. PDL1.0 + third-party 未解決 → REVIEW_REQUIRED */
export const SYNTHETIC_PDL_THIRD_PARTY_UNRESOLVED = buildRecipeSourceCandidate(
  syntheticInput({
    id: 'synthetic-b-pdl-thirdparty',
    licenseType: 'PDL1.0',
    modification: 'allowed',
    thirdPartyRights: 'unresolved',
  }),
)

/** C. CC BY 4.0 + attribution 情報欠落（unknown） → REVIEW_REQUIRED */
export const SYNTHETIC_MISSING_ATTRIBUTION = buildRecipeSourceCandidate(
  syntheticInput({ id: 'synthetic-c-no-attribution', attribution: 'unknown' }),
)

/** D. CC BY-NC 4.0 → REJECTED */
export const SYNTHETIC_NONCOMMERCIAL = buildRecipeSourceCandidate(
  syntheticInput({ id: 'synthetic-d-nc', licenseType: 'CC-BY-NC-4.0', commercialUse: 'prohibited' }),
)

/** E. ライセンス自体不明 → RESEARCH_ONLY（blocked。RIGHTS_CLEAR ではない） */
export const SYNTHETIC_UNKNOWN_LICENSE = buildRecipeSourceCandidate(
  syntheticInput({
    id: 'synthetic-e-unknown-license',
    licenseType: 'unknown',
    commercialUse: 'unknown',
    modification: 'unknown',
    attribution: 'unknown',
    thirdPartyRights: 'unknown',
    recipeApplicability: 'unclear',
  }),
)

/** F. license URL はあるが recipe applicability が unclear → REVIEW_REQUIRED */
export const SYNTHETIC_APPLICABILITY_UNCLEAR = buildRecipeSourceCandidate(
  syntheticInput({ id: 'synthetic-f-applicability-unclear', recipeApplicability: 'unclear' }),
)

/** G. Recipe Facts 自体の rights も unknown（Photo 分離では救えない）→ REVIEW_REQUIRED */
export const SYNTHETIC_RECIPE_FACTS_ALSO_UNKNOWN = buildRecipeSourceCandidate(
  syntheticInput({
    id: 'synthetic-g-facts-unknown',
    commercialUse: 'unknown',
    recipeApplicability: 'unclear',
    photoApplicability: 'unknown',
  }),
)

export const SYNTHETIC_SOURCE_CANDIDATE_FIXTURES = {
  RIGHTS_CLEAR: SYNTHETIC_RIGHTS_CLEAR_CANDIDATE,
  PDL_THIRD_PARTY_UNRESOLVED: SYNTHETIC_PDL_THIRD_PARTY_UNRESOLVED,
  MISSING_ATTRIBUTION: SYNTHETIC_MISSING_ATTRIBUTION,
  NONCOMMERCIAL: SYNTHETIC_NONCOMMERCIAL,
  UNKNOWN_LICENSE: SYNTHETIC_UNKNOWN_LICENSE,
  APPLICABILITY_UNCLEAR: SYNTHETIC_APPLICABILITY_UNCLEAR,
  RECIPE_FACTS_ALSO_UNKNOWN: SYNTHETIC_RECIPE_FACTS_ALSO_UNKNOWN,
}
