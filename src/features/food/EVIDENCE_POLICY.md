# NUKITORU Recipe Evidence Policy

MISSION 2.11 PHASE D.6で導入。Recipe Factoryで数千〜数万Recipeへ拡張する前に、開発者が今後誤って「事実確認なしの数値」を本番Recipeとして扱わないよう、以下を絶対原則とする。

## 必須原則

- **AI knowledge is not evidence.** Claude/AIの一般的な料理知識・学習データからの推測は、いかなる意味でもEvidence（根拠）として扱わない。`RecipeSourceType`にAI/推測/自己申告を表す値は存在しない（`government` / `public-institution` / `manufacturer` / `professional` / `other-trusted` の5種のみ）。
- **Guessing is prohibited.** 「一般的には」「おそらく」「だいたい」といった表現で重要情報（材料量・調味料量・水量・調理時間・工程・アレルゲン識別）を埋めない。
- **Unknown stays unknown.** 根拠が確認できない値は`review`または`blocked`に留める。`verified`へ昇格させない。
- **Conflicting evidence requires human review.** 複数の情報源が異なる値を示す場合（例: Source Aが水400ml、Source Bが水600ml）、平均値・中間値をAI判断で作成しない。人間が判断するまで`review`のまま。
- **Do not average conflicting source values.** 上記の具体化。400mlと600mlから500mlを作ることは常に禁止。
- **Source URL alone is insufficient.** URLが存在するだけではEvidence成立とみなさない。`publisher`・`title`・`sourceType`・`checkedAt`のすべてが必要（`isValidEvidenceSource()`で機械的に検査される）。
- **Only VERIFIED recipes are publishable.** `isRecipePublishable(recipe)`が`true`を返すRecipeのみが将来の本番catalogに公開できる。この判定はcandidate ranking（`rankRecipes`）とは完全に非依存で、development/mock flowでは`unverified` Recipeも引き続き利用できる。
- **External recipe wording must not be copied.** 他社レシピサイトの文章・説明・独自表現をコピーしない。情報源は「調査・検証の根拠」として利用するのみで、複製元にしない。
- **Sources are for verification, not duplication.** 上記の言い換え。

## Trusted Source Tier

| Tier | 分類 | 例 |
|---|---|---|
| Tier 1 | `government` / `public-institution` | 公的機関・食品安全/栄養等の公式データ |
| Tier 2 | `manufacturer` | 食品メーカー公式・調味料メーカー公式・大手食品企業公式レシピ |
| Tier 3 | `professional` | 料理専門家・管理栄養士・調理専門媒体・責任主体が明確な監修レシピ |
| 補助 | `other-trusted` | その他信頼できる料理情報（単独でVERIFIED化の根拠にはしない） |

匿名投稿・出所不明ページ・AI生成ページのみを根拠に重要数値を`verified`にしてはならない。ユーザー投稿レシピのみを根拠に重要数値を`verified`にしてはならない。

## Verification Status

| status | 意味 |
|---|---|
| `unverified` | Evidence確認前（`Recipe.verification`未設定はこの状態として扱う） |
| `review` | 根拠は存在するが、source間差異や判断事項があり人間確認が必要 |
| `verified` | 必要な事実・根拠が確認され、Fact/Evidence Gateを通過 |
| `blocked` | 根拠不足・矛盾・重要情報欠落・unsupported inference等により公開不可 |

判断不能なら`review`に、根拠なしなら`blocked`に倒す。既存44 RecipeはPHASE D.6時点でいずれも`verification`未設定＝実効的に`unverified`であり、PHASE D.7のEvidence Auditで1件ずつ調査するまで`verified`へ昇格させない。

## Evidence Resolution Protocol（PHASE D.7-Bで確立）

「REVIEWになったRecipeを、推測せず、平均化せず、根拠を失わず、どうVERIFIEDへ解決するか」の正式な手続き。各field verificationは以下いずれかの`supportType`に分類する（`RecipeFieldVerification.supportType`）。

| 区分 | 意味 | VERIFIEDでの扱い |
|---|---|---|
| **A. DIRECT SUPPORT** (`direct`) | Sourceに書かれた値がNUKITORU値と直接一致する | そのまま解決済みとしてカウントする |
| **B. DERIVED SUPPORT** (`derived`) | Sourceに直接同じ値はないが、明示された事実から機械的・説明可能に導出した | `derivation`に導出方法・使用した事実・計算式・前提条件を必ず記録する（Gate BQ）。暗黙のassumptionは禁止 |
| **C. RANGE SUPPORT** (`range`) | Sourceがrange（例: 40〜60分）を提示しており、その中の代表値を採用した | `derivation`に「なぜその値か」を示す明示的なNUKITORU Product PolicyまたはEvidenceを必ず記録する（Gate BR）。rangeを無言でexact値化することは常に禁止。根拠がなければ`review`のまま |
| **D. VARIANT SUPPORT** (`variant`) | Sourceは実在するが、料理のvariant/styleがNUKITORUと異なる | 「解決済み」としてカウントしない（Gate BV）。variant不一致のsourceを直接支持として扱わない |
| **E. CONFLICT** | Source間またはCurrent Recipeとの重要差 | 平均化禁止。servings/ingredient size/product specification/cooking method/cookware/regional-style差/intended tasteで説明可能か検討し、説明不能なら`review`維持（reviewNotesに記録） |
| **F. NOT FOUND** | 重要fieldに信頼できるEvidenceがない | 推測禁止・VERIFIED禁止。fieldVerification自体を作らずreviewNotesに明記する |
| **G. NOT APPLICABLE** | そのRecipeでは検証不要なfield | `applicableFieldsFor()`が動的に除外する（例: cookingLiquidsがないRecipeにはcookingLiquidsを要求しない） |

