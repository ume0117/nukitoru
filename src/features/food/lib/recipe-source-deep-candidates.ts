// ============================================================
// recipe-source-deep-candidates.ts
//
// MISSION 2.41F-2 — Rights-Clear Source Deep Validation。
//
// Primary Target A/B（Health Canada — HEFI 2019 / Food Source Contribution Table）と
// Primary Target C（UK National Archives — MAF 102/15 wartime recipes）を、
// LICENSE → LICENSE APPLICABILITY → ACTUAL DATA → THIRD-PARTY RIGHTS → ATTRIBUTION →
// RECIPE USABILITY の 1 本の Evidence Chain として深掘りした結果。
//
// 重要:
// - 1 件作るために基準を下げていない。3 件すべて REVIEW_REQUIRED（0 件 RIGHTS_CLEAR_CANDIDATE）。
//   これは§20「0件でも信用を守れたなら成功」の正しい結果。
// - Optional Target（Asian recipe dataset / Scientific Data・Figshare）は今回調査していない
//   （§6 で明示的に optional・余力に応じて。今回は Primary Target A/B/C の深掘りを優先した）。
// - Recipe Import は一切していない（既存 recipe-source-candidates.ts の MISSION 2.41F 3 件も無変更）。
// ============================================================

import type { RecipeSourceCandidateInput } from '@/features/food/types'
import { buildRecipeSourceCandidate } from './recipe-source-discovery'

const RETRIEVED_AT = '2026-09-05'

// ------------------------------------------------------------
// A. Health Canada — Healthy Eating Food Index 2019
//    (Recipe Breakdown / ASA24 Recipes HEFI) → REVIEW_REQUIRED
//    third-party 起源（ASA24 = 米国 NCI/NIH ツール）が確認され、Health Canada 単独の
//    OGL-Canada 表示だけでは record-level applicability を確定できない。
// ------------------------------------------------------------

