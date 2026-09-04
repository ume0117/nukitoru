# NUKITORU FOOD — Real Recipe Evidence Manifest

External Research Layer が Official Source Body を逐語確認した実 Recipe Candidate の状態台帳。
各 Candidate は **Evidence / Rights / Identity / Process / Import を別々に**記録する（一つの status へ潰さない）。
Import できない Candidate も削除せず、`recipe-evidence-pack-fixtures.ts` に Evidence Pack として保持する。

判定コード・helper は `recipe-evidence-pack.ts`（`validateEvidencePack` / `evidencePackStateBreakdown` /
`evidencePackHoldReasons` / `canEnterRecipeImport` / `runEvidencePackImport`）。

---

## Batch #1 — EGG branch（MISSION 2.41B）

External Research：農林水産省「うちの郷土料理」の Source Body を逐語確認（`evidenceMethod: official-source-body-review`）。
**両 Recipe とも第三者提供元「近藤 惠津子（『食材選びからわかるおうちごはん』より）」**があり、
`thirdPartyIndication: true` / `thirdPartyRightsReview: 'not-reviewed'`。今回の Evidence だけで cleared にしない。

| # | Recipe | Source URL | Evidence | Rights | Identity | Process | Import | HOLD |
|---|---|---|---|---|---|---|---|---|
| A | 親子丼（東京都）`evp-maff-oyakodon-tokyo` | `.../menu/34_12_tokyo.html` | **COMPLETE** | **REVIEW_REQUIRED**（第三者提供 Recipe・record-level 未 review） | **RESOLVED**（`jp-oyakodon`／canonicalName「親子丼」exact 一致） | OK | **BLOCKED** | `HOLD_RECORD_RIGHTS_REVIEW` |
| B | 玉子焼き（東京都）`evp-maff-tamagoyaki-tokyo` | `.../menu/34_11_tokyo.html` | **COMPLETE** | **REVIEW_REQUIRED**（同上） | **REVIEW_REQUIRED**（玉子焼き の WorldRecipeIdentity 未登録・推論で作らない） | OK | **BLOCKED** | `HOLD_RECORD_RIGHTS_REVIEW`, `HOLD_IDENTITY_REVIEW` |

### A. 親子丼 — 確認済み Fact（§3〜§7）

- servings: `2人分`（PRESENT）
- ingredients（PRESENT、原文表記保持）:
  鶏もも肉 150g（一口大のそぎ切り）/ 醤油 小さじ1/2（**鶏肉の下味**）/ 酒 小さじ1/2（下味）/
  玉ねぎ 1/2個（100g）（縦半分→薄切り）/ 卵 2個（軽くほぐす）/ 三つ葉 4〜5本（2cm）/ だし 100ml /
  ご飯 2人分 / 醤油 大さじ1（**合わせ調味料**）/ 砂糖 大さじ1/2（合わせ調味料）/ みりん 大さじ1/2（合わせ調味料）
- **醤油は用途別に 2 エントリ（下味 小さじ1/2 ／ 合わせ調味料 大さじ1）。合算しない（§4）。**
- steps（5 手順・順序保持）: 下味 → だし+合わせ調味料を中火（turn-on）→ 蓋・2〜3分煮る（range 保持）・卵を回し入れ →
  卵の周囲が固まりかけたら火を止め（turn-off）・三つ葉・再び蓋・30秒蒸らす → 丼にご飯・具をのせる
- completion cue: 「鶏肉に火が通るまで」（**温度 Fact へ変換しない**）
- equipment: 鍋 / 蓋 / 丼（サイズ・材質は推測しない）
- **SOURCE_NOT_STATED**: preparation（独立した下準備セクション無し）/ recipe 全体 completionCues /
  country / cuisine / mealOccasions
- **推測しない（§6）**: 鍋サイズ・材質、食材/鍋の中心温度、全体の所要時間、事前準備の所要時間、追加加熱時間

### B. 玉子焼き — 確認済み Fact（§8〜§12）

