# NUKITORU FOOD — Cooked Meal Record & Completion Photo (MISSION 2.40B)

「実際にこの料理を作った」という事実と「完成写真」を、**Recipe Evidence とは完全に分離して**
安全に記録する Foundation。

> 完成写真を撮ってもらう目的は NUKITORU のためだけではない。
> ユーザー自身にとって「自分が作った料理が残る」価値を最初に作る。
> その結果として Cooked Meal Records が自然に積み上がる。

## 8 つの別概念（絶対に同一 flag へまとめない）

| | 概念 | 型 |
|---|---|---|
| A | Recipe Evidence（このレシピの事実に根拠がある） | `RecipeVerification` / `RecipeEvidenceSource`（**変更しない**） |
| B | Cooked Meal Record（ユーザーが実際に完成させた記録） | `CookedMealRecord` |
| C | Completion Photo（完成した料理の写真） | `CompletionPhotoMetadata`（**画像バイナリを持たない**） |
| D | Household / Repeat Preference（この家庭で好き / また作りたい） | `RepeatIntent` |
| E | Share Action（外部 SNS へ共有した） | `food-share.ts`（既存） |
| F | Publication Consent（NUKITORU 内で他人に公開してよい） | `PhotoConsentState.publicationConsent` |
| G | Data Use Consent（集計・改善への利用許可） | `serviceImprovementConsent` / `aggregateAnalyticsConsent` |
| H | AI Training Consent（AI/ML 学習への利用許可） | `aiTrainingConsent` |

固定する分離（型・pure functions・tests・docs）:
- **Cooked Meal Record ≠ Recipe Verification** — 100 人が記録しても VERIFIED にならない。
- **Cooked Meal Record ≠ Practical Cook Validation** — Commander が正式に実施するものとは別。
- **Completion Photo ≠ Recipe Evidence ≠ Rights permission ≠ commercial reuse permission**。
- **Repeat Intent ≠ Taste Fact ≠ 「世界中の人に美味しい」** — Household Preference。
- **写真保存 ≠ 公開許可 ≠ SNS 共有 ≠ 分析許可 ≠ AI 学習許可**。
- **Share アクション ≠ Publication Consent。Upload ≠ AI Training Consent。**

## `CookedMealRecord`（`cooked-meal-record.ts`）

`{ id, canonicalRecipeId, recipeDisplayNameSnapshot, completedAt, evidenceSourceIdSnapshot?,
completionPhotoId?, repeatIntent?, createdAt }`

- `createCookedMealRecord(input, { now?, id? })` — 純粋関数。`now` を渡せば決定論的（既存 `buildMealDecision`
  と同じ方針）。id は `(now, canonicalRecipeId)` から決定論的に導出（外部乱数なし）。入力を mutate しない。
- **料理名から Recipe Identity を再推測しない** — `canonicalRecipeId` を保持。
- `recipeDisplayNameSnapshot` は「後で表示名が変わっても当時の記録が読める」snapshot 用途。
- `COOKED_MEAL_RECORD_MEANING` = 「NUKITORU で料理を最後まで進めた記録です。実際に食べたこと・
  美味しかったこと・レシピが正しいことを保証するものではありません。」— 完成画面に必ず表示。
- `withRepeatIntent(record, intent)` / `withCompletionPhoto(record, photoId)` — 非破壊。
- `countCookedByRecipe(records, id)` — 単なる件数。**Social Proof には使わない**（公開条件 / minimum
  cohort / privacy は別途決定。§24 No Fake Social Proof）。

### Record Truth（過剰解釈しない）

`CookedMealRecord` が意味するのは「**NUKITORU 上でユーザーが完成操作まで到達した**」という Product Event
だけ。「本当に食べた / 家族全員が食べた / 美味しかった / 安全だった / Recipe が正しかった /
再現可能だった」とは断定しない。

## `CompletionPhotoMetadata`（`completion-photo.ts`）

`{ id, cookedMealRecordId, localReference?, mimeType?, width?, height?, capturedAt?, createdAt,
visibility, consent }` — **画像そのもの（バイナリ）を持たない**。

- `createCompletionPhotoMetadata(input, { now?, id? })` — `visibility` は必ず `'private'`（引数で
  `public` を受け取らない）。`consent` は必ず全項目 `'not-granted'`。