const HEALTH_CANADA_HEFI2019_INPUT: RecipeSourceCandidateInput = {
  id: 'health-canada-hefi2019-recipe-breakdown',
  name: 'Health Canada — Healthy Eating Food Index 2019 (Recipe Breakdown / ASA24 Recipes HEFI)',
  organization: 'Health Canada',
  country: 'CA',
  sourceType: 'government',
  homepageUrl: 'https://open.canada.ca/data/en/dataset/29892c85-2ff5-484c-873c-f494ffba6e1b',
  recipeIndexUrl:
    'https://open.canada.ca/data/en/dataset/29892c85-2ff5-484c-873c-f494ffba6e1b/resource/3692f6a2-fead-44e9-9d2b-9364612a49f0',
  termsUrl: 'https://open.canada.ca/en/open-government-licence-canada',
  licenseUrl: 'https://open.canada.ca/en/open-government-licence-canada',
  licenseType: 'custom-government-license',
  commercialUse: 'allowed',
  modification: 'allowed',
  attribution: 'required',
  // ASA24 は米国 NCI（国立がん研究所）が Westat 社に委託開発した米国連邦のツール。
  // OGL-Canada 自身が「Information Provider がライセンスできない第三者権利」を明示的に除外しており、
  // ASA24 由来の food-code 体系がその除外対象に当たるか Health Canada は明言していない。
  thirdPartyRights: 'unresolved',
  // ライセンス表示は dataset レベルで 1 回のみ（resource ごとの明記なし）。third-party 起源の疑いがある
  // 特定 resource（Recipe Breakdown / ASA24 Recipes HEFI）まで applicability が及ぶとは確認できない。
  recipeApplicability: 'unclear',
  photoApplicability: 'unknown',
  externalContentApplicability: 'unknown',
  capabilities: ['RECIPE_INGREDIENT_GRAPH'],
  evidence: [
    {
      sourceUrl: 'https://open.canada.ca/en/open-government-licence-canada',
      documentTitle: 'Open Government Licence - Canada',
      publisher: 'Government of Canada',
      retrievedAt: RETRIEVED_AT,
      ruleSummary:
        '複製・改変・翻訳・翻案・再配布・商用利用を含め、いかなる適法な目的にも利用可能。attribution は'
        + '指定された文言、無ければ既定文言「Contains information licensed under the Open Government '
        + 'Licence – Canada」を使用。公式な地位や Information Provider の推奨を示唆する使用は禁止。'
        + '**個人情報・Information Provider がライセンスできない第三者の権利・公的な紋章/ロゴ/名称・'
        + '特許/商標は本ライセンスの対象外**と明記。',
      evidenceType: 'license-page',
      licenseIdentifier: 'Open Government Licence – Canada 2.0',
    },
    {
      sourceUrl: 'https://open.canada.ca/data/en/dataset/29892c85-2ff5-484c-873c-f494ffba6e1b',
      documentTitle: 'The Healthy Eating Food Index 2019 — Open Government Portal',
      publisher: 'Health Canada',
      retrievedAt: RETRIEVED_AT,
      ruleSummary:
        'Publisher: Health Canada。Licence: Open Government Licence - Canada（dataset ページに 1 回表示、'
        + 'resource ごとの個別表示なし）。resource 一覧に ASA24 2018 Complete Database / ASA24 Food HEFI / '
        + 'ASA24 Recipes HEFI / Recipe Breakdown / HEFI 2019 Cat CNF・V2 / Data Dictionary 等。',
      evidenceType: 'official-statement',
      applicabilityNote:
        'licence は dataset 単位の表明であり、ASA24 由来と明記される resource への適用範囲を個別に'
        + '確認できる記載はない。',
    },
    {
      sourceUrl:
        'https://opencanada.blob.core.windows.net/opengovprod/resources/5a91fd01-db89-4d18-a2e9-fb22de809e30/data-dict.txt',
      documentTitle: 'HEFI 2019 Data Dictionary',
      publisher: 'Health Canada',
      retrievedAt: RETRIEVED_AT,
      ruleSummary:
        'Recipe Breakdown / ASA24 Recipes HEFI の実フィールドを確認: FoodCode（recipe id）/ '
        + 'Main_Food_Description（recipe 名）/ IngCode（ingredient id）/ Ingredient_description / '
        + 'IngWeight・TotalRecipeWeight（g）/ HEFI2019Cat 等の栄養カテゴリ内訳。'
        + '**調理工程・下準備・servings のフィールドは無い**。"ASA24" が database source として本文中に'
        + '繰り返し登場する。',
      evidenceType: 'other',
      applicabilityNote:
        '"Recipe" という resource 名は、ここでは「栄養計算用の食材構成（食材コード×重量）」を意味し、'
        + '調理可能なレシピ（分量・工程）ではない。Capability は RECIPE_INGREDIENT_GRAPH（FULL_RECIPE ではない）。',
    },
    {
      sourceUrl: 'https://epi.grants.cancer.gov/asa24/',
      documentTitle: 'ASA24® Dietary Assessment Tool | EGRP/DCCPS/NCI/NIH',
      publisher: 'National Cancer Institute (NIH, U.S.)',
      retrievedAt: RETRIEVED_AT,
      ruleSummary:
        'ASA24 は米国 NCI が Westat 社に委託開発し、複数の NIH 部局が資金提供した米国連邦のツール。'
        + 'USDA の Automated Multiple-Pass Method（AMPM）と Baylor College of Medicine の FIRSSt を'
        + '土台にしている。Health Canada の documentation ではない、独立した米国機関由来の Evidence。',
      evidenceType: 'other',
      applicabilityNote:
        'ASA24 が米国連邦・NIH/NCI 起源であることを確認。Health Canada が OGL-Canada の下で'
        + 'この米国由来の food-code 体系を再配布してよいと明言した記載は見つかっていない'
        + '（third-party rights signal・§11 firewall 対象）。',
    },
  ],
  // MISSION 2.41F-2A §1 — Rights Gap（下記）とは別。データ完全性が埋まっても Rights は解消しない。
  dataCompletenessGaps: [
    'ASA24 Recipes HEFI / Recipe Breakdown の実 CSV 全体は開いていない（Data Dictionary でフィールド定義のみ確認）',
    'ingredient amount は g 単位（IngWeight）のみ。家庭調理向けの単位（大さじ等）・servings・cooking steps は元データに存在しない',
  ],
  productValueNotes: [
    '「栄養計算用の食材構成」であり調理可能なレシピではない。将来「家にある食材 → 料理候補」の Food Graph には'
      + '使える可能性があるが、そのまま FULL_RECIPE Starter Pack にはならない。',
  ],
  reviewNotes: [
    'MISSION 2.41F-2: 「Licence: Open Government Licence - Canada」という Portal 表示だけで'
      + 'RIGHTS_CLEAR_CANDIDATE へ変更していない（§2 の指示どおり）。',
    'RIGHTS GAP: (1) LICENSE_APPLICABILITY — licence は dataset レベルで 1 回のみ表示。ASA24 由来と明記される'
      + 'この特定 resource へ OGL-Canada が及ぶか個別に確認できていない。(2) THIRD_PARTY_RIGHTS — ASA24 は'
      + '米国 NCI/NIH 起源（一次資料で確認）。OGL-Canada は「Information Provider がライセンスできない第三者権利」を'
      + '除外対象と明記しており、Health Canada がこの米国由来 food-code 体系を再配布してよいと明言した記載は無い。',
    '次に必要な Rights Evidence: Health Canada（または NCI）へ、ASA24 由来 food-code 体系を含む本 resource が'
      + ' OGL-Canada の対象に含まれるかを確認。含まれない場合は third-party（米国 NCI）側の利用条件を確認。'
      + '※ CSV の schema を確認しても、この 2 つの Rights Gap は解消しない。',
  ],
  reviewedAt: RETRIEVED_AT,
}
export const HEALTH_CANADA_HEFI2019_CANDIDATE = buildRecipeSourceCandidate(HEALTH_CANADA_HEFI2019_INPUT)

