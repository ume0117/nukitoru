# NUKITORU World Food Knowledge Principles

MISSION 2.35 で導入。NUKITORU FOOD の開発方針を「1レシピずつ NUKITORU VERIFIED 化してから
サービスを作る」から「世界にすでに存在する信頼できる料理知識を、Evidence と出典を保持したまま
構造化して学び、NUKITORU らしい『誰でもスマホで迷わず作れる料理体験』へ変換する」方向へ拡張する。

**本 MISSION は大量スクレイピング MISSION ではない。** まず「世界の料理知識を安全に受け入れられる
器」を作る。Discovery UI / Matching Engine / AI Original Recipe Generator は作らない。

## 10 の絶対原則

1. **料理を知ることと、料理を保証することは別。**
   Knowledge Source が存在する ≠ NUKITORU VERIFIED。Knowledge Source が存在する ≠ 実際に家庭で作りやすい。
2. **Source Recipe Knowledge ≠ NUKITORU Verified。**
   外部の信頼できる情報源から確認した料理事実（`SourceRecipeKnowledge`）は、既存の厳格な
   Verification Gate（`RecipeVerification` / `isRecipePublishable`）を通過した VERIFIED Recipe とは別物。
3. **NUKITORU Presentation は料理事実を変更しない。**
   `NukitoruPresentation` は Source の料理事実（分量・火加減・時間・器具・工程）を変えず、
   スマホで・片手で・料理中に 3 秒で理解できる形へ構造化した「表示」にすぎない。
   表示を分かりやすくしただけで Evidence が増えたことにしてはいけない。
4. **UNKNOWN は UNKNOWN。**
   情報源が「弱火」としか書いていないなら「弱火」。「3分」も「20cm フライパン」も「油100ml」も
   「強火に変更」も、情報源になければ勝手に追加しない。Source heat = UNKNOWN のとき
   Presentation heat = medium にならない（`buildPresentationStep` / `presentationStepViolations`）。
5. **Translation is not Evidence.**
   日本語訳・英語名は表示名であって、Recipe Identity を別 Recipe へ変えない。
   `japaneseName` / `englishName` / `localName` / `aliases` はすべて同一の `canonicalRecipeId` へ接続する。
6. **Calculation is not Culinary Evidence.**
   面積比で「20cm 用の油100ml → 26cm なら169ml」のような料理事実の生成は禁止。
   単位換算値（`ProductUnitConversion`）は SOURCE FACT（`sourceStatement`）と分離した Product Decision であり、
   情報源の原文表記は決して書き換えない。range を midpoint 化しない。
7. **Canonicalization is not Allergen Composition.**
   `canonicalIngredientId` を後付けしても、原文の食材名・分量・意味論は不変
   （`attachCanonicalIngredientId`）。「しょうゆ → 小麦」のような誤った Ingredient Taxonomy を作らない。
   既存 Allergy HARD EXCLUSION（`recipe-safety.ts` / `ingredient-allergens.ts`）は一切変更しない。
8. **Presentation must remain traceable to Source Facts.**
   すべての `PresentationStep` は `sourceStepReference` で `SourceCookingStep.order` へ、
   `SourceRecipeKnowledge.evidenceSourceId` で `EVIDENCE_SOURCE_CATALOG` の実在エントリへ辿れる
   （`tracePresentationStep`）。「なぜこの分量／時間なんですか？」に答えられる構造を維持する。
9. **The world already has great recipes. NUKITORU makes them easier to cook.**
   目標は「レシピを大量生成する AI」ではない。既存の良いレシピを、面倒だと思わせず、
   「料理って楽しい」「またNUKITORUを使いたい」と思える体験へ変える。
10. **日本人には世界の料理を。世界の人には日本の料理を。**
    世界中の料理を「私にも作れそう」に変える。どの方向の紹介も同じ Food Model・
    同じ Evidence 基盤の上で対等に扱う（食文化に上下関係はない。`GLOBAL_FOUNDATION.md` と一致）。

## 4 つの概念レイヤー（混同しない）

