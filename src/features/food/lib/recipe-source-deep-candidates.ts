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
  // MISSION 2.41F-3 修正: 旧 URL（resource/58a491eb...）は Data Dictionary の "French" resource
  // だった（recipeIndexUrl と称しながら実際の "Foods and Ingredients" resource ではなかった）。
  // 実際の "Foods and Ingredients" CSV (English) resource へ修正。
  recipeIndexUrl:
    'https://open.canada.ca/data/en/dataset/b166b1c1-0313-4706-8cca-f464f6fc7086/resource/7ae4273d-cccf-4c8c-b796-43b58bef452c',
  termsUrl: 'https://open.canada.ca/en/open-government-licence-canada',
  licenseUrl: 'https://open.canada.ca/en/open-government-licence-canada',
  licenseType: 'custom-government-license',
  commercialUse: 'allowed',
  modification: 'allowed',
  attribution: 'required',
  // MISSION 2.41F-3 PRE-COMMIT AUDIT 再評価: type の ThirdPartyRightsState における 'none' は
  // 「第三者権利signalが見つからなかった」（消極的事実）ではなく「第三者権利が無いことを確認済み」
  // （積極的確認、例: 連邦職員の職務著作物と確認済み）を意味する（types/index.ts の comment、および
  // world-recipe-import-fixtures.ts の同種 fixture の用例で確認）。この基準に照らし、根拠を
  // 「ASA24 のような signal が見つからなかった」という消極的事実から、公式 Data Dictionary の
  // "How to cite" 節が FSCT の著作・派生元を Health Canada（元データは Statistics Canada 自身の
  // 調査）とだけ明記している、という積極的事実（下記 Evidence 参照）へ差し替えた。
  // なお、この判定は FSCT という配布物自体の著作権チェーンについてのみ有効。構築に使われた
  // CNF・recipe file 自体の ownership は確認していない（確認不要: FSCT CSV 自体にそれらの内容は
  // 一切露出しないため）。
  thirdPartyRights: 'none',
  // MISSION 2.41F-3 で実際の CSV（4.1MB, 36,918 行）・公式 Data Dictionary PDF・公式 User Guide PDF を
  // すべて開いて確認した。結果:
  //  (a) LICENSE_APPLICABILITY 方向へは強い補強 Evidence を得た（dataset record の License field に加え、
  //      open.canada.ca 公式 FAQ「datasets or tools made available にアクセスした時点で OGL-Canada に同意」、
  //      および Registry Operations Guide の "Authority to Release" 要件により、portal が resource 単位の
      // license 表示欄を持たない設計であること、かつ公開時に institution が resource 単位で OGL-Canada
      // 配布権限を確認する運用であることが Tier A 一次資料で確認できた）。
  //  (b) しかし CONTENT_SCOPE は否定的に確定した: 実 CSV の列は
  //      Nutrient/Item, Sex, Age, N, Food group_level1-3, Mean, Mean_SE, Unit, Percentage,
      // Percentage_SE, Flag, Food_Group_Level のみ。food/dish の個別 identity（food code 等）も
      // ingredient への relationship も存在しない。公式 Data Dictionary は明記: "Estimates in the
      // Foods and Ingredients file were generated by combining foods consumed as a food on its own
      // or as an ingredient; it does not take into account recipes." 公式 User Guide も同様に
      // "it does not provide details on the type of foods and recipes these ingredients are used in"
      // と明記。→ RECIPE_INGREDIENT_GRAPH 相当のデータは実在しないことが確定（推測ではなく一次資料確認）。
  // (b) の結果、recipeApplicability を 'confirmed' に格上げしない。'confirmed' は「対象 Recipe への
  // 適用を Evidence で確認済み」を意味するが、対象となる recipe/ingredient-relationship データ自体が
  // 存在しないため、このフィールドを 'confirmed' にすることは実態と合わない。(a) の Rights 側の補強も、
  // resource 単位の明示的な license 再掲ではなく portal の運用ルールからの構造的推論である点は残る。
  // → RIGHTS_CLEAR_CANDIDATE への切り替えはユーザー判断待ち（Completion Report 参照）。
  recipeApplicability: 'partial',
  photoApplicability: 'unknown',
  externalContentApplicability: 'unknown',
  // MISSION 2.41F-3 修正: RECIPE_INGREDIENT_GRAPH を削除。実データ確認の結果、food/dish → ingredient の
  // 関係を一切含まない（Health Canada 自身が "it does not take into account recipes" と明記）。
  // 残る実体は population-level food-group nutrient contribution 集計のみのため NUTRITION_REFERENCE
  // のみを capability として残す（Rights classification には capabilities は影響しない: §7 参照）。
  capabilities: ['NUTRITION_REFERENCE'],
  evidence: [
    {
      sourceUrl: 'https://open.canada.ca/data/en/dataset/b166b1c1-0313-4706-8cca-f464f6fc7086',
      documentTitle: 'Food Source Contribution Table (2015 CCHS Nutrition) — Open Government Portal',
      publisher: 'Health Canada',
      retrievedAt: RETRIEVED_AT,
      ruleSummary:
        'Publisher: Health Canada。Licence: Open Government Licence - Canada（dataset record の'
        + 'License field に表示）。"Foods and Recipes" と "Foods and Ingredients" の2系統の dataset。'
        + 'データ源は 2015 Canadian Community Health Survey - Nutrition。'
        + '外部（ASA24 等）第三者提供元への言及は確認されなかった。',
      evidenceType: 'official-statement',
      applicabilityNote:
        'License field は dataset record レベルの表示。個別 resource ページには licence の再掲は無い'
        + '（下記 resource page Evidence 参照）。',
    },
    {
      sourceUrl:
        'https://open.canada.ca/data/en/dataset/b166b1c1-0313-4706-8cca-f464f6fc7086/resource/7ae4273d-cccf-4c8c-b796-43b58bef452c',
      documentTitle:
        'Updated - FSCT Dataset - Foods and Ingredients (2015 CCHS Nutrition) — actual resource page (CSV, English, 4.1MB)',
      publisher: 'Health Canada',
      retrievedAt: '2026-09-16',
      ruleSummary:
        'MISSION 2.41F-3 で実際の downloadable resource page を直接確認（過去 MISSION は誤って'
        + 'Data Dictionary の French resource を参照していた）。resource page の HTML 本文には'
        + '"licen[cs]e" の文字列が一切出現せず（直接 grep で確認）、per-resource の個別 licence 表示は'
        + '存在しない。third-party 由来の言及もこのページには無い。',
      evidenceType: 'other',
      applicabilityNote:
        'この resource ページ自体に licence の再掲・個別表示が無いことを実際に開いて確認した'
        + '（推測ではない）。dataset record の licence がここへ及ぶかどうかは、このページ単体では'
        + '判断できない。',
    },
    {
      sourceUrl: 'https://open.canada.ca/en/open-government-licence-canada',
      documentTitle: 'Open Government Licence - Canada — official licence text',
      publisher: 'Government of Canada',
      retrievedAt: '2026-09-16',
      ruleSummary:
        '"Information" は "information resources... offered for use under the terms of this '
        + 'licence" と定義。commercial use / copy / modify / adapt / distribute を明示的に許可。'
        + 'attribution 必須（指定文言が無い場合は "Contains information licensed under the Open '
        + 'Government Licence – Canada"）。third-party rights は明示的に適用除外（別途確認が必要）。'
        + 'ライセンス本文自体は dataset と個別 resource の粒度について何も述べていない。',
      evidenceType: 'license-page',
      applicabilityNote:
        'ライセンス本文だけでは dataset レベルの表示が個別 resource へ及ぶかどうかは判断できない'
        + '（本文に dataset/resource の区別自体が存在しない）。',
    },
    {
      sourceUrl: 'https://open.canada.ca/en/frequently-asked-questions',
      documentTitle: 'Frequently Asked Questions — Open Government Portal (official)',
      publisher: 'Government of Canada',
      retrievedAt: '2026-09-16',
      ruleSummary:
        '公式 FAQ に "By accessing datasets or tools made available, you agree to the terms of '
        + 'the Open Government Licence – Canada." と明記（raw HTML で verbatim 確認済み）。'
        + 'portal 全体（個別 dataset の record page に限らない）で OGL-Canada が適用される前提を'
        + '示す Tier A の portal-wide 記述。',
      evidenceType: 'official-statement',
      applicabilityNote:
        '"datasets or tools made available" という表現は、resource（実データファイル）を明示的に'
        + '名指ししてはいない。dataset に付随する resource を含む一般的な意図と読むのが自然だが、'
        + 'resource 単位を明示した文言ではない点は残る。',
    },
    {
      sourceUrl: 'https://open.canada.ca/en/registry-operations-guide/upload-data',
      documentTitle: 'Registry operations guide: Uploading open data and information (official)',
      publisher: 'Government of Canada',
      retrievedAt: '2026-09-16',
      ruleSummary:
        '公式 Registry Operations Guide に、institution が dataset/resource を公開する際の承認'
        + 'チェックリスト項目として "Authority to Release - The institution has the mandate, '
        + 'legislative authority or permission from a third party provider to release the data or '
        + 'information resources under the Open Government Licence – Canada." と明記（raw HTML で'
        + 'verbatim 確認済み）。同 Guide には resource 単位の個別 licence 上書き機構への言及は無い'
        + '（= portal の設計上、licence は dataset record 単位でのみ管理される）。',
      evidenceType: 'other',
      applicabilityNote:
        'これは「公開 workflow 上、機関は resource を OGL-Canada の下で公開する権限確認を行う」という'
        + '運用ルールの確認であり、この特定 resource（7ae4273d）について Health Canada が個別に'
        + '発行した licence 表明の文書そのものではない。構造的・運用的な補強 Evidence であり、'
        + 'resource 固有の直接証拠ではない点を区別して記録する。',
    },
    {
      sourceUrl:
        'https://open.canada.ca/data/dataset/b166b1c1-0313-4706-8cca-f464f6fc7086/resource/e3bbc516-e7b2-4ec4-b8b0-d4c6ff1166ed/download/6-updated-fsct-data-dictionary-2015-cchs-nutrition.pdf',
      documentTitle: 'Updated - FSCT Data Dictionary (2015 CCHS Nutrition) — official PDF (English)',
      publisher: 'Health Canada',
      retrievedAt: '2026-09-16',
      ruleSummary:
        '公式 Data Dictionary を実際に開いて確認。列定義: Nutrient/Item（14 種の栄養素 + Food '
        + 'weight）, Sex, Age, N, Food group_level1-3（食品群カテゴリ、3 段階の粒度）, Mean（人口'
        + '平均の1日あたり寄与量）, Percentage（総摂取量に対する寄与率）等。"2.2 Estimates in the '
        + 'Foods and Ingredients file were generated by combining foods consumed as a food on its '
        + 'own or as an ingredient; it does not take into account recipes." と明記。'
        + 'また "How to cite data from the FSCT" 節に "Health Canada (2023). Food Source '
        + 'Contribution Table derived from Statistics Canada\'s 2015 Canadian Community Health '
        + 'Survey, Nutrition, Share file. Ottawa." と、公式引用形式で著作・派生元を明記している。',
      evidenceType: 'official-statement',
      applicabilityNote:
        'food/dish の個別 identity（food code 等）も ingredient への relationship も存在しないことを'
        + '公式資料で確認した。CONTENT_SCOPE の A（food/dish identity）・B（ingredient relationship）'
        + 'は実在しないことが確定（推測ではない）。C（quantity/contribution）は population-level の'
        + '人口統計値のみで、料理内の材料分量ではない。D（nutrition structured facts）は栄養素別の'
        + '人口寄与集計として存在するが、食品ごとの栄養成分値（per-100g 等）ではない。'
        + 'MISSION 2.41F-3 PRE-COMMIT AUDIT 追記: この公式引用形式は、FSCT という配布物自体の'
        + '著作・派生元を Health Canada（元データは Statistics Canada 自身の調査）とだけ明記して'
        + 'おり、外部・民間・海外の第三者は authorship chain のどこにも登場しない。これは thirdPartyRights'
        + '評価において「third-party signal が見当たらなかった」という消極的事実ではなく、'
        + '「配布物の著作・派生元が Government of Canada の内部だけで完結していると公式引用が明記'
        + 'している」という積極的事実であり、type の "none" 定義（例: 連邦職員の職務著作物と確認済み）'
        + 'が要求する confirmed 水準に当たる根拠として扱う。ただしこれは FSCT という配布物自体の'
        + '著作権チェーンについての確認であり、その構築に使われた CNF・recipe file という個別'
        + 'input 自体の ownership を確認したものではない（それらは FSCT CSV 自体には露出しない'
        + 'internal methodology input であるため、配布物の third-party rights 評価には影響しない）。',
    },
    {
      sourceUrl:
        'https://open.canada.ca/data/dataset/b166b1c1-0313-4706-8cca-f464f6fc7086/resource/7cb83e8a-943e-4ffc-a833-c9c25ef39bad/download/3-fsct-user-guide-2015-cchs-nutrition.pdf',
      documentTitle: 'User Guide — Food source contribution table (FSCT) — official PDF (English)',
      publisher: 'Health Canada',
      retrievedAt: '2026-09-16',
      ruleSummary:
        '公式 User Guide §2.3 に "In the file \'FSCT Dataset - Foods and Ingredients (2015 CCHS '
        + 'Nutrition)\'... it does not provide details on the type of foods and recipes these '
        + 'ingredients are used in." と明記。§2.1 は nutrient database の構築に 2015 Canadian '
        + 'Nutrient File (CNF)・a recipe file・survey foods を input として使ったと述べている。',
      evidenceType: 'official-statement',
      applicabilityNote:
        'FSCT の目的そのものが「食品群が集団の栄養摂取にどう寄与するか」という surveillance 統計で'
        + 'あり、recipe/ingredient graph の構築を目的にしていないことが公式文書で確認できた。'
        + 'MISSION 2.41F-3 PRE-COMMIT AUDIT 修正: CNF・recipe file が "Health Canada / Statistics '
        + 'Canada 自身の内部データである" という断定は本 MISSION では一次情報で独立に確認していない '
        + '（User Guide は CNF を input として名指ししているのみで、CNF 自体の ownership / '
        + 'authorship / licence status には言及していない）。third-party 起源との明示的な言及も'
        + '無いが、それは「確認して third-party ではないと分かった」のではなく「言及が無かった」'
        + 'だけであり、third-party rights 不存在の根拠としては使わない。CNF・recipe file はいずれも'
        + '内部 methodology input であり、公開される FSCT CSV 自体にはそれらの内容（recipe-level '
        + '構造・CNF の個別食品組成値等）は一切露出していない — この「非露出」の事実のみを確認済みと'
        + 'して記録する。',
    },
  ],
  // MISSION 2.41F-2A §3 — Rights Gap（reviewNotes 参照）と Data Completeness Gap（下記）は別物。
  dataCompletenessGaps: [
    'MISSION 2.41F-3 で実 CSV（"Foods and Ingredients"）と公式 Data Dictionary PDF を実際に開いて'
      + '確認した結果、food/dish の個別 identity（food code・料理名）は存在しないと確定'
      + '（Food group_level1-3 は食品カテゴリであり、個別の料理・食品アイテムではない）',
    'MISSION 2.41F-3 で確定: food/dish → ingredient の relationship は存在しない'
      + '（Health Canada 自身が "it does not take into account recipes" と明記）',
    'MISSION 2.41F-3 で確定: 調理工程・下準備・servings・household units は元データに存在しない',
    'MISSION 2.41F-3 で確定: 栄養値は食品ごとの組成値（per-100g 等）ではなく、population-level の'
      + '1日あたり平均寄与量（Mean）・寄与率（Percentage）のみ',
  ],
  productValueNotes: [
    'MISSION 2.41F-3 訂正: 過去 MISSION の「料理名 → 材料構成の Knowledge Graph に使える可能性」は'
      + '実データ確認により否定された。この resource は recipe/ingredient graph の材料にはならない。',
    '残る Product Value は狭い: 「どの食品カテゴリがカナダ人口のどの栄養素摂取に最も寄与しているか」'
      + 'という population nutrition surveillance の参照情報としてのみ使える（例: 教育コンテンツ・'
      + '栄養インサイト機能）。NUKITORU の recipe/ingredient データや per-food 栄養データベースの'
      + '代替にはならない。',
  ],
  reviewNotes: [
    'MISSION 2.41F-2: 4 候補中、third-party signal が確認されず、Rights fields（commercial / '
      + 'modification / attribution）もすべて allowed/required で判明している唯一の候補。',
    'MISSION 2.41F-3 PRE-COMMIT AUDIT — thirdPartyRights 再評価: 上記「signal が確認されず」は'
      + '消極的事実であり、type の \'none\' が要求する「確認済み」水準の根拠としては不十分と判断した。'
      + '根拠を、公式 Data Dictionary の "How to cite" 節（FSCT の著作・派生元を Health Canada / '
      + 'Statistics Canada とだけ明記する公式引用）という積極的事実に差し替えた（Evidence 参照）。'
      + 'また、User Guide が言及する CNF・recipe file について「Health Canada / Statistics Canada '
      + '自身の内部データ」と断定していた記述は、本 MISSION で独立に確認していないため削除した'
      + '（CNF 自体の ownership は未確認・未検証のまま。ただし FSCT CSV 自体に CNF の内容は露出しない'
      + 'ため、この判定には影響しない）。',
    'MISSION 2.41F-3 — LICENSE_APPLICABILITY 調査結果: dataset record の licence 表示に加え、'
      + '公式 FAQ（portal 全体の datasets/tools アクセス時に OGL-Canada 適用と明記）および '
      + 'Registry Operations Guide（institution が resource を OGL-Canada の下で公開する権限を'
      + '確認する運用、かつ portal に resource 単位の個別 licence 上書き機構が無いこと）という'
      + '3 つの独立した Tier A 一次資料で補強された。実際の resource page 自体には licence の'
      + '再掲は無いことも直接確認した（矛盾する licence 表示も無い）。この 3 点は「dataset レベルの'
      + 'licence が実際の downloadable resource に及ぶ」という結論を強く支持するが、この特定'
      + 'resource（7ae4273d）を名指しした Health Canada の明示的な licence 表明ではなく、portal の'
      + '一般的な運用ルールからの構造的推論である点は残る。',
    'MISSION 2.41F-3 — CONTENT_SCOPE 調査結果（確定・否定的）: 実 CSV（36,918 行）と公式 Data '
      + 'Dictionary・User Guide を直接確認した結果、A. food/dish identity、B. ingredient '
      + 'relationship、C. dish-level quantity/contribution はいずれも存在しない。D. nutrition '
      + 'structured facts は存在するが population-level 集計のみ。Health Canada 自身が "Foods and '
      + 'Ingredients... does not take into account recipes" と明記しており、これは推測ではなく'
      + '一次資料による確定事実。旧 MISSION の capabilities（RECIPE_INGREDIENT_GRAPH を含む）は'
      + 'この確認により誤りと判明し、削除した。',
    'MISSION 2.41F-3 判断: recipeApplicability は confirmed に格上げしなかった。理由は (1) 対象と'
      + 'なる recipe/ingredient-relationship コンテンツ自体が実在しないため「recipe への適用を'
      + '確認済み」という状態そのものが成立しない、(2) LICENSE_APPLICABILITY 側の補強も resource '
      + '固有の直接証拠ではなく運用ルールからの推論である、の 2 点による。したがって classification '
      + 'は REVIEW_REQUIRED を維持する。RIGHTS_CLEAR_CANDIDATE への切り替えを検討する場合は、'
      + 'Health Canada（nutrition.surveillance-nutritionnelle@hc-sc.gc.ca）へ "Foods and '
      + 'Ingredients" resource 単位での OGL-Canada 適用を直接確認するのが次のステップ（問い合わせ'
      + '文案は Completion Report 側に用意し、送信はしていない）。',
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
