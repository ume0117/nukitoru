# WORLD FOOD SOURCE AUDIT (MISSION 2.36 / 2.36A)

調査日: 2026-09-03（初版 MISSION 2.36）/ 2026-09-03 再監査（MISSION 2.36A）
調査者: NUKITORU (Claude Code session)
方式: research-first。Web 検索 + 一次情報（公式サイト・利用規約・ライセンス・API ドキュメント・
政府ページ）の確認。production code 変更ゼロ。

> **重要な免責**: 本文書は法的助言ではない。commercial use / copyright / license / AI training /
> database redistribution の可否について、一次情報で明確に確認できなかったものは **UNKNOWN /
> LEGAL REVIEW** とし、推測で USE 扱いしない（MISSION §18 NO-GUESSING）。実際の取り込み前に
> 各 source の最新 Terms を人間が再確認すること。

> **⚠️ MISSION 2.36A 再監査で初版の一部判定を撤回した。** 下の
> 「§0. MISSION 2.36A — SOURCE RIGHTS AUDIT CORRECTION」が初版の該当箇所を **supersede** する。
> 特に **USDA MyPlate Kitchen を Source 全体で 🟢 USE / Public Domain とした初版判定は撤回**。
> **MAFF「うちの郷土料理」の Source-level default rights と、個々の Recipe / 画像の rights は別物**
> として扱う。「公式だから使える」「政府だから全部 Public Domain」「Dataset に License があるから安全」
> のいずれも NUKITORU は採らない。

---

## §0. MISSION 2.36A — SOURCE RIGHTS AUDIT CORRECTION

### 0.1 中核原則: SOURCE RIGHTS ≠ RECORD RIGHTS ≠ ASSET RIGHTS

NUKITORU は将来数千〜数万件の料理 Knowledge を扱っても、**Source 単位の権利判定を
そのまま個々の Recipe / 画像へ適用しない**。権利は必要な粒度で確認する:

```
SOURCE  (例: USDA MyPlate Kitchen / MAFF うちの郷土料理)
  └─ default rights（Source 全体の既定。License / ToS / 政府規約 由来）
       └─ RECORD  (個々の Recipe)
            └─ record rights override（contributor / original source / "adapted from" があれば優先）
                 └─ ASSET  (画像・動画・イラスト・逐語 prose)
                      └─ asset rights（Recipe facts とは完全に別管理）
```

**Rights Inheritance ルール（将来の実装方針）:**
- Record に明示的な `rightsOverride` がある → **Record Rights を優先**。
- Record に override がない → Source Default Rights を参照。
- Source Default Rights も UNKNOWN → **Record も UNKNOWN**。
- **UNKNOWN を自動的に allowed へ昇格させない。**
- 画像が利用不可でも Recipe structured facts を自動的に利用不可にしない（逆も同様）。

### 0.2 撤回・修正した初版の判定

| # | 初版（MISSION 2.36）の記述 | MISSION 2.36A 修正 | 一次情報の根拠 |
|---|---|---|---|
| C1 | 「USDA MyPlate Kitchen → 米国連邦著作物 = public domain → 🟢 USE」（Source 全体） | **撤回。** Source-level = **⚪ PER-RECORD RIGHTS REVIEW REQUIRED**。個々の Recipe の contributor / original source / "adapted from" を確認したものだけ record 単位で USE 候補にする | USDA 公式: 「some materials on the USDA Web site are protected by copyright... used by USDA with permission... You may need to obtain permission from the copyright holder」。MyPlate recipe は SNAP-Ed / 州立大学 extension / 州の栄養教育プログラムから **contributed**。例:「2-Step Chicken」は **"adapted from" ONIE Project（University of Oklahoma Health Sciences Center のグラント事業）** |
| C2 | 「17 USC §105 の Public Domain 原則により recipe facts は PD」 | **限定。** 17 USC §105 は **「米国政府の officer/employee が職務として作成した work」のみ** を PD にする。**州・地方政府の work、契約・グラント（grant）で作成された work、第三者の work は §105 の対象外。** MyPlate の多くは grantee（州立大学 SNAP-Ed）由来のため §105 が自動適用されない | 17 USC §101/§105: 「a work prepared by an officer or employee of the United States Government as part of that person's official duties」。立法資料は「works prepared under U.S. Government contract or grant」を §105 の対象に含めていない |
| C3 | 「保全サイト myplate.food が構造化 JSON を提供」を前提に Import 候補化 | **注記追加。** myplate.food は **非公式の第三者保全サイト**。同サイトの「federal works = public domain / CC Public Domain Mark / free for any purpose including commercially」という記載は **第三者の主張** であり USDA の公式声明ではない。個々の recipe の "adapted from ONIE Project" 等の provenance と整合しない。myplate.food 独自の enhancement（remaster 画像・翻訳）は別 license（"custom licensing for bulk or print delivery"） | myplate.food 自身の記載 |
| C4 | MAFF「うちの郷土料理」: 「商用利用の明示的可否が UNKNOWN」 | **修正。** MAFF が権利を有し PDL1.0 が適用されるコンテンツについては、**PDL1.0 は CC BY 4.0 互換 → 出典表示を条件に商用利用・複製・公衆送信・翻訳・変形が可能**（商用は UNKNOWN ではない）。**ただし Source 全体を無条件利用可能とはしない**（下記 C5） | MAFF「リンク・著作権について」: 公共データ利用規約（第1.0版）準拠。PDL1.0 解説: 「自由に複製、公衆送信、翻訳・変形などを行える」「CC BY 4.0 国際ライセンスと互換性がある旨明記」 |
| C5 | MAFF「うちの郷土料理」: 「🟢 USE (facts) / ⚪ (逐語 prose)」（Source 一括） | **粒度化。** ① MAFF-held の facts = 🟢 USE（出典表示 + 改変明記）。② **個々の Recipe には第三者の「レシピ提供 / 監修 / 編集」がある**（例: だし(山形県) は「山形県郷土料理探訪」編集: 山形県グリーン・ツーリズム推進協議会 / 監修: 古田久子）→ record 単位で第三者権利の確認が必要。③ **画像は別 asset rights**（「写真等は第三者が権利を有している場合が多い」。ページごとに「リンク・著作権について」同意ゲート + 個別クレジット例:「やまがたの広報写真ライブラリー」） | MAFF「リンク・著作権について」の一次確認 + 郷土料理 recipe ページ（dashi_yamagata）の一次確認 |
| C6 | 「Recipe の材料リスト・分量・時間・温度 = 著作権対象外」（包括的断定） | **修正。** 「個々の事実・数値・単純な材料情報は著作権保護の対象にならない **場合がある**」に緩和。ただし creative expression / explanatory prose / selection・arrangement / compilation / **sui generis database rights** / ToS / API contract / redistribution 制限 は別問題。**NUKITORU は「FACT だから自由」を rights 判断に使わない。** 不明なら UNKNOWN / LEGAL REVIEW | 一般的な著作権整理（材料リスト非保護 / 説明 prose 保護）＋ EU Database Directive の sui generis 権 ＋ ToS の契約的制限（Ryanair v PR Aviation） |
| C7 | AI/ML: 「明示制限なし」を許容的に解釈しかけた箇所 | **明確化。** **commercial use permitted ≠ AI training explicitly permitted。** PDL1.0 / CC BY / ODbL いずれも AI/ML 利用を一次情報で確認できない → `aiMlUse: unknown` を維持。「禁止と書いていないから OK」とは判断しない。Public Domain / CC0 についても AI ORIGINAL への利用方法は別 MISSION で再評価 | PDL1.0・CC BY・ODbL の一次情報に AI/ML 記載なし |

### 0.3 再確認した一次情報（MISSION 2.36A）

| URL | 確認した事実 |
|---|---|
| https://www.maff.go.jp/j/use/link.html | MAFF は公共データ利用規約（第1.0版）準拠。出典表示必須・改変明記必須・「国が作成したかのように公表するな」・**写真等は第三者が権利を有する場合が多く利用前に確認が必要**・ロゴ/マーク/キャラクターは別制限・別の利用ルールが適用されるコンテンツは除外 |
| https://ja.wikisource.org/wiki/公共データ利用規約（第1.0版） | PDL1.0 は「自由に複製、公衆送信、翻訳・変形などを行える」ようにするもの。**CC BY 4.0 国際ライセンスと互換性がある旨明記**（＝出典表示を条件に商用利用可）。第三者権利・AI/ML への言及は本文抜粋では確認できず |
| https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/menu/dashi_yamagata.html | 郷土料理 recipe ページには **「レシピ提供」= 第三者**（「山形県郷土料理探訪」編集: 山形県グリーン・ツーリズム推進協議会 / 監修: 古田久子）。作り方は番号つき step list。画像は ZIP DL 可だが「リンク・著作権について」同意ゲートつき + 画像クレジット「やまがたの広報写真ライブラリー」。「出典を農林水産省『うちの郷土料理』と明記」+ クレジットのある画像は画像出典も明記 |
| https://www.usda.gov/about-usda/policies-and-links（および NAD Copyright ページ） | 「Most information... is considered public domain... **However, some materials... are protected by copyright, trademark... used by USDA with permission... You may need to obtain permission from the copyright holder.**」「linked pages は別サイトの copyright/licensing に従う」 |
| (USDA) ask.usda.gov「Where do the MyPlate Kitchen recipes come from」 | ※ WebFetch は TLS 証明書エラーで直接取得不可。権威ある二次情報（複数の州立大学 extension / SNAP-Ed）で「MyPlate recipe は university extension・州の栄養教育プログラム・public-health partner から **CNPP / SNAP-Ed へ contributed**」を確認 |
| https://www.myplate.gov/recipes/.../2-step-chicken（および MA SNAP-Ed 版） | 「2-Step Chicken」は **"adapted from" Simple Healthy Recipes — Oklahoma Nutrition Information and Education (ONIE Project)**。ONIE は **University of Oklahoma Health Sciences Center, College of Public Health** の事業（USDA が Oklahoma DHS 経由で funding するグラント事業） |
| https://en.wikisource.org/wiki/United_States_Code/Title_17/Chapter_1/Sections_105_and_106 | 17 USC §105/§101: PD になるのは「officer or employee of the United States Government」が「official duties」として作成した work のみ。契約/グラント作成物・州政府 work・第三者 work は含まれない |
| https://onieproject.org/about-onie/ | ONIE Project = University of Oklahoma Health Sciences Center 内の事業。SNAP-Ed グラント資金（2025-10 以降は SNAP-Ed 事業終了） |