RANGE→exact値化の具体例（PHASE D.7-Bで実際に遭遇した問題）: 「日立公式のrice cooker炊飯時間が40〜60分のrangeで提示されている場合、40（下限）を無言で選ぶことは禁止。特定商品を仮定しない場合はrangeの中央値（50分）を代表値として採用する」という明示的なNUKITORU Product Policyを`derivation`に記録した上で初めてVERIFIEDの対象にできる。

## Recipe Identity（PHASE D.7-Bで確立）

「同じ料理名なら同じRecipe」という扱いを禁止するため、VERIFIEDへ昇格させるRecipeは`RecipeVerification.recipeIdentity`（`RecipeIdentity`型）で以下を明示する（Gate BU）:

- `canonicalDish`: 料理の系統名
- `variant`: variant/style（例: 「二色丼(みそ味)ではないシンプルな3種調味料そぼろ」）
- `servingsBasis`: 前提とする基準人数
- `intendedTasteProfile`: 想定する味の方向性（例: 「家庭的・あっさりめ」）
- `coreMethod`: 核となる調理法
- `definingIngredients`: Recipeを特徴づける食材

**Evidence Verified = 「世界で唯一正しい味」ではない。** 料理には複数の正当なvariant（家庭的/濃いめ/あっさり/メーカー公式style/地域style等）が存在する。NUKITORUはRecipe Identity・intended taste profile・Evidenceの組み合わせを検証するのであって、単一の「正解の味」を確定するのではない。「牛丼」という名前だけで異なる牛丼Sourceを混ぜたり、「まぐろ丼」と「漬けまぐろ丼」を混同したりしないよう、比較前に必ずRecipe Identityを確認する。

## Critical Field Policy

VERIFIEDに必要な最低限のCritical Field（`RecipeVerifiableField`）: `requiredIngredients` / `ingredientAmounts` / `seasonings`（該当時）/ `seasoningAmounts`（該当時）/ `cookingLiquids`（該当時）/ `cookingTimeMinutes`（下記の条件付き）/ `servingsBase` / `criticalSteps` / `equipment`（該当時）/ `allergyIdentity`。

該当しないRecipeにはNOT APPLICABLEとして要求しない（`applicableFieldsFor()`が動的に決定）。Critical Fieldに CONFLICT・NOT_FOUND・unsupported inferenceが1つでも残る場合はVERIFIED禁止（Gate BS/BT/BW）。

### Recipe Evidence VERIFIED ≠ Product Time VERIFIED（MISSION 2.23 Decision B / 2.26で確立）

**Recipe Evidence VERIFIED** とは、`requiredIngredients` / 分量 / `servingsBase` / `seasonings` / 調味料量 / 下ごしらえ（`preparation`）/ 調理工程（`criticalSteps`）/ `equipment` / `allergyIdentity` / process coherence がEvidence要件を満たしたことを意味する。**Product Time はこれとは別の dimension である。**

- `cookingTimeMinutes` が VERIFIED の Critical Field として **applicable になるのは `verification.timeVerification.productTimeStatus === 'established'` のときだけ**。`productTimeStatus` が `'review'` / `'unknown'` の Recipe では `cookingTimeMinutes` は **NOT APPLICABLE**（`applicableFieldsFor()` が除外する）。`productTimeStatus` 未設定（legacy 44 Recipe）は従来どおり `cookingTimeMinutes` を必須にする＝挙動不変。
- Product Time が未確定（`review`/`unknown`）の Recipe も **Recipe Evidence VERIFIED になれる**。ただしその Recipe は:
  - 確定した調理時間を主張してはならない（`estimatedMinutes` は `null`）
  - strict max-time 結果（「15分以内」等）に一切登場してはならない（`productCookingTimeMinutes()` が `null` を返す）
  - legacy `cookingTimeMinutes` を「速いレシピ」として ranking に使ってはならない（ranking は `null → +Infinity` 扱い）
  - UI は「調理時間の目安：確認中」を表示する（「約○分」を Product Time として表示しない）
  - 情報源が述べる時間（`sourceStatedTotal`）は Evidence として内部保持してよい（除外スコープは `sourceStatedTotal.excludes` に machine-readable に記録。value との足し算はしない）
- `isRecipePublishable()` は `timeVerification` の `elapsedToReady` / `sourceStatedTotal` を参照しない（MISSION 2.15 §「Publishability との分離」の元設計）。`productTimeStatus` そのものを理由に publishability を落とすこともしない（MISSION 2.20 でここに入れていたブロックは MISSION 2.26 で撤去）。
- **Evidence Gate は一切緩めない。** これは「時間が未確定でも Recipe body の検証は成立し得る」という dimension の分離であって、body 側の要件の緩和ではない。

