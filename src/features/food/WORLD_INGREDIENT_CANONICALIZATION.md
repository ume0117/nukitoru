# NUKITORU World Ingredient Canonicalization Foundation (MISSION 2.38)

「世界のレシピに登場する食材」と「ユーザーの在庫にある食材」を、**表示名の文字列一致では
なく同じ Canonical Ingredient Identity へ、安全・決定論的に接続する**基礎。

MISSION 2.39（双方向 Food Matching Engine）が、順引き（家にある食材 → 作れる料理）と
逆引き（作りたい料理 → 必要食材 → 家にある → 足りない）を同じ Canonical Ingredient Identity
上で実装できるようにする。

## 最終原則

> 名前が似ているから、たぶん同じ — をしない。
> 分かるものだけ、つなぐ。分からないものは、分からないまま残す。

推測より事実 / 生成より検証 / UNKNOWN は UNKNOWN のまま。

## 3 つの既存 ingredient レイヤーとの関係（統合しない）

| レイヤー | ファイル | 役割 | MISSION 2.38 |
|---|---|---|---|
| **allergy/search normalization** | `ingredient-normalization.ts` | 表記ゆれ → 日本語 canonical string（安全性クリティカル） | **触らない** |
| **allergy taxonomy** | `ingredient-taxonomy.ts` | broader/narrower（鶏もも肉 → 鶏肉。allergy coverage） | **触らない** |
| **multilingual identity** | `canonical-food.ts`（MISSION 2.11 E.1） | 表示名から独立した `CanonicalFoodId`（proof-of-structure） | **id 体系を再利用して発展** |

MISSION 2.38 の `WORLD_INGREDIENT_IDENTITY_REGISTRY` は `canonical-food.ts` の id
（`chicken` / `onion` / `rice_raw` / `rice_cooked`）と整合させ、**新しい id 体系を作らない**。

## Canonical Ingredient Identity（`WorldIngredientIdentity`）

```
{
  canonicalIngredientId,   // 既存 CanonicalFoodId 型。bare snake_case（potato, chicken_thigh, soy_sauce …）
  canonicalName,           // 識別用の固定名（表示名 ≠ Identity なので names[] とは別）
  names: [{ language, name, kind: 'canonical' | 'alias' }],  // 明示登録された事実のみ
  category?,               // 自由記述の最小情報（enum 化しない）
  parentCanonicalIngredientId?,  // 将来の親子関係の「境界」だけ。自動推論しない
  identityEvidence?: { reference, checkedAt, notes? },  // Identity Evidence（他の Evidence と混ぜない）
  notes?
}
```

## Normalization（`normalizeIngredientName`）

**「表記差を整える」だけ**。`raw.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')`。

- ✅ 全角→半角（NFKC）、大文字小文字、前後・連続空白
- ❌ stemming / 単複変換 / typo correction / 部分一致 / 自動翻訳 / AI synonym
- ひらがな↔カタカナは NFKC で統合されない → `じゃがいも` / `ジャガイモ` は**明示 alias** が必要

同じ入力（正規化後）→ 常に同じ出力（idempotent）。

## Exact Resolution（`resolveWorldIngredientIdentity(sourceName, language, registry)`）

| 結果 | 条件 |
|---|---|
| `RESOLVED` | 正規化後に完全一致した Identity が **ちょうど 1 件**（同一 Identity 内で複数名が一致するのも RESOLVED） |
| `UNRESOLVED` | 完全一致が **0 件**（近い食材へ寄せない） |
| `AMBIGUOUS` | 完全一致した**異なる** Identity が **2 件以上** → `candidateIds` に列挙し、**1 つも選ばない**（fail-closed） |

- `language` 指定時: その言語で登録された名前だけを照合。
- `language` 省略時: 全言語照合（AMBIGUOUS になりやすい）。
- `potato` を `language: 'ja'` で引いても解決しない（自動翻訳しない）。

## Recipe Ingredient との接続（`canonicalizeSourceIngredientKnowledge`）

入力: `SourceIngredientKnowledge`（MISSION 2.35 / 2.37 の型）。出力: `CanonicalizedSourceIngredient`
（`{ original, resolution, linked }`）。

- `original` は**一切変更しない**。
- `original.canonicalIngredientId` が既に設定済み → 保持（再解決しない）。
- 未設定 & `RESOLVED` → `linked` に `canonicalIngredientId` **だけ**を足す。
- `UNRESOLVED` / `AMBIGUOUS` → link しない（`linked` は元の値のまま）。**Import 失敗にしない**。
- `linked` は常に `sourceIngredientName` / `quantity` / `unit` / `semantics` / `preparationState` /
  `japaneseName` / `englishName` / `originalLanguage` / `role` を `original` と同一に保つ。