// ------------------------------------------------------------
// B. Health Canada — Food Source Contribution Table (2015 CCHS Nutrition)
//    "Foods and Ingredients" → REVIEW_REQUIRED（4 候補中もっとも Rights-Clear に近い）
// ------------------------------------------------------------

const HEALTH_CANADA_FSCT_INPUT: RecipeSourceCandidateInput = {
  id: 'health-canada-fsct-2015-cchs',
  name: 'Health Canada — Food Source Contribution Table (2015 CCHS Nutrition) / Foods and Ingredients',
  organization: 'Health Canada',
  country: 'CA',
  sourceType: 'government',
  homepageUrl: 'https://open.canada.ca/data/en/dataset/b166b1c1-0313-4706-8cca-f464f6fc7086',
  recipeIndexUrl:
    'https://open.canada.ca/data/en/dataset/b166b1c1-0313-4706-8cca-f464f6fc7086/resource/58a491eb-a9bf-42bb-a90e-07907620c8d5',
  termsUrl: 'https://open.canada.ca/en/open-government-licence-canada',
  licenseUrl: 'https://open.canada.ca/en/open-government-licence-canada',
  licenseType: 'custom-government-license',
  commercialUse: 'allowed',
  modification: 'allowed',
  attribution: 'required',
  // 2015 CCHS-Nutrition は Health Canada / Statistics Canada 自身が実施した全国調査。
  // ASA24 のような確認済み第三者起源の signal は見つかっていない。
  thirdPartyRights: 'none',
  // Portal 上の dataset 説明（"Foods and Ingredients: breaks recipes into constituent ingredient
  // components"）は一次資料（open.canada.ca 自体）で確認したが、実際の CSV / PDF Data Dictionary の
  // フィールド一覧until 個別に開けておらず「ACTUAL DATA」の確認までは完了していない。
  recipeApplicability: 'partial',
  photoApplicability: 'unknown',
  externalContentApplicability: 'unknown',
  capabilities: ['RECIPE_INGREDIENT_GRAPH', 'NUTRITION_REFERENCE'],
  evidence: [
    {
      sourceUrl: 'https://open.canada.ca/data/en/dataset/b166b1c1-0313-4706-8cca-f464f6fc7086',
      documentTitle: 'Food Source Contribution Table (2015 CCHS Nutrition) — Open Government Portal',
      publisher: 'Health Canada',
      retrievedAt: RETRIEVED_AT,
      ruleSummary:
        'Publisher: Health Canada。Licence: Open Government Licence - Canada。'
        + '"Foods and Recipes"（料理全体として）と "Foods and Ingredients"（料理を構成食材へ分解）の'
        + '2 系統の dataset。データ源は 2015 Canadian Community Health Survey - Nutrition。'
        + '外部（ASA24 等）第三者提供元への言及は確認されなかった。',
      evidenceType: 'official-statement',
      applicabilityNote:
        '調理工程・下準備の記載への言及は無い。栄養素・食品群への寄与を分析する目的の dataset であり、'
        + '構成上 FULL_RECIPE ではなく RECIPE_INGREDIENT_GRAPH 相当と考えられる。',
    },
    {
      sourceUrl:
        'https://open.canada.ca/data/en/dataset/b166b1c1-0313-4706-8cca-f464f6fc7086/resource/58a491eb-a9bf-42bb-a90e-07907620c8d5',
      documentTitle: 'FSCT Data Dictionary (2015 CCHS Nutrition) — resource page',
      publisher: 'Health Canada',
      retrievedAt: RETRIEVED_AT,
      ruleSummary:
        'Data Dictionary は PDF（79.1 kB）。resource page 自体にはフィールド名の一覧は展開されておらず、'
        + 'PDF 本体を個別に開いてフィールド定義（recipe id / ingredient id / amount 等）を確認する'
        + '追加ステップが必要（本 MISSION では未実施）。third-party 由来の追加言及はこのページには無い。',
      evidenceType: 'other',
      applicabilityNote:
        'licence は dataset レコードに 1 回表示されるのみで、この特定 resource ページ上に licence の'
        + '再掲・個別表示は確認できなかった。dataset-level の licence 表示がこの downloadable resource へ'
        + '及ぶことを個別に確認できていないため recipeApplicability は confirmed ではなく partial。',
    },
  ],
  // MISSION 2.41F-2A §3 — Rights Gap（reviewNotes 参照）と Data Completeness Gap（下記）は別物。
  dataCompletenessGaps: [
    '実 CSV（"Foods and Ingredients"）・PDF Data Dictionary（79.1 kB）を開いてフィールド定義'
      + '（recipe id / ingredient id / amount 相当）を確認していない',
    '調理工程・下準備・servings は元データに存在しない（栄養素・食品群寄与分析が目的の dataset）',
  ],
  productValueNotes: [
    '料理名 → 材料構成の Knowledge Graph には使える可能性があるが、調理工程が無いため FULL_RECIPE '
      + 'Starter Pack にはならない。',
  ],
  reviewNotes: [
    'MISSION 2.41F-2: 4 候補中、third-party signal が確認されず、Rights fields（commercial / '
      + 'modification / attribution）もすべて allowed/required で判明している唯一の候補。',
    'RIGHTS GAP（2 つ・データ完全性とは別）: (1) LICENSE_APPLICABILITY — OGL-Canada は dataset レベルで'
      + '1 回のみ表示。この特定 resource へ及ぶことを個別に確認できていない。(2) CONTENT_SCOPE — photo /'
      + 'external content / recipe facts の各スコープへの適用可否をそれぞれ確認できていない。',
    'MISSION 2.41F-2A 整合性修正: 以前「残る Gap は CSV field 構造の確認 1 点のみ」と記載したのは不正確。'
      + '**CSV schema が確認できても Rights Gap（licence applicability / content scope）は解消しない**。'
      + '次の Rights Evidence: resource ページまたは Health Canada へ dataset-level licence がこの'
      + '"Foods and Ingredients" resource に適用されるか確認。',
  ],
  reviewedAt: RETRIEVED_AT,
}
export const HEALTH_CANADA_FSCT_CANDIDATE = buildRecipeSourceCandidate(HEALTH_CANADA_FSCT_INPUT)