### hasUnsupportedInference の意味（MISSION 2.26で明確化）

`hasUnsupportedInference === true` は **Recipe body / Recipe-Evidence fact の中に未支持の推測値が残っている**ことを意味する。**Product Time が未確定であること（`productTimeStatus`）はこれに含めない**（時間の不確実性は `productTimeStatus` が表現する）。

## VERIFIED昇格ルール（再掲・厳格化）

RecipeをVERIFIEDへ変更できるのは、次のすべてを満たす場合のみ:

1. 実際にSource本文を開いて確認した（検索snippetのみは不可）
2. sourceIdsが`EVIDENCE_SOURCE_CATALOG`の実在entryを参照する
3. `recipeIdentity`が設定され、必須項目が埋まっている
4. 全applicable Critical Fieldが`direct`または`derivation`付きの`derived`/`range`で解決されている（`cookingTimeMinutes` の applicable 判定は上記「Recipe Evidence VERIFIED ≠ Product Time VERIFIED」を参照）
5. 未解決のCONFLICTが残っていない（`reviewNotes`が空。解決済みの監査履歴・source比較・provenance は `provenanceNotes` に置き、これは VERIFIED をブロックしない）
6. 未解決のNOT_FOUNDが残っていない
7. `hasUnsupportedInference !== true`（Recipe body の未支持推測値のみが対象。Product Time 未確定は対象外）
8. Safety Gate（Allergy HARD EXCLUSION等）・既存Evidence Gate（AQ〜BZ）すべてPASS
9. `coherenceReview` が構造的に妥当な `coherent`（`isCoherenceReviewValid()`）。ただし `allergyIdentity` 等の非プロセス系 derived field「のみ」を支持する Evidence Source は process-coherence contributor にしない（`NON_PROCESS_COHERENCE_FIELDS`。安全分類の Evidence を「調理processを記述する source」として扱わない）

**件数目標を設定しない。** 無理な昇格よりも、正しく`review`/`blocked`に留めることの方が高い品質である。

### PRACTICAL_COOK_VALIDATION

現行 policy では **実際に作って再現性を確認する工程は Recipe Evidence VERIFIED の要件ではない**（8 rules は Evidence 構造のみ）。ただし将来の **Beta Quality Gate** では、Commander が別途判断するまで、実地調理検証が済んでいない Recipe の Beta 公開を block すべき。「実際に作って確認済み」と主張してよいのは、それが実際に行われた後だけ。

### Recipe VERIFIED が意味しないこと

`verification.status === 'verified'` が意味するのは Recipe Evidence の検証のみ。次のいずれも意味しない: allergen-free（該当アレルギー登録者は HARD EXCLUDE されるが「安全」を断定しない・PRODUCT CHECK ALERT は併存）・確定した調理時間・味の保証・authentic/本場・情報源との公式提携。

### allergyIdentity の3状態（MISSION 2.25 / 2.30 / 2.31A）

`allergyIdentity` が「評価済み（assessed）」とは、各 ingredient/seasoning の allergen-relevant identity が適用 policy の下で評価され、その判断が Evidence または policy に traceable であることを意味する。**「評価済み」＝「安全と証明された」ではない。**「不確実性が明示的に把握されている」も評価済みに含まれる。ingredient は次の3状態のいずれかに分類する（混同しない）:

- **A. NO_REGULATED_RELATION** — 確定した ingredient identity が、policy が追跡する規制対象アレルゲン（特定原材料等）と関係を持たない（例: みりん・しょうが・玉ねぎ・砂糖・塩）。根拠は消費者庁／東京都の特定原材料等カテゴリ表。
- **B. DEFAULT_GENERIC_RISK / contains** — generic ingredient が通常1つ以上の規制対象アレルゲンを伴う（例: しょうゆ→小麦・大豆、小麦粉→小麦）。`ingredient-allergens.ts` の relation として記録し、該当アレルギー登録で **HARD EXCLUDE**。
- **C. PRODUCT_IDENTITY_UNSPECIFIED** — レシピ出典が広いカテゴリ名しか示さず、実際に選ばれる商品（種類）によってアレルギー表示が変わり得る（例: 出典が「油」としか書かず、ごま油・落花生油・大豆油 等が該当し得る）。**HARD EXCLUDE しない**（存在しないアレルゲンを推測で付与しない。UNKNOWN ≠ ALLERGEN PRESENT）。**「安全」とも表示しない**（UNKNOWN ≠ SAFE）。既存 `ingredientChecks` 機構で machine-readable に表現し（`isProductCheckTarget` = true、`ingredientAllergenRelations` = `[]`）、ユーザーには **PRODUCT CHECK ALERT**（「使用する商品の原材料・アレルギー表示を確認してください」）を出す。C 状態の ingredient があっても、その不確実性が明示的に評価・machine-readable・explainable であれば Recipe Evidence VERIFIED は成立し得る（B の HARD EXCLUDE を弱める用途には使わない）。

## Evidence Variant Foundation（MISSION 2.13で確立）

MISSION 2.12 PHASE Bの実調査で繰り返し発生した問題：「複数の正当なSourceが同じ料理名について異なる数値を示す」という状況を、次の4つの異なる概念へ明確に分離する。