- servings/unit: `1本分`（PRESENT）
- ingredients: 卵 2個 / だし 大さじ1 / 砂糖 大さじ1/2 / 塩 少々 / 醤油 少々 / 油 適宜
- **「少々」「適宜」を数値（g/ml）へ変換しない（§9）** — `culinary-term` semantics で保持
- steps（3 手順）: 卵を割りほぐし調味料を混ぜる → 卵焼き器に油・熱し余分を拭く・卵液1/4を流す・
  半熟で巻く・繰り返す → 巻きすで巻く・粗熱が取れるまで置く・切り分ける
- completion cue: 「周囲がかわいて半熟状になったら」/「粗熱が取れるまで」
- equipment: 卵焼き器 / 巻きす
- **SOURCE_NOT_STATED（§11）**: step2/step3 の heat（具体的火力レベル）・duration（加熱分数・休ませ時間）/
  preparation / recipe 全体 completionCues / country / cuisine / mealOccasions
- **NOT_CAPTURED は 1 つも無い**（Source Body を確認しているため、記載の無い Fact は SOURCE_NOT_STATED）

### Canonical Ingredient audit（§21・Rights とは独立）

MISSION 2.38 `WORLD_INGREDIENT_IDENTITY_REGISTRY` に対し explicit alias のみで解決:

| 状態 | 食材 |
|---|---|
| RESOLVED（9） | 鶏もも肉→`chicken_thigh` / 醤油→`soy_sauce` / 酒→`cooking_sake` / 玉ねぎ→`onion` / 卵→`egg` / ご飯→`rice_cooked` / 砂糖→`sugar` / みりん→`mirin` / 塩→`salt` |
| UNRESOLVED（3） | 三つ葉 / だし / 油 |
| AMBIGUOUS（0） | （なし） |

- `鶏もも肉` は generic `chicken` へ格下げしない（部位は別 Identity）
- `ご飯` は `rice_cooked`（`rice_raw` ではない）
- `油` は特定植物油（`olive_oil` / `sesame_oil`）へ substring 解決しない → UNRESOLVED
- `だし` は特定だし商品へ解決しない → UNRESOLVED
- Evidence Pack は intake 時に canonicalIngredientId を生成しない（§22）。上記は監査結果であり、
  実際の canonicalization は Import 後（＝ Rights clear 後）に既存 MISSION 2.38 pipeline が行う。

### 既存データとの分離（§18）

- MAFF Evidence Pack（`evp-maff-oyakodon-tokyo`）は既存 repo `Recipe` の `oyako-don`（`verification.status: 'review'`・
  Source 間 amount conflict 記録あり）とは**別レイヤー・別 id**。Fact を混ぜない・既存 review Recipe を「修正」しない。
- WorldRecipeIdentity `jp-oyakodon` には現在 SourceRecipeKnowledge が無い（tori / buta のみ）。
  Rights clear 後にこの MAFF Recipe を**単一 Primary Process Anchor**（MAFF・東京都・親子丼・近藤惠津子提供）として接続する。

---

## 保留 Candidate を前へ進めるために必要な入力

### A. 親子丼 — `HOLD_RECORD_RIGHTS_REVIEW`

第三者提供 Recipe（近藤 惠津子『食材選びからわかるおうちごはん』）の Structured Facts を
NUKITORU の商用サービス内で再利用してよいかの **record-level rights review**。
確認できたら `thirdPartyRightsReview: 'cleared'` にする → Evidence COMPLETE + Rights PASS + Identity RESOLVED
→ `canEnterRecipeImport` true → `runEvidencePackImport` で既存 Pipeline へ。
（確認できなければ `thirdPartyRightsReview: 'unresolved'` → `HOLD_RIGHTS_BLOCKED`。推測で cleared にしない。）

### B. 玉子焼き — `HOLD_RECORD_RIGHTS_REVIEW` + `HOLD_IDENTITY_REVIEW`

1. A と同じ第三者 rights review。
2. 玉子焼き（卵焼き）の `WorldRecipeIdentity` を `world-recipe-identity.ts` へ登録する Product Decision
   （料理名の類似・「卵料理だから」では作らない）。登録後 `candidateCanonicalRecipeId` を設定。

両方が満たされて初めて Import → Canonicalization → Knowledge → Matching → Cooking Mode へ進む。
それまでは Matching / Presentation / Cooking Mode / UI へ一切出さない（§23 / §24 / §26）。