| レイヤー | 型 | 意味 |
|---|---|---|
| **A. SOURCE RECIPE KNOWLEDGE** | `SourceRecipeKnowledge` | 外部の信頼できる情報源から確認した料理事実。`evidenceSourceId` で `EVIDENCE_SOURCE_CATALOG` を参照 |
| **B. NUKITORU PRESENTATION** | `NukitoruPresentation` | A の料理事実を変更せず、スマホ向けに構造化した表示情報。Evidence を増やさない |
| **C. NUKITORU VERIFIED** | `RecipeVerification` / `isRecipePublishable` | 既存の厳格な Verification Gate。**本 MISSION で一切変更しない** |
| **D. AI ORIGINAL** | — | 十分な Evidence-backed Food Knowledge 蓄積後に着手。**本 MISSION では実装しない** |

## World Recipe Identity

`WorldRecipeIdentity`（`world-recipe-identity.ts` の `WORLD_RECIPE_IDENTITY_REGISTRY`）:
`canonicalRecipeId` / `canonicalName` / `localName` / `originalLanguage` / `country` / `region?` /
`cuisine?`（既存 `RecipeCuisine` を再利用）/ `japaneseName?` / `englishName?` / `aliases?` /
`identityEvidenceSourceIds?`。

- 表示名と Canonical Identity を混同しない。名称解決（`resolveWorldRecipeIdentity`）は
  trim + lowercase の**完全一致のみ**。fuzzy matching は一切行わない。
- Identity の登録（名称・由来）は SOURCE RECIPE KNOWLEDGE（分量・時間・工程等の料理事実）の
  Evidence には一切ならない。
- Locale ≠ Country ≠ Language ≠ Cuisine（`GLOBAL_FOUNDATION.md` と一致）。

## Cooking Knowledge Structure

`SourceCookingStep`: `order` / `factSummary?`（著作物性のある表現は転記しない）/ `ingredientsUsed?` /
`heat?`（`SourceHeatLevel`。示さなければ `unknown`）/ `heatTransition?`（`SourceHeatTransition`）/
`duration?`（`TimeValue`。既存 MISSION 2.15 の型を再利用。range を midpoint 化しない）/
`passiveDuration?` / `oilUsage?` / `liquidUsage?` / `lidUsage?` / `completionSign?`。

分量は既存 `QuantityStatement` / `QuantitySemantics`（MISSION 2.17B）を再利用する
（`displayText` は常に原文表記を保持、`semantics` に `exact` / `range` / `approximate` / `to-taste` /
`optional` / `unknown` / `culinary-term` を分離して保持）。

## PRE-COOK PREPARATION と PREPARATION の区別

- **PRE-COOK PREPARATION / 事前準備** (`SourceRecipeKnowledge.preCookPreparation`):
  調理開始「前」に時間が必要（解凍・常温戻し・漬け込み・炊飯・予熱）。`passiveWait` / `duration` は
  情報源が明示した場合のみ。
- **PREPARATION / 下準備** (`SourceRecipeKnowledge.preparation`):
  調理フロー「内」で行う（切る・混ぜる・計る）。

`sourceStatedTotalTime`（例: NHK「15分」）と `preCookPreparation`（例: 常温戻し約30分）は
**足し算しない**（15 + 30 = 45 のような arithmetic は一切しない。MISSION 2.26 Decision B と一致）。

## PRE-START KNOWLEDGE（section 11）

`PresentationPreCheckItem` の `kind`: `diners`（食べる人数）/ `servings`（作る量・食数。diners とは別）/
`ingredients` / `products` / `equipment` / `heat-source`（熱源。gas / IH 等）/ `ingredient-state`（食材の現在状態）/
`pre-cook-prep` / `prep` / `compatibility`（Recipe 条件との Compatibility）。本 MISSION では画面は作らない。

## Firewall（既存 Evidence / Safety への非結合）

`world-food-knowledge.ts` / `world-recipe-identity.ts` / `world-food-fixtures.ts` は次を
**import しない・読み書きしない**:
`recipe-publishability.ts` / `recipe-suggestion-engine.ts` / `recipe-catalog.ts` / `recipe-safety.ts` /
`practical-cook-validation.ts` / `mock-meal-provider.ts` / `from-now-to-table.ts` /
`RecipeVerificationStatus` / `PracticalCookValidation` / Allergy HARD EXCLUSION。