### 0.4 Revised classification（Source-level）

| Source | 初版 | **MISSION 2.36A Source-level** | Record-level で USE 昇格の条件 |
|---|---|---|---|
| **USDA MyPlate Kitchen** | 🟢 USE | **⚪ PER-RECORD RIGHTS REVIEW REQUIRED** | 各 recipe の `originalContributor` / `originalSourceName` / `"adapted from"` を確認し、(a) 米国連邦職員が職務として作成した work と確認できる、または (b) その contributor 自身の利用条件が commercial + structured-fact-storage を許容する と一次確認できた recipe のみ record 単位で USE |
| **MAFF「うちの郷土料理」** | 🟢 USE (facts) | **🟡 SOURCE DEFAULT = PDL1.0（MAFF-held facts は出典表示で商用 USE 可）／ ただし RECORD ごとに第三者「レシピ提供・監修」の確認が必要／ 画像は別 ASSET（既定 ⚪）** | recipe: 「レシピ提供」が MAFF 内部 or PDL 適用と確認できる、または第三者提供元の条件を確認できた record。画像: ページの「リンク・著作権について」+ 個別クレジットを確認し「二次利用可」と明示されたものだけ |

**過剰修正はしない（MISSION §19）:** MyPlate の一部に third-party recipe がある → MyPlate 全部禁止、
MAFF の一部画像に第三者権利がある → MAFF 全部禁止、とはしない。粒度を下げて扱う。

### 0.5 Minimum Per-Record Rights Design（設計提案のみ・実装しない）

MISSION 2.37 以降で、**実際に取り込む source 分だけ** 最小実装する。既存 `RecipeEvidenceSource` /
MISSION 2.36 の `WorldFoodSource`（Source-level）を置き換えず、その下に Record-level を足す。

```
WorldFoodSourceRecord {
  sourceId: string                 // WorldFoodSource.sourceId
  sourceRecordId: string           // source 側の recipe id
  sourceUrl: string

  originalContributor?: string      // 例: "ONIE Project"
  originalSourceName?: string       // 例: "Simple Healthy Recipes"
  originalSourceUrl?: string
  adaptedFrom?: string              // "adapted from" が明示されている場合

  thirdPartyRights: 'yes' | 'no' | 'unknown'

  rightsStatus: 'use' | 'conditional' | 'do-not-ingest' | 'unknown'
  rightsOverride?: {                // あれば Source default より優先（§0.1 inheritance）
    reason: string
    ...同じ flag 群
  }

  structuredFactStorage: RightsFlag  // 'allowed'|'conditional'|'prohibited'|'unknown'
  verbatimTextStorage:   RightsFlag  // 逐語 prose は facts と別
  imageReuse:            RightsFlag  // asset は record と別
  aiMlUse:              RightsFlag   // 既定 'unknown'

  rightsCheckedAt: string           // ISO
  rightsEvidenceUrl?: string        // 判断根拠の URL
  rightsNotes: string[]             // 一次情報の逐語引用・不確実性
}

type RightsFlag = 'allowed' | 'conditional' | 'prohibited' | 'unknown'
```

- `rightsStatus` を unknown → use に上げるには `rightsNotes` に一次情報の逐語引用 + `rightsCheckedAt` 必須。
- MISSION 2.37 に不要な field は production type として実装しない。

### 0.6 Revised First Import Recommendation（MISSION 2.37）

初版 §H の「MyPlate 10–20 件を US Public Domain として Import #1」は **撤回**。

**選定基準（Recipe 数の多さで選ばない。MISSION §13）:**
① 一次情報で License 明確 → ② commercial use 明確 → ③ structured fact storage 明確 →
④ provenance 明確 → ⑤ 第三者権利の混在リスクが低い → ⑥ Recipe 単位で Evidence trace 可能 →
⑦ 多言語展開に役立つ → ⑧ NUKITORU Presentation pipeline を検証できる。

| | **推奨: PRIMARY** | **BACKUP** |
|---|---|---|
| source | **Korea MFDS「조리식품의 레시피 DB」(COOKRCP01)** | **MAFF「うちの郷土料理」— MAFF-held facts + 第三者提供元を record 単位で確認したもの** |
| 理由 | data.go.kr で **이용허락범위「제한 없음」** を一次確認済み（§C5 一次情報）。政府（식약처）単一主体で第三者 contributor 混在リスクが低い。API で structured（材料・段階手順・栄養）。非日本語 → 多言語 pipeline 検証に最適 | PDL1.0（CC BY 4.0 互換）で MAFF-held facts は商用 USE 可と一次確認。ただし recipe ごとに「レシピ提供」= 第三者の確認が要る分、PRIMARY より手間 |
| exact content boundary | COOKRCP01 API の **RCP_NM / RCP_PARTS_DTLS（材料）/ MANUAL01..20（段階手順の事実）/ RCP_WAY2（調理법）/ RCP_PAT2（요리종류）/ INFO_*（栄養）** のみ | 料理名 / 都道府県 / 主な使用食材 / 番号つき作り方（事実構造）/ いわれ・歴史（要約） |
| sample 数 | **5–15 recipe**（요리종류 を分散: 밥/국/반찬/후식 等） | 5–10 recipe（第三者提供元がなるべく少数に集中するもの） |
| language | 韓国語（`localName` + `originalLanguage: 'ko'`）。英訳は生成せず Identity は Wikidata で解決 | 日本語 |
| rights basis | data.go.kr 15060073「이용허락범위: 제한 없음」/ 運用ステージは審査承認 | 公共データ利用規約（第1.0版）＝ CC BY 4.0 互換（MAFF-held 分）+ record 単位の第三者確認 |
| attribution | 「출처: 식품의약품안전처『조리식품의 레시피 DB』」を推奨表記 | 「出典：農林水産省『うちの郷土料理』」＋ 改変明記 ＋ 第三者提供元があればその明記 |
| excluded assets | **画像 URL は保存しない（参照のみ）**。画像著作権・第三者権利は未確認 | **画像は取り込まない**（ページごとの同意ゲート + 第三者クレジット。別途 asset review まで保留） |
| excluded prose | 手順の**逐語コピーはしない**（事実構造のみ。MANUAL の説明文をそのまま保存しない） | 監修者の説明 prose を逐語転載しない。いわれ・歴史は事実の要約のみ |
| third-party content handling | MFDS 単一主体。万一 record に外部 credit があれば `thirdPartyRights: 'yes'` として除外 | recipe ごとに `originalContributor` を記録。提供元の利用条件を確認できないものは `rightsStatus: 'unknown'` で除外 |
| provenance fields | sourceId / sourceRecordId(RCP_SEQ) / sourceUrl / rightsCheckedAt / rightsEvidenceUrl(data.go.kr 15060073) | + originalContributor / originalSourceName |
| why safest | 政府単一主体 + 明示的な「제한 없음」+ API で境界が明確 + 非日本語で pipeline の多言語耐性を検証できる。**運用申請 → 審査を通してから着手** | 日本カバー価値は高いが record 単位の第三者確認コストがあるため BACKUP |

> **前提**: Korea MFDS は開発段階は自動承認、**運用段階は審査承認が必要**。Import 前に利用申請と
> 運用審査を通す。審査で商用 product 利用に制約が付いた場合は BACKUP（MAFF）へ切り替える。

### 0.7 Revised Tier A（Recipe source のみ。Identity/Ingredient/Nutrition layer と混同しない）

| Source | Tier A 適格? | 理由 |
|---|---|---|
| Korea MFDS COOKRCP01 | ✅（運用審査後） | 「제한 없음」一次確認・単一主体・structured |
| MAFF うちの郷土料理（MAFF-held facts, record 確認済み分のみ） | △ 条件つき | PDL1.0 で商用可だが record 単位の第三者確認が前提 |
| USDA MyPlate Kitchen | ❌ → Tier B（record 確認できたもののみ候補） | Source 全体は ⚪。§105 が自動適用されない grantee 由来 recipe が混在 |
| Wikibooks Cookbook | △ | CC BY-SA（share-alike 注意）・UGC 品質 |
| **Identity/Ingredient/Nutrition（別レイヤー・Recipe Import ではない）**: Wikidata (CC0) / USDA FDC (CC0) / 日本食品標準成分表（出典表示）/ Open Food Facts (ODbL) / 消費者庁アレルゲン（CC BY 互換） | — | Recipe source と混同しない。ここは初版のまま有効 |