| 区分 | 意味 | 扱い |
|---|---|---|
| **A. CONFLICT（真の対立）** | 同一Recipe Identity・同一variant・同一文脈で、値が両立しない | 平均化・中間値・多数決・新しいsourceの自動採用のいずれも禁止。`review`を維持する |
| **B. LEGITIMATE VARIANT（正当なvariant）** | 同じ料理の、意味のある調理上の違いに基づく別の正当な作り方 | `RecipeVariantIdentity`として構造化できる。ただしVariant確立はEvidence解決を意味しない（下記） |
| **C. RECIPE IDENTITY MISMATCH（別Recipe Identity）** | `coreMethod`・`definingIngredients`等が異なり、そもそも同じRecipeとして比較できない | 直接比較・平均化の対象にしない。`supportType: 'variant'`のまま |
| **D. RANGE（既存概念）** | Evidence Fact自体が単一値ではなくrangeとして提示されている | `evidenceRange`として保持。Variantを確立してもrangeがexact Evidenceへ変わることはない |

**絶対原則: Variantを理由にEvidence基準を緩めない。** 「いろいろな作り方がある」という事実は「好きな数値を選んでよい」という意味ではない。数値の食い違いだけを理由に新しいvariantを発明することを禁止する（Source Aが しょうゆ30ml、Source Bが60mlというだけでは、2つのvariantには自動的にならない）。

### Variant Establishment Rule（採用ルール）

`recipe-variant.ts`の`isEstablishedVariant()`が機械的に検査する。variantとして確立できるのは次のすべてを満たす場合のみ:

1. 安定した`variantId`を持つ（数値conflictの解消のためだけに作らない）
2. `definingCharacteristics`が1件以上ある
3. その特徴が、意味のある調理上の次元（`cooking-method` / `sauce-base` / `major-ingredient-structure` / `regional-style` / `serving-form` / `preparation-method`）の少なくとも1つに基づく
4. 「2件以上の独立したsourceがこのvariant概念を支持する」**または**「1件の権威ある情報源（政府・メーカー公式・専門家等）がそれ自体でこのvariantを明示している」のいずれかを満たす
5. 「数値の食い違いを解消するためだけに作った」ものではない（人間の研究者が誠実性フラグで明示的に確認する）

`seasoning-amount`（調味料の量の違いのみ）・`source-author`（情報源の著者が違うだけ）・`numeric-difference`（数値が違うだけ）・`brand-preference`（ブランドの好み）・`product-decision`（Product Decision）は、単独では絶対にvariantの根拠にならない。

### Variant Evidence Relation（field単位の分類）

`RecipeFieldVerification.variantRelation`（任意）は、あるfieldのEvidenceがvariant境界に対してどう関係するかを示す純粋な分類メタデータである：`variant-independent`（どのvariantでも共通の事実）/ `variant-specific`（特定の`variantId`固有）/ `unresolved-between-variants`（複数variant候補があり未確定）/ `conflicting-within-variant`（同一variant内の真のConflict）。

**この分類は`isRecipePublishable()`の判定を一切変更しない。** 既存の`supportType`ベースの解決判定（`direct`/`derivation`付き`derived`のみが解決済み、`range`/`variant`/未設定は常に未解決）はMISSION 2.13でも完全に不変である。Variant支援は第二のpublishability gateを作らない。

### Product Decision Firewall（既存原則の再確認）

`RecipeProductDecision`は次のいずれも行えない: Evidenceを作る／Conflictを解決する／Rangeを解決する／Variantを確立する／`review`を`verified`へ昇格させる。Product Decisionは表示・ランキング・フィルタ用の値の選択のみに使う。

### Global / Cultural Neutrality

Variant基盤はlocale・region・canonical food id・将来の世界各国料理と両立する設計とする。ある地域の調理伝統は自動的にConflictを意味しない一方、地域ラベルがあるだけで自動的にVariant成立を意味することもない——distinction は必ずEvidenceが確立する。「本場/authentic」「日本式がデフォルトで優位」等の文化的上下関係・authenticityスコアは実装しない。地域ステレオタイプからvariantを推測することも禁止する。

## Source Silence Policy（MISSION 2.14Bで確立）

**情報源の沈黙は、否定的事実のEvidenceにならない。**

ある情報源が特定の食材・調味料・工程・器具・process上の特徴に一切言及していないとき、その沈黙自体を「使わない」「存在しない」ことの直接支持として扱ってはならない。

例:
- 情報源が塩に言及していない ≠ そのレシピが「塩を使わない」ことのEvidence
- 情報源がふたに言及していない ≠ 「ふたを使ってはいけない」ことのEvidence
- 情報源が水に言及していない ≠ 「水を使わない」ことのEvidence

これはMISSION 2.14Aの監査でmedama-yakiの`seasonings`フィールドが実際に踏んだ誤りである（キッコーマンの沈黙を「塩味なし」の根拠として扱っていた）。否定的事実を確立するには、その情報源が完全な手順を明示的に記述しており、かつ当該要素が意図的に省かれていることが文脈上明らかである場合に限る（例: 「本レシピでは油を使いません」のような明示的な否定文）。単なる話題の不在では成立しない。

