# NUKITORU FOOD — Rights-Clear Recipe Source Discovery (MISSION 2.41F)

「どの Recipe Source を商用サービスとして利用できるのか」を推測ではなく Evidence で判定する基盤。
MAFF の回答（MISSION 2.41E）を待つだけで開発を止めず、**別の Recipe Source** を探索・分類する。

> Source Discovery Candidate → Evidence Collection → Rights Classification → Import Eligibility Candidate
>
> **Source Discovery 成功 ≠ Recipe Import 許可。** ここで `RIGHTS_CLEAR_CANDIDATE` になっても、
> 実 Recipe の Import・`WorldFoodSource` 登録・Canonicalization・Matching・Presentation は
> 一切行わない（別 MISSION の判断）。

## Rights 判定モデル（`recipe-source-discovery.ts`）

**License が存在すること ≠ 対象 Recipe へその License が適用されること**（MISSION 2.41E から継続する原則）。

`RecipeSourceCandidateInput`（型は `types/index.ts`）は既存型を再利用する（新規 enum を乱立させない）:
- `commercialUse` / `modification`: 既存 `RightsFlag`（`allowed` / `conditional` / `prohibited` / `unknown`）
- `thirdPartyRights`: 既存 `ThirdPartyRightsState`（`none` / `cleared` / `unresolved` / `unknown`）
- `sourceType`: 既存 `WorldFoodSourceType`
- 新規（本 MISSION 固有）: `licenseType`（PDL1.0 / CC-BY-4.0 / CC0 / CC-BY-SA-4.0 / CC-BY-NC-4.0 系 3種 /
  all-rights-reserved / custom-government-license / custom-open-data-license / unknown）、
  `attribution`（required/notRequired/unknown）、`recipeApplicability` / `photoApplicability` /
  `externalContentApplicability`（License の**適用範囲**を Content 種別ごとに分離 — §11）

## Rights Gate（`classifyRecipeSourceCandidate` — 決定論的・純粋関数）

```
確定 REJECT:
  licenseType が CC-BY-NC 系（NUKITORU は商用サービスのため Primary Import Source として常に不可）
  commercialUse === 'prohibited'
  modification === 'prohibited'
        ↓ 上記に該当しなければ
RIGHTS_CLEAR_CANDIDATE ⟺ すべて満たす:
  commercialUse === 'allowed'
  AND modification !== 'prohibited'
  AND recipeApplicability === 'confirmed'
  AND thirdPartyRights ∈ {'none', 'cleared'}
  AND attribution !== 'unknown'
        ↓ gate 不通過
  licenseType === 'unknown' → RESEARCH_ONLY
  それ以外                  → REVIEW_REQUIRED（blockingReasons に理由を列挙）
```

- **`photoApplicability` / `externalContentApplicability` は gate 判定に使わない**（§11 content-scope
  separation）。画像や外部リンク Content の rights が unknown でも、Recipe Facts 側が確認できていれば
  `RIGHTS_CLEAR_CANDIDATE` になれる。ただし Recipe Facts 自体（`commercialUse` / `recipeApplicability`
  等）が unknown なら当然 block する。
- `buildRecipeSourceCandidate(input)` が `classification` / `blockingReasons` を導出する。手で矛盾した
  `classification` を作れない設計（`RecipeSourceCandidate` は `classifyRecipeSourceCandidate` の出力を
  必ず経由する）。
- `isEligibleForImportPipeline()` は常に `false` を返す boundary marker。`RIGHTS_CLEAR_CANDIDATE` でも
  Import Pipeline への接続は本 MISSION では行わない。

## Third-Party Rights Signal（§10）

`detectThirdPartyRightsSignal(text)` — 「提供 / 提供元 / 写真提供 / 資料提供 / 出典 / 監修 / 著者 /
レシピ提供 / 外部サイト / 転載 / © / Copyright」を検出する boolean 関数。**検出 = Signal の記録のみ。
allowed にも prohibited にも自動変換しない。** MISSION 2.41E の「レシピ提供元名：山形県」と同じ思想。