### 0.8 Unresolved rights questions（MISSION 2.36A 時点）

1. USDA MyPlate 個々の recipe が「連邦職員の職務著作物」か「grantee（州立大学 SNAP-Ed）著作物」かの
   record 単位の判定基準。grantee 著作物の再利用条件（SNAP-Ed グラント条項に「無償公開」義務があっても
   「public domain」「商用可」とは限らない）。
2. ONIE Project 等の "adapted from" 元素材の実際の利用許諾（一次情報で未確認）。
3. MAFF 郷土料理の「レシピ提供」第三者（各県団体・監修者）の利用条件。PDL1.0 が及ぶ範囲。
4. PDL1.0 / CC BY / ODbL の AI/ML 学習利用（すべて一次情報に記載なし → unknown 維持）。
5. Korea MFDS の運用段階審査で商用 product 利用にどんな条件が付くか。
6. myplate.food の「CC Public Domain Mark」表示の正確性（第三者による付与であり、原著作物の
   状態を保証しない。PDM は「権利者がいないことの表明」であって license ではない）。

---

## A. Executive Summary

- **推奨は「単一巨大 Dataset 依存」ではなく「Source Portfolio 型」**。CC0 / public-domain の
  政府データを土台に、Open license の百科事典データで identity を張り、専門メディア・メーカー公式は
  「人間が開いて確認する Evidence source」として使う。
- **今すぐ合法に取り込める recipe 本体データは限定的**だが存在する。
  **MISSION 2.36A で修正**: 権利の明確さは source によって差がある。
  Korea MFDS「조리식품의 레시피 DB」は「이용허락범위 제한 없음」を一次確認済みで単一主体（最も安全）。
  MAFF「うちの郷土料理」は PDL1.0（CC BY 4.0 互換）で MAFF-held facts は出典表示で商用可だが、
  recipe ごとに第三者「レシピ提供・監修」があり画像は別 asset rights。
  **USDA MyPlate Kitchen は Source 全体を public domain としない**（grantee=州立大学 SNAP-Ed 由来 recipe が
  混在。17 USC §105 は連邦職員の職務著作物のみを PD にする）→ record 単位確認が必要（§0.4）。
- **大規模 academic dataset（RecipeNLG / Recipe1M+ / Food.com / 各種 Kaggle・HF dump）は
  ほぼ全て「non-commercial research only」または「scrape 由来で再配布権が不明」**。NUKITORU の
  production Knowledge DB には取り込めない（研究・人間による Evidence 確認には使える可能性）。
- **商用 Recipe API（Spoonacular / Edamam）は「呼べる ≠ 永久保存できる」**。Spoonacular は
  cache 最大 1 時間・停止時は全削除・再販禁止。永続 Knowledge DB には不適。将来の提携/契約候補（Tier C）。
- **ingredient / nutrition / allergen の基盤データは今すぐ強力に揃う**:
  USDA FoodData Central（CC0）、日本食品標準成分表 / 食品成分データベース（出典表示で自由利用）、
  Open Food Facts（ODbL）、消費者庁 食物アレルギー表示情報（CC BY 互換）、Wikidata（CC0）。
- **日本発の強みを活かせる**: MAFF 郷土料理 + 食品成分表 + 消費者庁アレルゲン + メーカー公式（Evidence）で
  日本の家庭料理・和食・調味料・日本特有食材・日本の計量表現・日本のアレルゲンを高品質にカバー可能。
- **「日本料理 DB を作って後から翻訳」の構造にしない**ため、Identity 層（Wikidata CC0）と
  複数国の政府 recipe source を最初から並行して持つ。

---

## B. Source Comparison Table

| # | Source | 主体 / type | 国 | データ規模 (概算) | 内容 | Access | Rights 分類 |
|---|---|---|---|---|---|---|---|
| 1 | **USDA MyPlate Kitchen** (myplate.gov, 非公式保全: myplate.food) | 米国政府 (USDA) + 州立大学 SNAP-Ed 等の contributor | US | ~1,072 recipes | 材料・分量・手順・栄養・food group | web（公式サイトは 2026-01 retired）| **⚪ PER-RECORD RIGHTS REVIEW REQUIRED**（§0.4 C1/C2。初版 🟢 USE を撤回） |
| 2 | **MAFF「うちの郷土料理」** | 日本政府 (農林水産省) + 各県団体・監修者（レシピ提供） | JP | ~1,300+ 郷土料理 / 47都道府県 | 料理名・地域・いわれ/歴史・材料・番号つき作り方・写真(一部) | web (DB) | **SOURCE default = 🟡 PDL1.0（MAFF-held facts は出典表示で商用 USE 可）／ RECORD ごとに第三者提供元の確認要／ 画像は別 ASSET（⚪）**（§0.4 C4/C5） |
| 3 | **Korea MFDS「조리식품의 레시피 DB」** (COOKRCP01) | 韓国政府 (식품의약품안전처) | KR | ~1,100+ 料理 | 料理名・調理法・材料・手順・栄養・画像・ハッシュタグ | Open API (key, 運用時審査) | 🟢 USE |
| 4 | **Korea MAFRA / 농정원 recipe API** (기본/재료/과정 정보) | 韓国政府 | KR | UNKNOWN (数千) | recipe 基本情報 / 材料情報 / 過程情報 | Open API (key) | ⚪→🟢 (KOGL Type1 前提、要 per-dataset 確認) |
| 5 | **USDA FoodData Central** | 米国政府 (USDA) | US | 300,000+ foods | 栄養成分・branded products・成分 | Open API (1,000 req/hr), bulk download | 🟢 USE |
| 6 | **日本食品標準成分表(八訂)増補2023 / 食品成分データベース** | 日本政府 (文科省) | JP | ~2,500 食品 | 栄養成分（エネルギー・PFC・ビタミン・ミネラル等） | web DB, PDF/Excel | 🟢 USE (出典表示) |
| 7 | **Open Food Facts** | NPO (協働) | 世界 | 3M+ products | 商品原材料・アレルゲン・栄養・添加物 | full DB dump (JSON/CSV/SQLite), API | 🟢 USE (ODbL, 帰属+share-alike) |
| 8 | **Wikidata** | Wikimedia | 世界 | 数万 dish/ingredient items | 料理・食材の identity・多言語ラベル・別名・国・cuisine・出典リンク | SPARQL, dump | 🟢 USE (CC0) |
| 9 | **消費者庁 食物アレルギー表示情報** | 日本政府 (消費者庁) | JP | 規則・特定原材料28品目+ | アレルゲン表示ルール・代替表記・拡大表記 | web / PDF | 🟢 USE (CC BY 互換) |
| 10 | **Wikibooks Cookbook** | Wikimedia (community) | 主に EN | ~数千 recipes | 材料・手順・解説 | dump / HF dataset | 🟢 USE (CC BY-SA、share-alike 注意) |
| 11 | **Wikipedia (dish 記事)** | Wikimedia (community) | 多言語 | — | 料理の背景・歴史・地域・authenticity 文脈 | dump / API | 🟡→🟢 (CC BY-SA。**recipe source ではない**) |
| 12 | **OpenRecipes** (fictive-kin, GitHub) | 企業 (公開) | 主に EN | ~170k bookmarks | 料理名 + 画像 URL + source URL のみ（**手順なし**）・古い(~2016) | JSON snapshot | 🟢 USE (CC BY 3.0、discovery index のみ) |
| 13 | **NHK みんなのきょうの料理** (kyounoryouri.jp) | 専門メディア (NHK 教育) | JP | 大量 | 講師名つき監修 recipe（材料・分量・手順） | web (一部有料) | 🟡 EVIDENCE ONLY |
| 14 | **白ごはん.com** | 個人専門家 (冨田ただすけ) | JP | ~数百 | 和食 recipe（丁寧な手順） | web | 🟡 EVIDENCE ONLY |
| 15 | **メーカー公式 recipe (JP)**: キッコーマン, 味の素パーク, ハウス, マルコメ, キユーピー 等 | 食品/調味料メーカー | JP | 各社 数百〜数千 | 自社商品を使った recipe（材料・分量・手順） | web | 🟡 EVIDENCE ONLY (ToS: 転載/複製禁止) |
| 16 | **Cookpad 研究用データセット** (NII IDR) | UGC プラットフォーム | JP | ~1.7M recipes | UGC recipe 全文・つくれぽ | 契約 + 同意書 (研究のみ) | 🟡 RESEARCH ONLY |
| 17 | **RecipeNLG** (Poznań University of Technology) | 大学 | PL/世界 | ~2.2M recipes | 材料・手順・NER タグ | DL (規約同意) | 🟡 RESEARCH ONLY (non-commercial) |
| 18 | **Recipe1M / Recipe1M+** (MIT CSAIL) | 大学 | US/世界 | ~1M+ recipes + 13M images | 材料・手順・画像 | form 申請 (大学/研究機関のみ) | 🟡 RESEARCH ONLY |
| 19 | **Food.com Recipes & Interactions** (Kaggle: shuyangli94) | 個人 upload (scrape) | US | 270k recipes / 1.4M reviews | 材料・手順・タグ・レビュー | Kaggle DL | 🔴 DO NOT INGEST (scrape 由来・再配布権不明) |
| 20 | **Kaggle/HF の大量 recipe dump** (corbt/all-recipes, "2M+ recipes", 多言語 4.14M corpus 等) | 個人 upload (scrape) | 各国 | 数十万〜数百万 | 材料・手順 | Kaggle/HF DL | 🔴 DO NOT INGEST / ⚪ (uploader license ≠ 再配布権) |
| 21 | **RecipeDB / CulinaryDB / FlavorDB / FooDB** (IIIT-Delhi CoSyLab) | 大学 | IN/世界 | RecipeDB ~118k | recipe + 材料 + flavor 化合物 + 栄養 + 地域 | web / DL | 🟡 RESEARCH ONLY (license 不明記・scrape 由来) |
| 22 | **TheMealDB** | 個人運営 (crowd-sourced) | 世界 | **~793 meals** のみ | 料理名・材料・手順・画像・地域 | free API (+$10 premium) | ⚪ UNKNOWN (公開 license/ToS なし・保存可否不明) |
| 23 | **Spoonacular Food API** | 企業 | US | 数十万 recipes | 材料・手順・栄養・価格・分類 | 有料 API ($10–500/mo) | 🔴 DO NOT INGEST (cache≤1h, 停止時全削除, 再販禁止) |
| 24 | **Edamam Recipe Search / DB** | 企業 | US | ~40k (full) / 2M (nutrition のみ) | publisher recipe + 栄養 + アレルギー/diet label | 商用ライセンス (contact) | 🔴 DO NOT INGEST (無契約) / Tier C |
| 25 | **Nutritionix / FatSecret / Tasty(RapidAPI) 等** | 企業 | US | 各種 | 栄養中心 / recipe | 有料 API | ⚪ / Tier C (未深堀り) |
| 26 | **TasteAtlas** | 企業 | HR/世界 | ~10,000 dish/drink/ingredient | authentic 料理の identity・地域・伝統 recipe | web (proprietary) | 🔴 (ingest 不可) / 🟡 (人間参照) / Tier C |
| 27 | **Accademia Italiana della Cucina** | 文化団体 | IT | ~3,000 伝統 recipe (書籍) | イタリア各州の伝統 recipe | 書籍 / web | 🟡 EVIDENCE ONLY (著作権) |
| 28 | **EuroFIR** | 団体 (会員制) | EU | 26 か国の food composition | 栄養成分・伝統食 | 会員 / 有料 | ⚪ / Tier C |
| 29 | **한식진흥원 (Korean Food Promotion Institute)** hansik.or.kr | 韓国 公的機関 | KR | UNKNOWN | authentic 韓国料理・공공데이터 개방 | web / 공공데이터 | ⚪→🟢 (per-dataset KOGL 確認要) |
| 30 | **schema.org Recipe markup（Web 全般 / Common Crawl）** | 各 publisher | 世界 | 膨大 | 構造化 recipe metadata | Common Crawl 抽出 | ⚪ LEGAL REVIEW (各 publisher の著作権/ToS が残る) |
| 31 | **大手 recipe サイト (AllRecipes, NYT Cooking, BBC Good Food, クラシル, クックパッド web 等)** | 企業 / UGC | 各国 | 数十万〜数百万 | recipe 全般 | web (ToS で scrape 禁止が一般的) | 🔴 DO NOT INGEST (bulk) / 🟡 (個別 human Evidence) |