---

## MAFF「うちの郷土料理」 Record Rights 分析（MISSION 2.41C）

コード: `source-rights-scorecard.ts`（`MAFF_KYODO_RYORI_RIGHTS_ANALYSIS` / `MAFF_KYODO_RYORI_CURRENT_DECISION` /
`SOURCE_SELECTION_SCORECARDS`）。**Claude Code は法的結論を生成しない。** Evidence / Missing / Reason /
Next Research を分離して保持するだけ（§8）。

### 追加 External Research Evidence（§2〜§5）

| scope | Evidence Found | Evidence Missing | 現時点 decision |
|---|---|---|---|
| **source-purpose** | MAFF ABOUT/TOP: 郷土料理のいわれ・歴史・レシピ・地域背景の DB を作成し情報発信。**家庭調理に限らず外食企業のメニュー化・食品製造企業の商品化・郷土料理の調査等への活用を明示的に案内** | その「活用の案内」は個別 Record（特に第三者 Credit つき）の商用 structured-fact reuse 許諾を確定しない | `conditional` |
| **record** | SEARCH & MENU: 47 都道府県 1,365 種を検索できる **Official Database**（Database existence の Evidence） | Database の存在は個々の Record の再利用権をまとめて clear しない。第三者提供 Record の record-level 商用再利用を示す明示 Evidence | `unknown` |
| **third-party** | 親子丼・玉子焼き: 「近藤 惠津子（『食材選びからわかるおうちごはん』より）」の提供元表示。他ページにも提供元名・書籍名・個人名の表示があることを確認 | 第三者提供元（個人 / 出版社）の structured-fact 商用再利用の利用条件。MAFF 掲載が第三者著作物の再利用許諾まで含むかの明示記述 | `unknown` |
| **asset** | ダウンロード画像は「リンク・著作権について」を確認し「農林水産省 うちの郷土料理」を出典明記、画像提供元表示がある場合はその提供元も記載、と案内（＝ Asset は独自の利用条件を持つ） | （今回不要 — 画像を利用しない） | `conditional`（ただし NUKITORU は今回画像を一切利用しない。Evidence Pack の `imageAssetStatus` は保守的に `prohibited` のまま **変更しない**） |

### 4 層の決定（§9〜§11）

1. **source-level decision**: MAFF は「うちの郷土料理」の活用を家庭調理だけに限定していない（外食メニュー化・食品商品化・調査を公式に推奨）。→ 商用利用に前向きだが `conditional`。
2. **record-level decision**: `unknown`。Database の存在は個別 Record の clearance ではない。
3. **third-party decision**: `unknown`。第三者 Credit のある Record の商用 structured-fact reuse が明示許諾されているとは今回の Evidence だけで確定しない。
4. **asset decision**: `conditional`（独自条件）。SOURCE ≠ RECORD ≠ ASSET を維持。今回画像は不使用。

- **commercial use evidence**: source-level に**あり**（外食・食品企業・調査への活用推奨）。record-level（第三者 Credit つき）には**なし（不足）**。
- **missing rights evidence**: 第三者提供元の利用条件 / MAFF 掲載が第三者著作物の商用再利用許諾を含むかの明示記述。
- **prohibited evidence**: **無い**。「許可 Evidence 不足」であって「禁止 Evidence」ではない（§11）。→ `PROHIBITED` にはしない。

### 現時点の Rights 状態（cleared へ変更禁止・§10 / §20）

- 親子丼: **Rights = REVIEW_REQUIRED / Import = BLOCKED**（`HOLD_RECORD_RIGHTS_REVIEW`）
- 玉子焼き: **Rights = REVIEW_REQUIRED / Import = BLOCKED**（`HOLD_RECORD_RIGHTS_REVIEW`, `HOLD_IDENTITY_REVIEW`）

### Rights Evidence Found / Missing / Next Research（§17）

**親子丼**
- Rights Evidence Found: source-level の商用活用推奨 / Official Database であること / attribution 対象が明確
- Rights Evidence Missing: 第三者提供 Record の商用 structured-fact reuse 許諾
- Next Research Action: §12-A（MAFF「リンク・著作権について」で第三者 Record の扱いを明示確認）→ 不足なら §12-C / §12-D