**`SourceProcessNote`へ値を記入する際も同じ原則が適用される。** `isCoherenceReviewValid()`（MISSION 2.14B FINAL HARDENING）は、宣言した`reviewedDimensions`に対応する非空の値が`SourceProcessNote`に存在することを機械的に要求するが、この要求を満たすためだけに「lid: 'なし'」のような否定的事実を、情報源が実際には確立していないのに書き込んではならない。その次元について情報源が実際に確立した事実がない場合は、正しい対応は値を捏造することではなく、その次元を`reviewedDimensions`から外す、または`status`を`needs-review`のままにすることである。この規律は機械的には検査されない（人間の誠実性に依存する）。

## Recipe Coherence Review（MISSION 2.14Bで確立）

MISSION 2.14/2.14Aの監査で、sake-shioyaki・medama-yakiの2件について同一の構造的問題が発覚した: 各Critical FieldにField Evidence（「このsourceはこの事実を支持するか」）が個別に存在していても、複数sourceの異なる調理process（火加減sequence・ふた・水・調味の有無等）を組み合わせることで、**どのEvidence Sourceにも実在しないSynthetic Recipe**がVERIFIEDになり得る。

Field EvidenceとRecipe Coherenceは別の問いに答える、独立した必須ゲートである:

- **Field Evidence**: 「この情報源はこの具体的な事実を支持するか？」
- **Recipe Coherence**: 「支持された事実群は、互いに矛盾しない1つのRecipe process（Recipe Identity/Variant内）を構成するか？」

どちらか一方だけでは不十分。Recipe Coherenceは未支持のfieldを支持済みにしない。支持済みのfieldの集合は自動的にCoherenceを意味しない。

### 構造（`types/index.ts`）

`RecipeVerification.coherenceReview?: RecipeCoherenceReview`（任意）。既存Recipeはこのfieldを設定しない限り、`isRecipePublishable()`は自動的にfalseを返す（後述）。既存VERIFIED状態から自動的にcoherentへ移行することは絶対に行わない。

`RecipeCoherenceReview.status`: `'unreviewed' | 'coherent' | 'incoherent' | 'needs-review'`。**`'coherent'`のみが**publishability要件を満たし得る。

`RecipeCoherenceReview.sourceProcessNotes: SourceProcessNote[]` — 各採用sourceが実際にどのprocessを記述しているかの、人間が読んだ事実の要約（`equipment`/`fatOrOil`/`liquidOrWater`/`lid`/`heatSequence`/`flip`/`restOrResidualHeat`/`seasoningSequence`/`preparationSequence`、すべて任意）。source本文の著作物性のある表現をそのまま転記しない（事実構造のみ）。

`RecipeCoherenceReview.reviewedDimensions: ProcessDimension[]` — 比較した次元（`equipment`/`fat-or-oil`/`liquid-or-water`/`lid`/`heat-sequence`/`flip-or-turn`/`rest-or-residual-heat`/`seasoning-sequence`/`major-preparation-sequence`）。authenticity・quality score・culture ranking・popularity・brand preference・sponsor情報は次元として絶対に含めない。

`RecipeCoherenceReview.rationale: string` — なぜcoherent/incoherent/needs-reviewと判断したかの人間による説明。空文字不可。

### Naked Boolean Escape Hatchの禁止

`sourceProcessCompatible: true`のような、根拠構造を伴わないbooleanフラグ単体でCoherenceを成立させることは絶対に行わない。`isCoherenceReviewValid()`（`recipe-publishability.ts`）は次のすべてを機械的に検査する:

1. `status === 'coherent'`
2. `rationale`が空でない
3. `reviewedDimensions`が1件以上
4. `sourceProcessNotes`が1件以上
5. direct/derivedで解決済みの全applicable critical fieldが参照するsourceIdが、漏れなく`sourceProcessNotes`に含まれる（Field Evidenceに寄与しないsourceまでCoherence Reviewの対象にする必要はない）
6. `sourceProcessNotes`が参照する全sourceIdが`EVIDENCE_SOURCE_CATALOG`に実在し、metadataが完全である

AI推測・自動prose比較は一切行わない。人間が入力した構造化metadataの機械的整合性チェックのみ。

### 既存Gateとの独立性（Firewall）

- Range/Conflict Firewall: Coherenceが`coherent`であっても、未解決のRange・reviewNotesによるConflict・NOT_FOUND・未支持のCritical Fieldは引き続き`isRecipePublishable()`を独立にfalseにする。Coherenceはこれらを一切rescueしない。
- Variant Firewall: 正当なVariant確立はCoherenceを意味しない。Coherentな判定はVariantを自動確立しない。両者は完全に独立した概念である。
- Product Decision Firewall: `RecipeProductDecision`はCoherenceを一切確立できない（`isCoherenceReviewValid()`は`productDecisions`を参照しない）。
- Field Evidence Firewall: Coherence Reviewは未支持のfieldのsupportTypeを変更したり、Field Evidence判定を代替したりしない。

### Publishability Gate拡張

