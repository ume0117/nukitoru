# NUKITORU Global Foundation

MISSION 2.11 PHASE E.1で導入。NUKITORU FOODを「日本食を世界に発信するアプリ」ではなく
「世界の食を、世界のどの食卓にも」届けるアプリとして将来成長させるための、最小限の基盤。
**本PHASEはfoundationのみを対象とする**。世界各国レシピの大量追加・完全英語UI・
LINE連携・家族投票・BUZZ機能・44 Recipeの内容/検証状態の書き換えはすべてスコープ外。

## Global Design Principles

- **食文化に上下関係はない。** 「日本食を海外へ」だけでなく「世界の食を日本の食卓へ」
  「タイの食をアメリカの食卓へ」も対等に扱う。どの方向の紹介であってもNUKITORUは
  同じFood Model・同じEvidence基盤の上で動作する。
- **AIはCulinary Authenticityを推測しない。** 「これが本場の味」「これは正統」といった
  判断はEvidenceなしにAIが下してはならない。「AUTHENTIC」バッジ等は現時点で存在せず、
  導入も計画しない（[Authentic vs Adapted](#authentic-vs-adapted-design-note)参照）。
- **Locale ≠ Country ≠ Language ≠ Cuisineは、常に別軸として扱う。**
  - 日本語の情報源だから「日本食にしか使えない」わけではない。
  - イタリア料理だから「イタリアでしか作られない」わけではない。
  - 日本語(ja)だから「国は日本(JP)」とは限らない（将来のen-GB/en-AU等、language一定でも
    countryが変わるケースを最初から想定する）。
- **AI knowledge is still not Evidence.** `EVIDENCE_POLICY.md`のNo Guessing原則は
  Global化しても一切変わらない。国・地域・文化的文脈が増えても、AIの一般知識で
  Evidenceを埋めることは変わらず禁止。

## Locale Foundation

`Locale { language: LanguageCode; country: CountryCode }`（`types/index.ts`）。
Language/Country/Localeを意図的に分離する。

**MISSION 2.11 PHASE E.1.1で是正**: 当初`LanguageCode`/`CountryCode`自体を
`'ja'|'en'` / `'JP'|'US'`に閉じたunionとして定義しており、「現在サポートしている値」と
「世界で将来扱える基盤」を混同していた。現在は以下のように分離している。

- `LanguageCode` / `CountryCode`（Global・open primitive）: 型としては`string`。
  `en-GB`/`en-AU`/`ko-KR`/`zh-TW`/`th-TH`等の将来言語・国を、この型自体を
  再設計せずに表現できる。
- `SupportedLanguageCode`（`'ja'|'en'`） / `SupportedCountryCode`（`'JP'|'US'`）
  （Product・closed set）: 現在NUKITORUが正式サポートする値。`SupportedLocale`は
  その組。サポートを追加する際はこのunionと`lib/global-codes.ts`の
  `SUPPORTED_LANGUAGES`/`SUPPORTED_COUNTRIES`/`SUPPORTED_LOCALES`を更新するだけでよく、
  `LanguageCode`/`CountryCode`/`Locale`自体は変更不要。
- `isSupportedLanguage()`/`isSupportedCountry()`/`isSupportedLocale()`
  （`lib/global-codes.ts`）: 与えられた値が現在の正式サポート範囲内かどうかを判定する。
  未サポートのlocale（例: ko-KR）はGlobalに表現可能であっても自動的にサポート済み扱いには
  ならない。
- `isValidLanguageCodeFormat()`/`isValidCountryCodeFormat()`（`lib/global-codes.ts`）:
  ISO 639-1/ISO 3166-1 alpha-2の形式のみを検証する軽量な入り口。大規模なISOデータセットは
  導入しない。

全面的なi18nフレームワークは導入しない。

## Country/Region Foundation

`RegionContext { country?: CountryCode; region?: string }`。`RecipeIdentity`に
任意項目`originContext?: RegionContext`として追加（既存の`recipeIdentity`は
書き換え不要）。**Cuisine（`RecipeCuisine`）とCountry/Regionは別概念。**
「イタリア料理だが前提とする作り手や食材入手国はJP」のようなケースを将来
表現できるようにするための土台であり、今回は既存44 Recipeへの適用は行わない。

## Canonical Food Identity（最重要）

`米`/`rice`/`riz`のような表示文字列そのものをFood Identityとして扱わない。
`canonicalFoodId: string`という表示から独立したidを導入し、localized labelは
`CanonicalFoodLabel { canonicalFoodId, locale, label, synonyms? }`としてこのidへ
ぶら下がる（`lib/canonical-food.ts`）。

- 大規模food DBは構築しない。今回のsample dataは`chicken`/`onion`/`rice_raw`/
  `rice_cooked`の4件×ja-JP/en-US、計8 labelのみ（proof of structure）。
- **PHASE D.2で確立した「米（生米）」と「ごはん（炊飯済み）」の区別は、このGlobal層でも
  `rice_raw` / `rice_cooked`という別々のcanonicalFoodIdとして保持する。**
- `resolveCanonicalFoodId()`は完全一致のみで解決し、fuzzy matching・AI類似判定は
  一切行わない。辞書にないlabelは`undefined`（unknownはunknownのまま）。
- **既存の`ingredient-normalization.ts`（`canonicalizeIngredientName`）は変更しない。**
  こちらは今まで通りJapanese canonical stringへ正規化する既存の安全な実装として
  そのまま使い続ける。`canonical-food.ts`はこれを置き換えるものではなく、将来
  多言語化する際の追加レイヤーとして独立に存在する（本PHASEでは食材マッチング・
  アレルギー判定のいずれのパスにも接続しない）。
- **Allergy HARD EXCLUSION（`recipe-safety.ts`）は本PHASEで一切変更しない。**
  fuzzy matching・AI類似度によるアレルギー判定は、Global化後も永続的に禁止のまま。

## Units Foundation

`UnitCode`（g/kg/ml/l/tsp/tbsp/osaji/kosaji/cup-us/cup-metric/cup-jp/oz/lb/piece/other）
と`Quantity { value, unit, rawText? }`を型としてのみ追加する。自動換算ロジックは
実装しない。US cup・metric cup・Japanese cupは意図的に別値として区別し、
大さじ/小さじ（osaji/kosaji）もUS tsp/tbspとは別概念として区別する。
`RecipeIngredient.amount`（既存のfree-text string）はそのまま変更しない。
Evidence Sourceに記載された原文の単位表記は、既存の`evidenceRange.unit`（自由文字列）
と同様に`Quantity.rawText`でそのまま保持し、無言換算・丸めは行わない。

## Country-aware Evidence

`RecipeEvidenceSource`に任意項目`sourceCountry?: CountryCode` /
`sourceLocale?: Locale`を追加。既存14 sourceは未設定のままでよく、書き換え不要。
**「日本の情報源だから日本食にしか使えない」という単純な国籍フィルタは導入しない。**
relevanceの判断は将来的にもRecipe Identity・variant・country/region contextの
組み合わせで人間が行うものであり、この2フィールドだけで自動的にEvidenceの
適用範囲を制限することはしない。AI knowledge is still not Evidenceの原則は不変。

## Authentic vs Adapted（design note）

将来、Recipe Identityが「伝統的/リファレンスとなるレシピ」と「家庭での置き換え・
アレンジレシピ」を区別できるようにする余地は残すが、**本PHASEでは
「AUTHENTIC」等のバッジ・ラベル・スキーマは一切追加しない。** AIがEvidenceなしに
Authenticityを判定することは今後も禁止する。代替食材（例: 日本でタイ料理を作る際の
入手可能な代用品）をAIが無根拠に生成することも禁止のまま。オリジナル/リファレンス
食材と、家庭での代替食材は将来も混同しない設計とする。

## Human Creator Future Compatibility（design note）

Creator機能（プロの料理人・レシピ研究家・メーカー公式レシピ考案者等のHuman
Provenance）は本PHASEでは実装しない。ただし現在の`RecipeEvidenceSource.sourceType`
（`government`/`public-institution`/`manufacturer`/`professional`/`other-trusted`）は
将来値を追加するだけで拡張できる設計であり、大きなスキーマ変更なしにHuman
Provenanceを将来接続できる。AIは家庭と食文化をつなぐインターフェースであって、
人間の創り手の代替ではない、という位置づけを維持する。

## Current Japan Behavior Preservation

本PHASEで追加した型・モジュール（`Locale`/`RegionContext`/`CanonicalFoodId`/
`CanonicalFoodLabel`/`UnitCode`/`Quantity`/`canonical-food.ts`）は、既存の
食材マッチング・Allergy HARD EXCLUSION・Candidate A/B・Recipe ranking・
Product Check Alert・Recipe detail表示・Amount/Liquid/Reality/Evidence/No Guessing
Gate・既存44 Recipeの内容・検証状態のいずれにも接続・影響しない、独立した
追加レイヤーとして実装する（Global Foundation Gate CB〜CNで回帰確認する）。