**玉子焼き**
- Rights Evidence Found: 親子丼と同じ source-level Evidence
- Rights Evidence Missing: 親子丼と同じ + 玉子焼きの `WorldRecipeIdentity` 未登録
- Next Research Action: §12-A/C の rights 確認 + 玉子焼き Identity 登録の Product Decision（Rights Source 戦略が決まってから — §16）

---

## Source Selection Scorecard（§14 — Research Prioritization のみ・Rights を自動決定しない）

`SOURCE_SELECTION_SCORECARDS`。**aggregate 数値スコアを持たない。** 各軸は
`strong` / `moderate` / `weak` / `unknown`（NUKITORU 採用にとっての明確さ・有利さ）。

| axis | 農林水産省「うちの郷土料理」 |
|---|---|
| Officiality | strong |
| Source Body Accessibility | moderate（External Research は本文確認可。Claude Code 直接 fetch は 403） |
| Structured Fact Completeness | strong |
| Commercial Use Clarity | moderate（source-level は前向き・個別 record は不明確） |
| Record Rights Clarity | **weak**（第三者 Credit つき record の再利用権が不明） |
| Third-party Rights Complexity | **weak**（個人名・書籍名 Credit が record ごとに異なる） |
| Asset Separation | strong |
| Attribution Requirements | moderate（MAFF + 提供元 attribution が必要） |
| Recipe Process Completeness | strong |
| Ingredient Coverage Utility | moderate（egg branch → 複数 Recipe へ分岐） |

**Research Note**: Source-level は商用利用に前向きだが第三者 Credit のある個別 Record は record rights が不明。
第三者 Credit の無い MAFF-held / 自治体提供 Record を優先すれば adoption コストが下がる（§12-D / §15）。

---

## Third-party-free Candidate Strategy（§15）

`source-rights-scorecard.ts` の `thirdPartyReviewSignalFor(rights)` / `partitionByThirdPartyReview(packs)` で、
`thirdPartyIndication !== true`（＝ レシピ提供元が MAFF 自身・自治体・公的機関、または第三者権利問題が少ない）
Candidate を機械的に識別できる。Claude Code は Web にアクセスしない — Candidate Evidence は External Research
Layer が提供する。現在の EGG branch 2 件はどちらも `needsThirdPartyReview: true`。

### 推奨 Next Action（§12 の A〜E）

- **第一候補: D**（第三者 Credit の無い MAFF-held / 自治体提供 Record を次 Batch 対象に切り替える）+ **A**（MAFF「リンク・著作権について」の明示確認）を並行。
- 親子丼・玉子焼きは HOLD のまま保持（削除しない）。Rights が明確な Official Recipe を優先し、レシピ数より信用を優先する（§13）。

---

## Batch #2 — 山形県 public-sector Record（MISSION 2.41D）

External Research：農林水産省「うちの郷土料理」の Source Body を逐語確認（`evidenceMethod: official-source-body-review`）。
**3 件とも レシピ提供元名 = 「山形県」= public-sector provider**（`classifyRecipeProvider` → `'public-sector'`。
2.41B の「近藤 惠津子（書籍より）」= private-individual + private-publisher とは**別分類**）。

コード: `source-rights-scorecard.ts`（`MAFF_LINK_COPYRIGHT_EVIDENCE` / `MAFF_YAMAGATA_PUBLIC_SECTOR_RIGHTS_ANALYSIS` /
`MAFF_YAMAGATA_CURRENT_DECISION` / `MAFF_YAMAGATA_SCORECARD` / `classifyRecipeProvider`）、
fixtures: `IMONI_YAMAGATA_EVIDENCE_PACK` / `NATTOJIRU_YAMAGATA_EVIDENCE_PACK` / `TAMAKONNYAKU_YAMAGATA_EVIDENCE_PACK`。

### 追加 Rights Evidence（§2〜§6）