既存の唯一の公開判定関数`isRecipePublishable()`を拡張する（第二のgateは作らない）。全既存条件をすべて満たし、かつ`isCoherenceReviewValid()`が`true`の場合のみpublishableになる。`manualPublish`・`trustedOverride`・betaの特例・一時的な例外は一切存在しない。

この変更により、MISSION 2.14B時点で既存44 Recipeのうち`coherenceReview`を明示的に設定しているものは0件であり、**現在VERIFIEDだった/なりかけていたRecipeも含め、明示的にCoherence Reviewされるまで一律publishableでなくなる**。これは意図的な挙動であり、件数を回復するための緩和は行わない。

## cookingTimeMinutes 意味論ポリシー（MISSION 2.14A/2.14Bで確認された未解決の懸念）

現在の`cookingTimeMinutes`フィールドは、Recipeごとに異なる意味論で使われていることが監査で確認された（例: sake-shioyakiは「予熱を除いたactive加熱+余熱」、medama-yakiは「active加熱の一部+NUKITORU独自の予熱見積もり」を混在、shio-musubi/onigiri-noriは「炊飯器のrange時間」と「握るという非加熱の準備作業」を合算）。この不整合はまだ解消していない。

**cookingTimeMinutesの意味論がRecipe横断で正規化されるまで、あるRecipeを、scopeの異なる時間（例: 予熱を含む時間と予熱を含まない時間、加熱時間と非加熱の準備時間）を混在させたderivationによってVERIFIEDにしてはならない。** 単一のsourceが明示する単一の値の機械的合算（例: sake-shioyakiの「4分+3分」——どちらも同一sourceの同一methodについて明示された、同じscopeの直接事実）は許容されるが、scopeの異なる複数の推定を足し合わせて一つの値にすることは、この意味論が確定するまで許容しない。この懸念自体の解消（意味論の正規化）は本ポリシーの範囲外であり、別途Commanderの判断を要する。

## criticalSteps の direct 判定ポリシー（MISSION 2.14A/2.14Bで確立）

`criticalSteps`フィールドに`supportType: 'direct'`を付与するには、引用したEvidence Sourceが**実質的な手順**を直接支持している必要がある。

NUKITORUの文言がsource本文の言い回しをそのままコピーする必要はない——paraphraseは想定内であり、むしろ望ましい（著作物のコピーを避けるため。Source本文の著作物性のある表現の転記は禁止）。

しかし、次のような**実質的な手順の変更**をdirectの名目で隠してはならない:
- 火加減のsequence（例: 強火→弱火の切り替えタイミング）
- ふた・水の有無
- 休ませる・余熱を使う工程の有無
- 裏返す・裏返さないの違い
- 主要な準備工程の有無（例: 卵を先にボウルへ割り入れる工程の省略）
- 調味のsequence（いつ・何を加えるか）

これは**verbatim-copy要件ではなく、semantic equivalence（実質的等価性）要件**である。NUKITORUのstepsが、引用したsourceの実際の手順と実質的に異なる場合（simplifiedすぎる、複数sourceのhybridになっている等）、`supportType`を外し未解決として扱う（`variantRelation: 'unresolved-between-variants'`等で分類可能）。

## Cooking Time Semantics Foundation（MISSION 2.15で確立）

MISSION 2.14A/Bの監査で、既存の`cookingTimeMinutes`（Recipe直下、単一number）がRecipeごとに異なる意味論で使われていることが確認された（sake-shioyaki=活火+余熱・予熱除外、medama-yaki=活火の一部+独自の予熱見積もりが混在、shio-musubi/onigiri-nori=炊飯器のrange時間+非加熱の準備作業が混在）。本セクションは、この不整合を解消するための**型・意味論・Gateの基盤**を確立する（44 Recipeの実データ移行は本MISSIONの範囲外）。

### Evidence Time と User Decision Time の分離

- **Evidence Time**: 情報源が実際に述べる時間（例:「弱火で3〜4分」「予熱3分」「15〜30分置く」「炊飯40〜60分」）。これらはそのままsource factとして保持する。
- **User Decision Time**:「15分以内」「30分以内」「今日は時間がない」の判定・ランキング・フィルタに使う数値。Product Decisionが複数のEvidence Timeから導出してよいが、**元のEvidence Factを書き換えてはならない**。

### TimeValue（Evidence精度の保持）

```ts
type TimeValue =
  | { kind: 'exact'; minutes: number }
  | { kind: 'range'; minMinutes: number; maxMinutes: number }
  | { kind: 'approximate'; minutes: number }
  | { kind: 'unknown' }
```

`3〜4分`を`3.5分`（midpoint）にしない。`約10分`を`exact 10`にしない。不明を推測で埋めない。

### Time Component（時間の構成要素）

`TimeComponentKind`: `activePrepMinutes`（切る・混ぜる・味付け・成形・卵を割る等、意味のあるユーザー作業）/ `activeHeatingMinutes`（炒める・煮る・焼く等、能動的な加熱）/ `passiveCookingMinutes`（炊飯器の炊飯・オーブンでの放置焼き等、ほぼ手を動かさない加熱経過時間）/ `preheatMinutes`（予熱）/ `restingMinutes`（休ませる・漬け込む・水切り・冷ます等、非加熱の待ち時間）/ `residualHeatMinutes`（余熱による加熱）。既存データで実際に区別が必要と判明したこの6種のみ。実データが必要性を証明しない限りカテゴリを追加しない。