---

## C. Rights Matrix（用途単位）

> MISSION §7: source 全体に単純な USE/DON'T USE を付けない。**用途ごと**に分類する。
> 凡例: ✅ 可 / ❌ 不可 / ⚠️ 条件つき / ❓ UNKNOWN（要確認）

| Source | 閲覧 | URL 紹介 | 人間による Evidence 確認 | structured facts を内部 DB 保存 | recipe 全文/逐語 prose 保存 | 画像再利用 | AI/ML 学習 | 再配布 |
|---|---|---|---|---|---|---|---|---|
| USDA MyPlate Kitchen | ✅ | ✅ | ✅ | ✅ (帰属推奨) | ✅ (public domain) | ✅ (連邦画像は PD、要個別確認) | ✅ | ✅ |
| USDA FoodData Central | ✅ | ✅ | ✅ | ✅ | — (recipe なし) | — | ✅ (CC0) | ✅ |
| MAFF 郷土料理 | ✅ | ✅ | ✅ | ✅ (出典+改変明記) | ⚠️ 監修 prose は逐語転載しない → ❓ | ⚠️ 一部のみ可 | ❓ (CC BY 互換なら可の見込み・要確認) | ✅ (出典表示) |
| 食品成分DB / 成分表 | ✅ | ✅ | ✅ | ✅ (出典表示) | — | — | ❓ (明記なし) | ✅ (出典表示) |
| 消費者庁 アレルゲン | ✅ | ✅ | ✅ | ✅ (出典+改変明記) | ⚠️ (facts のみ) | — | ❓ | ✅ |
| Open Food Facts | ✅ | ✅ | ✅ | ✅ (ODbL: 帰属+share-alike) | — (recipe なし) | ⚠️ CC BY-SA + 第三者パッケージ権 | ❓ (明示制限なし) | ⚠️ share-alike |
| Wikidata | ✅ | ✅ | ✅ | ✅ | — | — | ✅ (CC0) | ✅ |
| Wikibooks Cookbook | ✅ | ✅ | ✅ | ✅ (CC BY-SA) | ⚠️ share-alike が派生物に及ぶ | ⚠️ per-file | ❓ | ⚠️ share-alike |
| OpenRecipes | ✅ | ✅ | ✅ | ✅ (CC BY 3.0、metadata のみ) | — (手順なし) | ❌ (URL のみ) | ⚠️ | ✅ (帰属) |
| Korea MFDS COOKRCP01 | ✅ | ✅ | ✅ | ✅ (제한 없음) | ⚠️ facts 推奨・逐語は要注意 | ❓ 画像権 要確認 | ❓ | ✅ |
| NHK きょうの料理 | ✅ | ✅ | ✅ | ⚠️ facts のみ (現行 NUKITORU 実務) | ❌ | ❌ | ❌ | ❌ |
| 白ごはん.com | ✅ | ✅ | ✅ | ⚠️ facts のみ | ❌ | ❌ | ❌ | ❌ |
| メーカー公式 (JP) | ✅ | ✅ | ✅ | ⚠️ facts + 帰属 + URL (EVIDENCE_POLICY.md) | ❌ (ToS: 転載/複製禁止) | ❌ | ❌ | ❌ |
| Cookpad 研究データ | ⚠️ 契約後 | ✅ | ⚠️ 研究のみ | ❌ (商用 product DB 不可) | ❌ | ❌ | ⚠️ 研究のみ | ❌ |
| RecipeNLG | ✅ | ✅ | ✅ (研究) | ❌ (non-commercial) | ❌ | — | ⚠️ 研究のみ | ❌ |
| Recipe1M+ | ⚠️ 研究機関のみ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ⚠️ 研究のみ | ❌ |
| Food.com / Kaggle・HF scrape dump | ✅ | ✅ | ⚠️ (元サイトを直接確認すべき) | ❌ | ❌ | ❌ | ❌ | ❌ |
| RecipeDB 系 | ✅ | ✅ | ✅ (研究) | ❌ (license 不明記) | ❌ | ❌ | ⚠️ | ❌ |
| TheMealDB | ✅ | ✅ | ✅ | ❓ (規約なし) | ❓ | ❓ | ❓ | ❓ |
| Spoonacular | ✅ (API) | ✅ | ✅ | ❌ (cache ≤ 1h) | ❌ | ❌ | ❌ | ❌ (再販禁止) |
| Edamam | ⚠️ 契約 | ✅ | ✅ | ❌ (無契約) | ❌ | ❌ | ❓ | ❌ |
| TasteAtlas | ✅ | ✅ | ✅ (authenticity 参照) | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## D. Evidence Quality Matrix

| Source | publisher の説明責任 | 専門監修 | 種別 | 工程の詳細度 | 再現性 | 出所安定性 | 総合 Evidence 品質 |
|---|---|---|---|---|---|---|---|
| 消費者庁 / 食品成分表 / USDA FDC | 政府 | ✅ | government | (facts) | 高 | 高 | ★★★★★ |
| USDA MyPlate Kitchen | 政府 | ✅ (栄養士) | government | 中〜高 | 中〜高 | 中（サイト retired だが PD で保全済み） | ★★★★☆ |
| MAFF 郷土料理 | 政府 | ✅ (料理研究家監修) | government | 中 | 中 | 高 | ★★★★☆ |
| Korea MFDS COOKRCP01 | 政府 | ✅ | government | 中 | 中 | 高 | ★★★★☆ |
| NHK きょうの料理 | 放送メディア | ✅ (講師名つき) | professional | 高 | 高 | 中〜高 | ★★★★☆ (NUKITORU で実績) |
| メーカー公式 (自社商品 recipe) | 企業 | ✅ | manufacturer | 中〜高 | 中〜高 | 中 | ★★★★☆ (自社商品について権威) |
| 白ごはん.com / 専門料理家 | 個人（実名・責任主体明確） | ✅ | professional | 高 | 高 | 中 | ★★★★☆ |
| Accademia Italiana della Cucina | 文化団体 | ✅ | editorial | 高 | 中 | 高 | ★★★★☆ (authentic 参照) |
| Open Food Facts | 協働 (contributor) | 一部 | UGC + 検証 | (商品 facts) | — | 中 | ★★★☆☆ (商品原材料は有用) |
| Wikidata | 協働 | — | UGC + 出典 | (identity のみ) | — | 中〜高 | ★★★☆☆ (identity には十分) |
| Wikibooks Cookbook | 匿名寄与者 | ❌ | UGC | 中 | 低〜中 | 中 | ★★☆☆☆ |
| TheMealDB | 匿名寄与者 | ❌ | UGC | 低〜中 | 低 | 低（793件・更新停滞気味） | ★★☆☆☆ |
| RecipeNLG / Recipe1M+ / Food.com / Kaggle dump | 匿名 UGC の scrape | ❌ | UGC scrape | 中（量は多い） | 低 | 低（元 URL 消失リスク） | ★☆☆☆☆ (research のみ) |
| RecipeDB 系 | 大学が scrape 集約 | ❌ | UGC scrape + 研究注釈 | 中 | 低 | 低 | ★★☆☆☆ (ontology は参考) |

