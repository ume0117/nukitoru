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

VERIFIEDに必要な最低限のCritical Field（`RecipeVerifiableField`）: `requiredIngredients` / `ingredientAmounts` / `seasonings`（該当時）/ `seasoningAmounts`（該当時）/ `cookingLiquids`（該当時）/ `cookingTimeMinutes` / `servingsBase` / `criticalSteps` / `equipment`（該当時）/ `allergyIdentity`。

該当しないRecipeにはNOT APPLICABLEとして要求しない（`applicableFieldsFor()`が動的に決定）。Critical Fieldに CONFLICT・NOT_FOUND・unsupported inferenceが1つでも残る場合はVERIFIED禁止（Gate BS/BT/BW）。

## VERIFIED昇格ルール（再掲・厳格化）

RecipeをVERIFIEDへ変更できるのは、次のすべてを満たす場合のみ:

1. 実際にSource本文を開いて確認した（検索snippetのみは不可）
2. sourceIdsが`EVIDENCE_SOURCE_CATALOG`の実在entryを参照する
3. `recipeIdentity`が設定され、必須項目が埋まっている
4. 全applicable Critical Fieldが`direct`または`derivation`付きの`derived`/`range`で解決されている
5. 未解決のCONFLICTが残っていない（`reviewNotes`が空）
6. 未解決のNOT_FOUNDが残っていない
7. `hasUnsupportedInference !== true`
8. Safety Gate（Allergy HARD EXCLUSION等）・既存Evidence Gate（AQ〜BZ）すべてPASS

**1件もVERIFIEDにならなくてもMISSION成功とする。件数目標を設定しない。** 無理な昇格よりも、正しく`review`/`blocked`に留めることの方が高い品質である。