## 分類（Source Classification・`RecipeSourceCandidateClassification`）

| | 意味 |
|---|---|
| `RIGHTS_CLEAR_CANDIDATE` | 商用利用・改変・対象 Recipe への適用・第三者権利・attribution をすべて Evidence で確認できた（Import 許可ではない） |
| `REVIEW_REQUIRED` | ライセンスは確認できるが、適用範囲・第三者・attribution 等に不明点が残る |
| `RESEARCH_ONLY` | 料理の存在・名称等の調査には使えるが、Rights Evidence が commercial reuse には不足 |
| `REJECTED` | NonCommercial / 商用禁止 / 改変禁止等、NUKITORU 用途と明確に非互換 |

## 実 Recipe Source Candidate（`recipe-source-candidates.ts`）— 3 件調査・0 件 RIGHTS_CLEAR

External Research（本日の一次資料 WebFetch）に基づく評価。**無理に A 判定を作らない**——実際、3 件とも
`RIGHTS_CLEAR_CANDIDATE` ではない。これは失敗ではない（§14）。

| Source | Organization | License | Classification | 主な Blocking Reason |
|---|---|---|---|---|
| **Wikibooks Cookbook** | Wikimedia Foundation | CC BY-SA 4.0 | `REVIEW_REQUIRED` | share-alike（改変は同ライセンス公開義務）/ Cookbook 全体としての Recipe 完成度は page ごとで未確認 |
| **TheMealDB** | TheMealDB（独立運営） | Custom ToU（実質 all-rights-reserved） | `REJECTED` | 無料枠は商用・公開アプリでの利用を明示的に禁止（有料 Supporter 登録必須。NUKITORU は有料 API を前提にしない） |
| **USDA MyPlate Kitchen** | USDA (FNS) | unknown | `RESEARCH_ONLY` | 一次資料を本日取得できず（`ask.usda.gov` は TLS 証明書エラー、`usda.gov/about-usda/policies-and-links` は HTTP 403）。既存 grantee（州立大学 SNAP-Ed 等）由来 record の混在も未解決（MISSION 2.36A から継続） |

### Wikibooks Cookbook — 確認した Evidence

`https://en.wikibooks.org/wiki/Wikibooks:Copyrights` を WebFetch で確認: テキストは CC BY-SA 4.0（+
GFDL）。商用利用・改変・再配布は許可されるが、**改変・追加した内容は同ライセンスで公開する義務**（share-alike）。
出典（ページへのハイパーリンク等）必須。**非テキストメディア（画像等）は各メディア説明ページで別途ライセンス**
が定められ、テキストのライセンスを自動継承しない（`photoApplicability: 'separate'`）。個別レシピページの
分量・工程の記載充足度は page ごとに異なり、一律には確認できていない（`recipeApplicability: 'partial'`）。

**未解決の Product Decision**: share-alike 条件と NUKITORU の「Structured Facts 抽出 → 独自 UI 表示」
モデルをどう両立させるか（Fact 自体の著作物性は低いが、抽出・構造化の粒度次第では派生物として扱われ得る）。
今回は判断せず `REVIEW_REQUIRED` のまま保持する。

### TheMealDB — 確認した Evidence

`https://www.themealdb.com/terms_of_use.php` を WebFetch で確認: API を使ったアプリ開発はレート制限内で
許可されるが、**無料利用者は App Store 等へ公開すること自体ができない**。一般公開（商用・公開サービス化）
するには Patreon または PayPal の有料 Supporter 登録が必須。アートワークの大半はユーザー投稿のカスタム
作成物で権利者が一様に確認できない（`thirdPartyRights: 'unresolved'`）。

**判定根拠**: ライセンス名ではなく Terms 本文の商用条件（有料 Tier 必須）で `REJECTED` とした
（§4「ライセンス名だけで PASS/REJECT させない」）。CC BY-NC 系と同様、NUKITORU（商用サービス・有料 API
を前提にしない方針）の Primary Import Source としては不可。

