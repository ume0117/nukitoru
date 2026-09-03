# NUKITORU FOOD — Recipe Evidence Pack Intake (MISSION 2.41A)

Claude Code が外部 Web Source を直接取得できなくても、**External Research Layer**（Claude Code の外部）で
確認された Official Source Evidence を**安全に受け取り**、推測せず・Rights を弱めず・既存 Import
Pipeline へ渡せるようにする Foundation。

> MISSION 2.41 は「Source 本文を Claude Code 環境から十分に確認できない」という STOP 条件に
> 正しく到達した。これは失敗ではなく Rights / Evidence Gate の Fail Closed である。
> MISSION 2.41A はその Input Channel を正式化して MISSION 2.41 を再開可能にする。

```
External Research Layer（Claude Code の外部）
  Official Source を開く / Source Body を確認 / Rights を確認 / Fact を抽出
        ↓
RecipeEvidencePack
        ↓ validateEvidencePack（Schema + Rights + Identity + Process + Completeness）
        ↓ canEnterRecipeImport（COMPLETE のときだけ true）
        ↓ toRawSourceRecord（PRESENT の Fact だけを値として渡す）
RawRecipeImportCandidate（MISSION 2.37）
        ↓ 既存 importRecipeCandidate（Rights Gate / Identity / Promote）
SourceRecipeKnowledge
        ↓ MISSION 2.38 Canonicalization → MISSION 2.35 Presentation
```

## 責務分離

| Layer | 責務 |
|---|---|
| External Research Layer | Official Source を開く・Source Body を確認・Rights 情報を確認・Fact を抽出・Evidence Pack を作成 |
| Claude Code（本 MISSION） | Evidence Pack 受領・Schema Validation・Completeness Gate・Rights Gate・Identity boundary・Import adapter・Canonicalization / Matching / Presentation boundary・tests |

**Claude Code は Evidence Pack に無い Recipe Fact を絶対に補完しない**（分量・時間・火加減・食材・
Substitution・Country・Cuisine・Meal Occasion・Allergen・Rights すべて）。AI Knowledge ≠ Evidence。

## `RecipeEvidencePack`（`recipe-evidence-pack.ts` / 型は `types/index.ts`）

`{ identity, source, rights, recipe, classification, provenance }`

- **これは `SourceRecipeKnowledge` ではない。** `as SourceRecipeKnowledge` / `as RawRecipeImportCandidate`
  の cast は禁止。validate → adapter を経由してのみ昇格する。
- **Commander / External Research Layer が渡した = 真実ではない**（`EVIDENCE_PACK_TRUST_MODEL`）。
  trusted / verified / rightsAllowed / publishable / practicallyValidated にしない。Pack 自体を検証する。

### Fact Presence State（§6）— `FactPresenceState`

| state | 意味 |
|---|---|
| `PRESENT` | External Research Layer が Source Body 上でその Fact を確認済み |
| `SOURCE_NOT_STATED` | Source Body を確認したが、その Fact について記載が無い |
| `NOT_CAPTURED` | Source Body 確認 / Evidence capture が未完了 |
| `CONFLICT` | 同一 Evidence scope 内に互いに両立しない Fact が存在 |

**`SOURCE_NOT_STATED`（情報源が沈黙）≠ `NOT_CAPTURED`（まだ調べていない）** を必ず区別する（§18）。
Source が火加減を書いていないだけなら `SOURCE_NOT_STATED` として保持でき、Recipe は必ずしも INCOMPLETE
ではない。まだ heat 欄を調べていないなら `NOT_CAPTURED` であり INCOMPLETE。

### `EvidenceFact<T>`（§7）

`{ status, value?, conflictingValues?, evidenceReference?, notes? }`

- `PRESENT` → `value` 必須
- `SOURCE_NOT_STATED` / `NOT_CAPTURED` → `value` 禁止（default 値へ変換しない・空文字でごまかさない）
- `CONFLICT` → 単一確定 `value` にしない。`conflictingValues` に複数候補をそのまま保持
- **conflict averaging 禁止（§8）** — 水400ml + 水600ml から 500ml を生成しない。「一般的にはこのくらい」で解決しない。

`factHasValidShape(fact)` がこの形状ルールを判定し、違反は `FACT_PRESENCE_INVALID` として検出される。

### Rights（§9〜§11）— 既存 `RightsFlag` を再利用（新 enum を作らない）

`{ sourceRightsStatus, recordRightsStatus, structuredFactStorageStatus, verbatimTextStatus,
imageAssetStatus, thirdPartyIndication?, thirdPartyRightsReview?, rightsEvidenceReference?, rightsNotes? }`