// ------------------------------------------------------------
// C. UK National Archives — MAF 102/15 (1) Recipes for cakes with no eggs
//    → REVIEW_REQUIRED（Rights は比較的明確だが、実データが scan 画像内で未抽出）
// ------------------------------------------------------------

const UK_NATIONAL_ARCHIVES_MAF10215_INPUT: RecipeSourceCandidateInput = {
  id: 'uk-national-archives-maf-102-15',
  name: 'The National Archives (UK) — MAF 102/15 (1) Recipes for cakes with no eggs',
  organization: 'The National Archives (UK) / Crown copyright (historical MAF record)',
  country: 'GB',
  sourceType: 'government',
  homepageUrl:
    'https://www.nationalarchives.gov.uk/education/families/holidays-through-history/wartime/maf-102-15-1-recipes-for-cakes-with-no-eggs/',
  termsUrl: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
  licenseUrl: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
  licenseType: 'custom-government-license',
  commercialUse: 'allowed',
  modification: 'allowed',
  attribution: 'required',
  // このページ自体には第三者クレジット（提供元・写真提供等）の表示は確認されなかった
  thirdPartyRights: 'none',
  // RIGHTS: OGL v3.0 の一般枠組みは及ぶと考えられるが、この特定の歴史記録に対する OGL v3.0 の
  // 明示的な適用表示（per-record assertion）は確認できておらず、古い Crown 著作物の複製範囲も未検証。
  // （※「スキャンが未文字起こし」は Rights ではなく Data Completeness Gap。dataCompletenessGaps を参照）
  recipeApplicability: 'partial',
  // 歴史文書のスキャン画像。OGL の一般原則は及ぶと考えられるが、画像固有のデジタル化権利は別途未確認
  photoApplicability: 'separate',
  externalContentApplicability: 'unknown',
  capabilities: ['HISTORICAL_RECIPE', 'DISCOVERY_ONLY'],
  evidence: [
    {
      sourceUrl: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
      documentTitle: 'Open Government Licence for public sector information (v3.0)',
      publisher: 'The National Archives (UK)',
      retrievedAt: RETRIEVED_AT,
      ruleSummary:
        '複製・公表・頒布・送信・翻案・商用/非商用での活用を許可。attribution は指定文言、無ければ既定'
        + '文言「Contains public sector information licensed under the Open Government Licence v3.0」。'
        + '**個人データ・FOI 開示外情報・政府ロゴ/紋章・軍の記章・第三者知的財産権・特許/商標/意匠権・'
        + '身分証明書類は対象外**と明記。',
      evidenceType: 'license-page',
      licenseIdentifier: 'Open Government Licence v3.0 (UK)',
    },
    {
      sourceUrl:
        'https://www.nationalarchives.gov.uk/education/families/holidays-through-history/wartime/maf-102-15-1-recipes-for-cakes-with-no-eggs/',
      documentTitle: 'MAF 102/15 (1) Recipes for cakes with no eggs — The National Archives',
      publisher: 'The National Archives (UK)',
      retrievedAt: RETRIEVED_AT,
      ruleSummary:
        'ページ本文は The National Archives による解説文と、歴史文書（戦時中の卵不使用ケーキ・ビスケット'
        + 'レシピ集）のスキャン画像で構成される。個別の材料・分量・手順はページ本文には書き起こされておらず、'
        + '拡大画像でのみ閲覧できる。ページ内に個別の third-party クレジット表示は確認されなかった。',
      evidenceType: 'official-statement',
      applicabilityNote:
        'ページ footer は一般の OGL v3.0 ページを参照するのみで、この記録固有の OGL v3.0 適用表示は無い。'
        + 'photoApplicability は scan/デジタル化権利が未確認のため separate。recipeApplicability は partial。',
    },
  ],
  // MISSION 2.41F-2A §4 — scan 未文字起こしは Data Completeness Gap（Rights ではない）
  dataCompletenessGaps: [
    'スキャン画像から材料・分量・手順を文字起こし（transcription）していない → 構造化 Recipe Fact が未生成',
    'AI 画像認識で自動生成しない方針。人手 transcription が必要',
  ],
  productValueNotes: [
    '戦時中の卵不使用ケーキという歴史資料。現代の家庭料理 Starter Pack としての実用性は限定的'
      + '（Rights classification には影響させない — §1 の C は分離）。',
  ],
  reviewNotes: [
    'MISSION 2.41F-2 §5: RIGHTS と PRODUCT VALUE を分離して評価した。',
    'MISSION 2.41F-2A §4 整合性修正: 以前「実データ未抽出」を recipeApplicability partial の理由として'
      + '記載したが、それは Data Completeness Gap。**RIGHTS GAP は別**: (1) LICENSE_APPLICABILITY —'
      + 'この記録固有の OGL v3.0 適用表示が無い + 古い Crown 著作物の複製範囲未検証、(2) CONTENT_SCOPE —'
      + 'scan 画像のデジタル化権利（photoApplicability=separate）が未確認。',
    '次の Rights Evidence: The National Archives へ、MAF 102 シリーズ / この scan の再利用条件が'
      + ' OGL v3.0 の対象かを確認。文字起こし（Data Completeness）とは独立に進められる。',
  ],
  reviewedAt: RETRIEVED_AT,
}
export const UK_NATIONAL_ARCHIVES_MAF10215_CANDIDATE = buildRecipeSourceCandidate(
  UK_NATIONAL_ARCHIVES_MAF10215_INPUT,
)