---

## E. Japan Coverage

| ニーズ | カバーする source | 分類 |
|---|---|---|
| 家庭料理 / 定番和食 (recipe 本体) | NHK きょうの料理・白ごはん.com・メーカー公式（**人間が開いて structured facts を Evidence 記録**、現行 MISSION 2.11–2.31 方式）+ MAFF 郷土料理（地方の定番） | 🟡 EVIDENCE + 🟢 (MAFF facts) |
| 郷土料理 / 伝統和食 | **MAFF「うちの郷土料理」** (~1,300、公共データ利用規約) | 🟢 USE |
| 調味料（しょうゆ・みそ・みりん・だし 等） | メーカー公式（キッコーマン・マルコメ・味の素 等、自社商品について権威）を Evidence として | 🟡 EVIDENCE ONLY |
| 日本特有食材 | 食品成分DB（食品名の標準化）+ Wikidata（多言語 identity）+ MAFF | 🟢 USE |
| 日本の計量表現（大さじ・小さじ・合・少々・適量） | 既存 MISSION 2.17B `QuantitySemantics` / `UnitCode`（osaji/kosaji/cup-jp）で表現済み。source から逐語で拾う（人間） | 内製 + Evidence |
| 日本のアレルゲン（特定原材料等） | **消費者庁 食物アレルギー表示情報**（CC BY 互換）+ メーカー公式アレルギー表示 | 🟢 USE + 🟡 |
| 日本の食品安全 | 消費者庁・厚労省・食品安全委員会（政府、CC BY 互換の見込み・要確認） | 🟢/⚪ |
| 栄養成分（日本） | **日本食品標準成分表(八訂)増補2023 / 食品成分データベース**（出典表示で自由利用） | 🟢 USE |

**結論**: 日本は「政府 open data（MAFF 郷土料理・食品成分表・消費者庁）＋ メーカー/専門メディアの
human Evidence」で、大量無断取得なしに高品質カバーが可能。NUKITORU 発の強み。

---

## F. Global Coverage

| 地域 | 今すぐ使える open source | Evidence / 参照 source | 状態 |
|---|---|---|---|
| USA | USDA MyPlate Kitchen (🟢 PD)・USDA FDC (🟢 CC0) | — | ✅ 強い |
| Japan | MAFF・食品成分表・消費者庁 (🟢) | NHK・メーカー公式・白ごはん.com (🟡) | ✅ 強い |
| Korea | MFDS COOKRCP01 (🟢 제한 없음)・MAFRA/농정원 API (⚪→🟢)・한식진흥원 (⚪→🟢) | — | ✅ 良好（要 per-dataset 確認） |
| 世界共通 (identity) | **Wikidata (🟢 CC0)**・Wikipedia (🟡 CC BY-SA)・OpenRecipes (🟢 索引のみ) | — | ✅ identity 層は全世界カバー可 |
| 世界共通 (栄養/商品) | **Open Food Facts (🟢 ODbL)**・USDA FDC | EuroFIR (⚪ 会員制) | ✅ 商品・栄養 |
| Italy / Spain / France | — (open な政府 recipe DB 未発見) | Accademia Italiana della Cucina (🟡)・各国料理学校/文化機関 (🟡)・TasteAtlas (🟡/Tier C) | ⚠️ Evidence source は在るが open ingest なし |
| China / SE Asia / India / Middle East / Latin America | — | 各国政府 open data portal を次 MISSION で個別調査（Korea モデルが有望） | ⏳ 未調査（MISSION 2.36 の範囲外で可） |
| 多言語 recipe 本文 | Wikibooks Cookbook (🟢 CC BY-SA、主に EN) | RecipeNLG 多言語部分 (🟡 research) | ⚠️ open は限定的 |

**構造上の要点**: identity 層（Wikidata, CC0）と栄養/商品層（Open Food Facts, USDA FDC）は
**最初から全世界カバー**。recipe 本体は「国別の政府 open data を足していく」方式（US→JP→KR は完了、
次に各国 open data portal）。「日本 DB を作って翻訳」ではなく、最初から多国 parallel。

---

## G. Source Portfolio Recommendation

**1 つの巨大 Dataset に依存しない。5 レイヤーの Portfolio。**

| レイヤー | 役割 | 主 source | 分類 |
|---|---|---|---|
| **L1. Identity Layer** | 世界の料理・食材の canonical identity、多言語名、別名、国、cuisine、authenticity 文脈 | **Wikidata (CC0)** + Wikipedia (CC BY-SA) | 🟢 |
| **L2. Open Recipe Layer** | 実際に取り込む recipe 本体（材料・分量・手順・時間・器具） | **USDA MyPlate Kitchen (PD)** + **MAFF 郷土料理 (PDL)** + **Korea MFDS COOKRCP01 (제한 없음)** + Wikibooks Cookbook (CC BY-SA) | 🟢 |
| **L3. Ingredient / Nutrition / Safety Layer** | 食材の正規化、栄養、アレルゲン、食品安全 | **USDA FDC (CC0)** + **日本食品標準成分表 (出典表示)** + **Open Food Facts (ODbL)** + **消費者庁アレルゲン (CC BY 互換)** | 🟢 |
| **L4. Evidence Layer（人間が開いて structured facts を確認）** | 既存 EVIDENCE_SOURCE_CATALOG の拡張。recipe fact の裏付け | NHK きょうの料理・白ごはん.com・メーカー公式（JP）/ Accademia Italiana della Cucina（IT）/ 各国専門機関 | 🟡 EVIDENCE ONLY |
| **L5. Discovery / Reference Layer（保存しない）** | 「世界にどんな料理があるか」の発見、authenticity の人間参照 | OpenRecipes（索引）・TasteAtlas（人間参照）・Recipe APIs（transient） | 🟡 / Tier C |

**Rights Classification と Tier は別**（MISSION §16）:
- 🟢 USE でも品質が低ければ Tier A にしない（例: TheMealDB は ⚪ かつ 793 件で Tier 外）。
- 高品質でも大量保存不可なら Tier B/C（例: NHK, Edamam）。

### Tier 分け

| Tier | 定義 | source |
|---|---|---|
| **Tier A（今すぐ取り込み候補）** | 権利明確 + Evidence 品質十分 + structured 取得可能 | **⚠️ MISSION 2.36A で改訂 → §0.7 参照。** Recipe source: Korea MFDS COOKRCP01（運用審査後）/ MAFF 郷土料理（record 確認済み分のみ・条件つき）。USDA MyPlate は Tier B へ降格（record 確認分のみ候補）。Identity/Ingredient/Nutrition 層（別レイヤー）: USDA FDC / 日本食品標準成分表 / Open Food Facts / Wikidata / 消費者庁アレルゲン |
| **Tier B（Evidence / Source 参照候補）** | 大量保存はしないが、人間が開いて facts を確認し attribution 付きで記録 | NHK きょうの料理 / 白ごはん.com / メーカー公式（JP）/ Wikibooks Cookbook（品質次第で A 昇格可）/ Accademia Italiana della Cucina / OpenRecipes（索引のみ） |
| **Tier C（将来の契約・API・提携候補）** | 契約 / 有料 / 提携があれば有用 | Edamam（publisher recipe ライセンス）/ Spoonacular（栄養・分類）/ TasteAtlas（authenticity）/ EuroFIR（欧州栄養）/ Cookpad（研究）/ Recipe1M+（研究提携） |

---

## H. First Import Recommendation（MISSION 2.37 向け）

> **⚠️ MISSION 2.36A で全面改訂。以下の初版 Import #1〜#3 は歴史記録として残すが、
> 実際の推奨は §0.6「Revised First Import Recommendation」を見ること。**
> 初版の誤り: (1) Import #1 で USDA MyPlate を「US Public Domain」として最優先にしていた
> → grantee（州立大学 SNAP-Ed）由来 recipe の混在を見落としていた（§0.4 C1/C2）。
> (2) Import #2 で MAFF を「PDL1.0 で一括 facts USE」としていた → 個々の recipe の
> 第三者「レシピ提供・監修」と画像の別 asset rights を粒度分けしていなかった（§0.4 C5）。
> **改訂後の PRIMARY = Korea MFDS COOKRCP01（運用審査後）、BACKUP = MAFF（record 確認分）。**

**「全件取り込み」をしない。小規模 import で Pipeline を検証する。**

### Import #1 — USDA MyPlate Kitchen（最優先）  ← ❌ 初版。§0.6 で撤回・降格

