# NUKITORU FOOD — Rights-Clear Source Deep Validation (MISSION 2.41F-2)

MISSION 2.41F の Source Discovery / Rights Gate を使い、**最初の Rights-Clear Recipe Source** を
確定できるか、有望候補の LICENSE → LICENSE APPLICABILITY → ACTUAL DATA → THIRD-PARTY RIGHTS →
ATTRIBUTION → RECIPE USABILITY を 1 本の Evidence Chain としてつないだ深掘り結果。

> 1 件作るために基準を下げない。**結果 0 件も正しい。**

MISSION 2.41F のドキュメント（`RECIPE_SOURCE_DISCOVERY.md`）・実 Candidate 3 件
（`recipe-source-candidates.ts`）は本 MISSION で変更していない。深掘り結果は本ドキュメントと
`recipe-source-deep-candidates.ts` へ追記として保存する。

## 結果サマリー

| Target | Source | Classification | Capability | 主な RIGHTS GAP（→ 詳細は下記 Gap Model） |
|---|---|---|---|---|
| A（Primary） | Health Canada — HEFI 2019（Recipe Breakdown / ASA24 Recipes HEFI） | `REVIEW_REQUIRED` | `RECIPE_INGREDIENT_GRAPH` | `THIRD_PARTY_RIGHTS`（ASA24=米国 NCI/NIH 由来）+ `LICENSE_APPLICABILITY` + `CONTENT_SCOPE` |
| B（Primary） | Health Canada — Food Source Contribution Table (2015 CCHS) / Foods and Ingredients | `REVIEW_REQUIRED` | `RECIPE_INGREDIENT_GRAPH` / `NUTRITION_REFERENCE` | `LICENSE_APPLICABILITY`（dataset レベルで 1 回のみ表示）+ `CONTENT_SCOPE`。third-party は none で、**残るのは Rights の適用範囲確認**（CSV schema 確認は別の Data Completeness Gap） |
| C（Primary） | The National Archives (UK) — MAF 102/15 (1) Recipes for cakes with no eggs | `REVIEW_REQUIRED` | `HISTORICAL_RECIPE` / `DISCOVERY_ONLY` | `LICENSE_APPLICABILITY`（この記録固有の OGL v3.0 適用表示が無い + 古い Crown 著作物の複製範囲未検証）+ `ACTUAL_RESOURCE` + `CONTENT_SCOPE`。**scan 未文字起こしは Rights ではなく Data Completeness Gap** |

**RIGHTS_CLEAR_CANDIDATE: 0 / REVIEW_REQUIRED: 3 / RESEARCH_ONLY: 0 / REJECTED: 0**。
Optional Target（Asian recipe dataset, Scientific Data/Figshare）は今回調査していない（§6 で明示的に
optional・今回は Primary Target A/B/C の深掘りを優先）。

---

## Target A — Health Canada: Healthy Eating Food Index 2019

- Record: `29892c85-2ff5-484c-873c-f494ffba6e1b`。Portal 表示: Publisher = Health Canada、
  Licence = **Open Government Licence - Canada**（dataset ページに 1 回のみ表示。resource ごとの
  個別表示はない）。
- **OGL-Canada 本文（一次資料 `open.canada.ca/en/open-government-licence-canada` を確認）**:
  複製・改変・翻訳・翻案・再配布・商用利用を含め自由。attribution は既定文言
  「Contains information licensed under the Open Government Licence – Canada」。
  **「Information Provider がライセンスできない第三者の権利」は明示的に対象外**。
- **ACTUAL DATA（Data Dictionary を直接確認）**: `Recipe Breakdown` / `ASA24 Recipes HEFI` の実フィールドは
  `FoodCode`（recipe id）/ `Main_Food_Description`（recipe 名）/ `IngCode`（ingredient id）/
  `Ingredient_description` / `IngWeight`・`TotalRecipeWeight`（g）/ 栄養カテゴリ内訳。
  **調理工程・下準備・servings のフィールドは無い** → Capability は `RECIPE_INGREDIENT_GRAPH`
  であって `FULL_RECIPE` ではない（"Recipe" という名前だけで判断しない — §13 test 7）。
