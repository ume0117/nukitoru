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