MAFF「リンクについて・著作権」`https://www.maff.go.jp/j/use/link.html` 本文を確認:
- **General Rule**: MAFF コンテンツは特記されていない限り農水省に著作権が帰属し、権利表記がない限り **PDL1.0** に準拠して利用可能。
- **PDL1.0 scope**: 複製・公衆送信・翻訳・翻案を含め自由に利用でき **商用利用も可能**（ただし *PDL1.0 applicable content* が前提。第三者権利物には自動適用しない）。
- **attribution**: 利用時は出典を記載する。
- **modification disclosure**: 編集・加工して利用する場合は出典とは別に「編集・加工したこと」を記載。加工情報を、あたかも国・府省等が作成した情報であるかのように公表・利用しない。
- **third-party**: 第三者が権利を有していることを表示・示唆している場合、利用者側で確認する必要がある。

**§6 correction to 2.41C**: Source General Rule = PDL1.0 という Evidence が追加された。ただし既存データを allowed へ書き換えず、
**Source General Rule** と **Individual Record Applicability** を分離する。

### 4 層の決定（§7〜§22・cleared / allowed へ変更禁止）

| scope | 決定 | 主な理由コード |
|---|---|---|
| source-purpose | `conditional` | `PDL1_0_GENERAL_RULE` / `PDL_APPLICABILITY_PER_RECORD_NOT_CONFIRMED` |
| record | `unknown` | `PUBLIC_SECTOR_PROVIDER` / `NOT_PRIVATE_THIRD_PARTY` / `NO_SEPARATE_TERMS_OBSERVED` / `PDL_APPLICABILITY_TO_RECORD_NOT_EXPLICIT` |
| third-party | `conditional` | `PROVIDER_IS_PUBLIC_SECTOR` / `NOT_PRIVATE_COPYRIGHT_HOLDER` / `REVIEW_STILL_REQUIRED_FOR_PDL_APPLICABILITY` |
| asset | `prohibited` | `ASSET_SEPARATE` / `IMAGE_PROVIDER_DIFFERS_FROM_RECIPE_PROVIDER`（納豆汁の画像提供 =「やまがたの広報写真ライブラリー」≠ 山形県）/ `IMAGES_NOT_USED_THIS_BATCH` |

- **prohibited evidence は無い**（`isProhibited: false`）。「PDL applicability 未確認」＝「許可 Evidence 不足」であって「禁止」ではない（§10 / §11）。
- **public-sector provider（山形県）を private-party HOLD と機械的に同一視しない**（§21）。しかし「山形県だから allowed」にも自動変換しない。
- record-level PDL applicability の確認が済むまで **3 件とも Rights = REVIEW_REQUIRED**（§22 / §40）。

### Batch #2 候補の状態

| Recipe | Source URL | Provider | Evidence | Rights | Identity | Import | HOLD |
|---|---|---|---|---|---|---|---|
| 芋煮（山形県）`evp-maff-imoni-yamagata-v2` | `.../menu/imoni_yamagata.html` | 山形県（public-sector） | **COMPLETE** | **REVIEW_REQUIRED** | **REVIEW_REQUIRED**（`WorldRecipeIdentity` 未登録・Rights 未 PASS のため追加提案しない） | **BLOCKED** | `HOLD_RECORD_RIGHTS_REVIEW`, `HOLD_IDENTITY_REVIEW` |
| 納豆汁（山形県）`evp-maff-nattojiru-yamagata` | `.../menu/nattojiru_yamagata.html` | 山形県（画像は別提供元） | **COMPLETE** | **REVIEW_REQUIRED** | **REVIEW_REQUIRED** | **BLOCKED** | 同上 |
| 玉こんにゃく（山形県）`evp-maff-tamakonnyaku-yamagata` | `.../menu/tamakonnyaku_yamagata.html` | 山形県（public-sector） | **COMPLETE** | **REVIEW_REQUIRED** | **REVIEW_REQUIRED** | **BLOCKED** | 同上 |

**imported recipes: 0**。first real import success: **なし**（3 件とも全 Gate を通過せず）。Import Pipeline / Canonicalization /
Forward Matching / Reverse Matching / Cooking Mode boundary の E2E は**未実行**（Import 成功 Recipe が無いため — §28〜§32）。

### 確認済み Fact（要点）

