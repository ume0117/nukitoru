# NUKITORU FOOD — Smartphone Decision & Swipe Cooking UX (MISSION 2.40 / 2.40A)

> **⚠️ MISSION 2.40A で Home hierarchy・既存 Stock 連携・Completion Share を補正した。
> 末尾「MISSION 2.40A 補正」が本文の該当箇所（Completion の disabled ボタン、
> /food/decide の食材テキスト入力を Primary にしていた点）を supersede する。**

MISSION 2.35〜2.39 の Foundation を、初めてユーザー体験へ接続する。
高機能なレシピアプリを作るのではなく、**迷わず操作できる一本道** を作る。

> 探すときは楽しく。料理中は迷わずスワイプ。
> ユーザーには、とことん簡単に。裏側では、とことん慎重に。

## 一本道

```
今日、どうする？
  ├─ A. 家にあるもので作る（Forward）   ← Stock → MISSION 2.39 matchRecipesFromStock
  └─ B. 作りたいものから探す（Reverse） ← Recipe 選択 → evaluateRecipeAgainstStock
     → Recipe Detail
       → 「料理をはじめる」
         → Cooking Mode（1 画面 1 工程 / 左右スワイプ）
           → 完成 🎉
             → （完成後にのみ）気に入る / 覚える / また作る / みんなにシェアする
```

料理中は、指が濡れている・油が付いている・包丁を持っている・火を見ている前提。
**小さいボタンを狙わせない。長い文章を読ませない。何度も上下スクロールさせない。余計な機能を見せない。**

## Ingredient Match Presentation（`food-match-presentation.ts`）

MISSION 2.39 の Matching Truth をユーザー向けラベルへ写像。**内部区別は破壊しない。**

| 内部 (MISSION 2.39) | 表示 | 日本語 |
|---|---|---|
| `EXACT` | `at-home` | 家にある |
| `LOW` | `low` | 少ない |
| `MISSING` | `missing` | 足りない |
| `UNRESOLVED` | `needs-check` | 確認が必要 |
| `AMBIGUOUS` | `needs-check` | 確認が必要 |

- **`UNRESOLVED` ≠ `AMBIGUOUS`** — 表示は「確認が必要」へまとめるが、`RecipeMatchPresentation` は
  `unresolvedCount` / `ambiguousCount` を別々に保持し、各材料の `internalMatchClass` も元のまま。
- **「あと○個」= `missingCount` のみ**（`needsCheckCount` を混ぜない。`shoppingHint.missingCount`）。
- **Quantity Truth（§13）**: 「家にある」= EXACT は「必要量が十分」ではない。
  - `headline: 'ALL_LISTED_AT_HOME'` → 「材料はすべて家にあります（分量は未確認）」
  - 「十分あります」「これだけで作れます」を **文言で断定しない**（テストで固定）。
  - 各材料に `quantityNote: 'not-evaluated'`。
- **候補ゼロ（§40）**: 「作れる料理はありません」と断定しない →
  「現在登録されている料理の中では、条件に合う候補が見つかりませんでした」。
- **ranking の意味（§42）**: 「家にある食材との一致状況で並んでいます（おすすめ順ではありません）」。
  `rankingMeaning: 'availability-fit'`。「おすすめ」「AI が選びました」を出さない。

## Recipe Detail Presentation（`toRecipeDetailPresentation`）

`SourceRecipeKnowledge` + optional `NukitoruPresentation` / `RecipeFoodMatchResult` / `WorldRecipeIdentity`
から Derived。**Source Fact を一切変更しない**（一方向）。

- 名前 = `sourceRecipeName`（原文・翻訳しない）
- 国/地域 = `WorldRecipeIdentity` に `identityEvidenceSourceIds` がある場合のみ
- Meal Occasion = 明示 metadata がある場合のみ
- 人数 = `SourceRecipeKnowledge.servings?.displayText`（Source にある場合のみ）
- 分量 = `quantity.displayText` そのまま（単位換算しない）
- 事前準備 / 下準備 = `preCookPreparation` / `preparation` を別々に（既存 World Food Knowledge の区別）
- 工程 = `NukitoruPresentation.steps`（Source 由来の heat/time のみ）。無ければ `SourceCookingStep.factSummary`
- Evidence = `{ evidenceSourceId, imported }`（Matching state と混同しない）

## Cooking Mode / Swipe（`cooking-navigation.ts` + `CookingModeView.tsx`）

- **1 画面 = 1 工程**。`CookingStepView` は 1 step 分だけ（STEP n / N、heat、title、材料 action、instruction、目安時間、完成サイン、warning）。
- **Source にない heat / time を表示しない** — `CookingStepView` は `PresentationStep` の値をそのまま通す（`undefined` は `undefined`）。
- **左スワイプ → 次 / 右スワイプ → 前**（`classifySwipe`）:
  - `|deltaX| < 48px` → `none`（短い動き・誤タップを swipe にしない）
  - `|deltaY| > 0.6 * |deltaX|` → `none`（主に縦の動きは誤 navigation しない）
  - gesture library なし（`pointerdown` / `pointerup` の座標差のみ。`pointercancel` で破棄）。
