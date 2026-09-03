# NUKITORU Bidirectional Food Matching Engine (MISSION 2.39)

決定論的・説明可能な双方向 Matching Engine の Foundation。完成 UI は作らない
（MISSION 2.40 でスマホ体験へ変換する）。

## 2 つの入口

```
A. Forward（順引き）:  家にあるもの → 渡された Recipe collection → 各 Recipe の Ingredient Availability Fit
B. Reverse（逆引き）:  選択 Recipe → listed ingredients → Stock 比較 → 家にある / 少ない / 足りない / 不明 / 曖昧
C. Meal Occasion:      breakfast / lunch / snack / dinner / late-night / bento（明示 metadata のみ）
```

## 最終原則

> 「たぶん作れる」を「作れます」へ勝手に変換しない。
> まず正確に、何があるか・何が少ないか・何がないか・何が分からないか・何が曖昧かを分ける。

- **EXACT MATCH は canonicalIngredientId の完全一致のみ。** 似ている ≠ 同じ / 親カテゴリ ≠ 持っている / 代用品 ≠ 一致 / UNKNOWN ≠ MATCH。
- **EXACT ≠ Quantity Sufficient。** `quantityStatus` は常に `NOT_EVALUATED`。個→g 換算・単位変換をしない。
- **LOW ≠ 必要量を満たす。** Identity は存在するが十分量は保証しない。
- **UNRESOLVED ≠ MISSING / AMBIGUOUS ≠ MISSING / AMBIGUOUS ≠ EXACT。**
- **missingCount には UNRESOLVED / AMBIGUOUS を混ぜない**（「あとN個」の安全計算）。

## Ingredient Match Classification（`classifyIngredientMatch`）

| class | 条件 | 主な reason code |
|---|---|---|
| `EXACT` | req 解決済み(id=R) + `id===R` の RESOLVED stock が `available` | `CANONICAL_ID_EXACT` |
| `LOW` | 同上 + stock が `low` | `STOCK_LOW` |
| `MISSING` | req 解決済み + 一致する available/low stock が無い | `STOCK_ABSENT` / `STOCK_EXPLICITLY_UNAVAILABLE` / `NON_EXACT_CANONICAL_ID` |
| `UNRESOLVED` | req の Identity が UNRESOLVED、または同名の未解決 stock があり不足と断定できない | `RECIPE_IDENTITY_UNRESOLVED` / `STOCK_IDENTITY_UNRESOLVED` |
| `AMBIGUOUS` | req の Identity 候補が複数、または candidateIds に R を含む AMBIGUOUS stock がある | `IDENTITY_AMBIGUOUS` |

すべての match に `QUANTITY_NOT_EVALUATED` が付く。

### Truth Table（固定）

| Recipe id | Stock | Result |
|---|---|---|
| potato | potato / available | `EXACT` |
| potato | potato / low | `LOW` |
| potato | potato / out(unavailable) | `MISSING` (STOCK_EXPLICITLY_UNAVAILABLE) |
| potato | onion / available | `MISSING` (STOCK_ABSENT, NON_EXACT_CANONICAL_ID) |
| potato | （在庫なし） | `MISSING` (STOCK_ABSENT) |
| potato | 同名の未解決 stock | `UNRESOLVED` (STOCK_IDENTITY_UNRESOLVED) |
| recipe 側 unresolved | — | `UNRESOLVED` (RECIPE_IDENTITY_UNRESOLVED) |
| recipe 側 ambiguous | — | `AMBIGUOUS` (IDENTITY_AMBIGUOUS) |
| tomato | cherry_tomato | `MISSING` / NON_EXACT（EXACT にしない） |
| chicken_thigh | chicken | `MISSING` / NON_EXACT（parent/child を EXACT にしない） |
| rice_cooked | rice_raw | `MISSING` / NON_EXACT（state を同一視しない） |

## Recipe Match Result（`RecipeFoodMatchResult`）

`{ canonicalRecipeId, recipeName（原文）, mealOccasions, mealOccasionKnown, ingredientMatches[],
exactCount, lowCount, missingCount, unresolvedCount, ambiguousCount, listedIngredientCount,
matchFlags[], reasonCodes[], missingCanonicalIngredientIds[] }`

`matchFlags`（観測できた事実のみ。`READY_TO_COOK` のような保証的名称は使わない）:
- `ALL_LISTED_IDENTITIES_PRESENT` = 全 listed requirement が EXACT または LOW（missing/unresolved/ambiguous がゼロ）
- `HAS_LOW_STOCK` / `HAS_MISSING_INGREDIENTS` / `HAS_UNRESOLVED_INGREDIENTS` / `HAS_AMBIGUOUS_INGREDIENTS`

`missingCanonicalIngredientIds` = 明示的に MISSING な canonical id（dedup+sort）。§38 Shopping boundary。

## Forward Matching + Availability Ranking

`matchRecipesFromStock(stockSnapshots, recipes, options?)` → `RecipeFoodMatchResult[]`（決定論的にソート済み）。
外部 Recipe 検索はしない — 渡された collection だけを評価する。

`compareByAvailabilityFit`（`options.occasionFilter` は §19 STRICT policy）:
1. `ambiguousCount` asc
2. `unresolvedCount` asc
3. `missingCount` asc
4. `lowCount` asc
5. `exactCount` desc
6. `canonicalRecipeId` asc（安定 tie-break）

**この順序は人気・美味しさ・健康・おすすめ度・品質ではなく、家にある Ingredient との availability fit だけ。**

### Score / Ratio を作らない（§35）

`4/5 listed identities` のような比率は計算可能だが「全 Ingredient の重要度が同じ」とは限らないため
`80%作れる` を作らない。`counts` だけで十分なので `score` / `ratio` / `percentage` フィールドは持たない
（テストで固定）。