- **芋煮**: 4〜5人分（range 保持）/ 里芋（皮つき）500g・板こんにゃく1/2枚・牛肉150g（脂身の多い部位が好ましい）・長ねぎ1本・**醤油 大さじ4（Source total・工程で STEP4 大さじ1 + STEP5 大さじ3 に分割。二重計上しない — §13）**・砂糖 大さじ1・1/2・清酒（日本酒）大さじ3・水800cc / 6 手順（順序保持）/ STEP3 に条件付き Fact「精粉こんにゃく=ゆでこぼし不要でもよい／生芋こんにゃく=ゆでこぼし必要」/ STEP4 heat は SOURCE_NOT_STATED（`turn-on` のみ）/ equipment 鍋。
- **納豆汁**: 5人分 / 納豆200g・豆腐1/5丁（80g）・いもがら8g・油揚げ2枚・こんにゃく1/5枚（50g）・きのこ適宜・山菜適宜・だし汁5カップ・味噌大さじ5・ねぎ10cm・せり少々 / **ゴボウ・人参・里芋は「好みで」= role `optional`（required へ昇格しない — §26）** / 8 手順 / STEP7「沸騰直前に火を止める」cue 保持 / 「味噌味はほんの少し濃いめ」「熱々を食べる」は taste/serving expression として notes のみ・Safety Fact へ変換しない / equipment すり鉢。
- **玉こんにゃく**: 4本分（skewer serving unit）/ 玉こんにゃく20個・醤油大さじ3・スルメイカ適量（role `optional`）・練り辛子適量（role `optional`）/ **串は equipment（Ingredient ではない — §27）** / 具体的火力・時間は SOURCE_NOT_STATED（§19）/ equipment 鍋・串。

### Canonical Ingredient audit（§25・Rights とは独立・Import 前なので参考）

| 状態 | 食材 |
|---|---|
| RESOLVED（2） | 醤油→`soy_sauce` / 砂糖→`sugar`（explicit alias のみ） |
| UNRESOLVED（多数） | 里芋 / 里芋（皮つき）/ 板こんにゃく / 牛肉（registry に beef なし）/ 長ねぎ（≠ 玉ねぎ）/ 清酒（日本酒）（≠ 料理酒 — §25）/ 水 / 納豆 / 豆腐 / いもがら / 油揚げ / こんにゃく / 玉こんにゃく（≠ generic konjac）/ きのこ（≠ 特定種）/ 山菜 / だし汁（≠ 特定だし商品）/ 味噌 / ねぎ / せり / ゴボウ / 人参 / スルメイカ / 練り辛子 |
| AMBIGUOUS（0） | （なし） |

Import 前のため実 canonicalization（MISSION 2.38）は未実行。上記は監査結果。

### CHOI-TASHI / future preparation candidate（§14 / §36）

- **七味唐辛子（芋煮）** — 将来の Source-backed CHOI-TASHI Evidence Candidate。Primary Recipe Fact へ混ぜない。今回実装しない。
- **洗い里芋（芋煮）** — future preparation-shortcut / product-state candidate。

### Batch #2 を前へ進めるために必要な入力（§60）

すべて `HOLD_RECORD_RIGHTS_REVIEW` + `HOLD_IDENTITY_REVIEW`。

1. **Rights（§12-A / §12-C）**: 都道府県が MAFF「うちの郷土料理」データベースへ提供した Record が MAFF の PDL1.0 grant の対象か、それとも山形県が別に権利を保持し別途許諾が必要かを、MAFF「リンクについて・著作権」/ コンテンツ利用条件、または山形県の郷土料理コンテンツ利用条件で明示確認する。PDL applicability が確認できれば Rights PASS（attribution =「出典：農林水産省／レシピ提供：山形県」+ 加工表示 を条件に）。確認できなければ REVIEW_REQUIRED を維持。
2. **Identity（§24）**: Rights PASS 後、`jp-imoni` / `jp-nattojiru` / `jp-tamakonnyaku` を `world-recipe-identity.ts` へ登録する Product Decision（MAFF Source で名称確認済み・既存 Identity と衝突なし）。
3. **Attribution provenance schema（§33）**: Import 時に必要な「Original Recipe Provider / PDL1.0 applicability / Required attribution 文字列 / Modification disclosure requirement」を構造的に追跡できる schema が現状の `RecipeEvidencePack` / `RecipeImportProvenance` に無い。Rights PASS で実際に import する際に、この最小 schema 追加を別途 Product Decision として行う（今回は無理な拡張をせず STOP）。

