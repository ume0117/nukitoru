# NUKITORU World Recipe Import Pipeline (MISSION 2.37)

MISSION 2.35（World Food Knowledge Foundation）と MISSION 2.36 / 2.36A（Source Discovery &
Rights Audit）を接続し、**「権利・出所を確認できない Recipe Data は NUKITORU Knowledge へ入れない」**
最小 Import Pipeline。実データの大量取り込みはしない — 安全な「入口」を型・純粋関数・最小 Fixture・
テストで成立させる。

## パイプライン

```
RAW SOURCE DATA
  │  外部の JSON / API レスポンス / スクレイプ結果など（NUKITORU の外）
  ▼
normalizeRecipeCandidate()      文字列 trim + cookingSteps を order 昇順にするだけ。
  │                              単位換算・翻訳・欠落補完・range midpoint 化は一切しない。
  ▼
RawRecipeImportCandidate        staging object。SourceRecipeKnowledge ではない。
  │                              `as SourceRecipeKnowledge` での cast は禁止。
  ▼
evaluateRecipeImportRights()    RIGHTS GATE（fail-closed・決定論的）
  │                              SOURCE RIGHTS ≠ RECORD RIGHTS ≠ ASSET RIGHTS
  ▼
resolveImportIdentity()         IDENTITY RESOLUTION（完全一致のみ・fuzzy 禁止・新規生成禁止）
  │
  ▼
promoteCandidateToSourceKnowledge()
  │  料理事実を verbatim コピー。imageUrl は転写しない。
  │  evidenceSourceId = WorldFoodSource.sourceId、importProvenance を設定。
  ▼
SourceRecipeKnowledge (+ importProvenance)
  │
  ▼
buildPresentation()（MISSION 2.35）
  ▼
NukitoruPresentation           Source に無い fact を追加しない（heat unknown → unknown 等）
```

`importRecipeCandidate(candidate, { sourceRegistry?, identityRegistry?, importedAt })` が
上記を一気通貫で実行し、`RecipeImportResult`（`{ ok: true, knowledge, identity, decision }`
または `{ ok: false, reasons, decision? }`）を返す。**例外に依存せず、監査可能な reason を返す。**

## SOURCE RIGHTS ≠ RECORD RIGHTS ≠ ASSET RIGHTS

```
WorldFoodSource            Source 全体の default rights（利用規約 / ライセンス / 政府規約 由来）
  └─ WorldFoodSourceRecordRights   個々の Recipe。rightsOverride があれば source より優先
       └─ ASSET（画像・逐語 prose）  Recipe facts とは完全に別。本 MISSION では画像を扱わない
```

### Rights Inheritance（`resolveEffectiveRights`）

- record の `rightsOverride` に設定された flag のみ **record-override** 由来。
- それ以外は **source-default** 由来。
- source 由来値が `unknown` でも勝手に変えない（fail-closed は Rights Gate が担う）。
- `EffectiveRecipeRights.resolvedFrom` に各 flag の由来を記録（監査用）。

### Rights Gate の通過条件（すべて満たす）

| 対象 | 条件 | 満たさない時の reason |
|---|---|---|
| Source | registry に登録されている | `SOURCE_NOT_REGISTERED` |
| Source | classification ≠ `do-not-ingest` | `SOURCE_DO_NOT_INGEST` |
| Source | classification が `unknown` の場合、record override で `structuredFactStorage=allowed` | `SOURCE_CLASSIFICATION_UNKNOWN` |
| Source | classification が `research-only` の場合、同上 | `SOURCE_RESEARCH_ONLY` |
| Source | `checkedAt` が存在（一次確認日） | `SOURCE_RIGHTS_CHECK_DATE_MISSING` |
| Record | provenance（sourceId / sourceRecordId / sourceUrl）が揃う | `RECORD_PROVENANCE_MISSING` |
| Record | `rightsStatus` ≠ `do-not-ingest` | `RECORD_RIGHTS_DO_NOT_INGEST` |
| Record | `rightsStatus` ≠ `unknown` | `RECORD_RIGHTS_UNKNOWN` |
| Record | `rightsCheckedAt` が存在 | `RECORD_RIGHTS_CHECK_DATE_MISSING` |
| Record | `thirdPartyRights` ≠ `unresolved` / `unknown` | `THIRD_PARTY_RIGHTS_UNRESOLVED` |
| Effective | `structuredFactStorage === 'allowed'` | `STRUCTURED_FACT_STORAGE_{PROHIBITED,UNKNOWN,CONDITIONAL_UNMET}` |
| Identity | `canonicalRecipeId` が WorldRecipeIdentity へ完全一致 | `IDENTITY_UNRESOLVED` |