### USDA MyPlate Kitchen — 確認できなかったこと（正直な記録）

`ask.usda.gov` の該当記事は WebFetch 時に TLS 証明書検証エラー、`usda.gov/about-usda/policies-and-links`
は HTTP 403（MAFF と同様の取得阻害パターン）。**検索結果の要約**には「元の USDA レシピは 17 USC §105
により連邦職務著作物として public domain」との言及があったが、**これは二次情報（検索エンジン要約）であり
そのまま Evidence として採用していない**（§1「検索結果 snippet だけで Rights 判定しない」）。また
「myplate.gov の MyPlate Kitchen は 2026年1月に RealFood.gov へ移行し、`myplate.food`（非 `.gov` ドメイン）
が引き継いでいる」との言及も一次資料で確認できず、`myplate.food` のライセンス主張は採用していない。
MISSION 2.36A で記録済みの「grantee（州立大学 SNAP-Ed 等）由来 record が混在し、17 USC §105 の PD が
自動適用されない record がある」という結論を維持し、`licenseType: 'unknown'` のまま `RESEARCH_ONLY` とした。

この Candidate は既存 `world-food-sources.ts` の `us-usda-myplate`（MISSION 2.37）と同一の実世界 Source
を指す Source-Discovery 層の再評価であり、**既存 `WorldFoodSource` 登録簿の内容は変更していない**。

## Content-Scope Separation（§11）

Rights 判定を Content 種別ごとに分離して保持できる: `recipeApplicability`（料理名・材料・分量・工程等の
Structured Facts）/ `photoApplicability`（写真）/ `externalContentApplicability`（外部リンク先 Content）。
Photo が `unknown` でも Recipe Facts が `confirmed` なら Recipe Facts 側は Gate を通過できる
（SYNTHETIC fixture で検証済み）。ただし **今回はいずれの実候補についても画像・外部 Content を利用しない**。

## Firewall

- `recipe-source-discovery.ts` / `recipe-source-candidates.ts` は `recipe-publishability` /
  `recipe-safety` / `practical-cook-validation` / `recipe-catalog` / `ai-provider` / `food-matching` /
  `world-food-knowledge` / `world-recipe-import` / `cooked-meal-record` を import しない（test で固定）。
- `RIGHTS_CLEAR_CANDIDATE` ≠ Recipe Import 実行 ≠ Recipe VERIFIED ≠ Allergy Safe ≠ Taste Verified
  （`RIGHTS_CLEAR_CANDIDATE_MEANING` に明記）。
- `isEligibleForImportPipeline()` は常に `false`。WorldFoodSource 登録簿・SourceRecipeKnowledge
  fixture は一切変更していない。
- 大量 Recipe Import はしていない（`RecipeSourceCandidate` は ingredients / steps を持たない —
  Source-level の Rights 評価のみ）。
- ネットワーク・スクレイピングの実装なし。Discovery は Claude Code が WebSearch / WebFetch で一次資料の
  URL を直接確認し、Evidence として URL・publisher・retrievedAt・短い要約のみを保持した
  （規約本文の大量コピーはしていない）。

## 今後の Next Action

- Wikibooks Cookbook: share-alike と NUKITORU の表示モデルの両立可否を Product Decision として検討。
  可能なら個別レシピページの Source Body 逐語確認（MISSION 2.41B 相当）へ進める。
- TheMealDB: 有料 API を前提にしない方針のため、Primary Source としては扱わない（Ingredient Discovery
  等の RESEARCH_ONLY 用途は別途検討の余地あり、今回は評価しない）。
- USDA MyPlate: ネットワーク到達性が改善した際に一次資料（`ask.usda.gov` / `usda.gov`）を再確認する。
  `myplate.food` は公式ドメインか確認できるまで一切参照しない。
- 継続して MAFF 回答（MISSION 2.41E）を待ちつつ、日本の他の公的機関・地方公共団体オープンデータ、
  海外の CC BY / CC0 dataset を External Research で追加探索する。