export const DEEP_VALIDATION_CANDIDATES = [
  HEALTH_CANADA_HEFI2019_CANDIDATE,
  HEALTH_CANADA_FSCT_CANDIDATE,
  UK_NATIONAL_ARCHIVES_MAF10215_CANDIDATE,
]

// ------------------------------------------------------------
// SYNTHETIC — §13 の追加要件（capability 独立性・third-party cleared 経路等）検証専用
// ------------------------------------------------------------

const SYNTHETIC_NOTE = 'SYNTHETIC — MISSION 2.41F-2 Gate 経路検証専用。実在の Source ではない。'

function syntheticInput(overrides: Partial<RecipeSourceCandidateInput> = {}): RecipeSourceCandidateInput {
  return {
    id: 'synthetic-deep-source',
    name: 'SYNTHETIC deep validation test source',
    organization: 'SYNTHETIC / NUKITORU internal test',
    country: 'INTL',
    sourceType: 'government',
    homepageUrl: 'https://example.invalid/synthetic-deep-source',
    recipeIndexUrl: 'https://example.invalid/synthetic-deep-source/resource',
    termsUrl: 'https://example.invalid/synthetic-deep-source/terms',
    licenseUrl: 'https://example.invalid/synthetic-deep-source/license',
    licenseType: 'CC-BY-4.0',
    commercialUse: 'allowed',
    modification: 'allowed',
    attribution: 'required',
    thirdPartyRights: 'none',
    recipeApplicability: 'confirmed',
    photoApplicability: 'unknown',
    externalContentApplicability: 'unknown',
    evidence: [
      {
        sourceUrl: 'https://example.invalid/synthetic-deep-source/terms',
        documentTitle: 'SYNTHETIC terms',
        publisher: 'SYNTHETIC',
        retrievedAt: RETRIEVED_AT,
        ruleSummary: SYNTHETIC_NOTE,
        evidenceType: 'terms-of-use',
      },
    ],
    reviewNotes: [SYNTHETIC_NOTE],
    reviewedAt: RETRIEVED_AT,
    ...overrides,
  }
}