**重要**:
- `commercialUse: allowed` **だけでは Import を許可しない**。核心条件は `structuredFactStorage === 'allowed'`。
- `aiMlUse` は **Import 可否の条件にしない**（別 dimension）。値は decision に保持するが、Pipeline は AI 処理を一切しない。
- この MVP では `structuredFactStorage: 'conditional'` は通さない（`allowed` のみ）。conditional の
  個別条件評価は将来の拡張。

## RIGHTS EVIDENCE ≠ CULINARY EVIDENCE

| | RIGHTS EVIDENCE | CULINARY EVIDENCE |
|---|---|---|
| 問い | このデータを保存・利用してよいか | この分量・工程・時間の根拠は何か |
| 型 | `WorldFoodSource` / `WorldFoodSourceRecordRights` / `RecipeImportProvenance` | `RecipeEvidenceSource`（EVIDENCE_SOURCE_CATALOG）/ `RecipeVerification` |
| import された knowledge | `importProvenance` に記録。`importedKnowledgeHasRightsProvenance()` で確認 | **未検証**。`sourceKnowledgeHasValidEvidence()` は false を返す |

利用権がある ≠ 料理として正しい。料理として信頼できる ≠ データを大量保存してよい。

## Importable ≠ …

- **Importable ≠ VERIFIED** — Pipeline は `RecipeVerification` を設定しない。`isRecipePublishable` を呼ばない。
- **Importable ≠ Publishable** — 同上。既存 `tori-teriyaki` / `buta-shogayaki` の VERIFIED 状態は不変。
- **Importable ≠ Allergy-safe** — Import は ingredient → allergen 関係を一切作らない（`soy sauce → wheat` の自動推測なし）。既存 Allergy Gate 不変。
- **Importable ≠ Practically validated** — `practicalCookValidation` を設定しない。既存 status 不変。
- **Importable ≠ AI-training permitted** — `aiMlUse: allowed` でも AI Pipeline へ送らない。model training / fine-tuning / embeddings / RAG / AI Original はしない。

## Firewall（import graph）

`world-recipe-import.ts` / `world-food-sources.ts` / `world-recipe-import-fixtures.ts` は次を
**import しない**（テストで固定）:
`recipe-publishability` / `recipe-safety` / `practical-cook-validation` / `recipe-catalog` /
`mock-meal-provider` / `recipe-suggestion-engine` / `from-now-to-table` / `ai-provider` /
`recipe-variant` / `recipe-time`。
`verifyRecipe(` / `publishRecipe(` / `fetch(` の呼び出しも無い。

再利用するのは MISSION 2.35 の `world-food-knowledge.ts`（`buildPresentationStep` /
`getWorldRecipeIdentityById` 等）と `world-recipe-identity.ts` のみ。

## Source Registry（`WORLD_FOOD_SOURCE_REGISTRY`）

MISSION 2.36 / 2.36A で **一次情報で確認できた rights だけ** を記載。`checkedAt` 未設定 = 未確認。