---

## MISSION 2.41E — Public-sector Record Rights Final Gap

追加 External Research：MAFF 別紙・山形県 Open Data 条件。コード: `source-rights-scorecard.ts`
（`MAFF_APPENDIX_THIRD_PARTY_EVIDENCE` / `YAMAGATA_OPEN_DATA_EVIDENCE` / `CONTENT_CATEGORY_SEPARATION` /
`MAFF_YAMAGATA_RIGHTS_MATRIX` / `LICENSE_INHERITANCE_RULE` / `MAFF_YAMAGATA_REMAINING_RIGHTS_GAP` /
`NUKITORU_STRUCTURED_FACT_SCOPE` / `NUKITORU_USE_CASE_SUMMARY` / `RIGHTS_INQUIRY_DRAFTS` /
`RIGHTS_CLEAR_SOURCE_KPI_CONCEPTS` / `ALTERNATIVE_SOURCE_PRIORITY`）。

### 核心（§31）: **License が存在すること ≠ 目的の Record へその License が適用されること**

- MAFF「リンクについて・著作権」→ **PDL1.0 general rule あり**（権利表記がない限り。出典 + 加工表示条件、国・府省作成と誤認させる利用禁止）。
- MAFF 別紙 `https://www.maff.go.jp/j/use/bessi.html` → 第三者権利の表示・示唆の**例示**（資料：○○ / 写真提供：○○ / ○○ホームページ / 出典：○○）。**「レシピ提供元名」は直接列挙されていない** → NUKITORU は「必ず第三者著作権」とも「権利表記ではない」とも断定せず **Review Signal**（`thirdPartyIndication: true`）として扱う。
- 山形県オープンデータカタログ `https://www.pref.yamagata.jp/.../opendata/index.html` → カタログ掲載データは注記があるものを除き **CC BY 4.0**。ただし**外部リンク先は Open Data ではなくリンク先の著作権に従う**（external-link boundary）。

### Content 区分の完全分離（§8）— License inheritance 禁止（§10）

| | Content | License |
|---|---|---|
| A | 山形県 Open Data Catalog 直接掲載 Data | CC BY 4.0（注記除く） |
| B | 山形県 Web Site 上の通常 Content | 山形県サイトの著作権の取扱いに従う（未確認） |
| C | **山形県が MAFF へ提供した Content（芋煮等）** | **NOT ESTABLISHED（本 MISSION の Gap）** |
| D | MAFF が自ら作成した Content | PDL1.0 general rule（権利表記がない限り） |
| E | 第三者 private provider Content（親子丼・玉子焼き = 近藤 惠津子・書籍） | record-level review required（2.41B HOLD） |

A が CC BY 4.0 でも B/C/D/E へ自動継承しない。**PDL1.0 と CC BY 4.0 を統合しない。有利な License を勝手に Recipe へ適用しない**（`LICENSE_INHERITANCE_RULE.prohibited === true`）。

### Rights Matrix（§9・`MAFF_YAMAGATA_RIGHTS_MATRIX`）

| subject | license evidence | 目的 Record への適用 |
|---|---|---|
| MAFF General Content | PDL1.0 general rule exists | `conditional` |
| MAFF content with no rights indication | potentially PDL1.0 applicable, subject to conditions | `conditional` |
| MAFF content with provider indication（芋煮等） | record-specific review required | `unknown` |
| Yamagata Open Data Catalog content | CC BY 4.0, subject to catalog terms | `unknown`（MAFF レシピには自動適用しない） |
| **Yamagata-provided MAFF Recipe（芋煮 / 納豆汁 / 玉こんにゃく）** | **license currently NOT ESTABLISHED** | `unknown` |

どの行も target record へ `allowed` を主張しない（test で固定）。

### 現在の Recipe 状態（変更なし・§11）