- **THIRD-PARTY RIGHTS（一次資料で確認）**: "ASA24" が database source として本文中に繰り返し登場。
  ASA24 は**米国 NCI（国立がん研究所）が Westat 社に委託開発した米国連邦のツール**（`epi.grants.cancer.gov/asa24/`
  で確認。USDA の AMPM と Baylor College of Medicine の FIRSSt を土台にしている）。
  Health Canada が OGL-Canada の下でこの米国由来の food-code 体系を再配布してよいと明言した記載は
  見つかっていない。
- **結論**: 「Portal に Licence: Open Government Licence - Canada と表示されている」だけで
  `RIGHTS_CLEAR_CANDIDATE` へ変更していない（§2 の指示どおり）。third-party signal（ASA24=米国 NCI/NIH）が
  具体的に確認できたため `thirdPartyRights: 'unresolved'`、かつ dataset レベルの licence 表示が
  この特定 resource まで及ぶか確認できないため `recipeApplicability: 'unclear'`。→ `REVIEW_REQUIRED`。

## Target B — Health Canada: Food Source Contribution Table (2015 CCHS Nutrition)

- Record: `b166b1c1-0313-4706-8cca-f464f6fc7086`。Publisher = Health Canada、
  Licence = Open Government Licence - Canada。"Foods and Recipes"（料理全体）と
  "Foods and Ingredients"（構成食材へ分解）の 2 系統。データ源は **2015 Canadian Community Health
  Survey (CCHS) - Nutrition**（Health Canada 自身の全国調査）。
- **THIRD-PARTY RIGHTS**: Target A のような確認済み第三者起源の signal は見つからなかった
  （`thirdPartyRights: 'none'`）。
- **ACTUAL DATA**: dataset 説明ページ（一次資料）は「Foods and Ingredients: 料理を構成食材へ分解」と
  明記するが、実際の CSV / PDF Data Dictionary（79.1 kB）のフィールド一覧までは本 MISSION で
  個別に開いて確認できていない → `recipeApplicability: 'partial'`（confirmed ではない）。
  調理工程への言及は無く、栄養素・食品群の寄与分析が目的の dataset → Capability は
  `RECIPE_INGREDIENT_GRAPH` / `NUTRITION_REFERENCE`。
- **結論**: commercialUse / modification / attribution / thirdPartyRights はすべて確認済みで、
  **残る Gap は「実際の CSV / PDF Data Dictionary を開いてフィールド構造を確認する」の 1 点のみ**。
  4 候補中もっとも `RIGHTS_CLEAR_CANDIDATE` に近い。→ `REVIEW_REQUIRED`（`RECIPE_APPLICABILITY_NOT_CONFIRMED` のみ）。

## Target C — The National Archives (UK): MAF 102/15 (1)

- 「うちの郷土料理」の英国版に相当する、戦時中の卵不使用ケーキ・ビスケットレシピ集（スキャン画像）。
- **OGL v3.0 本文（一次資料 `nationalarchives.gov.uk/doc/open-government-licence/version/3/` を確認）**:
  複製・公表・頒布・送信・翻案・商用/非商用活用を許可。attribution は既定文言。
  個人データ・政府ロゴ/紋章・軍の記章・**第三者知的財産権**・特許/商標/意匠権・身分証明書類が対象外。
- ページ本体（一次資料）にはこの記録固有の third-party クレジット表示は確認されなかった
  （`thirdPartyRights: 'none'`）。
- **ACTUAL DATA**: ページは The National Archives の解説文＋歴史文書のスキャン画像で構成され、
  **材料・分量・手順はページ本文に書き起こされておらず、拡大画像でのみ閲覧できる**。
  → `recipeApplicability: 'partial'` の**理由は RIGHTS**（この記録固有の OGL v3.0 適用表示が無く、
  古い Crown 著作物の複製範囲を未検証。`photoApplicability: 'separate'`）。