- **境界安全**:
  - first step で `previous` → `currentIndex` は 0（負数にしない）
  - last step で `next` → `status: 'completed'`（completion boundary）
  - `completed` で `next` → 同一 session（boundary overrun なし）
  - `completed` で `previous` → 最終工程へ戻れる（レビュー可能）
- **補助ナビ**: 大きな `← 戻る` / `次へ →` ボタン（`min-h-[64px]`、full-width）。swipe できない環境 / keyboard / screen reader 向け。小さな target にしない。
- **縦スクロール最小化**（§19）: `flex-1 justify-center`。ただし情報を隠すために極端に小さい文字にはしない。
- **Cooking 中は隠す**（§36）: Share / Print / Favorite / Update / Settings / social / PRO / recommendation / unrelated nav。ヘッダは「進捗 + 中断」のみ。
- state は client のみ（`useState`。DB 保存なし。resume は別 MISSION）。
- `prefers-reduced-motion` 尊重（step 遷移 animation を多用しない）。

## Completion（`CookingModeView` の `Completion`）

- 最終 step 後に **明確な「完成！」状態**。Cooking Mode の終了点を曖昧にしない。
- **完成後にのみ** 二次アクション（`FoodDeferredAction`: `favorite` / `repeat` / `share` / `print`）を表示。
  本 MISSION では **boundary のみ**（`disabled` ボタン）。永続化・実処理は別 MISSION。
- Favorite ≠ Repeat Intent（好き/保存 ≠ 実際にまた作りたい）— 型で別概念として区別（`FoodDeferredAction`）。
- PRO boundary: Free/PRO の制限数・価格をコードに固定しない（Product Decision）。

## Share（`food-share.ts`）

- **既存パターンの再利用**: 既存の Share は `src/app/layout.tsx` footer のインライン `<a>`（X/Bluesky/Facebook/LINE intent URL）と
  `family-share.ts`（Web Share API → clipboard fallback）。`food-share.ts` は同じ URL パターン + 同じ fallback を
  pure function 化しただけ。新しい Share provider abstraction は作らない。
- **Fact のみ**: `buildFoodShareText({ recipeName, factualTags? })`。引数は料理名（原文）と、
  呼び出し側が明示的に渡す `factualTags` のみ。**在庫 / 家族 Preference / Allergy / 個人設定を含めない**（テストで固定）。
- **推測でタグを付けない（§30）**: `factualTagsFrom({ mealOccasions, cuisineLabelWithEvidence })` は
  **明示 Meal Occasion metadata** と **Evidence つきの料理圏ラベル** だけを受け取る。
  国 / occasion / ジャンルを料理名・食材から推測しない。
- brand tag: `#NUKITORU` `#NUKITORUFOOD`（`BRAND_HASHTAGS`）。
- Cooking 中には出さない。完成後 or Recipe Detail から。

## Print / Update / Recipe Growth（boundary のみ）

- **Print**: 既存に汎用 print component は無い（`window.print` の散発利用のみ）。本 MISSION では
  Recipe Detail の presentation model（名前 / servings / 材料 / 事前準備 / 下準備 / 作り方 / 出典）が
  そのまま print-friendly。外部画像・Source prose の丸ごと転載はしない（Rights Gate 尊重）。
- **Update / Changelog**: 既存 `src/app/changelog/page.tsx`（静的 `versions` 配列 + ページ）。
  FOOD 専用の重複 Update System を作らない。将来「新しい料理が増えました」等をここへ追記。
- **Recipe Growth（§34）**: fake count を出さない。実データ（現状 2 品）をそのまま表示。
  「今週○品増えました」は実 Recipe Data Expansion（MISSION 2.41）以降。

## Route / Component

- 新 route: **`/food/decide`**（静的・`robots: noindex`）。既存 `/food`（`FoodApp` = MISSION 2.11 系の
  mock meal provider flow）は **一切変更しない**。これは並行の新 UX。大規模 routing 再設計なし。
- Component: `WorldFoodDecideApp.tsx`（orchestrator）+ `CookingModeView.tsx`（swipe cooking）。
- Data: **MISSION 2.35 の実 Recipe Knowledge（`tori-teriyaki` / `buta-shogayaki`）のみ**を production 表示。
  SYNTHETIC fixture（`food-matching-fixtures.ts` の `syn-*`）は production UI に出さない。