芋煮 / 納豆汁 / 玉こんにゃく: Evidence COMPLETE / Rights **REVIEW_REQUIRED** / Identity **REVIEW_REQUIRED** / Import **BLOCKED**。
親子丼 / 玉子焼き: 変更なし。allowed へ変更禁止（§5 / §25）。

### 残っている Rights Gap（§12）— 非常に限定された 2 問。どちらかが「はい」なら Rights PASS へ

- **Question A**: MAFF「うちの郷土料理」で「レシピ提供元名：山形県」と表示されている Recipe Record は、MAFF Website の PDL1.0 に基づいて商用サービスで利用可能な Content に含まれるか。
- **Question B**: 含まれない場合、山形県は MAFF へ提供した当該 Record の料理名・材料・分量・調理工程等の Structured Facts について、出典を明示し必要な加工表示を行う条件で、商用 Web Service での再利用を認めているか。

**resolved by**: MAFF または山形県への確認のみ（コード変更不要）。

### 再利用スコープ（§13・`NUKITORU_STRUCTURED_FACT_SCOPE`）

- 希望: 料理名 / 材料名 / 材料分量 / 人数 / 下準備 / 調理工程 / 火加減 / 時間 / 完成Cue
- 希望しない: Recipe 写真 / 動画 / イラスト / ロゴ / 文章の丸ごと転載 / 書籍本文 / 画像 Asset

### 問い合わせ Draft（§15〜§18 — **送信していない**。`RIGHTS_INQUIRY_DRAFTS.contactNotSent === true`）

> **MAFF 問い合わせ用**
> 農林水産省「うちの郷土料理」に掲載されている「レシピ提供元名：山形県」等の公的機関提供レシピについて、料理名・材料・分量・調理工程等を構造化し、出典を明示したうえで商用 Web Service 内で再構成して表示する場合、農林水産省 Web Site の PDL1.0 準拠利用条件の対象として利用可能でしょうか。写真・動画等は利用しません。編集・加工表示等、必要な表示条件があればご教示ください。

> **山形県 問い合わせ用**
> 農林水産省「うちの郷土料理」に掲載され、レシピ提供元名として「山形県」と表示されている芋煮・納豆汁・玉こんにゃく等について、料理名・材料・分量・調理工程等を構造化し、出典（農林水産省／レシピ提供：山形県）等を表示したうえで、商用 Web Service 内で再構成して表示することは可能でしょうか。写真・動画は利用しません。山形県オープンデータカタログの CC BY 4.0 が当該提供レシピにも適用されるか、または別の利用条件があるか、ご教示ください。

送信は External Research Layer / Commander が判断する。Claude Code は Draft のみ（メール / フォーム / 電話 いずれも実施していない）。

### Alternative Source Strategy（§19 / §20 — Discovery 実装なし）

Rights 問い合わせを待つ間も別 Source 探索は可能。優先条件: Official / Record-level License explicit / Commercial reuse explicit /
Structured Fact completeness high / No private third-party provider / No asset dependency / Attribution manageable。
候補形: Government Open Data / CC BY・CC0 Recipe Dataset / Official API with storage・reuse permission。
**Product Decision**: 1 Source に固執しない。MAFF の Rights 確認コストが大量 Recipe 拡張のボトルネックになるなら、より明示的に
Open License された Food Knowledge Source を Primary にし、MAFF は Supplementary / Regional Cuisine Source として利用する。

### Rights-clear Source KPI Concepts（§21 — 数値実装不要・`RIGHTS_CLEAR_SOURCE_KPI_CONCEPTS`）

Rights-clear Recipe Count / Evidence-complete Recipe Count / Canonicalizable Ingredient Coverage /
Process-complete Recipe Count / Stock-to-Dish Branch Coverage / Rights Review Cost per Recipe / Attribution Complexity。

### Attribution schema gap（§22 — 変更しない）

2.41D で発見した「Original Recipe Provider / License Applicability / Required Attribution / Modification Disclosure を
Import 後も構造的に保持する場所が無い」問題は今回も schema 変更せず。Rights PASS Recipe が 1 件確定した時点で
別 MISSION「ATTRIBUTION PROVENANCE MINIMUM SCHEMA」を実施する（先に schema を作りすぎない）。