/** §13 test 4 — Rights-clear ingredient graph（工程なし）→ PASS 可 + capability は RECIPE_INGREDIENT_GRAPH */
export const SYNTHETIC_CLEAR_INGREDIENT_GRAPH = buildRecipeSourceCandidate(
  syntheticInput({ id: 'synthetic-clear-ingredient-graph', capabilities: ['RECIPE_INGREDIENT_GRAPH'] }),
)

/** §13 test 5 — Rights-clear な historical recipe（Capability は Rights と独立） */
export const SYNTHETIC_CLEAR_HISTORICAL_RECIPE = buildRecipeSourceCandidate(
  syntheticInput({ id: 'synthetic-clear-historical', capabilities: ['HISTORICAL_RECIPE'] }),
)

/** §13 test 12 — third-party 明示的に cleared → gate 通過可 */
export const SYNTHETIC_THIRD_PARTY_CLEARED = buildRecipeSourceCandidate(
  syntheticInput({ id: 'synthetic-third-party-cleared', thirdPartyRights: 'cleared' }),
)

/** §13 test 6 — 論文（article）は CC BY だが、参照する Recipe dataset 自体は別評価（未確認） */
export const SYNTHETIC_ARTICLE_LICENSE = buildRecipeSourceCandidate(
  syntheticInput({
    id: 'synthetic-article-cc-by',
    name: 'SYNTHETIC article (CC BY 4.0)',
    sourceType: 'academic-dataset',
  }),
)
export const SYNTHETIC_REFERENCED_DATASET_UNKNOWN = buildRecipeSourceCandidate(
  syntheticInput({
    id: 'synthetic-referenced-dataset',
    name: 'SYNTHETIC dataset referenced by the article (license not independently confirmed)',
    licenseType: 'unknown',
    commercialUse: 'unknown',
    modification: 'unknown',
    attribution: 'unknown',
    thirdPartyRights: 'unknown',
    recipeApplicability: 'unclear',
  }),
)