- `localReference` は session 内の blob: object URL 等。**永続化しない**。
- `stripLocalReferenceForPersistence(meta)` — 保存前に `localReference` を必ず除去。
- `revokeObjectUrlReference(url)` — `blob:` のみ `URL.revokeObjectURL`。data:/http: は no-op。
- `replacePhotoLocalReference(meta, next?, mime?)` — 選び直し / 削除（`next=undefined`）。非破壊。
- `photoIsExcludedFromShareText()` — 「写真の存在が share text に影響しない」boundary marker。

### Consent Model

`PhotoConsentState { publicationConsent, serviceImprovementConsent, aggregateAnalyticsConsent,
aiTrainingConsent, recordedAt }` — **4 項目それぞれ独立**。`ConsentState = 'not-granted' | 'granted' | 'declined'`。

- `createPhotoConsentState(now, overrides?)` — default 全項目 `'not-granted'`（安全側）。
  個別に明示 override した項目だけが変わる。**単一 `consent: true` は存在しない。**
- `isFullyUnconsented(consent)` — 全項目 `'not-granted'` か。
- 本 MISSION では **同意画面・利用規約更新を作らない**（type と default のみ）。

## Completion UX（`CookingModeView.tsx`）

```
🎉 今日のごはん完成！
  ↓
📸 完成写真を残す（任意）   ← カメラ/ライブラリ。写真なしでも完了できる
  ↓
みんなにシェアする（任意）  ← 写真を選んでも Share 本文には入らない
```

- 完成到達時に `CookedMealRecord` を **1 回だけ** `recordCookedMeal` で保存（写真なしでも成立）。
- 写真は `<input type="file" accept="image/*" capture="environment">` + `URL.createObjectURL` の
  **local preview のみ**。「選び直す」「削除」可能。unmount / 選び直しで `revokeObjectUrlReference`。
- **server upload なし・cloud storage なし・base64 localStorage なし・AI 解析なし・EXIF 抽出なし。**
- 写真は「この端末の中だけに表示されています（アップロードしていません）」と明記。
- Cooking 中は写真 action を出さない（Completion 後のみ）。未実装の Favorite / Print を再表示しない。

## Persistence（`storage.ts` — 既存 pattern の additive 拡張）

`recordCookedMeal(record)` / `loadCookedMealRecords()` — 既存 `recordMealDecision` と同じ
capped list（`nukitoru_food_cooked_meals`, 最大 100 件、`safeGet`/`safeSet`、SSR-safe、corruption-safe）。

- **画像バイナリ / base64 / EXIF / `localReference` は一切保存しない。**
- `CompletionPhotoMetadata` 本体の永続化は将来 MISSION（現状は session-only）。
- 既存 storage schema / migration なし。

## Firewalls

- `cooked-meal-record.ts` / `completion-photo.ts` は `recipe-publishability` / `recipe-safety` /
  `practical-cook-validation` / `recipe-catalog` / `world-recipe-import` / `ai-provider` を import しない。
- RecipeVerification / PracticalCookValidation / Rights / Allergy / Matching Truth / Stock schema を
  一切変更しない（types は append-only）。
- AI / network / fetch / EXIF / 画像認識 / 味の評価 / 盛り付け採点をしない（tests で固定）。
- 200 件の Cooked Meal Record を作っても `tori-teriyaki` の VERIFIED / publishable は不変（test）。
- 1000 件の `repeatIntent: 'want-to-repeat'` でも Evidence Fact にならない（test）。

## MISSION 2.41 への接続点

- Cooked Meal Records が積み上がる → 「作った料理」「今月作った料理」「また作りたい料理」の
  食卓アルバム（`CookedMealPresentation` + `toCookedMealPresentation`。History 画面は本 MISSION では作らない）。
- 十分に集計・匿名化した「どの Recipe が実際に作られたか」の傾向をサービス改善へ（公開条件 /
  minimum cohort / privacy / consent を別途決定してから。`countCookedByRecipe` は boundary のみ）。
- 写真つき Share / `CompletionPhotoMetadata` の永続化 / consent 画面は将来の別 Product Decision。