- **DATA COMPLETENESS GAP（RIGHTS とは別）**: 材料・分量・手順はスキャン画像内にのみ存在し文字起こし
  していない（AI 画像認識で自動生成しない方針）。これは `recipeApplicability` の理由ではない。
- **結論**: §5 の指示どおり RIGHTS / DATA COMPLETENESS / PRODUCT VALUE を分離して評価。
  Capability = `HISTORICAL_RECIPE` / `DISCOVERY_ONLY`。→ `REVIEW_REQUIRED`（`RECIPE_APPLICABILITY_NOT_CONFIRMED`）。

---

## Gap Model — Rights ≠ Completeness ≠ Product Value（MISSION 2.41F-2A）

MISSION 2.41F-2 の Documentation / Completion Report で **Rights Evidence Gap** と
**Data / Recipe Completeness Gap** の記述が一部混同していたため整理した（gate の分類結果は不変。
昇格なし・real Recipe import なし）。

3 系統を `RecipeSourceCandidate` の別フィールドとして分離:

| 系統 | 格納先 | 例 |
|---|---|---|
| **A. RIGHTS GAP** | `blockingReasons`（gate 出力）+ `evidenceChainMissingLinks()` | `LICENSE_APPLICABILITY` / `THIRD_PARTY_RIGHTS` / `CONTENT_SCOPE` / `ATTRIBUTION` / `COMMERCIAL_USE` / `MODIFICATION` |
| **B. DATA / RECIPE COMPLETENESS GAP** | `dataCompletenessGaps?: string[]` | 実 CSV schema 未確認 / ingredient amount が g のみ / servings なし / cooking steps なし / scan 未文字起こし |
| **C. PRODUCT VALUE GAP** | `productValueNotes?: string[]` | 歴史資料で現代の家庭料理 Starter Pack には向かない |

`gapSeparationFor(candidate)` が 3 系統を分けて返す（`rightsGaps` は識別子のみで、散文の data gap は
絶対に混ざらない）。`hasUnresolvedRightsGap(candidate)` は Rights Gap が 1 つでも残れば `true`。

**原則**: `CSV schema が分かる ≠ Licence applicability confirmed`。`scan untranscribed` は Completeness Gap
であって Rights failure ではない。逆に Rights Applicability 不明なのに「政府データだから」で PASS もしない。

| Source | RIGHTS GAP | DATA COMPLETENESS GAP | PRODUCT VALUE NOTE |
|---|---|---|---|
| Health Canada HEFI 2019 | `LICENSE_APPLICABILITY`（dataset レベルの licence 表示がこの resource へ及ぶか未確認）+ `THIRD_PARTY_RIGHTS`（ASA24=米国 NCI/NIH 由来）+ `CONTENT_SCOPE` | 実 CSV 全体未確認 / amount は g のみ・servings/steps は元データに無い | 栄養計算用の食材構成であり調理可能レシピではない |
| Health Canada FSCT | `LICENSE_APPLICABILITY`（licence は dataset レベルで 1 回のみ表示）+ `CONTENT_SCOPE`（third-party は none） | 実 CSV / PDF Data Dictionary 未オープン / 調理工程・servings は元データに無い | 材料構成 Knowledge Graph には使えるが FULL_RECIPE ではない |
| UK National Archives MAF 102/15 | `LICENSE_APPLICABILITY`（この記録固有の OGL v3.0 適用表示が無い + 古い Crown 著作物の複製範囲未検証）+ `ACTUAL_RESOURCE`（downloadable resource なし）+ `CONTENT_SCOPE`（`photoApplicability=separate`） | scan 画像を人手で文字起こししていない（AI 画像認識で自動生成しない方針） | 戦時中の歴史資料。現代の家庭料理 Starter Pack としての実用性は限定的 |

**整合性修正の要点**: FSCT の「残る Gap は CSV field 構造の確認 1 点のみ」という以前の記述は不正確だった。
CSV schema が確認できても RIGHTS GAP（`LICENSE_APPLICABILITY` / `CONTENT_SCOPE`）は解消しない。
UK MAF の「実データ未抽出」は `recipeApplicability: partial` の理由ではなく Data Completeness Gap。