再利用するのは既存の Evidence 語彙のみ: `EVIDENCE_SOURCE_CATALOG`（`evidence-sources.ts`。純粋な data）/
`TimeValue` / `QuantitySemantics` / `QuantityStatement` / `CanonicalFoodId` / `Locale` /
`LanguageCode` / `CountryCode` / `RecipeCuisine`。

## Copyright / Data Rights Boundary

- 外部 Recipe 本文を大量コピーして保存する機能は作らない。外部 Recipe の文章表現を
  そのまま NUKITORU 本文として転載しない。
- 保存するのは原則として structured facts / source metadata / Evidence relationship /
  canonical identity / NUKITORU 独自 Presentation metadata のみ。
- `SourceCookingStep.factSummary` は「著作物性のある表現をそのまま転記しない事実の要約」
  （EVIDENCE_POLICY.md「Sources are for verification, not duplication」と一致）。
- 「構造化すれば何でも自由に利用可能」とは仮定しない。データソースごとの Terms / license /
  commercial-use allowance / attribution requirements / redistribution restrictions は
  次 MISSION 以降で Source Registry として管理する。権利が不明なデータを「使える」と断定しない。

## Sample Knowledge Fixtures（Schema / Pipeline 検証用）

- **World Recipe Identity Registry**: 日本 5（tori-teriyaki / buta-shogayaki / gyudon / oyakodon / misoshiru）
  ＋ 海外 4（Tortilla Española / aglio e olio / ratatouille / kimchi-bokkeumbap）。
  海外エントリは MISSION 2.35 本文が明示的に例示した料理のみ（発明ではない）。
- **SOURCE RECIPE KNOWLEDGE**: 2 件のみ（tori-teriyaki / buta-shogayaki）。いずれも既存 catalog で
  Recipe Evidence VERIFIED 済みの NHKきょうの料理・河野雅子の掲載事実を「新しい Knowledge 形へ
  構造化し直した」もの（同じ NHK source を指す・新しい Evidence ではない）。
- **NUKITORU PRESENTATION**: 上記 2 件から `buildPresentationStep` 経由で生成
  （料理事実を SOURCE からのみ導出する＝ FACTS MUST NOT CHANGE を構造で担保）。
- 架空の Recipe facts は入れない。国際料理の SOURCE RECIPE KNOWLEDGE は本 MISSION では未収録
  （Globalization Gap。非日本語の権威ある情報源を開いて確認する作業は次 MISSION）。

## Kitchen Compatibility（Foundation only — 監査結果）

既存 `PracticalCookValidation.environment`（`PracticalCookEnvironment`）は既に
`heatSource` (`'gas' | 'ih' | 'other' | 'unknown'`) / `panType` / `panSizeCm` / `ingredientStartingState` /
`thermometerUsed` を持つ（MISSION 2.33）。本 MISSION では `NukitoruPresentation.preCookChecklist` に
`heat-source` / `equipment` / `ingredient-state` の kind を追加し、将来 Cooking Mode が
「熱源は？」「道具は？」を確認できる余地を残した。**Kitchen Profile の大規模実装はしない。**
「Source が20cm なので26cm なら油169ml」のような面積比による料理事実の生成は禁止。

### 構造上の不足（次 MISSION への申し送り）

- `SourceRecipeKnowledge.equipment` は自由記述の `string[]`。pan/pot の径・oven/microwave/thermometer の
  有無を構造化した `SourceEquipmentKnowledge` 型はまだ無い（`PracticalCookEnvironment` とは別に、
  「情報源が前提とする器具」を machine-readable にする型が将来必要）。
- `PresentationPreCheckItem.compatibility` は kind のみ定義。実際の Recipe 条件 ↔ Kitchen Profile の
  照合ロジックは本 MISSION では作らない。
- 単位換算（`ProductUnitConversion`）は型のみ。実換算関数・osaji/kosaji ↔ ml のテーブルは未実装
  （意図的。無言換算を Evidence 化しないため）。