## Reverse Matching

`evaluateRecipeAgainstStock(knowledge, stock, options?)` → `RecipeFoodMatchResult`
（`evaluateRecipeFoodMatch` は同義）。ingredient-by-ingredient の結果と各 count を返す。
2.40 が「✅ 家にある / ⚠️ 少ない / ❌ 足りない / ❓ 確認が必要」へ変換できる。

## Stock Adapter（既存 Stock を変更しない）

既存 `StockStatus`（`available` / `low` / `out`）は不変。`mapStockStatusToAvailability` で
`StockAvailabilityStatus`（`available` / `low` / `unavailable`）へ pure projection。
`toStockIngredientSnapshot` が MISSION 2.38 の `resolveWorldIngredientIdentity` で名前解決し
`FoodStockIngredientSnapshot` を作る。Stock schema そのものは触らない（§44）。

## Meal Occasion Foundation（`meal-occasion.ts`）

- `MealOccasion = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'late-night' | 'bento'`。
  **snack（おやつ）は 2.39 から正式 Foundation**（future placeholder ではない）。
- Meal Occasion は Recipe Identity ではない。同一 Recipe が複数 Occasion を持てる。
- **推測分類しない**（§18）: `卵料理 → breakfast`、`甘い → snack`、`ご飯もの → dinner` は禁止。
  `MealOccasionMetadata { occasions, source: 'explicit'|'trusted-source-metadata'|'nukitoru-reviewed', notes? }`
  として明示情報がある場合のみ設定。本 MISSION の fixture は **SYNTHETIC のみ**、実 Recipe には付けない。
- **未設定 = unknown**（§19）。unknown を breakfast 等へ自動分類しない。unknown は「その occasion に
  向かない」という意味ではなく「分類情報が無い」だけ。
- STRICT filter: `INCLUDED`（明示的に含む）/ `EXCLUDED`（明示的に含まない）/
  `EXCLUDED_FROM_STRICT_FILTER`（unknown）。
- **bento = お弁当 ≠ Food Safety Guarantee**（§21）。「冷めても安全 / 保存可能」を推測しない
  （Food Safety / Storage Evidence は別レイヤー）。

## Firewalls

- **Match ≠ VERIFIED / Publishable**（§24）: Result に verification 概念なし。既存 `tori-teriyaki` / `buta-shogayaki` 不変。
- **Match ≠ Allergy Safe**（§22）: ingredient→allergen 推測なし。既存 Allergy Gate 不変。`recipe-safety` / `ingredient-taxonomy` / `ingredient-allergens` を import しない。
- **Match ≠ Practical Validated**（§25）: `practicalCookValidation` を設定しない。
- **Match ≠ Rights Permission**（§23）: MISSION 2.37 Rights Gate を迂回しない。`world-recipe-import` を import しない。Rights BLOCK された candidate は Matching で昇格しない。
- **Substitution firewall**（§26）: 代用品を一切実装しない。`lettuce` vs `cabbage` は EXACT にしない。
- **Parent/Child firewall**（§27）: `parentCanonicalIngredientId` を Exact Matching に使わない。
- **Preparation State firewall**（§28）: `rice_raw` ≠ `rice_cooked`。`"boiled potato"` を `potato` へ寄せない。
- **Product Identity firewall**（§29）: 商品固有名を generic ingredient へ推測変換しない。
- **AI / Network firewall**（§24 gen.）: 乱数・現在時刻・fetch・embedding・vector・semantic を使わない。
- **Source Fact preservation**（§32）: `SourceRecipeKnowledge` / Stock を mutate しない。Derived Result のみ。

`food-matching.ts` / `meal-occasion.ts` / `food-matching-fixtures.ts` の import 禁止リストはテストで固定。
Matching Engine が再利用するのは MISSION 2.38 の `world-ingredient-canonicalization.ts` /
`world-ingredient-registry.ts` と `meal-occasion.ts` のみ。

## Fixture（`food-matching-fixtures.ts`）

**すべて SYNTHETIC**。12 の synthetic recipe（`syn-*`）+ 12 の stock snapshot fixture + SYNTHETIC の
`MEAL_OCCASION_METADATA_FIXTURES`。MISSION 2.35 の `SOURCE_RECIPE_KNOWLEDGE_FIXTURES` には混ぜない
（テストで固定）。`evidenceSourceId` は `synthetic-matching-fixture`。**タコライス専用ロジック /
タコライス fixture は存在しない**（テストで `/taco|タコライス/i` 不在を固定）。

## MISSION 2.40 への接続点

`toRecipeFoodMatchSummary(result)` → `RecipeFoodMatchSummary`（recipe identity / display name /
meal occasions / 各 count / matchFlags / missingCanonicalIngredientIds。**Cooking Steps を含めない**）。
2.40 はこれ + `SourceRecipeKnowledge` + `NukitoruPresentation` をスマホ UI へ接続する。

## タコライス将来接続（§40）

同じ generic engine で、`Recipe Identity: taco-rice` + rights/evidence-backed な Recipe Knowledge +
household stock が揃えば「家にある / 少ない / 足りない / 確認が必要」を算出できる。
`if (recipe === taco-rice)` のような料理専用 Matching logic は書かない。

## この MISSION で作らなかったもの

完成 UI / Cooking Mode / Shopping List UI / EC / ネットスーパー / GPS / notification / AI / LLM /
embeddings / vector / semantic / fuzzy / substitution / nutrition / calorie / allergen inference /
quantity conversion / unit conversion / serving conversion / recipe generation / external API /
scraper / crawler / DB / migration / analytics / billing。