## Rights Evidence Chain（§9）

`evidenceChainMissingLinks(candidate)` が SOURCE_ORGANIZATION / SOURCE_RECORD / ACTUAL_RESOURCE /
LICENSE / LICENSE_URL / COMMERCIAL_USE / MODIFICATION / ATTRIBUTION / LICENSE_APPLICABILITY /
THIRD_PARTY_RIGHTS / CONTENT_SCOPE のうち欠落している link を返す。3 候補とも 1 つ以上欠落があり、
`RIGHTS_CLEAR_CANDIDATE` にしていない。

| Candidate | 欠落 link |
|---|---|
| Health Canada HEFI 2019 | `LICENSE_APPLICABILITY`, `THIRD_PARTY_RIGHTS` |
| Health Canada FSCT | `LICENSE_APPLICABILITY`, `CONTENT_SCOPE` |
| UK National Archives MAF 102/15 | `LICENSE_APPLICABILITY`, `CONTENT_SCOPE` |

## Source Capability Model（§7 / §8）— Rights とは独立

`RecipeSourceCapability`: `FULL_RECIPE` / `RECIPE_INGREDIENT_GRAPH` / `NUTRITION_REFERENCE` /
`FOOD_SAFETY_REFERENCE` / `CULINARY_IDENTITY_REFERENCE` / `HISTORICAL_RECIPE` / `DISCOVERY_ONLY`。
`RecipeSourceCandidateInput.capabilities?`（optional・複数可・MISSION 2.41F の既存 3 候補は無変更のまま
`undefined` で残る）。「Rights-clear だが FULL_RECIPE ではない」（例: Health Canada は将来
「家にある食材 → 料理候補」の Food Graph に使える可能性がある — §15）を表現できる。

## Attribution Preview（§10）— 正式文言ではない

`buildAttributionPreview(candidate)` が Evidence（organization / name / licenseType / licenseUrl）から
導出できる範囲だけで `{ source, dataset, licence, licenceUrl?, modifiedNote }` を組み立てる。
正式な文言は Evidence から確認できるまで推測で確定しない。

## Firewall（MISSION 2.41F から継続）

- `recipe-source-deep-candidates.ts` は Verification / Allergy / Matching / AI / Import Pipeline の
  いずれも import しない。
- `isEligibleForImportPipeline()` は本 MISSION でも常に `false`。
- `WorldFoodSource` 登録簿・`SourceRecipeKnowledge` fixture（tori/buta 2 件）は無変更。
- MISSION 2.41F の実 Candidate 3 件（Wikibooks Cookbook / TheMealDB / USDA MyPlate）も無変更。
- real Recipe import = 0 を維持。

## 今後の Next Action

- **Health Canada FSCT（Target B）が最有力**（third-party signal なし）。ただし独立した 2 系統の作業が要る:
  - **RIGHTS**: resource ページ / Health Canada へ、dataset-level の OGL-Canada 表示がこの
    "Foods and Ingredients" resource に適用されるかを確認（`LICENSE_APPLICABILITY` / `CONTENT_SCOPE`）。
    これが解決して初めて `recipeApplicability` を `confirmed` にできる。
  - **DATA COMPLETENESS**: FSCT Data Dictionary（PDF）と CSV を開いてフィールド定義を確認（Capability 精緻化）。
    これは RIGHTS Gap を解消しない。
- **Health Canada HEFI 2019（Target A）**: ASA24（米国 NCI/NIH）由来 food-code 体系の再配布条件を
  Health Canada または NCI に確認する必要がある（RIGHTS）。解決すれば同じ dataset の他 resource にも波及する。
- **UK National Archives（Target C）**: RIGHTS — The National Archives へ MAF 102 シリーズ / scan の
  再利用条件が OGL v3.0 の対象かを確認。DATA COMPLETENESS — scan の人手文字起こし。両者は独立に進められる。
- 引き続き MAFF 回答（MISSION 2.41E）を待ちつつ、Optional Target（CC BY / CC0 の Asian recipe
  dataset 等）や他の公的機関オープンデータを External Research で追加探索する余地がある。