| 項目 | 指定 |
|---|---|
| source | USDA MyPlate Kitchen recipes |
| 一次 URL | https://www.myplate.gov/myplate-kitchen （retired）/ 保全: https://myplate.food/recipes |
| dataset version | 「2026-01-07 retirement 時点の 1,072 recipe セット」 |
| license | US federal work = public domain (17 U.S.C. §105) / CC Public Domain Mark |
| attribution | 不要だが「Source: USDA MyPlate Kitchen」を推奨表記 |
| fields | recipe 名 / 材料（名・分量）/ 手順 / servings / 調理時間（記載時）/ 栄養 / food group |
| languages | 英語（+ 一部 ES/FR/KR/DE の非公式翻訳は取り込まない） |
| number of records | **最初は 10–20 件のみ**（朝食・主菜・スープを横断） |
| import boundary | structured facts のみ。myplate.food の「独自 enhancement（remaster 画像・翻訳）」は取り込まない（元 USDA facts のみ）。画像は取り込まない（別途 PD 確認後） |
| 目的 | MISSION 2.35 の `SourceRecipeKnowledge` / `NukitoruPresentation` pipeline を **英語 source で** 検証 |

### Import #2 — MAFF「うちの郷土料理」（日本カバー検証）

| 項目 | 指定 |
|---|---|
| source | 農林水産省「うちの郷土料理〜次世代に伝えたい大切な味〜」 |
| 一次 URL | https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/ |
| license | 公共データ利用規約（第1.0版）= CC BY 4.0 互換（要・取り込み直前に「リンクについて・著作権」再確認） |
| attribution | 「出典：農林水産省『うちの郷土料理』」+ 改変した場合はその旨 |
| fields | 料理名 / 都道府県 / 主な使用食材 / **作り方（構造化した事実。監修者の逐語 prose は転記しない）** / いわれ・歴史（事実の要約） |
| import boundary | **10 件のみ**（例: 石狩鍋・きりたんぽ鍋・治部煮・ほうとう・冷汁・鶏飯・ゴーヤーチャンプルー 等、地域を分散）。写真は取り込まない（「一部のみ二次利用可」のため個別確認まで保留）。JAS/GI マーク関連は除外 |
| 目的 | 日本語 source + 地域 identity（`WorldRecipeIdentity.region`）の pipeline 検証 |

### Import #3（条件つき）— Korea MFDS COOKRCP01

| 項目 | 指定 |
|---|---|
| source | 식품의약품안전처「조리식품의 레시피 DB」(COOKRCP01) |
| 一次 URL | https://www.foodsafetykorea.go.kr/api/openApiInfo.do?...svc_no=COOKRCP01 / https://www.data.go.kr/data/15060073/openapi.do |
| license | 이용허락범위「제한 없음」(no restriction)。運用ステージは審査承認が必要 |
| fields | 料理名 / 材料 / 手順（단계별）/ 栄養 / 調理법 / 요리종류 |
| import boundary | **API 経由で 10 件**。画像 URL は保存せず参照のみ（画像権 未確認）。ハングル原文の料理名を `localName`、`originalLanguage: 'ko'` |
| 目的 | 3 言語目・API 取得経路・非日本語 identity の検証。**MFDS への利用申請と運用審査を通してから** |

**この 3 件（計 ~30–50 recipe）で pipeline 全体（Identity 解決 → SourceRecipeKnowledge →
Presentation → Traceability → 既存 VERIFIED/Allergy への非影響）を検証してから拡大する。**

---

## I. Source Rights Registry Proposal（設計案のみ・コード実装しない）

> MISSION §14/§19: 調査前に巨大 Schema を実装しない。以下は **設計提案** であり、
> MISSION 2.37 以降で最小実装する。既存 `RecipeEvidenceSource`（`evidence-sources.ts`）を
> 置き換えず、その上位の「source の権利メタデータ」レイヤーとして追加する。

```
WorldFoodSource {
  sourceId: string                    // 例: "usda-myplate-kitchen"
  name: string
  organization: string
  sourceType:                         // 既存 RecipeSourceType を再利用/拡張
    | 'government' | 'public-institution' | 'manufacturer'
    | 'professional' | 'other-trusted'
    | 'open-dataset' | 'encyclopedia' | 'academic-dataset' | 'commercial-api'  // ← 追加候補
  country?: CountryCode               // 主体の所在（適用範囲の自動フィルタには使わない）
  languages: LanguageCode[]
  officialUrl: string
  termsUrl?: string
  licenseUrl?: string

  access: {
    api: boolean
    dataset: boolean                  // ダウンロード可能な dump がある
    bulkDownload: boolean
    webOnly: boolean
    registrationRequired: boolean
    cost: 'free' | 'paid' | 'membership' | 'contract' | 'unknown'
  }

  rights: {
    license?: string                  // "CC0-1.0" | "CC-BY-4.0" | "CC-BY-SA-4.0" | "ODbL-1.0"
                                       //  | "US-PD-17USC105" | "PDL-1.0-JP" | "KOGL-Type1"
                                       //  | "proprietary" | "unknown"
    commercialUse:      RightsFlag
    attributionRequired: boolean | 'unknown'
    modification:       RightsFlag
    redistribution:     RightsFlag
    shareAlike:         boolean | 'unknown'
    caching:            RightsFlag     // API の場合
    cacheMaxDuration?:  string         // 例: "1h"（Spoonacular）, "none-required"
    structuredFactStorage: RightsFlag  // NUKITORU 用途の核心
    verbatimTextStorage:   RightsFlag  // creative wording / prose
    imageReuse:         RightsFlag
    aiMlUse:            RightsFlag      // 学習利用が規約で言及されているか
    scraping:           RightsFlag     // 明示的な scrape 可否
    databaseRightNote?: string         // EU Database Directive / sui generis の懸念
  }

  // 用途単位（MISSION §7）。source 全体の単純 USE/DON'T USE を作らない
  allowedPurposes: Purpose[]          // 明示的に許可を確認できたものだけ
  // Purpose = 'view' | 'link-out' | 'human-evidence-check'
  //         | 'structured-fact-db' | 'verbatim-recipe-db' | 'image-use'
  //         | 'ai-training' | 'redistribution' | 'discovery-index'

  classification:                     // MISSION §6
    | 'USE'                           // 一次情報で用途への利用根拠を確認
    | 'RESEARCH_ONLY'
    | 'DO_NOT_INGEST'
    | 'UNKNOWN'                       // 一次情報を見ても不明。勝手に USE にしない

  portfolioTier: 'A' | 'B' | 'C' | 'none'   // classification とは別（MISSION §16）

  evidenceQuality: {
    publisherAccountability: 'government' | 'manufacturer' | 'professional' | 'editorial' | 'ugc' | 'ugc-scrape'
    professionalSupervision: boolean | 'partial' | 'unknown'
    processDetail:  'low' | 'medium' | 'high' | 'facts-only'
    sourceStability: 'low' | 'medium' | 'high'
  }

  checkedAt: string                   // ISO。この権利判断をいつ一次情報で確認したか
  reviewAfter?: string                // 規約は変わりうる。再確認目安
  notes: string[]                     // 判断根拠・逐語引用・不確実性
}

type RightsFlag = 'allowed' | 'conditional' | 'prohibited' | 'unknown'
```

**設計原則**:
- `evidence-sources.ts` の既存 `RecipeEvidenceSource` は不変。`WorldFoodSource.sourceId` から
  `RecipeEvidenceSource` を参照する（1 source が複数 evidence entry を持ちうる）。
- `classification` を上げる（UNKNOWN → USE）には、`notes` に一次情報の逐語引用と `checkedAt` が必須。
- `allowedPurposes` は「明示的に確認できた用途だけ」を列挙。空配列 = 何も保存してよいと確認できていない。
- schema は **調査結果に合わせて最小から**。上記の全 field を一度に実装しない。

---

## J. Risks / Unknowns