- 在庫: `/food/decide` 内の軽量テキスト入力 → `projectStockToSnapshots`（client のみ）。
  既存 Stock persistence（`storage.ts` / `stock-status.ts`）を破壊しない。

## Firewalls

- MISSION 2.39 Matching Truth / MISSION 2.38 Canonicalization / Rights Gate / RecipeVerification /
  Allergy / Practical / Product Time / Process Coherence / Stock schema を一切変更しない。
- AI を使わない。乱数・現在時刻を ranking / navigation に使わない。
- Presentation → Source Fact の mutation 禁止（テストで固定）。
- `food-match-presentation.ts` / `cooking-navigation.ts` / `food-share.ts` は
  `recipe-publishability` / `recipe-safety` / `practical-cook-validation` / `recipe-catalog` /
  `recipe-suggestion-engine` / `mock-meal-provider` / `ai-provider` / `world-recipe-import` /
  `ingredient-*` を import しない（テストで固定）。

## MISSION 2.41 への接続点

`/food/decide` の UI は完成したが Recipe がほぼ無い。MISSION 2.41（Real Recipe Data Expansion）で
`Rights-confirmed source → real records → Import Pipeline → Canonicalization → Recipe Knowledge → Matching → NUKITORU FOOD`
の実データ拡張を進める。本 MISSION では大量 Recipe を入れない。

---

## MISSION 2.40A 補正 — Core UX Alignment（既存 Stock を主データにする）

NUKITORU FOOD の本筋は「レシピ検索」ではなく **「NUKITORU を見れば家にある食材が分かる。
その家にあるもので何が作れるか分かる」**。MISSION 2.40 の実装を捨てず、最小補正した。

### 既存 Stock persistence 再監査

- 登録済み食品名の出所: `loadPantry().staples` + `loadRegularFoods()` + `loadFrozenFoods()` +
  `loadPantryFoods()` + `Object.keys(loadStockStatus())`（すべて `storage.ts`、`safeGet` = 読むだけ・
  画面を開いただけで書き込まない）。
- 現在庫: `loadStockStatus(): Record<string, StockStatusEntry>`（item 名キー、`status: 'available'|'low'|'out'`、
  エントリ無しは既定 `available`）。

### Stock adapter（`food-matching.ts` に追加・pure）

- `persistedStockAvailability(statusMap, itemName)` — `available`→`available` / `low`→`low` /
  `out`→`unavailable`。エントリ無し/不正は既存 `getStockStatus` と同じ安全側 `available`。
- `projectPersistedStockToFoodSnapshots({ itemNames, statusMap }, registry?)` — 既存 Stock →
  `FoodStockIngredientSnapshot[]`。同名重複を除去。identity は MISSION 2.38 canonicalization
  （resolved は `canonicalIngredientId` 保持 / unresolved は `UNRESOLVED` / ambiguous は `AMBIGUOUS`。
  推測しない）。入力を mutate しない。
- `summarizeStockSnapshots(snapshots)` → `StockSummary`（available/low/unavailable/resolved/
  unresolved/ambiguous/total。**実データからのみ・fake count なし**）。

### Home hierarchy（PRIMARY / SECONDARY）

- **Stock サマリ表示**: 「家にあるもの N 品 ・ 少ないもの M 品」（`stockSummary` から。実データのみ）。
- **PRIMARY（最大 CTA、`min-h-[88px]` 塗り）**: 「🧊 家にあるもので作る」→ 既存 Stock が 1 件以上なら
  **追加入力なしで即 Forward Matching**（同じ食材を二度入力させない）。
- **Stock が空のときのみ**: 「まず、家にある食材を登録しましょう」+ `/food/stock` への大きな導線。
  空なのに Recipe 候補を生成しない。
- **SECONDARY（小さく下）**: 「作りたい料理が決まっていますか？ [🔎 料理名から探す]」。
- Occasion チップは PRIMARY flow の STRICT filter（metadata 不足で 0 件のときの説明を正確に）。
- 「今だけ追加」テキスト入力は Forward 画面の折りたたみ補助として残す（Primary flow から外した）。

### Completion Share を実動化

- `shareFood({ recipeName })`（Web Share API → clipboard fallback、`family-share.ts` と同型）。
- fallback / 追加として X / Bluesky / Facebook / LINE の intent リンク（`buildSnsShareUrls`。既存
  `layout.tsx` footer と同じ URL パターン）。
- **Favorite / Repeat / Print は未実装なので完成画面から隠す**（押せない UI を並べない）。
  `FoodDeferredAction` 型と本 doc の boundary 記述は残す（将来実装時に表示）。
- Share 本文: 料理名（原文）+ URL + `#NUKITORU #NUKITORUFOOD` のみ。在庫 / Allergy / Family /
  Preference / 個人設定を含めない（`FoodShareInput` は `recipeName` + `factualTags?` のみ・テスト固定）。