- **SOURCE ≠ RECORD ≠ ASSET**。SourceRights が allowed でも RecordRights / ImageAssetRights は自動 allowed にならない。
- **third-party クレジット検出 = 自動 SKIP は禁止（§10）**。
  検出 → record-level rights review が必要 → `thirdPartyRightsReview`:
  `'cleared'` なら継続 / `'unresolved'` なら hard block（fail-closed）/ それ以外は review pending（INCOMPLETE）。
- `prohibited` / `unknown` / 条件未充足の `conditional` は IMPORT_READY 不可（§11・fail-closed）。
- **rights hard block は `evidenceMethod === 'official-source-body-review'` のときのみ**行う。
  要約からは RIGHTS_BLOCKED を判定しない（full review が前提）。例外: 登録済み source の
  `classification === 'do-not-ingest'` は要約でも hard block。
- Pack が source 登録簿より広い権利を主張したら `RIGHTS_CLAIM_EXCEEDS_SOURCE`（§4）。

### Evidence Completeness（§12〜§19）— `EvidenceCompletenessResult`

優先順位（安全側・強いブロックが勝つ）:
`RIGHTS_BLOCKED` > `INCOMPLETE` > `IDENTITY_REVIEW` > `PROCESS_REVIEW` > `COMPLETE`

| result | 意味 | Import |
|---|---|---|
| `COMPLETE` | 次の Import 段階へ渡せる情報が揃っている。**≠ Verified / Publishable / Practical Validated / Allergy Safe**（§13・`EVIDENCE_PACK_COMPLETE_MEANING`） | 可 |
| `INCOMPLETE` | Source URL / Organization / Recipe Name 欠落、必須 Evidence が NOT_CAPTURED、Primary Process Anchor 不足、source 未登録、third-party review pending、要約のみ 等 | 不可 |
| `RIGHTS_BLOCKED` | `prohibited` / `unknown` / 条件未充足 `conditional`、do-not-ingest source、third-party unresolved、EXCEEDS_SOURCE | 不可 |
| `IDENTITY_REVIEW` | `candidateCanonicalRecipeId` が未設定 / 登録簿に無い。**料理名の類似で Identity を決めない**（§16） | 不可 |
| `PROCESS_REVIEW` | ingredient / amount / step / heat / time / completion cue / servings 等に `CONFLICT` | 不可 |

`canEnterRecipeImport(pack)`（§19・pure）= `validateEvidencePack(pack).result === 'COMPLETE'`。

### Import adapter（§20 / §21）— `toRawSourceRecord(pack)`

`COMPLETE` の Evidence Pack のみ `RawRecipeImportCandidate`（MISSION 2.37）へ変換する。

- **Fact を生成しない。** `PRESENT` の Fact だけを値として渡す。
- `SOURCE_NOT_STATED` を default 値へ変換しない（field を省略する）。
- `NOT_CAPTURED` / `CONFLICT` は COMPLETE なら現れない（validate が弾く）。防御的に `ok:false`。
- `canonicalIngredientId` は付けない（§22。Canonicalization は Import 後に MISSION 2.38 pipeline が
  RESOLVED / UNRESOLVED / AMBIGUOUS を判定する）。
- `recordRights` を組み立て、既存 `importRecipeCandidate` の Rights Gate で**再度**検証される（二重ゲート）。

`runEvidencePackImport(pack, { importedAt })` は adapter → `importRecipeCandidate` を一気に通す便宜関数。
Fact を一切生成・補完しない。

### Boundary

- **Matching（§23）** — `evidencePackCanEnterMatching(pack)` は COMPLETE 以外 false。
  Matching Truth（MISSION 2.39）自体は変更しない。
- **Presentation（§24）** — `evidencePackIsNotPresentation()` は boundary marker。
  順序は Evidence Pack → Import → Canonicalization → Knowledge → Presentation。
  Evidence Pack ≠ `NukitoruPresentation`。

## Firewall（§25〜§27 / §38 / §39）

- `recipe-evidence-pack.ts` / `-fixtures.ts` は `recipe-publishability` / `recipe-safety` /
  `practical-cook-validation` / `recipe-catalog` / `mock-meal-provider` / `recipe-suggestion-engine` /
  `from-now-to-table` / `ai-provider` / `food-matching` / `world-food-knowledge` / `cooked-meal-record`
  を import しない（tests で固定）。
- `RecipeVerification` / `PracticalCookValidation` / Allergy Gate / Matching Truth / Stock schema を
  一切変更しない（types は append-only）。
- Evidence Pack COMPLETE ≠ `RecipeVerification` VERIFIED（§25）。`verified: true` shortcut を作らない。
- Commander が Source を確認したこと ≠ Commander が実際に料理したこと（§26。Practical Validation は別）。
- Evidence Pack に Ingredient Fact がある ≠ Allergy 確認済み（§27）。
- scraper / crawler / browser automation / 403 bypass / proxy を実装しない。Source 取得は
  External Research Layer の責務（§38）。`fetch` / `new Date()` / `Math.random()` を使わない。