**Translation ≠ Canonicalization**: `"potatoes"` を canonical `potato` に link しても、
`sourceIngredientName` は `"potatoes"` のまま（`"じゃがいも"` に書き換えない）。

## 潰さないもの（variant / state / product）

| 別 Identity（同一にしない） | id |
|---|---|
| chicken ≠ chicken thigh | `chicken` / `chicken_thigh` |
| tomato ≠ cherry tomato | `tomato` / `cherry_tomato` |
| milk ≠ soy milk（名前に "milk" を含むが親子関係も無い） | `milk` / `soy_milk` |
| olive oil ≠ sesame oil | `olive_oil` / `sesame_oil` |
| pork ≠ pork shoulder | `pork` / `pork_shoulder` |
| rice (raw) ≠ cooked rice | `rice_raw` / `rice_cooked` |

- `parentCanonicalIngredientId` は将来の**境界**のみ。Matching では親子で自動一致しない。
- State/Preparation（raw / boiled / diced / peeled …）は Identity に含めない。
  `"boiled potato"` / `"ゆでじゃがいも"` は登録が無い → `UNRESOLVED`（`potato` へ寄せない）。
- Generic Ingredient Identity のみ。Specific Product Identity（`キッコーマン特選丸大豆しょうゆ` 等）は
  registry に入れない → `UNRESOLVED`。

## Firewalls（境界を壊さない）

- **Allergy**: `soy_sauce` が解決しても wheat / soy allergen を自動生成しない。Allergy Evidence は別レイヤー。既存 `ingredient-normalization.ts` / `ingredient-taxonomy.ts` / `recipe-safety.ts` を変更・import しない。
- **Substitution**: 「これが無ければこれで代用」を一切実装しない。Identity relation ≠ substitution permission。
- **Unit**: 単位変換をしない。`quantity` / `semantics` は SOURCE FACT として保持。MISSION 2.35 の `ProductUnitConversion` 境界を守る。
- **Rights Gate**: MISSION 2.37 の Rights Gate を迂回しない。Rights BLOCK された candidate は canonicalize しても BLOCK のまま。`world-ingredient-*` は `world-recipe-import.ts` を import しない。
- **VERIFIED / Practical**: Ingredient canonicalization ≠ Recipe VERIFIED / Publishable / Practically validated。`tori-teriyaki` / `buta-shogayaki` の状態は不変。
- **AI**: LLM / embedding / vector / semantic search / AI translation / AI synonym を使わない。全て deterministic pure function（`Math.random` / `Date.now` / `new Date` 不使用）。

`world-ingredient-canonicalization.ts` / `world-ingredient-registry.ts` /
`world-ingredient-fixtures.ts` の import 禁止リストはテストで固定。

## MISSION 2.39 向け interface

- `resolveWorldIngredientIdentity()` — 食材名 → identity（RESOLVED / UNRESOLVED / AMBIGUOUS）
- `canonicalizeSourceIngredientKnowledge()` — imported knowledge の食材を link
- `ingredientIdentitiesMatch(a, b)` — **exact canonical id 一致のみ** true（alias 曖昧一致・parent match しない）
- `classifyIngredientIdentityMatch(recipeSideId, stockSideId, flags)` → `EXACT` / `MISSING` / `UNRESOLVED` / `AMBIGUOUS`（Recipe Matching 自体は 2.39 で実装）

## Fixture

- `WORLD_INGREDIENT_IDENTITY_REGISTRY`: 22 Identity（野菜・香味 6 / 卵乳 3 / 肉 4 / 穀物 2 / 調味料 5 / 油 2）。既存 recipe（tori/buta）の食材 + 世界料理テスト用（potato / egg / garlic / tomato / rice）。巨大辞書ではない。
- `SYNTHETIC_AMBIGUOUS_REGISTRY`: 意図的に曖昧な 2 Identity（`synthetic_scallion` / `synthetic_leek` が同じ英語名を共有）。AMBIGUOUS 検証専用。本番 registry に混ぜない（テストで固定）。
- `SYNTHETIC_SOURCE_INGREDIENTS`: canonicalize 接続テスト用の `SourceIngredientKnowledge`。

## この MISSION で作らなかったもの

Recipe Matching Engine / 冷蔵庫推薦 / 逆引き / 不足食材計算 / Shopping List / substitutions /
similarity ranking / fuzzy matching / AI / embeddings / vector DB / translation API / external API /
nutrition / automatic allergen inference / unit conversion / recipe UI / database / migration /
タコライス Recipe。