| # | リスク / 不明点 | 深刻度 | 対応 |
|---|---|---|---|
| R1 | **MAFF 郷土料理の「作り方」テキストの著作物性**。公共データ利用規約は適用されるが、監修 料理研究家の説明表現が creative wording に該当する可能性。逐語転載は避け、事実構造のみ抽出すべき | 中 | facts のみ抽出。取り込み直前に「リンクについて・著作権」を再確認。逐語 prose = ⚪ |
| R2 | **MISSION 2.36A 更新**: MAFF-held コンテンツの**商用利用**は PDL1.0 が CC BY 4.0 互換であることを一次確認できたため **UNKNOWN を解消**（出典表示を条件に商用可）。**AI/ML 学習**は依然 UNKNOWN（PDL1.0 本文に記載なし）。**新たな主リスクは「個々の recipe の第三者レシピ提供元」と「画像の別 asset 権利」**（§0.4 C5） | 中 | recipe ごとに `originalContributor` を確認。画像は取り込まない。AI/ML は `aiMlUse: unknown` 維持 |
| R3 | **Korea MFDS COOKRCP01 の画像・逐語手順の権利**。「이용허락범위 제한 없음」は API データ全体を指すが、画像著作権・第三者権利は別 | 中 | 画像は保存せず参照のみ。手順は facts 抽出 |
| R4 | **Open Food Facts の share-alike（ODbL）**。NUKITORU の Knowledge DB が「派生データベース」とみなされると、その部分を ODbL で公開する義務が生じうる | 中〜高 | OFF データは「ingredient/allergen 参照テーブル」として分離管理。混ぜて 1 つの DB にしない設計を検討。legal review 候補 |
| R5 | **EU Database Directive の sui generis 権**。欧州 source（将来）から「実質的部分」を抽出すると、facts でも database right 侵害の可能性（Ryanair v PR Aviation: ToS で制限可） | 中 | 欧州 source は個別 legal review。当面 open license があるものだけ |
| R6 | **Kaggle / HuggingFace の uploader-set license の無効性**。uploader に再配布権がなければ、表示 license に関わらず取り込み不可（MISSION §9） | 高 | 全ての Kaggle/HF recipe dump を DO_NOT_INGEST 既定。元 source の一次規約を確認できたものだけ例外 |
| R7 | **TheMealDB に公開 license / ToS が存在しない**。793 件と小規模だが、「規約がない」＝「自由」ではない | 低〜中 | UNKNOWN。取り込まない。運営者へ照会が必要なら Tier C |
| R8 | **schema.org Recipe markup / Common Crawl 抽出**。技術的には可能だが、各 publisher の著作権・ToS が残る。「facts だから自由」と断定しない（MISSION §8） | 高 | LEGAL REVIEW。当面着手しない |
| R9 | **メーカー公式 recipe の Evidence 利用範囲**。現行 NUKITORU 実務（人間が開いて structured facts + 帰属 + URL を記録）が各社 ToS の「私的使用の範囲」を超えないかは、厳密には各社 ToS 解釈次第 | 中 | 現行方式（facts のみ・逐語 prose なし・出典明記・大量取得なし）を維持。各社 ToS を Registry に記録 |
| R10 | **政府データでも「編集・加工したものを国が作ったかのように公表するな」制約**（PDL/政府標準利用規約 共通） | 低 | NUKITORU Presentation に「出典」と「NUKITORU が再構成した」旨を明記（MISSION 2.35 の traceability で対応済み） |
| R11 | **MISSION 2.36A 更新**: USDA MyPlate.gov の retirement（2026-01）に加え、**MyPlate recipe の多くが grantee（州立大学 SNAP-Ed / 州の栄養教育プログラム）由来 or "adapted from" 第三者**（例: 2-Step Chicken ← ONIE Project）。**17 USC §105 は連邦職員の職務著作物のみ PD にするため、Source 一括で PD 扱いできない**。myplate.food の「CC Public Domain Mark」は第三者による付与で原著作物の状態を保証しない | 中 | Source-level を ⚪ PER-RECORD REVIEW に変更（§0.4 C1）。record 単位で contributor を確認したものだけ USE 候補。可能なら Wayback の USDA 原本ページの provenance 表記を一次とする |
| R12 | **AI/ML 学習利用は、ほぼ全 source で規約に明示がない** | 中 | 「明示がない」＝「許可」ではない。AI ORIGINAL 着手前に、L2 の PD/CC0 source（USDA・Wikidata）に限定して検討 |

---

## K. Sources checked（一次確認 or 権威ある二次情報）

| # | URL | 確認内容 |
|---|---|---|
| 1 | https://recipenlg.cs.put.poznan.pl/dataset | RecipeNLG license（non-commercial research only） |
| 2 | https://github.com/Glorf/recipenlg | RecipeNLG リポジトリ |
| 3 | https://huggingface.co/datasets/mbien/recipe_nlg | RecipeNLG dataset card / license |
| 4 | https://pic2recipe.csail.mit.edu/ | Recipe1M+ 公式（研究機関のみ） |
| 5 | https://github.com/torralba-lab/im2recipe-Pytorch | Recipe1M+ アクセス form |
| 6 | https://www.themealdb.com/ | TheMealDB データ規模（793 meals）・crowd-sourced |
| 7 | https://www.themealdb.com/api.php | TheMealDB API tiers（license/ToS 記載なし） |
| 8 | https://developer.edamam.com/recipe-database-licensing | Edamam ライセンス（contact-only、40k publisher recipes） |
| 9 | https://spoonacular.com/food-api/terms | Spoonacular ToS（cache ≤ 1h・停止時全削除・再販禁止） |
| 10 | https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/ | MAFF 郷土料理 DB 内容・「家庭調理/外食メニュー化/商品化」を推奨 |
| 11 | https://www.maff.go.jp/j/use/link.html | MAFF 著作権ポリシー（公共データ利用規約 第1.0版 / PDL1.0 準拠） |
| 12 | https://www.digital.go.jp/... (PDL 1.0 解説) | 公共データ利用規約 第1.0版：商用可・改変可・CC BY 4.0 互換 |
| 13 | https://ja.wikipedia.org/wiki/政府標準利用規約 | 政府標準利用規約 2.0：CC BY 4.0 互換 |
| 14 | https://www.nii.ac.jp/dsc/idr/cookpad/cookpad.html | クックパッドデータセット（NII IDR、契約・研究用） |
| 15 | https://current.ndl.go.jp/car/28051 | クックパッドデータセット 研究用提供の経緯 |
| 16 | https://www.myplate.gov/myplate-kitchen | USDA MyPlate Kitchen（2026-01 retired） |
| 17 | https://ask.usda.gov/s/article/Am-I-permitted-to-use-content-or-materials-from-ChooseMyPlate-gov | USDA コンテンツ利用可否 |
| 18 | https://ask.usda.gov/s/article/Where-do-the-MyPlate-Kitchen-recipes-come-from | MyPlate recipe の出所 |
| 19 | https://myplate.food/recipes | 1,072 recipe の保全サイト（非公式） |
| 20 | https://world.openfoodfacts.org/terms-of-use | Open Food Facts：ODbL + DbCL + CC-BY-SA 画像・帰属+share-alike・第三者権利注意 |
| 21 | https://world.openfoodfacts.org/data | OFF データ配布（JSON/CSV/SQLite dump + API） |
| 22 | https://en.wikipedia.org/wiki/Open_Database_License | ODbL（商用可・帰属・share-alike のコピーレフト） |
| 23 | https://fdc.nal.usda.gov/api-key-signup/ | USDA FoodData Central API（data.gov key、1,000 req/hr） |
| 24 | https://catalog.data.gov/dataset/fooddata-central | FDC：CC0 1.0 / public domain、300k+ foods |
| 25 | https://www.mext.go.jp/a_menu/syokuhinseibun/index.htm | 日本食品標準成分表（文科省） |
| 26 | (食品成分DB 二次利用) | 「出典明記で自由利用」（論文・書籍・アプリ） |
| 27 | https://www.caa.go.jp/policies/policy/food_labeling/food_sanitation/allergy/ | 消費者庁 食物アレルギー表示情報 |
| 28 | https://www.kportal.caa.go.jp/kiyaku/ | 消費者庁：政府標準利用規約 2.0 / CC BY 互換 |
| 29 | https://en.wikibooks.org/wiki/Cookbook:Recipes | Wikibooks Cookbook（CC BY-SA 4.0） |
| 30 | https://huggingface.co/datasets/gossminn/wikibooks-cookbook | Wikibooks Cookbook の構造化 dump |
| 31 | https://www.wikidata.org/wiki/Wikidata:Licensing | Wikidata：全データ CC0 |
| 32 | https://www.wikidata.org/wiki/Wikidata:WikiProject_Food/Taxonomy | Wikidata 食のタクソノミ |
| 33 | https://en.wikipedia.org/wiki/Wikipedia:Recipes_proposal | Wikipedia は recipe を本文に載せない方針 |
| 34 | https://github.com/fictive-kin/openrecipes | OpenRecipes（CC BY 3.0、bookmark のみ・手順なし・~2016） |
| 35 | https://cosylab.iiitd.edu.in/recipedb/ | RecipeDB（IIIT-Delhi、~118k、scrape 集約） |
| 36 | https://academic.oup.com/database/article/doi/10.1093/database/baaa077/6006228 | RecipeDB 論文 |
| 37 | https://www.kaggle.com/datasets/shuyangli94/food-com-recipes-and-user-interactions | Food.com dataset（Food.com/GeniusKitchen から scrape） |
| 38 | https://arxiv.org/pdf/1909.00105 | 「Generating Personalized Recipes」— Food.com scrape の出所論文 |
| 39 | https://www.kogl.or.kr/info/licenseType1.do | KOGL 제1유형：商用可・改変可・出처표시 |
| 40 | https://www.foodsafetykorea.go.kr/api/openApiInfo.do?...svc_no=COOKRCP01 | Korea MFDS 조리식품 레시피 DB API |
| 41 | https://www.data.go.kr/data/15060073/openapi.do | COOKRCP01：이용허락범위「제한 없음」・무료・운영단계 심의 |
| 42 | https://data.mafra.go.kr/ | Korea MAFRA 農食品 공공데이터 포털（recipe API 群） |
| 43 | https://www.hansik.or.kr/contents/contentsDetail.do?cntntsSeq=48&menuSn=239 | 한식진흥원 공공데이터 개방 |
| 44 | https://www.kikkoman.co.jp/kiyaku/kiyaku.html | キッコーマン ウェブサイト利用規約（複製・転載を私的使用外で禁止） |
| 45 | https://www.kikkoman.co.jp/homecook/app/terms/ | キッコーマン ホームクッキング利用規約 |
| 46 | https://www.tasteatlas.com/recipes | TasteAtlas（proprietary、~10k、authentic 志向） |
| 47 | https://www.accademiaitalianadellacucina.it/en/ricette | Accademia Italiana della Cucina（~3,000 伝統 recipe、書籍） |
| 48 | https://www.eurofir.org/ | EuroFIR（欧州 food composition、会員制） |
| 49 | https://themarkup.org/levelup/2023/08/23/how-to-legally-scrape-eu-data-for-investigations | EU Database Directive / DSM Directive の scrape 例外（商用は非対象） |
| 50 | https://copyrightalliance.org/are-recipes-cookbooks-protected-by-copyright/ | 米国：材料リストは非保護、説明 prose は保護されうる |
| 51 | https://theconversation.com/recipetin-eats-founder-accuses-cookbook-author-of-plagiarism-... | recipe の著作権（表現 vs 事実）の法的整理 |
| 52 | https://monolith.law/en/internet/copyright-issues-related-to-cooking-recipes-... | 日本法：レシピの手順自体は著作物性が低い／写真・文章表現は保護 |