### elapsedToReadyMinutes（ユーザー向け中核概念）

「料理を始めてから、食べられる状態になるまでの実経過時間」。`15分以内`/`30分以内`/`今日は時間がない`の主判定に使う。

**単純に全componentを合算しない。** オーブン予熱中に食材を準備する等、フェーズは重なり得る。`elapsedToReadyMinutes`が実際に何を根拠にどう組み合わされたかは、`ElapsedToReadyDerivation.derivation`（人間による明示的な説明、空文字不可）として必ず記録する。根拠のない重なり（overlap）を機械的に推測することは絶対にしない。重なりが立証できない場合はunresolvedのまま（`elapsedToReady`を設定しない）とし、`review`扱いを維持する。

### activeWorkMinutes（手間の意味論、本MISSIONではUI非公開）

「ユーザーが実際に手を動かす時間」。将来の「手間5分」「ほぼ放置」等の表示を見据えた意味論のみを本MISSIONで確立する。放置・余熱・休ませる等の受動的な待ち時間を、調理中に発生するというだけの理由で含めてはならない。

### 保守的フィルタリングポリシー（Section 7）

`「15分以内」`は、Evidenceの上限が15以下の場合のみ適格とする：

| Evidence | 15分以内に適格？ |
|---|---|
| exact 12 | 適格 |
| range 10–15 | 適格（上限=15） |
| range 10–20 | **不適格**（上限=20 > 15） |
| approximate 15 | **既定では不適格**（Evidenceが裏付ける保守的な上限を明示する仕組みは本MISSIONでは未実装） |
| unknown | 不適格 |

`resolvedUpperBoundMinutes()`（`recipe-time.ts`）が実装する。range代表値・中央値選択・「約」のexact化は一切行わない。

### Time Verification（既存Evidence architectureの再利用）

新しい巨大なフレームワークは作らない。`RecipeVerification.timeVerification?: RecipeTimeVerification`（任意）として、既存のsourceIds/derivation/variantIdという語彙をそのまま再利用する：

```ts
interface RecipeTimeVerification {
  components?: TimeComponentFact[]           // 個々のcomponent Evidence（sourceIds/variantId付き）
  sourceStatedTotal?: SourceStatedTotalTime   // 情報源が内訳なしで示す合計時間（gyudon/oyako-don型）
  elapsedToReady?: ElapsedToReadyDerivation   // ユーザー向けProduct Decision（derivation必須）
  activeWork?: ActiveWorkDerivation           // 「手間」の意味論（UI非公開）
}
```

### Recipe Coherenceとの関係（Section 11）

Time EvidenceとRecipe Coherenceは独立したgateである。あるsourceが grill timing を、別のsourceが異なる調理processを提供する場合、両方の時間が個別に正当であっても、Recipe Coherenceがそのprocessの組み合わせを認めない限り、時間を合算してはならない。`isEligibleForMaxElapsedTime()`は、`coherenceReview`が明示的に`coherent`以外と判定されている場合、その時間主張を適格にしない。

### Publishability との分離（Section 18）

**Recipe publishabilityとtime-filter eligibilityは別の問いである。** `isRecipePublishable()`は`timeVerification`を一切参照しない（cookingTimeMinutesの新モデルが不完全であることを理由に、既存recipeが一律publish不可になることはない）。逆に、あるRecipeが将来publishableであっても、`elapsedToReadyMinutes`が`unknown`/未設定であれば、厳密な「15分以内」結果には一切登場できない。

### Legacy `cookingTimeMinutes` の扱い（Section 9/20）

既存の`Recipe.cookingTimeMinutes`（単一number）は、`recipe-suggestion-engine.ts`のハードフィルタ（`maxCookingMinutes`との比較）・ソート・`RecipeDetailView.tsx`の表示・`mock-meal-provider.ts`の`estimatedMinutes`で現在も使用されている。本MISSIONではこれらを**一切変更しない**（ユーザー向け挙動の変更はCommander判断が必要）。当面は「A. legacyとして維持」する。将来的に`elapsedToReadyMinutes`が十分なRecipeで解決されれば「B. 新モデルから導出」への移行を検討できるが、それは別MISSIONの判断とする。

### False Precisionの禁止（Section 17）

range midpoint・任意の丸め・裏付けのない準備時間の追加・裏付けのないoverlapの差し引き・「約」のexact化・機器の予熱時間の推測・炊飯時間の推測・休ませる時間の推測、いずれも禁止。不明は不明のまま。

## FROM NOW TO TABLE Foundation（MISSION 2.15 Phase B で確立）

NUKITORU FOODが最終的に答える問いは「このレシピは何分？」ではなく**「今ある家庭の状態から、何分後に食べられる？」**である。本セクションはその **型・意味論・決定論的 primitive の基盤**を確立する（実 Recipe への適用・UI 公開・inventory 結合は本 MISSION の範囲外）。実装は `from-now-to-table.ts`。

### 3つの時間レイヤーを混同しない