// --- MISSION 2.41F-2A: Rights ≠ Completeness の分離を検証する SYNTHETIC ---

/**
 * §8 test 1 / 4 / 5 — Rights Evidence 欠落（recipeApplicability unclear）だが
 * Data Completeness Gap は空。schema が確認できても Rights Gap は解消しない。
 */
export const SYNTHETIC_RIGHTS_GAP_DATA_COMPLETE = buildRecipeSourceCandidate(
  syntheticInput({
    id: 'synthetic-rights-gap-data-complete',
    recipeApplicability: 'unclear',
    photoApplicability: 'confirmed',
    externalContentApplicability: 'confirmed',
    capabilities: ['RECIPE_INGREDIENT_GRAPH'],
    dataCompletenessGaps: [], // 実データは完全に把握済み（recipe id / ingredient / amount 確認済み）
  }),
)

/**
 * §8 test 2 / 9 — Rights Evidence 完全だが cooking steps なし。
 * Rights classification は FULL_RECIPE capability と独立（RIGHTS_CLEAR でも FULL_RECIPE ではない）。
 */
export const SYNTHETIC_RIGHTS_COMPLETE_NO_STEPS = buildRecipeSourceCandidate(
  syntheticInput({
    id: 'synthetic-rights-complete-no-steps',
    photoApplicability: 'confirmed',
    externalContentApplicability: 'confirmed',
    capabilities: ['RECIPE_INGREDIENT_GRAPH'],
    dataCompletenessGaps: ['cooking steps / servings なし'],
  }),
)

/**
 * §8 test 10 — capabilities に FULL_RECIPE を含むが licence 不明。
 * FULL_RECIPE は Rights PASS を意味しない。
 */
export const SYNTHETIC_FULL_RECIPE_NO_RIGHTS = buildRecipeSourceCandidate(
  syntheticInput({
    id: 'synthetic-full-recipe-no-rights',
    licenseType: 'unknown',
    commercialUse: 'unknown',
    modification: 'unknown',
    attribution: 'unknown',
    thirdPartyRights: 'unknown',
    recipeApplicability: 'unclear',
    capabilities: ['FULL_RECIPE'],
  }),
)

export const DEEP_VALIDATION_SYNTHETIC_FIXTURES = {
  CLEAR_INGREDIENT_GRAPH: SYNTHETIC_CLEAR_INGREDIENT_GRAPH,
  CLEAR_HISTORICAL_RECIPE: SYNTHETIC_CLEAR_HISTORICAL_RECIPE,
  THIRD_PARTY_CLEARED: SYNTHETIC_THIRD_PARTY_CLEARED,
  ARTICLE_LICENSE: SYNTHETIC_ARTICLE_LICENSE,
  REFERENCED_DATASET_UNKNOWN: SYNTHETIC_REFERENCED_DATASET_UNKNOWN,
  RIGHTS_GAP_DATA_COMPLETE: SYNTHETIC_RIGHTS_GAP_DATA_COMPLETE,
  RIGHTS_COMPLETE_NO_STEPS: SYNTHETIC_RIGHTS_COMPLETE_NO_STEPS,
  FULL_RECIPE_NO_RIGHTS: SYNTHETIC_FULL_RECIPE_NO_RIGHTS,
}