| sourceId | classification | structuredFactStorage | 状態 |
|---|---|---|---|
| `kr-mfds-cookrcp01` | `unknown` | `conditional` | 「이용허락범위 제한 없음」一次確認済みだが**運用審査未了 + 商用条件未確定** → 現状 Import 経路は通らない（MISSION 2.36A §16）。API key 取得も API 呼び出しもしない |
| `jp-maff-kyodo-ryori` | `use` | `allowed`（MAFF-held facts）| PDL1.0 = CC BY 4.0 互換。ただし record ごとに第三者「レシピ提供」の確認が必要。`imageReuse: prohibited`（別 asset） |
| `us-usda-myplate` | `unknown` | `unknown` | **Source 全体を Public Domain 扱いしない**（MISSION 2.36A §0.4）。grantee 由来 recipe が混在。record 単位でのみ判定 |
| `synthetic-cleared-open-source` | `use` | `allowed` | **SYNTHETIC・テスト専用**。`imageReuse: prohibited` / `aiMlUse: unknown` |
| `synthetic-scrape-dataset` | `do-not-ingest` | `prohibited` | **SYNTHETIC・テスト専用**（scrape 由来で再配布権なしを表す） |

## Fixtures（`world-recipe-import-fixtures.ts`）

**すべて SYNTHETIC**。含まれる「料理事実」は Rights Gate 検証専用のダミーで、実在の情報源に
基づかない。`SOURCE_RECIPE_KNOWLEDGE_FIXTURES`（MISSION 2.35 の実データ）には混ぜない
（テストで固定）。cookingSteps は「heat unknown を補完しない」「range を midpoint 化しない」等の
fact-preservation を確認できる最小構成。

| fixture | 期待 | 検証内容 |
|---|---|---|
| A | PASS | allowed source + allowed record |
| B | BLOCK | `STRUCTURED_FACT_STORAGE_UNKNOWN`（record override） |
| C | BLOCK | `THIRD_PARTY_RIGHTS_UNRESOLVED`（MAFF の第三者レシピ提供） |
| D | BLOCK | `SOURCE_DO_NOT_INGEST` |
| E | PASS（画像なし）| `imageReuse: prohibited` でも facts は Import 可能。`imageUrl` は Knowledge に入らない |
| F | PASS | `aiMlUse: unknown` でも Import 可能。AI 扱いにしない |
| G | PASS | source classification `unknown` + record override で federal 職務著作物と確認 → Import 可能 |
| H | BLOCK | MyPlate + "adapted from ONIE Project"（grantee 由来）→ `SOURCE_CLASSIFICATION_UNKNOWN` + `THIRD_PARTY_RIGHTS_UNRESOLVED` |
| I | BLOCK | `RECORD_RIGHTS_CHECK_DATE_MISSING` |
| J | BLOCK | `RECORD_PROVENANCE_MISSING`（sourceUrl 空） |
| K | BLOCK | `IDENTITY_UNRESOLVED`（rights は通過） |
| L | BLOCK | `RECORD_RIGHTS_UNKNOWN` |
| M | BLOCK | `SOURCE_NOT_REGISTERED` |

## この MISSION で作らなかったもの

DB / migration / API endpoint / admin UI / Cooking Mode / Matching Engine / scraper / crawler /
external API client / bulk importer / translation engine / embeddings / vector DB / AI Original /
自動単位換算 / Kitchen compatibility / image downloader / monetization。純粋関数中心。

## 次 MISSION（2.38）候補

1. Korea MFDS の利用申請 → 運用審査を通し、条件を一次確認できたら `kr-mfds-cookrcp01` の
   classification / rights を実際の確認範囲へ更新（審査結果次第で `use` + `structuredFactStorage: allowed`、
   または `conditional` のまま）。その上で 5–15 record の実 Import（API 呼び出しは別途 Commander 承認）。
2. `structuredFactStorage: 'conditional'` の個別条件評価（`RightsCondition` 型）。
3. Import された knowledge を「human culinary evidence review」へ回すワークフロー
   （Import ≠ VERIFIED から VERIFIED-track へ上げる導線）。
4. Wikidata（CC0）による ingredient canonical identity の拡張（未知 ingredient の解決率向上）。
5. Asset（画像）rights の別レイヤー実装 — ただし download / storage は引き続きしない。