- AI で Ingredient / Amount / Servings / Heat / Time / Equipment / Completion Cue / Country / Cuisine /
  Meal Occasion / Allergen / Rights を補完しない（§39）。

## Storage（§41）

Evidence Pack を localStorage / DB へ保存しない。migration 不要。code / fixture / test / docs で Foundation を成立させる。

## MAFF Candidates（`recipe-evidence-pack-fixtures.ts`）— **まだ Import しない**

MISSION 2.41 §28〜§31 の 4 候補を Candidate Fixture として保持する。書いてよいのは Commander が
明示的に確認済みと述べた Fact だけで、それ以外はすべて `NOT_CAPTURED`（推測補完しない）。

| candidate | source | Commander 確認済み Fact | 現在の result |
|---|---|---|---|
| 肉じゃが（§28） | 農林水産省 めざましごはん `recipe112.html`（うちの郷土料理とは別・rights 監査未実施） | 4人分 / 主要食材 10 種の**名前** / 工程に「中火」「中火〜弱火」「約20分」 | `INCOMPLETE`（SOURCE_NOT_REGISTERED + 分量・手順 NOT_CAPTURED） |
| 芋煮 山形県（§29） | 農林水産省 うちの郷土料理 `imoni_yamagata.html`（レシピ提供元: 山形県） | 4〜5人分 / 里芋 500g / 水 800cc / 他 6 食材の名前 / 6 工程が存在 | `INCOMPLETE`（third-party review pending + 分量・手順 NOT_CAPTURED） |
| 呉の肉じゃが 広島県（§30） | 農林水産省 うちの郷土料理 `42_20_hiroshima.html` | 4人分 / 牛肉 160g / じゃがいも 6個 / 玉ねぎ 1個 / 糸こんにゃく 240g / 5 工程が存在 | `INCOMPLETE`（調味料分量・手順 NOT_CAPTURED）※通常の肉じゃがと同一 Identity にしない |
| けんちん汁（§31） | 農林水産省 うちの郷土料理（URL 未提供・page 存在のみ確認） | なし | `INCOMPLETE`（URL 欠落 + 全 Fact NOT_CAPTURED） |

**MISSION 2.41 再開に必要な External Research 入力**: 上表の各 candidate について、Source Body で確認した
`servings` / `ingredients`（全 Ingredient と分量）/ 番号付き `steps`（順序・火加減・時間・完成目安）/
`equipmentConditions` / `preparation` / third-party の利用条件 review 結果 / `candidateCanonicalRecipeId`
（WorldRecipeIdentity への完全一致 or 新規 Identity 登録）を `PRESENT` / `SOURCE_NOT_STATED` の
`EvidenceFact` として渡す。すべて揃い `evidenceMethod: 'official-source-body-review'` になれば
`validateEvidencePack` が `COMPLETE` を返し、既存 Import Pipeline へ流せる。

## Future Boundary（実装しない・docs のみ）

- **Sauce / Tare（§33）** — 将来 NUKITORU FOOD は完成料理だけでなく SAUCE / TARE / DRESSING / DIP /
  SEASONING_BASE を Food Knowledge 対象にする（「この肉、何味にしよう？」）。Evidence Pack schema を
  「完成料理しか表現できない」形へ過剰に固定しない。今回機能は作らない。
- **CHOI-TASHI / Flavor Variation（§34）** — 芋煮 + 七味唐辛子 のような Source-backed arrangement を
  将来 Primary Recipe とは別の独立 Knowledge として保持する。Primary Recipe ≠ CHOI-TASHI。
  巨大実装 / Matching / UI は作らない。
- **Product-specific Knowledge（§35 / §36）** — 特定商用商品 + ちょい足し。generic Ingredient ≠
  commercial Product。特定商品名を generic Ingredient へ正規化しない。Product Identity は将来別途設計。
  ちょい足しにも Evidence が必要（Manufacturer Official / Government / Professional Culinary / User Idea を区別。
  Official Arrangement ≠ User Idea ≠ Verified Recipe Fact）。

## 原則

NUKITORU は AI が知っている Recipe をそれっぽく表示するサービスではない。
なぜこの材料なのか・なぜこの分量なのか・なぜこの時間なのか を後から辿れる Food Knowledge を作る。
External Research Layer が調査する。Claude Code が安全に構造化する。Evidence が不足すれば STOP する。
**推測より事実。生成より検証。** ユーザーには、とことん簡単に。裏側では、とことん慎重に。