- **A. Source Recipe Time**: 情報源が実際に述べる時間（`RecipeTimeVerification` / `SourceStatedTotalTime` / legacy `cookingTimeMinutes`）。
- **B. Active Work Time**: ユーザーが実際に手を動かす時間（`ActiveWorkDerivation`）。放置・余熱・待ち時間を含めない。
- **C. From-Now-to-Table Time**: 家庭の現状から料理全体が食べられる状態になるまでの実経過時間。**同じ Recipe でも家庭状態によって変わる。静的属性ではない。**

### 最小限の Ingredient Readiness State（Section 5）

`IngredientReadinessState`: `raw` / `ready` / `frozen-ready` / `packaged-ready` / `unknown` の 5 値のみ。巨大な Food State Ontology は作らない。将来 冷凍肉・解凍済み・カット済み野菜・乾物・浸水済み・下茹で済み 等へ拡張可能な設計に留め、今回は実装しない。

### MealStartContext（Section 6）

From-Now-to-Table は Recipe の静的属性ではなく、次の合成である：

```
Recipe Process + Meal Start Context + Ingredient State + Equipment/Process Evidence + Explicit Product Decision
= From-Now-to-Table
```

`MealStartContext.componentStates`（構成要素キー → readiness 状態）。既存 inventory / localStorage / Stock 挙動とは結合しない・変更しない。未指定の構成要素は `unknown` 扱い（推測で埋めない）。

### RICE COUNTS（Section 4/7/14）

「ごはんが既に炊けている」と勝手に仮定してはならない。同じ牛丼でも、炊いたごはん / 冷凍ごはん / 生米 / 状態不明 で From-Now-to-Table は異なりうる。

**禁止**: 炊飯時間を 50 分と仮定・冷凍ごはん解凍を 3 分と仮定・パックごはんを 2 分と仮定・解凍時間の仮定・予熱の仮定・parallelism の仮定・prep overlap の仮定・range の midpoint 化・approximate の exact 化。**Evidence / context がなければ UNKNOWN。**

`raw rice → 炊飯 task → ready rice` / `frozen cooked rice → 再加熱 task → ready rice` / `packaged ready rice → 必要な準備 task → ready rice` / `ready cooked rice → already-ready path` / `unknown → unresolved`。ただし duration を勝手に入れない。

### Task / Dependency primitive（Section 8）

完全な scheduler・AI scheduling・fuzzy inference・自動最適化 engine は作らない。決定論的 primitive のみ：`PrepTask { id, component, description, duration: TimeValue, dependsOn, requiredState?, resultState, sourceIds }` と `MealPlan { mealId, requiredComponents, tasks, declaredParallelGroups? }`。duration は Phase A の `TimeValue` を再利用し Evidence 精度を保持する。

### Parallelism は明示宣言のみ（Section 9/10）

時間を単純加算してはいけない（炊飯 50 + 牛丼 15 = 65 とは限らない）。しかし「並行できそう」という推測も禁止。**依存で順序付けられていない task 同士の overlap は、`declaredParallelGroups` に明示列挙されている場合のみ許可する。** 宣言がなければ関係は未確定 → `unresolved`。

### Critical Path derivation は Product Decision（Section 10）

明示された dependency / parallelism だけを使って From-Now-to-Table を導出する。`max(50, 15)` のような計算結果は Product Decision derivation であり、Evidence Fact へ昇格させない。derivation 文字列（空文字不可）に、どの chain をどう組み合わせたかを必ず記録する。active task の duration が `unknown` / `approximate`（上限未確定）なら `unresolved`。

### Complete Meal Readiness（Section 11）

From-Now-to-Table は、必要な料理構成要素**すべて**が ready になった時点。牛丼なら `rice ready AND gyudon-topping ready`。片方だけ完成しても TABLE READY ではない。

### Evidence Firewall（Section 16）

From-Now-to-Table は Product Decision。`RecipeVerificationStatus` を上げる / `UNVERIFIED→REVIEW` / `REVIEW→VERIFIED` / Recipe Coherence 修復 / Variant conflict 解決 / Evidence Range の exact 化 / Source Silence の Evidence 化 / `isRecipePublishable()` の緩和 / Recipe Evidence source として扱う / 既存 Evidence architecture の迂回、いずれも禁止。`from-now-to-table.ts` は `recipe-publishability.ts` / `recipe-suggestion-engine.ts` / `recipe-catalog.ts` / `recipe-coherence.ts` を import しない。

### Allergy Firewall / Recipe Fact Freeze（Section 17/18）

Allergy HARD EXCLUSION・`allergyConfirmed`・member allergy union・Safety Gate は変更禁止。時間が短いことを理由に unsafe Recipe を候補へ戻さない。`recipe-catalog.ts` の 44 Recipe の fact（requiredIngredients / amounts / seasonings / cookingLiquids / servingsBase / cookingTimeMinutes / equipment / steps）は変更禁止。

### 将来の厳密な「15分以内」意味論（Section 15）

長期的には「15分以内」＝「今の家の状態から 15 分以内に食卓へ出せる」とする（単なる `sourceRecipeTime <= 15` ではない）。`qualifiesForStrictMaxFromNowToTable()` がその foundation を提供する（`unresolved` は絶対に不適格、range は上限で判定）。**本 MISSION では現行の production 15/30 quick filter・UI behavior を一切変更しない。**