**この MISSION で一次または権威ある情報を確認した source / framework: 約 31 source + 8 ライセンス枠組み。**

---

## Q. IMPORTANT PRODUCT QUESTIONS

### Q1. NUKITORU FOOD は現実的にどの程度の Recipe Knowledge を、合法かつ持続可能に構築できそうか？

- **今すぐ合法に取り込める recipe 本体（MISSION 2.36A 修正後の現実値）**:
  Korea MFDS ~1,100（「제한 없음」・単一主体・運用審査後）が最も確実。
  MAFF 郷土料理 ~1,300 は PDL1.0 で MAFF-held facts が商用可だが **record 単位の第三者確認** が要る。
  USDA MyPlate ~1,072 は **Source 一括では取り込めず、record 単位で連邦職務著作物と確認できた分のみ**
  （実効的な取り込み可能数は 1,072 より小さくなる見込み）。Wikibooks Cookbook ~数千（CC BY-SA）。
  → **確実に取り込めるのは当面 Korea MFDS ~1,100 + record 確認を通した分**。各国政府 open data portal
  （Korea モデル）を足して中期的に **数千〜1 万 recipe** 規模が現実的（初版の「1〜3 万」は楽観的すぎた）。
- **加えて「人間が Evidence 確認する」方式**（現行 MISSION 2.11–2.31）で、NHK・メーカー公式・
  各国専門機関から高品質 recipe を **1 件ずつ** 積む。数は出ないが Evidence 品質が最高。
- **持続可能性**: 政府 open data は license が安定・出所が明確・無料。API 依存（Spoonacular 等）は
  持続性が低い（規約変更・cache 制限・課金）。→ **政府 open data 中心が最も持続可能。**
- **数百万規模の Recipe DB は、合法には作れない**（それらは全て scrape 由来 / non-commercial /
  API 一時利用）。NUKITORU はそこで競争しない（MISSION §1 と一致）。

### Q2. 大量 Recipe Dataset を中心にすべきか、複数 Source Portfolio 型にすべきか？

**複数 Source Portfolio 型（G 章の 5 レイヤー）。** 理由:
- 合法に大量保存できる単一 Dataset が存在しない（大規模なものは全て research-only か scrape 由来）。
- 単一依存はライセンス変更・サイト消滅（USDA MyPlate.gov の retirement が実例）に脆い。
- NUKITORU の価値は「量」ではなく「良い Knowledge を見つけ、Evidence を失わず、分かりやすくする」
  （MISSION §1）。Portfolio 型はこの価値と整合する。

### Q3. 日本料理と世界料理をどういう Source 構成でカバーすべきか？

- **日本料理**: MAFF 郷土料理（PDL1.0 で MAFF-held facts は商用可・**ただし record ごとに第三者提供元の確認**）＋ 食品成分表（🟢、食材・栄養）＋ 消費者庁アレルゲン
  （🟢、安全）を土台に、NHK・白ごはん.com・メーカー公式を **human Evidence**（🟡）で家庭の定番和食を補う。
- **世界料理**: Wikidata（🟢 CC0）で全世界の料理・食材 **identity** を最初から張り、
  Korea MFDS（KR、「제한 없음」）を最初の政府 open recipe とし、USDA MyPlate（US、**record 単位で連邦職務著作物と確認できた分のみ**）等を足していく。栄養・商品は
  Open Food Facts（🟢 世界）＋ USDA FDC（🟢）。authentic 参照は各国文化機関を human Evidence で。
- **「日本 DB → 翻訳」にしない**: Identity 層（Wikidata）と栄養/商品層（OFF, FDC）は最初から多言語・
  全世界。recipe 本体だけ国別に段階拡大。

### Q4. 「冷蔵庫 → 世界の料理」を実現するために、最初に必要な最低データは何か？

1. **Ingredient Canonical Identity（多言語）** — Wikidata（CC0）＋ 既存 `canonical-food.ts` の拡張。
   「卵 / egg / huevo / 계란」を 1 つの id へ。**これが無いと冷蔵庫マッチングが言語で分断する。**
2. **少数の Evidence-backed World Recipe（各国 5–15 件）** — MISSION 2.35 の `SourceRecipeKnowledge`
   形式で。USDA + MAFF + Korea MFDS の First Import（H 章）。
3. **Ingredient → Recipe の逆引き**（recipe が要求する canonical ingredient の集合）— 既存
   `requiredIngredients` 構造で足りる。
4. **アレルゲン関係テーブル** — 消費者庁（JP）＋ Open Food Facts / 各国表示制度。既存
   `ingredient-allergens.ts` の拡張。
5. **「作る量 / 食べる人数 / 熱源 / 器具」の pre-start context** — MISSION 2.35 で型は用意済み。

→ **最小構成 = Wikidata ingredient identity + 30–50 の Evidence-backed recipe（3 か国）+
既存アレルゲンテーブル。** これで「冷蔵庫の卵・じゃがいも・玉ねぎ → 🇪🇸 Tortilla / 🇯🇵 肉じゃが候補」の
最小デモが Evidence 付きで成立する。

### Q5. Evidence-backed AI ORIGINAL へ将来進むために、今から保存すべき Provenance は何か？

- **各 fact の source id（EVIDENCE_SOURCE_CATALOG）+ observation fingerprint + checkedAt**
  （既存 `EvidenceSourceObservation`）。AI ORIGINAL が「どの事実に基づいて提案したか」を後から辿れる。
- **source の license / allowedPurposes / classification**（I 章 Registry）。将来「この source は
  AI 学習利用が許可されているか」を fact 単位で判定できるように。**AI/ML 利用が規約で明示的に
  許可されている source（現状ほぼ USDA PD / Wikidata CC0 のみ）を区別して保存する。**
- **SourceCookingStep 単位の heat / time / UNKNOWN 状態**（MISSION 2.35）。AI ORIGINAL が
  「情報源が沈黙していた事実」を捏造しないため、UNKNOWN を UNKNOWN として保存し続ける。
- **Recipe Identity / variant / authenticity 文脈**（Wikidata 由来 + human 判断）。AI ORIGINAL が
  「adapted / fusion」を「traditional」と偽らないため。
- **「NUKITORU が構造化/再構成した」旨のマーキング**（政府データの「国が作ったかのように公表するな」
  制約への対応。MISSION 2.35 traceability で対応済み）。

---

## 次 MISSION（2.37）推奨  ← MISSION 2.36A で改訂

1. **First Import（PRIMARY）= Korea MFDS COOKRCP01 を 5–15 件**（§0.6）。**先に MFDS へ利用申請 →
   運用審査を通す**。MISSION 2.35 の `SourceRecipeKnowledge` → `NukitoruPresentation` pipeline を
   **非日本語 source** で検証（多言語耐性）。EVIDENCE_SOURCE_CATALOG に MFDS source を追加。
   審査で商用 product 利用に制約が付いたら **BACKUP = MAFF 郷土料理（record 確認分 5–10 件）** へ切替。
2. **Wikidata ingredient identity の最小取り込み**（既存 `canonical-food.ts` を CC0 データで拡張。
   卵・じゃがいも・玉ねぎ・鶏肉・米 等 20–30 食材 × 5–7 言語）。Identity 解決を先に用意し、
   非日本語 recipe の Identity を Wikidata で張れるようにする。
3. **`WorldFoodSource`（Source-level）+ `WorldFoodSourceRecord`（Record-level, §0.5）の最小実装**。
   実際に取り込む 1–2 source 分だけ。巨大 schema を一度に作らない。
   `rightsStatus` を unknown→use に上げるには一次情報の逐語引用 + `rightsCheckedAt` 必須。
4. **USDA MyPlate は record 単位のみ候補**（§0.4 C1）。取り込むなら各 recipe の
   `originalContributor` / `"adapted from"` を確認し、連邦職員の職務著作物と確認できた
   （または contributor の利用条件を一次確認できた）recipe だけ。Source 一括では入れない。
5. MAFF 郷土料理を使うなら、各 recipe の「レシピ提供」第三者を `originalContributor` に記録し、
   画像は取り込まない（asset は別 review）。PDL1.0 の AI/ML 可否は unknown 維持。
6. Open Food Facts の ODbL share-alike リスク（R4）について legal review、または「参照テーブルを
   分離管理する」設計方針を確定。
7. **AI/ML 学習利用は全 source で `aiMlUse: unknown` を既定**（§0.4 C7）。AI ORIGINAL・大量 scrape・
   翻訳エンジン・matching engine・画像取り込み・unit conversion・kitchen compatibility は着手しない。
