// ============================================================
// NUKITORU FOOD — Domain Foundation (types only)
//
// MISSION 1 スコープ: 型定義のみ。UI・AI実接続・永続化は含まない。
// 既存NUKITORU（scanner/license/CSV等）とは独立した領域として定義する。
// ============================================================

// ------------------------------------------------------------
// Ingredient（食材）
// ------------------------------------------------------------

export type IngredientUnit =
  | 'piece'
  | 'pack'
  | 'bag'
  | 'bottle'
  | 'box'
  | 'tray'
  | 'bunch'
  | 'sheet'
  | 'head'
  | 'block'
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'unknown'

/**
 * quantityMode は数量の「確信度」を表す。
 * AIはこの値を勝手に 'exact' へ格上げ（＝数量を確定）してはいけない。
 */
export type QuantityMode = 'exact' | 'pack' | 'vague' | 'unknown'

export type VagueAmount = 'many' | 'half' | 'little'

export interface Ingredient {
  id: string
  name: string
  normalizedName?: string

  quantity?: number | null
  unit?: IngredientUnit | null

  quantityMode: QuantityMode

  /** quantityMode === 'vague' のときのみ意味を持つ */
  vagueAmount?: VagueAmount | null
}

// ------------------------------------------------------------
// Household（世帯構成）
// ------------------------------------------------------------

export interface Household {
  adults: number
  children: number
  childrenAges: number[]
}

// ------------------------------------------------------------
// Allergy / Dislike
//
// アレルギーは安全上の強制除外条件、嫌いな食材は優先度を下げる条件。
// 両者を型レベルで明確に分離する（絶対に混同しない）。
// ------------------------------------------------------------

export interface AllergyProfile {
  /** 献立から強制的に除外すべき食材・成分名 */
  allergies: string[]
  /** 優先度を下げるが、除外は強制しない食材名 */
  dislikes: string[]
}

// ------------------------------------------------------------
// Member（一緒に食べる人）
//
// 本名は扱わない。呼び名（label）のみ。
// allergyConfirmed が false の間は、初回アレルギー確認が未完了であることを表す。
// このメンバーが「今日食べる人」に含まれる場合、allergiesは既存のハード除外
// ロジック（mock-meal-provider.ts）へそのまま渡せる形（string[]）を維持する。
// ------------------------------------------------------------

export interface Member {
  id: string
  label: string
  allergies: string[]
  allergyConfirmed: boolean
}

// ------------------------------------------------------------
// Pantry（常備調味料）
// ------------------------------------------------------------

export interface Pantry {
  /** 常備している調味料・乾物等の名前一覧 */
  staples: string[]
}

// ------------------------------------------------------------
// DailyCondition（体調）
//
// 診断用途ではない。医療効果を断定するロジックはここにもAI側にも入れない。
// ------------------------------------------------------------

export type DailyCondition =
  | 'normal'
  | 'tired'
  | 'cold_symptoms'
  | 'low_appetite'
  | 'heavy_stomach'
  | 'summer_fatigue'
  | 'hangover'

// ------------------------------------------------------------
// CookingPreference（調理条件）
// ------------------------------------------------------------

export type ShoppingMode = 'none' | 'one_item' | 'few_items' | 'normal'

export interface CookingPreference {
  maxCookingMinutes: number | null
  shoppingMode: ShoppingMode
}

// ------------------------------------------------------------
// Season（季節・旬）
// ------------------------------------------------------------

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

// ------------------------------------------------------------
// Meal Suggestion（献立提案の入出力構造）
// ------------------------------------------------------------

export interface MealSuggestionRequest {
  ingredients: Ingredient[]
  household?: Household
  allergyProfile?: AllergyProfile
  pantry?: Pantry
  dailyCondition?: DailyCondition
  cookingPreference?: CookingPreference
  season?: Season
}

export type DishType = 'main' | 'side' | 'soup' | 'other'

export interface RequiredIngredient {
  name: string
  amount?: string
}

export interface Dish {
  name: string
  type: DishType
  requiredIngredients: RequiredIngredient[]
}

export interface MealSuggestion {
  title: string
  reason: string

  dishes: Dish[]

  estimatedMinutes: number | null

  shoppingItems: string[]

  notes: string[]

  /**
   * MISSION 2.11 PHASE C — この提案の元になったRecipeのid（任意）。
   * 将来のRecipe詳細画面（準備するもの/作り方/ちょいアレンジ）が、
   * ここから RECIPE_CATALOG を再検索して詳細情報を表示できるようにする。
   * 既存のcombo型suggestion（複数dishesを持つ場合）にはまだ付与しない。
   */
  recipeId?: string

  /**
   * MISSION 2.11 PHASE D — 「今ある食材で作れる」(true) か
   * 「あと1つで作れる」(false) かをUI側が文字列パース（reasonの文言判定等）
   * に頼らず判定できるようにする明示的フラグ。
   * A（true）は候補一覧で常にB（false）より上位に表示・優先される
   * （NUKITORU FOODの最重要コンセプト。この優先順位を逆転させない）。
   */
  isFullyAvailable?: boolean

  /** isFullyAvailable=false の場合に不足している食材名（元のRecipe表記のまま） */
  missingIngredients?: string[]

  /**
   * AI提案が守るべき制約の可視化領域。将来の実装は例えば以下を warnings に含めることを想定する:
   * - 存在しない食材を家にあると断定していないか
   * - unknown quantity を勝手に数値化していないか
   * - allergies 対象を献立に含めていないか
   * - 生食不可食材を生食提案していないか
   * - 医療効果を断定していないか
   * - 危険な保存状態を安全と断定していないか
   */
  warnings: string[]
}

export interface MealSuggestionResponse {
  suggestions: MealSuggestion[]
}

// ------------------------------------------------------------
// MISSION 2.12 PHASE A — Dinner Decision MVP
//
// 「提案された」ではなく「選ばれた」を将来測定できるようにするための、
// 最小限のDecision/Feedback概念。大規模analyticsは作らない。
// allergy情報・世帯プロフィール・共有先/連絡先はこれらの型に一切含めない
// （フィールドとして存在しないため、実装側が誤って複製することもできない）。
// ------------------------------------------------------------

export type MealCandidateType = 'A' | 'B'

export interface MealDecision {
  recipeId: string
  decidedAt: string
  selectedMemberIds: string[]
  candidateType: MealCandidateType
}

export type MealFeedbackRating = 'good' | 'neutral' | 'bad'

export interface MealFeedback {
  recipeId: string
  recordedAt: string
  rating: MealFeedbackRating
}

// ============================================================
// MISSION 2.2 — Household Profile & Stock Master (types only)
//
// 「一度決めれば毎回入力しなくてよい情報」を保存するための追加型。
// 既存の Household / AllergyProfile / Pantry はそのまま再利用し、
// ここでは新しい概念（食の好み・常備食材/冷凍庫/保存食品）のみを追加する。
// mock-meal-provider.ts の献立選定ロジックへはまだ組み込まない。
// ============================================================

// ------------------------------------------------------------
// FoodPreferences（食の好み）
// ------------------------------------------------------------

export type SpiceLevel = 'none' | 'mild' | 'medium' | 'hot'

export type Cuisine = 'japanese' | 'western' | 'chinese' | 'korean' | 'italian' | 'other'

export interface FoodPreferences {
  favoriteIngredients: string[]
  favoriteCuisines: Cuisine[]
  spiceLevel: SpiceLevel | null
}

// ------------------------------------------------------------
// Stock Master（常備食材 / 冷凍庫 / 保存食品）
//
// 既存 Pantry.staples（常備調味料）とは別概念。
// 「staples」という語の意味が重複しないよう、
// ここでは regularFoods / frozenFoods / pantryFoods という名前を使う。
// ------------------------------------------------------------

export type StorageLocation = 'room_temperature' | 'refrigerated' | 'frozen'

/**
 * 常備品マスターの1項目。
 * defaultStorageLocation / tags は将来拡張用の構造で、
 * MISSION 2.2では献立選定・保存場所の入力には使用しない。
 */
export interface StockMasterItem {
  id: string
  label: string
  defaultStorageLocation?: StorageLocation
  tags?: string[]
  /** 「よく使うもの」として初期表示するか。配列の並び順には依存しない */
  featured?: boolean
}

export interface MasterGroup {
  label: string
  items: StockMasterItem[]
}

export interface StockCategories {
  regularFoods: string[]
  frozenFoods: string[]
  pantryFoods: string[]
}

// ------------------------------------------------------------
// MISSION 2.3 — Current Stock Status
//
// 「常備品として登録しているか（ON/OFF）」と「今、実際にあるか」は別概念。
// このStockStatusは後者（現在庫）のみを表し、Pantry.staples / regularFoods /
// frozenFoods / pantryFoods の配列（常備品ON/OFF）とは完全に独立して保存する。
// ------------------------------------------------------------

export type StockStatus = 'available' | 'low' | 'out'

export interface StockStatusEntry {
  status: StockStatus
  updatedAt?: string
}

// ============================================================
// MISSION 2.11 PHASE A — Recipe Schema Foundation
//
// 既存 Dish / MealSuggestion 等は変更しない。Recipeは将来のcatalog拡張・
// 複数候補化・詳細画面（準備するもの/作り方/ちょいアレンジ）に備えた
// データ構造のみをここで定義する。今回はcatalogへの投入・候補生成ロジック
// への組み込みは行わない（既存の動作は一切変わらない）。
//
// アレルギー安全性の絶対ルール:
//   allergyRelevantIngredients(recipe) = requiredIngredients + seasonings
// arrangements.addIngredients は基本Recipeのハード除外対象に含めない
// （アレンジのために基本料理そのものまで除外しない）。個別のアレンジ提案は
// 別途 addIngredients だけを対象に安全判定できる構造にする。
// ------------------------------------------------------------

export interface RecipeArrangement {
  id: string
  label: string
  /** このアレンジ特有の追加食材。基本Recipeのアレルギー判定には含めない */
  addIngredients?: string[]
}

/**
 * MISSION 2.11 PHASE D.3 — Recipe Ingredient & Seasoning Amount Foundation。
 *
 * amountはあえて string とし、value:number/unit:string等への過剰な構造化は
 * しない（大さじ1と1/2、1/2個、少々、適量 等、数値だけでは表現できない
 * 日本語の分量表現をそのまま保持するため）。将来の自動人数換算schemaは
 * 別MISSIONで設計する。
 *
 * amountは常に「Recipe.servingsBase人数分の基準量」を表す。
 * selectedMembers数（今日の人数）に応じた自動計算・自動換算は行わない。
 *
 * name / amount を別フィールドにすることで、将来の英語UI展開時に
 * nameだけを翻訳・置換できる構造を維持する（"大さじ"等のlocale変換は
 * 別MISSION）。
 */
export interface RecipeIngredient {
  name: string
  amount: string
}

/**
 * MISSION 2.11 PHASE D.4 — 調理に必要だが候補判定・Stock照合・
 * allergy判定の対象にしない基礎液体（水・湯のみを想定）。
 * requiredIngredientsへ入れない理由: ユーザーが冷蔵庫に「水」を
 * 登録しないとRecipeがA候補にならない、という不自然なUXを避けるため。
 * amountはRecipeIngredientと同様、servingsBase人数分の基準量。
 */
export interface RecipeCookingLiquid {
  name: string
  amount: string
}

/**
 * MISSION 2.11 PHASE D.5 — Allergen Alert Foundation。
 *
 * しょうゆ・味噌・だしの素等、レシピ上は単純な調味料名だが実際の商品に
 * よって原材料・アレルゲンが異なり得るものへの「原材料表示を確認してください」
 * 注意喚起（PRODUCT CHECK ALERT）を表す。
 *
 * これは既存のAllergy HARD EXCLUSION（allergyRelevantIngredients経由の
 * 候補除外）とは完全に別のレイヤーであり、candidate A/B判定・
 * allergyRelevantIngredientsのいずれにも一切使わない。
 *
 * messageをここに持たせない理由: 表示文言を44件（将来数千件）のRecipe
 * データに複製すると、Recipe Factoryでの大量生成時に文言が揺れたり、
 * 誤って「含みません」等の安全断定表現が紛れ込むリスクが上がる。
 * 表示文言は product-check-messages.ts の1箇所に集約し、ここでは
 * ingredientNameのみを保持する（recipe-labels.tsのCUISINE_LABELSと
 * 同じ「データはid、表示文言は別レイヤー」の設計に揃える）。
 */
export interface RecipeIngredientCheck {
  /** requiredIngredients または seasonings に実在するcanonical名と一致させる */
  ingredientName: string
}

/**
 * MISSION 2.11 PHASE C — 将来世界各国の家庭料理を扱うためのcuisine分類。
 * 既存 FoodPreferences.favoriteCuisines が使う Cuisine 型（'western'という
 * 大括りを持つ）とは別の型として独立させ、既存機能へは影響させない。
 * 「無理に外国料理へ分類しない」方針のため、家庭で一般的な和食は
 * 'japanese' とし、由来が明確な料理のみ個別のcuisineを付与する。
 */
export type RecipeCuisine =
  | 'japanese'
  | 'chinese'
  | 'korean'
  | 'italian'
  | 'french'
  | 'thai'
  | 'vietnamese'
  | 'indian'
  | 'mexican'
  | 'american'
  | 'spanish'
  | 'other'

/**
 * MISSION 2.11 PHASE D.6 — Recipe Provenance & Fact/Evidence Gate。
 *
 * 「レシピの重要情報には事実と根拠が必須」というルールをschema化する。
 * AIの一般知識・推測だけでRecipeの重要情報（分量・水量・調理時間・工程等）を
 * 確定してはならない。根拠が確認できない場合はunverified/reviewに留め、
 * 矛盾する情報源がある場合も平均値等をAI判断で作成しない。
 *
 * unverified = Evidence確認前（Recipe.verification未設定はこの状態として扱う）
 * review     = 根拠は存在するが、source間差異や判断事項があり人間確認が必要
 * verified   = 必要な事実・根拠が確認され、validationを通過
 * blocked    = 根拠不足・矛盾・重要情報欠落・unsupported inference等により公開不可
 */
export type RecipeVerificationStatus = 'unverified' | 'review' | 'verified' | 'blocked'

/**
 * Source品質のTier分類（詳細はEVIDENCE_POLICY.md参照）。
 * 匿名投稿・出所不明・AI生成ページはいずれの型にも該当しない
 * （＝型システム上、正当なsourceTypeとして登録できない）。
 */
export type RecipeSourceType =
  | 'government'
  | 'public-institution'
  | 'manufacturer'
  | 'professional'
  | 'other-trusted'

/**
 * Evidence Source（情報源）。RecipeへEmbedせず、evidence-sources.tsの
 * EVIDENCE_SOURCE_CATALOGへ集約し、RecipeVerification.sourceIdsで参照する
 * （数千〜数万Recipeでも同一sourceの重複複製が起きない正規化設計）。
 * URLが存在するだけではEvidence成立とみなさない
 * （publisher/title/sourceType/checkedAtも必須）。
 */
export interface RecipeEvidenceSource {
  id: string
  publisher: string
  title: string
  url: string
  sourceType: RecipeSourceType
  /** ISO日付文字列。この情報源をいつ確認したか */
  checkedAt: string
  /**
   * MISSION 2.11 PHASE E.1 — Global Foundation。この情報源が属する国（任意）。
   * 「日本の情報源だから日本食にしか使えない」という単純ルールを意味しない
   * （relevanceはRecipe Identity + variant + country/region contextの組み合わせで
   * 人間が判断する。この値だけで自動フィルタしない）。既存14 sourceは未設定のまま
   * （書き換え不要・省略時は従来通り扱う）。
   */
  sourceCountry?: CountryCode
  /** この情報源の言語/ロケール（任意）。sourceCountryと同様、単独で判定材料にしない */
  sourceLocale?: Locale
  /**
   * MISSION 2.17 Part A — Evidence Traceability（任意）。
   * URLの存在は「NUKITORUが何を確認したか」の証明にならない（web内容は後日変わりうる）。
   * 実際に本文を開いて確認した時点と、その時観測した内容の決定論的な指紋を記録する。
   * 未設定の既存sourceは「legacy / fingerprint不明」として扱う（"unchanged"とは見なさない）。
   */
  observation?: EvidenceSourceObservation
}

/**
 * MISSION 2.17 Part A — 実際に本文を確認したときの観測記録。
 *
 * `contentFingerprint` は「NUKITORUが依拠した事実」を要約したNUKITORU自作の
 * 正規化文字列の **SHA-256（64桁小文字16進）** であり、**source本文の複製ではない**
 * （source本文はハッシュも保存もしない）。同一URLで後日fingerprintが変われば
 * 「内容が変わった」ことだけを検出できる。
 *
 * fingerprintは以下を一切証明しない（`evidence-traceability.ts` にも明記）:
 * - Evidenceの品質 / 情報源の権威 / 掲載内容の真正性 / レシピの正しさ / レシピの安全性
 * - RecipeVerificationStatus / VERIFIED適格性（fingerprintはVERIFIEDの根拠にならない）
 *
 * HUMAN-SUMMARY LIMITATION: 人間の観測サマリが不完全なら、記録されなかった事実の
 * 変化はfingerprintでは検出できない。fingerprintの品質は観測の網羅性に依存する。
 * 将来は自由記述ではなく構造化した観測へ進みうるが、本MISSIONでは実装しない。
 */
export interface EvidenceSourceObservation {
  /** 観測時に依拠した事実の正規化サマリ（NUKITORU自作）のSHA-256（64桁小文字16進） */
  contentFingerprint: string
  /** このfingerprintを記録した日付（ISO）。source.checkedAtとは別に観測ごとに持つ */
  observedAt: string
  /**
   * 任意。この観測を再確認すべき目安の日付（ISO）。
   * 全sourceへ一律の間隔は課さない（source種別ごとに将来方針が異なりうるため、
   * 「普遍的な再確認間隔」はこのMISSIONでは定義しない）。
   */
  reverifyAfter?: string
  /** 任意。最後に再確認した日付（ISO）。未設定なら初回observationのまま */
  lastReverifiedAt?: string
}

// ============================================================
// MISSION 2.17 Part B — Quantity Semantics Foundation
//
// 食材・調味料の分量は必ずしもexact numberではない。ユーザーに見せる
// 表示テキスト（displayText）と、Evidenceシステムがその分量について
// 知っている意味（semantics）を明確に分離する。
//
// 本MISSIONは「表現できること」だけを保証する。既存44 Recipeの
// amount文字列は移行しない（no mass migration・no regex/AI/fuzzy推論）。
// semanticsはEvidenceを生まない（`quantity-semantics.ts` の firewall 参照）。
// ============================================================

/**
 * ある分量についてEvidenceシステムが知っている意味。
 * - exact:        情報源が単一の数値を明示（例: しょうゆ大さじ2）
 * - range:        情報源が範囲を明示（midpointへ収縮させない。例: 3〜4分）
 * - approximate:  情報源が「約」等で概数を示す（exact化しない）
 * - to-taste:     適量・お好みで（作り手が調整する。数値化しない）
 * - optional:     入れなくてよい（省略が許容される）
 * - unknown:      NUKITORUが分からない（推測で埋めない）
 * - culinary-term: 少々・ひとつまみ 等、情報源自身がその語を使っている
 *
 * 「ひとつまみ」は自動的に「適量」と同じではない。「少々」は自動的に
 * 数値rangeではない。「お好みで」はユーザーの選択を表す。これらの意味は
 * 型として区別されたまま保持される。
 */
export type QuantitySemantics =
  | { kind: 'exact'; value: number; unit: string }
  | { kind: 'range'; min: number; max: number; unit: string }
  | { kind: 'approximate'; value: number; unit: string }
  | { kind: 'to-taste' }
  | { kind: 'optional' }
  | { kind: 'unknown' }
  | { kind: 'culinary-term'; term: string }

/**
 * ある分量についての、表示テキスト・意味論・根拠の対応（任意）。
 * 将来 RecipeIngredient 等へ紐付ける想定だが、本MISSIONでは型のみ定義し、
 * 既存Recipeには一切付与しない。
 */
export interface QuantityStatement {
  /** ユーザーに見せる文字列（例:「塩 ひとつまみ」「しょうゆ 適量」）。常に保持する */
  displayText: string
  /** その分量についてEvidenceシステムが知っている意味 */
  semantics: QuantitySemantics
  /**
   * このsemanticsを裏付けるsourceId（任意）。空/未設定は「意味論は記録したが
   * Evidenceで裏付けられていない」状態を表す。semanticsがEvidenceを生まない
   * ことの担保として、unknown→他への変更にはこのidが必須（quantity-semantics.ts）。
   */
  evidenceSourceIds?: string[]
  /** このsemanticsをどう判断したかのNUKITORU自作の説明（任意） */
  rationale?: string
}

/** Field-level evidenceの対象領域（Recipeの重要情報のうちEvidence追跡が必要なもの） */
export type RecipeVerifiableField =
  | 'requiredIngredients'
  | 'ingredientAmounts'
  | 'seasonings'
  | 'seasoningAmounts'
  | 'cookingLiquids'
  | 'cookingTimeMinutes'
  | 'servingsBase'
  | 'criticalSteps'
  | 'equipment'
  | 'allergyIdentity'
  // MISSION 2.20 — Recipe.preparation（調理開始前の下ごしらえ・待機）を持つRecipeでのみ
  // applicableになる（applicableFieldsFor参照）。既存44 Recipeはpreparation未設定＝対象外。
  | 'preparation'

/**
 * MISSION 2.11 PHASE D.7-B / D.7-B.1 — Evidence Resolution Protocol。
 * fieldVerificationがどの根拠区分に基づくかを明示する（EVIDENCE_POLICY.md参照）。
 *
 * - direct: Sourceに書かれた値がNUKITORUの値と直接一致する（導出不要）
 * - derived: Sourceに直接同じ値はないが、明示された事実（複数の直接事実の組み合わせ等）
 *            から機械的・説明可能に導出した（derivationフィールドに導出方法・使用した
 *            事実・計算式・前提条件を必ず記録する。rangeからの代表値選択はここに含めない）
 * - range: Sourceがrange（例:40〜60分）のみを提示しており、Recipeの値（単一の数値）が
 *          そのrangeから選ばれた代表値であることを示す。
 *          【D.7-B.1で確定した絶対ルール】rangeはVERIFIEDの「解決済み」として
 *          **絶対にカウントしない**。derivationを付けても、明示的なNUKITORU Product
 *          Policyを記録しても、rangeが「exact値のEvidence直接支持」に昇格することはない。
 *          「rangeの中央値を採用すればEvidence上のexact valueになる」という扱いは禁止。
 *          Evidence Fact上、40〜60分は最後まで40〜60分である。実際にRecipeへ採用した
 *          単一の値は、Evidenceではなく`RecipeVerification.productDecisions`に
 *          Product Decisionとして別途記録する（isRecipePublishableの判定には使わない）。
 * - variant: Sourceは実在するが、料理のvariant/styleがNUKITORUと異なるため直接支持にならない
 *            （variant supportのみのfieldはVERIFIEDの「解決済み」としてカウントしない）
 */
export type EvidenceSupportType = 'direct' | 'derived' | 'range' | 'variant'

export interface RecipeFieldVerification {
  field: RecipeVerifiableField
  /** この情報を裏付けるsourceId（RecipeVerification.sourceIdsの部分集合） */
  sourceIds: string[]
  /** この根拠がどの区分か（未設定はvariant相当＝VERIFIEDの解決済みとしてカウントしない） */
  supportType?: EvidenceSupportType
  /** supportTypeが'derived'の場合は必須: 導出方法・使用した事実・計算式・前提条件 */
  derivation?: string
  /**
   * supportTypeが'range'の場合、Evidence Fact自体のmin/maxをそのまま保持する
   * （exact値へ収縮させない。単位は自由記述、例: "分"）。
   */
  evidenceRange?: { min: number; max: number; unit: string }
  /**
   * MISSION 2.13 — Evidence Variant Foundation。このfieldのEvidenceがvariant境界に
   * 対してどう関係するかの分類（純粋なメタデータ。isRecipePublishable()は参照しない）。
   */
  variantRelation?: VariantEvidenceRelation
  /** variantRelationが'variant-specific'の場合のみ意味を持つ。対応するRecipeVariantIdentity.variantId */
  variantId?: string
}

/**
 * MISSION 2.11 PHASE D.7-B.1 — Product Decision。
 *
 * EvidenceがrangeまたはNOT_APPLICABLEな粒度でしか事実を提供しない場合でも、
 * Recipe schemaやUI・candidate filter（例: cookingTimeMinutesという単一数値の
 * フィールド）は具体的な1つの値を必要とする。その「具体的な1つの値を採用する」
 * という判断はEvidence Factそのものではなく、NUKITORU側のProduct Decisionである。
 * Product DecisionはisRecipePublishable()のEvidence解決判定には一切使わない
 * （Product Decisionを積んでもVERIFIEDへは近づかない）。UI側でこの値を
 * 「Evidenceが直接支持した値」であるかのように表示してはならない。
 */
export interface RecipeProductDecision {
  field: RecipeVerifiableField
  /** 採用した具体的な値（Recipe本体のamount等と一致させる） */
  value: string
  /** なぜこの値を採用したか（rangeのどこを、どんな理由で選んだか） */
  reason: string
  /** 参考にしたsourceId（参考情報であり、Evidence resolutionの根拠にはしない） */
  referenceSourceIds?: string[]
}

/**
 * MISSION 2.11 PHASE D.7-B — Recipe Identity。
 *
 * 「同じ料理名なら同じRecipe」という扱いを禁止するための最小限の識別情報。
 * 「牛丼」という名前だけで異なる牛丼Sourceを混ぜたり、「まぐろ丼」と「漬けまぐろ丼」を
 * 混同したりしないよう、Evidence比較の前提としてRecipeが何を指すかを明示する。
 * Evidence Verified = 「世界で唯一正しい味」ではない。料理には複数の正当なvariantが
 * 存在し、NUKITORUはRecipe Identity・intended taste profile・Evidenceの組み合わせを
 * 検証する（例: 家庭的/濃いめ/あっさり/メーカー公式style/地域style等）。
 */
export interface RecipeIdentity {
  /** 料理の系統名（例: "鶏そぼろ丼"）。Recipe.nameと同じでよいが、明示的に固定する */
  canonicalDish: string
  /** variant/style（例: "二色丼(みそ味)ではないシンプルな3種調味料そぼろ"） */
  variant: string
  /** このRecipe Identityが前提とする基準人数 */
  servingsBasis: number
  /** 想定する味の方向性（例: "家庭的・あっさりめ"）。唯一の正解を意味しない */
  intendedTasteProfile: string
  /** 核となる調理法（例: "ひき肉をしょうゆ・砂糖・みりんで炒め煮する"） */
  coreMethod: string
  /** このRecipeを特徴づける食材（比較時にvariant一致判定の基準にする） */
  definingIngredients: string[]
  /**
   * MISSION 2.11 PHASE E.1 — Global Foundation。このRecipe Identityが前提とする
   * 国/地域文脈（任意）。Cuisine（RecipeCuisine）とは別概念（例: 「イタリア料理」だが
   * 前提とする作り手はJP、のようなケースを将来表現できるようにする）。
   * 既存recipeIdentityは未設定のままでよく、書き換え不要。
   */
  originContext?: RegionContext
  /**
   * MISSION 2.13 — Evidence Variant Foundation。このRecipe Identityが具体的に
   * どのRecipeVariantIdentityへ紐づくか（任意）。「同じ料理名」を理由にした
   * variant混同を防ぐための、安定したID付きの構造化variant情報。
   * `variant`（自由記述の説明文）は引き続き維持し、この構造化フィールドで
   * 置き換えない。既存recipeIdentityは未設定のままでよく、書き換え不要。
   */
  variantIdentity?: RecipeVariantIdentity
}

/**
 * MISSION 2.13 — Evidence Variant Foundation。
 *
 * 「同じ料理の、正当な別の作り方」を表す、安定した人間管理IDによる識別情報。
 * 数値の食い違いを解消するためだけに新設してはならない（EVIDENCE_POLICY.md参照）。
 * AI生成・fuzzy matching・source数の多数決による自動生成は絶対に行わない。
 */
export interface RecipeVariantIdentity {
  /** 安定したID。数値conflictの解消のためだけに作らない */
  variantId: string
  /** 任意。将来のCanonicalFoodId的な「料理そのもの」への緩い紐付け */
  canonicalDishId?: string
  /** 人間が読むための表示用ラベル（UI表示用ローカライズ文言ではない） */
  label?: string
  /** 例: "フライパン法（油・酒・ふた使用）"、"だし仕立て" */
  preparationStyle?: string
  /**
   * このvariantを正当に区別する具体的な調理上の特徴（cooking method / sauce-base
   * structure / major ingredient structure / regional style / serving form /
   * preparation method等）。以下だけを根拠に設定してはならない:
   * 数値の違いのみ・情報源の著者の違いのみ・ブランドの好み・Product Decision。
   */
  definingCharacteristics: string[]
}

/**
 * MISSION 2.13 — Evidence Variant Foundation。
 * ある1つのfieldのEvidenceが、variantの境界に対してどう関係するかの分類。
 * 純粋な分類メタデータであり、isRecipePublishable()の判定を緩めたり
 * 迂回したりするために一切参照されない（既存supportTypeベースの判定は不変）。
 */
export type VariantEvidenceRelation =
  /** このfieldの事実はvariantに依存しない（どのvariantでも同じ） */
  | 'variant-independent'
  /** このfieldの事実は特定のvariantId固有（RecipeFieldVerification.variantId参照） */
  | 'variant-specific'
  /** 複数のvariant候補が存在し、どちらに属するfieldなのかまだ確定していない */
  | 'unresolved-between-variants'
  /** 同一variant内で、値そのものが矛盾している（真のConflict） */
  | 'conflicting-within-variant'

// ============================================================
// MISSION 2.14B — Recipe Coherence Review
//
// MISSION 2.14/2.14Aで発覚した問題: 各Critical FieldにEvidence metadataが
// 個別に存在していても、複数sourceの異なる調理process（火加減・ふた・水・
// 調味の有無等）を組み合わせることで、「どのEvidence Sourceにも実在しない
// Synthetic Recipe」がVERIFIEDになり得る（sake-shioyaki・medama-yakiの
// 2件で実際に確認）。
//
// Recipe Coherence Reviewは、Field Evidence（「このsourceはこの事実を
// 支持するか」）とは別次元の問い（「支持された事実は互いに矛盾しない
// 1つのprocessを構成するか」）に答えるための、最小限の人間管理メタデータ。
// AI推測・自動比較は行わない。既存のField Evidence判定・Variant判定・
// Product Decision判定を一切代替・迂回しない（Section 8/9/10参照）。
// ============================================================

/**
 * Recipe Coherence Reviewで比較対象とする調理上の次元。意味のある不整合を
 * 検出するために必要な最小集合のみ（authenticity/quality score/culture
 * ranking/popularity/brand preference/sponsor情報は意図的に含めない）。
 */
export type ProcessDimension =
  | 'equipment'
  | 'fat-or-oil'
  | 'liquid-or-water'
  | 'lid'
  | 'heat-sequence'
  | 'flip-or-turn'
  | 'rest-or-residual-heat'
  | 'seasoning-sequence'
  | 'major-preparation-sequence'

/**
 * 1つのEvidence Sourceが実際にどのprocessを記述しているかの、人間が読んだ
 * 事実の要約。sourceの原文をコピーするのではなく、事実構造のみを短く記録する
 * （Section 20: NUKITORU Recipeの文言・source本文の著作物性のある表現は
 * ここに転記しない）。全フィールド任意（そのsourceが言及していない次元は
 * 空のままにする＝「言及なし」を明示的な事実として偽装しない）。
 */
export interface SourceProcessNote {
  sourceId: string
  equipment?: string
  fatOrOil?: string
  liquidOrWater?: string
  lid?: string
  heatSequence?: string
  flip?: string
  restOrResidualHeat?: string
  seasoningSequence?: string
  preparationSequence?: string
}

export type RecipeCoherenceStatus =
  /** 人間によるCoherence Reviewが未実施 */
  | 'unreviewed'
  /** 採用したEvidence Sourceの、このRecipeで実際に使用された事実群が、
   *  互いに矛盾しない1つのprocessとして明示的に確認済み */
  | 'coherent'
  /** 既知の非互換なprocess事実が組み合わされていることが判明している */
  | 'incoherent'
  /** 互換性を判定するための情報が不足している */
  | 'needs-review'

/**
 * Recipe全体としてEvidenceが1つの整合したprocessを構成するかどうかの
 * 人間によるレビュー記録。isRecipePublishable()はstatus==='coherent'かつ
 * 構造的に妥当な場合のみこれを満たしたとみなす（recipe-publishability.ts
 * のisCoherenceReviewValid()参照）。空のbooleanフラグでは成立しない
 * （Section 6: naked boolean escape hatch禁止）。
 */
export interface RecipeCoherenceReview {
  status: RecipeCoherenceStatus
  sourceProcessNotes: SourceProcessNote[]
  reviewedDimensions: ProcessDimension[]
  /** なぜcoherent/incoherent/needs-reviewと判断したかの人間による説明。空文字不可 */
  rationale: string
}

// ============================================================
// MISSION 2.11 PHASE E.1 — Global Foundation
// Locale / Country / Units / Canonical Food Identityの最小基盤。
// 詳細な設計方針はGLOBAL_FOUNDATION.md参照。
//
// 絶対原則:
// - Locale ≠ Country ≠ Language ≠ Cuisineであり、混同しない。
// - 表示文字列（米/rice/riz等）そのものをFood Identityとして扱わない
//   （canonicalFoodIdは表示文字列から独立したidであり、fuzzy matchingでは解決しない）。
// - ここに追加する型は既存のRecipe/RecipeIngredient/RecipeCuisine/
//   ingredient-normalization.ts/recipe-safety.tsの挙動を一切変更しない
//   （Allergy HARD EXCLUSION・既存44 Recipeの内容は無傷のまま）。
// ============================================================

/**
 * MISSION 2.11 PHASE E.1.1 — ISO 639-1相当の言語コードを表すGlobal（open）primitive。
 * 「現在ja/enのみサポートしている」ことと「将来世界中の言語コードを表現できる基盤である」
 * ことを混同しない。型としてはstringであり、'ja'|'en'に構造的に限定されない
 * （将来ko/zh/th等を追加してもこの型自体の再設計は不要）。
 * 現在NUKITORUがProductとして正式サポートする言語は SupportedLanguageCode を参照する。
 * 形式検証が必要な場合は global-codes.ts の isValidLanguageCodeFormat() を使う
 * （大規模なISO 639 datasetは導入しない）。
 */
export type LanguageCode = string

/**
 * ISO 3166-1 alpha-2相当の国コードを表すGlobal（open）primitive。
 * LanguageCodeと同じ設計方針（現在JP/USのみサポート、将来任意の国コードを表現できる
 * 基盤であることを混同しない）。現在の正式サポート国は SupportedCountryCode を参照する。
 */
export type CountryCode = string

/**
 * 現在NUKITORUがProductとして正式サポートする言語（closed）。LanguageCodeの部分集合。
 * サポート言語を追加する際はこのunionとglobal-codes.tsのSUPPORTED_LANGUAGESを更新する
 * （LanguageCode自体の再設計は不要）。
 */
export type SupportedLanguageCode = 'ja' | 'en'

/**
 * 現在NUKITORUがProductとして正式サポートする国（closed）。CountryCodeの部分集合。
 * サポート国を追加する際はこのunionとglobal-codes.tsのSUPPORTED_COUNTRIESを更新する
 * （CountryCode自体の再設計は不要）。
 */
export type SupportedCountryCode = 'JP' | 'US'

/**
 * Language/Country/Localeは概念的に別軸。Localeは常にlanguageとcountryの組で表現し、
 * 「日本語=日本」のような暗黙の等値化をしない（例: 将来のen-GB/en-AUはlanguage:'en'
 * のままcountryだけが変わる）。LanguageCode/CountryCodeがopenになったため、Localeも
 * 構造的にja-JP/en-US以外を表現できる。
 */
export interface Locale {
  language: LanguageCode
  country: CountryCode
}

/**
 * 現在NUKITORUがProductとして正式サポートするlocale（closed）。構造的にLocaleの部分集合
 * （SupportedLanguageCode ⊂ LanguageCode、SupportedCountryCode ⊂ CountryCodeのため、
 * SupportedLocaleの値はそのままLocaleとしても扱える）。
 */
export interface SupportedLocale {
  language: SupportedLanguageCode
  country: SupportedCountryCode
}

/**
 * Cuisine（RecipeCuisine）とCountry/Regionは別概念。「日本料理=日本製」
 * 「イタリア料理=イタリアでしか作られない」という前提を置かない。
 * regionは自由記述の最小構造（今はenum化しない）。
 */
export interface RegionContext {
  country?: CountryCode
  region?: string
}

/**
 * 表示文字列から独立したFood Identity。「米」「rice」「riz」等の表示ラベルは
 * すべてこのidに紐づくlabel/synonymに過ぎず、id自体が文字列比較のfuzzy matchingで
 * 解決されることは絶対にない（canonical-food.ts参照）。
 */
export type CanonicalFoodId = string

export interface CanonicalFoodLabel {
  canonicalFoodId: CanonicalFoodId
  locale: Locale
  label: string
  /** そのlocale内での表記ゆれ（人間が確認した明示リストのみ。fuzzy matching禁止） */
  synonyms?: string[]
}

/**
 * 単位の基盤型（今回は型定義のみ。自動換算ロジックは実装しない）。
 * US cup / metric cup / Japanese cupは意図的に別値として区別する。
 * 大さじ/小さじ（osaji/kosaji）もUS tsp/tbspとは別概念として区別する。
 */
export type UnitCode =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'tsp'
  | 'tbsp'
  | 'osaji'
  | 'kosaji'
  | 'cup-us'
  | 'cup-metric'
  | 'cup-jp'
  | 'oz'
  | 'lb'
  | 'piece'
  | 'other'

export interface Quantity {
  value: number
  unit: UnitCode
  /** Evidence Sourceに記載された原文の単位表記をそのまま保持する（無言換算・丸め禁止） */
  rawText?: string
}

// ============================================================
// MISSION 2.15 — Cooking Time Semantics Foundation
//
// 既存の`cookingTimeMinutes`（Recipe直下、単一number）はcandidate ranking/
// UI表示のためのlegacy fieldとして引き続き利用する（本MISSIONでは一切
// 変更しない）。ここで定義するのは、Evidence Fact（情報源が実際に述べる
// 時間）とProduct/UI Decision（ユーザー向け意思決定に使う時間）を明確に
// 分離した、新しい並行のTime Verification構造である。既存44 Recipeへの
// 遡及的なデータ移行は本MISSIONの範囲外（recipe-time.ts参照）。
// ============================================================

/**
 * Evidence Sourceが実際に述べる時間表現の精度をそのまま保持する。
 * 3〜4分をmidpoint化しない・約10分をexact化しない・不明を推測で埋めない。
 */
export type TimeValue =
  | { kind: 'exact'; minutes: number }
  | { kind: 'range'; minMinutes: number; maxMinutes: number }
  | { kind: 'approximate'; minutes: number }
  | { kind: 'unknown' }

/**
 * 時間の構成要素。既存データで実際に区別が必要だと判明した6種のみ
 * （それ以上のカテゴリは追加しない。Section 2）。
 */
export type TimeComponentKind =
  | 'activePrepMinutes'
  | 'activeHeatingMinutes'
  | 'passiveCookingMinutes'
  | 'preheatMinutes'
  | 'restingMinutes'
  | 'residualHeatMinutes'

/** 個々のtime componentについてのEvidence Fact。RecipeFieldVerificationと同じ設計思想 */
export interface TimeComponentFact {
  kind: TimeComponentKind
  value: TimeValue
  sourceIds: string[]
  /**
   * このcomponentが特定のRecipeVariantIdentityに固有の場合（任意）。
   * 異なるvariantのcomponent同士を無断で合算しないためのタグ
   * （MISSION 2.13のvariantId概念を再利用。No cross-Variant arithmetic）。
   */
  variantId?: string
}

/**
 * 情報源が内訳を示さず、レシピ全体の合計時間のみを明示している場合
 * （例: gyudon/oyako-donの「調理時間約30分/15分」）。既知の合計・未知の
 * 内訳、という状態をそのまま表現する（Section 16）。
 */
export interface SourceStatedTotalTime {
  value: TimeValue
  sourceIds: string[]
  /**
   * MISSION 2.26 — 情報源が「表示時間から明示的に除外している」と述べている時間
   * （任意）。例: NHK「調理時間15分 ※鶏肉を常温に戻す時間（約30分）は除く」。
   * これは machine-readable な scope 記録であって、value と足し算してはならない
   * （15 + 30 = 45 のような arithmetic・elapsedToReady 導出・FNTT は一切しない）。
   */
  excludes?: TimeComponentFact[]
}

/**
 * ユーザー向け唯一の意思決定用時間（「15分以内」等のcritical path）。
 * Evidence componentそのものではなく、それらの人間による明示的な
 * 組み合わせ判断（Product Decision）。derivationが必須（no hidden
 * arithmetic・no automatic overlap guessing。Section 3/8/12）。
 */
export interface ElapsedToReadyDerivation {
  value: TimeValue
  /** どのcomponent/sourceStatedTotalを、どんな順序・重なりの根拠で組み合わせたかの説明。空文字不可 */
  derivation: string
  /** この導出が実際に使用したsourceIdの一覧（Coherence Review対象と揃える） */
  contributingSourceIds: string[]
}

/**
 * 「ユーザーが実際に手を動かす時間」の意味論（MISSION 2.15時点ではUI非公開。
 * Section 4）。放置・余熱・休ませる等の受動的な待ち時間を含めない。
 */
export interface ActiveWorkDerivation {
  value: TimeValue
  derivation: string
}

/**
 * MISSION 2.20 — legacy `Recipe.cookingTimeMinutes`（Recipe直下の単一number）を
 * Product Decision（max-timeフィルタ / ranking / estimatedMinutes / 「約○分」UI）で
 * 「確定した経過時間」として扱ってよいかの状態。
 *
 * - 未設定（'legacy'相当）: 従来どおり `cookingTimeMinutes` の数値をそのまま使う。
 *   既存44 Recipeは全件このケース＝挙動は一切変わらない。
 * - 'established': Evidence解決の結果、`cookingTimeMinutes` を Product 経過時間として
 *   使ってよいと明示的に確認済み（挙動は 'legacy' と同じ＝数値を使う）。
 * - 'review' / 'unknown': `cookingTimeMinutes` はまだ確定した経過時間ではない。
 *   max-timeフィルタ・ranking・estimatedMinutes・「約○分」表示で確定値として
 *   使ってはならない（recipe-time.ts の productCookingTimeMinutes 参照）。
 *
 * 注意: これは Source Displayed Time（例: NHKの「15分（常温に戻す時間を除く）」）でも
 * Preparation/Lead Time（例: 約30分の常温戻し）でもなく、NUKITORUがユーザーに
 * 「今の状態から何分後に食べられるか」として提示できる Product Elapsed Time の
 * 利用可否ステータスである（Section 2/3）。
 */
export type ProductTimeStatus = 'established' | 'review' | 'unknown'

/** RecipeVerification.timeVerification（任意）。既存Recipeは未設定のままでよい */
export interface RecipeTimeVerification {
  components?: TimeComponentFact[]
  sourceStatedTotal?: SourceStatedTotalTime
  elapsedToReady?: ElapsedToReadyDerivation
  activeWork?: ActiveWorkDerivation
  /**
   * MISSION 2.20 — legacy `cookingTimeMinutes` の Product Decision 利用可否。
   * 未設定は 'legacy' 相当（従来どおり数値を使う）。'review'/'unknown' は確定値
   * としての利用を禁止する（BLOCKER B の最小・additive・opt-in な解消）。
   */
  productTimeStatus?: ProductTimeStatus
}

export interface RecipeVerification {
  status: RecipeVerificationStatus
  /** このRecipe全体で参照する情報源のid一覧（evidence-sources.tsのEVIDENCE_SOURCE_CATALOGを参照） */
  sourceIds: string[]
  /** どのsourceがどのfieldを裏付けるかの追跡（将来Recipe Factoryが利用） */
  fieldVerifications?: RecipeFieldVerification[]
  /**
   * review状態で残っている「未解決の Recipe-Evidence 問題」のみ。verifiedの場合はここが
   * 空でなければならない（isRecipePublishable が空でない reviewNotes をブロッカー扱いする）。
   * MISSION 2.26 — 解決済みの監査履歴・source比較・provenance・explainability は
   * provenanceNotes へ移す（それらは未解決問題ではないため VERIFIED をブロックしない）。
   * Decision B のもと、未解決の Product Time は Recipe-Evidence 問題ではない。
   */
  reviewNotes?: string[]
  /**
   * MISSION 2.26 — 解決済みの Evidence 監査履歴 / source比較 / provenance / explainability
   * ノート（任意）。Evidence の説明可能性・追跡可能性のために保持するが、未解決問題ではない。
   * isRecipePublishable() はこの field を一切参照しない（VERIFIED をブロックしない）。
   * Evidence 履歴を「ゲートを通すため」に削除しない（Section 6）。
   */
  provenanceNotes?: string[]
  /**
   * MISSION 2.26 — true = Recipe body / Recipe-Evidence fact の中に、未支持の推測値が残っている。
   * Product Time が未確定であること（productTimeStatus='review'/'unknown'）はこれには含めない
   * （Product Time の不確実性は productTimeStatus が表現する。Section 7）。
   * true の場合、他の条件に関わらず isRecipePublishable() は必ず false になる。
   */
  hasUnsupportedInference?: boolean
  /** MISSION 2.11 PHASE D.7-B — VERIFIEDに必須のRecipe Identity（Gate BU） */
  recipeIdentity?: RecipeIdentity
  /**
   * MISSION 2.11 PHASE D.7-B.1 — Evidence Factとは別枠のProduct Decision一覧。
   * range等、Evidenceが単一値を提供しない場合にRecipe/UIが必要とする具体値の
   * 採用理由を記録する。isRecipePublishable()のEvidence解決判定には使わない。
   */
  productDecisions?: RecipeProductDecision[]
  /**
   * MISSION 2.14B — Recipe Coherence Review（任意）。未設定はunreviewed相当
   * として扱う（isRecipePublishable()参照）。既存Recipeはこのfieldを設定
   * しないままでよく、その場合は自動的にVERIFIED条件を満たさなくなる
   * （Section 12: 既存VERIFIED状態からの自動coherent移行は行わない）。
   */
  coherenceReview?: RecipeCoherenceReview
  /**
   * MISSION 2.15 — Cooking Time Semantics Foundation（任意）。既存Recipeは
   * 未設定のままでよい。legacyの`cookingTimeMinutes`（Recipe直下）とは
   * 独立に併存する（recipe-time.ts参照。isRecipePublishable()はこのfieldを
   * 参照しない＝publishability要件を変更しない）。
   */
  timeVerification?: RecipeTimeVerification
}

// ============================================================
// MISSION 2.15 Phase B — FROM NOW TO TABLE Foundation
//
// NUKITORU FOODが最終的に答える問いは「このレシピは何分？」ではなく
// 「今ある家庭の状態から、何分後に食べられる？」である。
//
// 3つの時間レイヤーを絶対に混同しない:
//   A. Source Recipe Time  … 情報源が実際に述べる時間（RecipeTimeVerification /
//      SourceStatedTotalTime / legacy cookingTimeMinutes）。
//   B. Active Work Time    … ユーザーが実際に手を動かす時間（ActiveWorkDerivation）。
//   C. From-Now-to-Table Time … 家庭の現状から料理全体が食べられる状態になるまでの
//      実経過時間（下記）。同じRecipeでも家庭状態によって変わり、静的属性ではない。
//
// これはProduct Decision Layerであり、Recipe Evidenceそのものではない。
// RecipeVerificationStatusを上げる／Coherenceを修復する／Variantを解決する／
// Evidence Rangeをexactへ潰す、いずれにも使ってはならない（from-now-to-table.ts参照）。
// 既存inventory/localStorage/Stock挙動・production 15/30 quick filter・UIは
// 本MISSIONでは一切変更しない。
// ============================================================

/**
 * 食材・構成要素の最小限のreadiness状態モデル（Phase B）。
 * 巨大なFood State Ontologyは作らない。将来 冷凍肉/解凍済み/カット済み野菜/
 * 乾物/浸水済み/下茹で済み 等へ拡張可能な設計に留め、今回はこの5値のみ。
 */
export type IngredientReadinessState =
  | 'raw' // 生米・生肉等、調理前
  | 'ready' // そのまま食卓へ出せる/使える状態（炊けたごはん等）
  | 'frozen-ready' // 調理済みだが冷凍（冷凍ごはん等）。解凍/再加熱が必要
  | 'packaged-ready' // パックごはん等。開封/加熱等の準備が必要な場合がある
  | 'unknown' // 状態不明。推測で埋めない

/**
 * 家庭の「今」の状態。From-Now-to-Table導出の起点（Section 6）。
 * 既存inventory/localStorage/Stockとはまだ結合しない。
 */
export interface MealStartContext {
  /** 構成要素キー → 現在のreadiness状態。未指定の要素は 'unknown' 扱い */
  componentStates: Record<string, IngredientReadinessState>
}

/**
 * 決定論的なprep task primitive（Section 8）。完全なscheduler/AI schedulingではない。
 * durationはPhase AのTimeValueを再利用し、Evidence精度をそのまま保持する。
 */
export interface PrepTask {
  id: string
  /** この taskが寄与する必須構成要素キー（MealPlan.requiredComponents のいずれか） */
  component: string
  description: string
  /** 所要時間（Evidence）。unknown/approximate は上限未確定として扱う（発明しない） */
  duration: TimeValue
  /** 先行task id。この taskの開始前に完了している必要がある */
  dependsOn: string[]
  /**
   * この taskを開始するために構成要素が満たすべき状態（任意）。
   * MealStartContextの開始状態、または先行taskによって満たされる。
   */
  requiredState?: IngredientReadinessState
  /** この taskの完了後に構成要素が到達する状態 */
  resultState: IngredientReadinessState
  /** durationのEvidence source id（無根拠のdurationを許さないための痕跡） */
  sourceIds: string[]
}

/**
 * 1食分の決定論的なmeal plan（Section 8/11）。
 */
export interface MealPlan {
  mealId: string
  /** すべてreadyになって初めてTABLE READY（Section 11） */
  requiredComponents: string[]
  tasks: PrepTask[]
  /**
   * 明示的に同時進行可能とEvidence/レビュアーが認めたtask idグループ（Section 9/10）。
   * ここに列挙されないtask同士のoverlapは一切推測しない。
   */
  declaredParallelGroups?: string[][]
}

/**
 * From-Now-to-Table導出結果（Product Decision Layer。Evidence Factではない）。
 * parallelismが未宣言・durationが未確定・構成要素の状態が不明なら 'unresolved'。
 */
export type FromNowToTableResult =
  | {
      kind: 'resolved'
      /** 家庭の現状から食卓までの実経過時間（Product Decision）。rangeはrangeのまま保持 */
      value: TimeValue
      /** どのchainをどんな依存・並行の根拠で組み合わせたかの明示的説明（空文字不可） */
      derivation: string
      /** critical pathを構成するtask id列（0件 = 追加調理taskなしで即ready） */
      criticalPath: string[]
    }
  | {
      kind: 'unresolved'
      /** なぜ導出できないか（duration不明・parallelism未宣言・構成要素の状態不明 等） */
      reason: string
    }

/**
 * MISSION 2.20 — 調理開始前に必要な「下ごしらえ・待機」1手順。
 *
 * BLOCKER A の最小・非破壊な解消: `Recipe.steps`（＝加熱調理の手順）と
 * 明確に区別して、Evidenceで確認できた準備工程を「嘘をつかずに」保持する。
 * 巨大な task graph は作らない（household依存の FNTT / PrepTask とは別概念。
 * これは universal な Recipe fact）。
 *
 * 絶対ルール:
 * - allergy判定 / candidate matching / A・B分類 / ranking / stock matching には
 *   一切使わない（RecipeCookingLiquid と同じ非機能メタデータ扱い）。
 * - 所要時間（duration）・受動待機（passiveWait）は Evidence が明示する場合のみ設定。
 *   常温戻し / 解凍 / 浸水 / 予熱 / 炊飯の時間を推測で埋めない。
 */
export interface RecipePreparationStep {
  /** 表示文（1手順ぶんの下ごしらえ）。空文字不可 */
  text: string
  /**
   * 受動的な待ち時間か（常温に戻す・浸水・解凍・粗熱をとる等、ユーザーが手を動かさない）。
   * true=passive wait / false・未設定=active preparation。
   * 将来 From-Now-to-Table / ActiveWorkDerivation がこの区別を利用できる余地を残す。
   */
  passiveWait?: boolean
  /**
   * この準備工程に Evidence が明示する所要時間（任意）。発明しない。
   * MISSION 2.15 の TimeValue をそのまま再利用（rangeをmidpoint化しない）。
   */
  duration?: TimeValue
}

// ============================================================
// MISSION 2.33 — Practical Cook Validation Foundation
//
// 「Recipe Evidence として確認された」（LAYER A: RecipeVerification）と
// 「実際に人間がそのレシピを作って再現性・分かりやすさを確認した」（LAYER B）を
// 完全に分離して machine-readable に記録する最小構造。
//
// 絶対ルール:
// - practicalCookValidation は Recipe Evidence ではない。observation を
//   Recipe fact（requiredIngredients / amounts / seasonings / preparation /
//   steps / equipment / RecipeIdentity / fieldVerifications / EvidenceSource /
//   coherenceReview / allergyIdentity / verification.status）へ自動昇格させない。
// - isRecipePublishable() はこの構造を一切参照しない（Recipe Evidence
//   publishability は LAYER A のみで決まる。Recipe.verification 側に置かず
//   Recipe 直下に置くのはこの分離を構造で示すため）。
// - Product Time（productTimeStatus / productCookingTimeMinutes /
//   sourceStatedTotal / activeWork / elapsedToReady）を変えない。
//   実測時間は observation であって Product Time を確定しない。
// - 味は主観。tasteVerified 等の事実フラグを作らない。「おいしかった」は
//   observation にのみ入る。
// - 'verified' という語を practical 側で使わない（Evidence VERIFIED との混同防止）。
// - tester の氏名・メール・住所・正確な位置・家族の氏名・端末識別子を要求しない。
// ============================================================

/**
 * 実地調理検証（LAYER B）の状態。Evidence VERIFIED とは別概念。
 * - 'not-tested': まだ誰も実際に作って確認していない（既定）。
 * - 'passed': 重大な Evidence/Safety 矛盾なく作れた。
 * - 'passed-with-observations': 作れたが実務上のメモが残る（UX 改善候補）。
 * - 're-review-required': 実地観察が Evidence-backed process と実質的に矛盾する、
 *   または重要な再現性問題を示す → 将来の Evidence Resolution mission が必要。
 * - 'safety-stop': 食品安全上の懸念に遭遇した → Beta 公開不可。Evidence が
 *   自動的に false になるわけではないが、人間判断まで解決扱いにしない。
 */
export type PracticalCookValidationStatus =
  | 'not-tested'
  | 'passed'
  | 'passed-with-observations'
  | 're-review-required'
  | 'safety-stop'

/** 個々の実地テストの結果（'not-tested' はテスト未実施の状態でありテスト結果にはならない） */
export type PracticalCookTestResult =
  | 'passed'
  | 'passed-with-observations'
  | 're-review-required'
  | 'safety-stop'

/**
 * 実地観察のカテゴリ。observation は Recipe fact ではない
 * （例:「IH では玉ねぎ1分でしんなりしなかった」は observation であって
 *  steps を「玉ねぎ2分」へ書き換える根拠にはならない）。
 */
export type PracticalCookObservationCategory =
  | 'clarity'
  | 'preparation'
  | 'cooking-process'
  | 'equipment'
  | 'timing'
  | 'food-safety'
  | 'taste-texture'
  | 'household-usability'
  | 'environment-variance'

export interface PracticalCookObservation {
  category: PracticalCookObservationCategory
  /** 実地で気づいたことの記述。Recipe fact へ自動反映しない。空文字不可 */
  note: string
}

/** 再現性の文脈（任意・プライバシー最小）。個人・家族の識別情報は持たない */
export interface PracticalCookEnvironment {
  heatSource?: 'gas' | 'ih' | 'other' | 'unknown'
  panType?: string
  panSizeCm?: number
  ingredientStartingState?: string
  thermometerUsed?: boolean
}

/**
 * 1回の実地テスト記録。
 * startedAt / readyAt / actualElapsedMinutes は observation であり、
 * 単一の実測値が Product Time を確定することは絶対にない（Section 12）。
 */
export interface PracticalCookTest {
  id: string
  /** ISO 日付/時刻。いつ実地テストしたか */
  testedAt: string
  /** テスト対象の Recipe バージョン識別（任意。将来 Recipe が版管理される場合） */
  recipeVersion?: string
  result: PracticalCookTestResult
  observations: PracticalCookObservation[]
  environment?: PracticalCookEnvironment
  /** 実測の開始時刻（ISO・任意）。observation。Product Time を確定しない */
  startedAt?: string
  /** 実測の完成時刻（ISO・任意）。observation。Product Time を確定しない */
  readyAt?: string
  /** 実測の経過分（任意）。observation。productCookingTimeMinutes を確定しない */
  actualElapsedMinutes?: number
}

/**
 * Recipe 直下の任意フィールド。未設定は実効的に 'not-tested'
 * （practicalCookValidationStatusOf 参照）。
 */
export interface PracticalCookValidation {
  status: PracticalCookValidationStatus
  tests?: PracticalCookTest[]
}

export interface Recipe {
  id: string
  name: string
  type: DishType
  /** 由来料理圏。任意（未設定のRecipeも許容する） */
  cuisine?: RecipeCuisine

  /** 必須食材。アレルギー判定対象。amountはservingsBase人数分の基準量 */
  requiredIngredients: RecipeIngredient[]
  /** 実際にこのレシピで使う調味料。アレルギー判定対象。amountはservingsBase人数分の基準量 */
  seasonings?: RecipeIngredient[]
  /** 調理に使う基礎液体（水・湯）。候補判定・allergy判定には一切使わない */
  cookingLiquids?: RecipeCookingLiquid[]
  /** 商品によって原材料が異なり得る食材への注意喚起。候補判定・HARD EXCLUSIONには一切使わない */
  ingredientChecks?: RecipeIngredientCheck[]

  cookingTimeMinutes: number
  /** レシピが想定する人数の参考値。selectedMembers数に応じた自動計算はまだ行わない */
  servingsBase: number

  /** 普通/あっさり/がっつり/時短/子ども向け 等を表現する汎用タグ */
  tags?: string[]
  /** 準備するもの（調理器具・食器等、消費しない物のみ。食材はここに含めない） */
  equipment?: string[]
  /**
   * MISSION 2.20 — 調理開始前の下ごしらえ・待機（順序つき）。`steps`（加熱調理の手順）
   * とは別枠。未設定の Recipe は従来どおり（表示も挙動も一切変わらない）。
   * allergy / matching / ranking / A・B分類には使わない。
   */
  preparation?: RecipePreparationStep[]
  steps?: string[]

  arrangements?: RecipeArrangement[]
  notes?: string[]

  /**
   * MISSION 2.11 PHASE D.6 — 未設定（undefined）は実効的に
   * status='unverified'として扱う（getVerificationStatus()参照）。
   * 既存44 RecipeはこのPHASEで一切書き換えない＝全件が実効的にunverified。
   */
  verification?: RecipeVerification

  /**
   * MISSION 2.33 — 実地調理検証（LAYER B）。Recipe Evidence（verification / LAYER A）
   * とは別レイヤー。未設定は実効的に status='not-tested'
   * （practicalCookValidationStatusOf 参照）。isRecipePublishable() はこれを参照しない。
   */
  practicalCookValidation?: PracticalCookValidation
}

// ============================================================
// MISSION 2.35 — World Food Knowledge Foundation
//
// 「世界にすでに存在する信頼できる料理知識を、Evidence と出典を保持したまま
// 構造化して学び、NUKITORU らしい料理体験へ変換する」ための最小の器（型のみ）。
//
// 4つの概念を型レベルで厳密に分離する（WORLD_FOOD_KNOWLEDGE_PRINCIPLES.md 参照）:
//   A. SOURCE RECIPE KNOWLEDGE  — 外部の信頼できる情報源から確認した料理事実
//      （SourceRecipeKnowledge）。
//   B. NUKITORU PRESENTATION    — A の料理事実を「変更せず」スマホで理解しやすい形へ
//      構造化した表示情報（NukitoruPresentation）。Evidence を増やさない。
//   C. NUKITORU VERIFIED        — 既存の厳格な Verification Gate（RecipeVerification /
//      isRecipePublishable）。本 MISSION は一切変更しない。
//   D. AI ORIGINAL              — 本 MISSION では実装しない。
//
// 絶対原則:
// - SOURCE RECIPE KNOWLEDGE ≠ NUKITORU VERIFIED。
// - NUKITORU PRESENTATION ≠ 新しい料理 Evidence（表示を分かりやすくしただけ）。
// - UNKNOWN は UNKNOWN。情報源が示さない火加減・時間・分量・器具サイズを
//   AI や一般常識で補完しない。
// - Translation is not Evidence / Calculation is not Culinary Evidence /
//   Canonicalization is not Allergen Composition。
// - Presentation の各事実は SOURCE KNOWLEDGE のどこ由来か追跡可能であること。
// - これらの型は既存 Recipe / RecipeIngredient / RecipeVerification /
//   ingredient-normalization.ts / recipe-safety.ts / recipe-publishability.ts の
//   挙動を一切変更しない（独立した追加レイヤー）。
// ============================================================

// ------------------------------------------------------------
// World Recipe Identity（世界料理の同一性）
//
// 表示名（japaneseName / englishName 等）と Canonical Identity を混同しない。
// 日本語訳によって Recipe Identity を別 Recipe へ変えてはいけない。
// ------------------------------------------------------------

/** 表示文字列から独立した「世界のある料理そのもの」の id（fuzzy match で解決しない） */
export type WorldRecipeCanonicalId = string

export interface WorldRecipeIdentity {
  canonicalRecipeId: WorldRecipeCanonicalId
  /** その料理圏での代表的な正式名（例: "Tortilla Española"） */
  canonicalName: string
  /** 現地表記（canonicalName と同じでもよい。例: "Tortilla de patatas"） */
  localName: string
  /** 原語（ISO 639-1 相当。LanguageCode） */
  originalLanguage: LanguageCode
  /** 由来国（ISO 3166-1 alpha-2 相当。CountryCode）。Cuisine とは別概念 */
  country: CountryCode
  region?: string
  /** 由来料理圏。既存 RecipeCuisine を再利用（任意） */
  cuisine?: RecipeCuisine
  japaneseName?: string
  englishName?: string
  /** 表記ゆれ・別名（人間が確認した明示リストのみ。fuzzy match 禁止） */
  aliases?: string[]
  /**
   * この Identity（名称・由来）の根拠となる sourceId（任意。EVIDENCE_SOURCE_CATALOG）。
   * 未設定は「一般的な名称として登録したが Identity 用 Evidence 未添付」を表す。
   * Identity の登録は SOURCE RECIPE KNOWLEDGE（分量・時間・工程等の料理事実）の
   * Evidence には一切ならない。
   */
  identityEvidenceSourceIds?: string[]
}

// ------------------------------------------------------------
// Global Ingredient Knowledge（世界対応の食材知識）
//
// 既存 Ingredient Taxonomy / canonical-food.ts を尊重する。
// 翻訳 ≠ Evidence。Canonicalization ≠ Allergen Composition。
// ------------------------------------------------------------

export type SourceIngredientRole =
  | 'required' // 必須食材
  | 'seasoning' // 調味料
  | 'optional' // 入れなくてよい
  | 'garnish' // 飾り・薬味
  | 'cooking-liquid' // 水・湯等の基礎液体

export interface SourceIngredientKnowledge {
  /** 情報源に書かれた食材名（原文の表記を尊重。翻訳で置き換えない） */
  sourceIngredientName: string
  /** 既存 canonical-food.ts の canonicalFoodId（任意。fuzzy 解決禁止・未知は付けない） */
  canonicalIngredientId?: CanonicalFoodId
  /** 既存 ingredient-normalization.ts で正規化した名前（任意） */
  normalizedName?: string
  japaneseName?: string
  englishName?: string
  originalLanguage?: LanguageCode
  role: SourceIngredientRole
  /**
   * 情報源が示した分量。displayText（原文表記）は常に保持し、semantics は
   * 既存 QuantitySemantics を再利用する（range を midpoint 化しない・
   * unknown を推測で埋めない・「大さじ」を g へ無言換算しない）。
   */
  quantity?: QuantityStatement
  /** 下ごしらえの状態（例: "みじん切り" / "thinly sliced"）。情報源が示した場合のみ */
  preparationState?: string
}

/**
 * SOURCE FACT と PRODUCT CONVERSION を分離するための型（本 MISSION では未使用）。
 * 「計算できる ≠ Evidence である」。UI 上の換算値を将来表示する場合も、
 * 情報源の原文（sourceStatement）は決して書き換えない。
 */
export interface ProductUnitConversion {
  /** 情報源の原文の分量表記（QuantityStatement。書き換え禁止） */
  sourceStatement: QuantityStatement
  /** NUKITORU が UI 表示用に導出した値（Product Decision。Evidence ではない） */
  convertedValue: number
  convertedUnit: string
  /** どの前提でどう換算したかの NUKITORU 自作の説明（空文字不可） */
  conversionNote: string
}

// ------------------------------------------------------------
// Cooking Knowledge Structure（調理知識の構造）
//
// すべて「情報源にある場合のみ」事実として設定する。
// 情報源にない情報を AI や一般常識で補完しない。
// ------------------------------------------------------------

/** 情報源が示した火加減。示していなければ 'unknown'（発明しない） */
export type SourceHeatLevel =
  | 'off'
  | 'very-low'
  | 'low'
  | 'medium-low'
  | 'medium'
  | 'medium-high'
  | 'high'
  | 'unknown'

/** 情報源が示した火加減の変化。示していなければ 'unknown' */
export type SourceHeatTransition =
  | 'turn-on' // 火をつける
  | 'keep' // そのまま維持
  | 'lower' // 弱める
  | 'raise' // 強める
  | 'turn-off' // 火を止める
  | 'unknown'

export type SourceLidUsage = 'lid-on' | 'lid-off' | 'unknown'

export interface SourceCookingStep {
  /** 1 始まりの手順番号 */
  order: number
  /**
   * 情報源の手順を、著作物性のある表現をそのまま転記せずに要約した事実記述（任意）。
   * EVIDENCE_POLICY.md「Sources are for verification, not duplication」を守る。
   */
  factSummary?: string
  /** この手順で投入・使用する食材（SourceIngredientKnowledge.sourceIngredientName と一致） */
  ingredientsUsed?: string[]
  /** 情報源がこの手順で示した火加減。未設定/'unknown' は「情報源が示していない」 */
  heat?: SourceHeatLevel
  /** 情報源が示した火加減の変化。未設定/'unknown' は「情報源が示していない」 */
  heatTransition?: SourceHeatTransition
  /** 情報源が示したこの手順の能動的な所要時間（TimeValue）。無ければ undefined */
  duration?: TimeValue
  /** 情報源が示した受動的な待ち時間（蒸し焼き・煮込み等）。無ければ undefined */
  passiveDuration?: TimeValue
  /** 油の使用（情報源の記述。'unknown' 可） */
  oilUsage?: string
  /** 液体・水の使用（情報源の記述。'unknown' 可） */
  liquidUsage?: string
  /** ふたの使用。未設定/'unknown' は「情報源が示していない」 */
  lidUsage?: SourceLidUsage
  /** 完成・次へ進む目安（例: "皮がこんがりしたら"）。情報源が示した場合のみ */
  completionSign?: string
}

export interface SourcePreparationKnowledge {
  /** 準備工程 1 手順（情報源由来の事実記述） */
  text: string
  /** 受動的な待ち時間か（常温戻し・浸水・解凍・漬け込み等） */
  passiveWait?: boolean
  /** 情報源が明示した所要時間（TimeValue）。発明しない */
  duration?: TimeValue
}

/**
 * A. SOURCE RECIPE KNOWLEDGE — 外部の信頼できる情報源から「確認した」料理事実。
 * NUKITORU VERIFIED でも NUKITORU オリジナルでもない。すべての事実は
 * evidenceSourceId（EVIDENCE_SOURCE_CATALOG）へ追跡可能である。
 */
export interface SourceRecipeKnowledge {
  /** WorldRecipeIdentity.canonicalRecipeId */
  canonicalRecipeId: WorldRecipeCanonicalId
  /** 情報源に書かれたレシピ名（原文） */
  sourceRecipeName: string
  /**
   * 料理事実の出所 id。
   * - 人手で構造化した knowledge: EVIDENCE_SOURCE_CATALOG の RecipeEvidenceSource.id。
   * - MISSION 2.37 Import Pipeline 経由の knowledge: WorldFoodSource.sourceId
   *   （rights + publisher の登録簿）。この場合 importProvenance が必ず設定される。
   *   import された knowledge は EVIDENCE_SOURCE_CATALOG には無いため
   *   sourceKnowledgeHasValidEvidence() は false を返す（Import ≠ VERIFIED の証）。
   */
  evidenceSourceId: string
  /**
   * MISSION 2.37 — Import Pipeline 経由で昇格した場合の権利・取り込み来歴。
   * 未設定 = 人手で構造化した knowledge。設定あり = Rights Gate を通過した import。
   */
  importProvenance?: RecipeImportProvenance
  /** 情報源の言語（LanguageCode） */
  sourceLanguage: LanguageCode
  /** 情報源が示した「作る量／食数」。displayText は原文表記 */
  servings?: QuantityStatement
  ingredients: SourceIngredientKnowledge[]
  /**
   * PRE-COOK PREPARATION / 事前準備 — 調理開始「前」に時間が必要な工程
   * （解凍・常温戻し・漬け込み・炊飯・予熱）。
   */
  preCookPreparation?: SourcePreparationKnowledge[]
  /**
   * PREPARATION / 下準備 — 調理フロー「内」で行う準備（切る・混ぜる・計る）。
   */
  preparation?: SourcePreparationKnowledge[]
  /** 情報源が示した調理器具（原文表記） */
  equipment?: string[]
  cookingSteps: SourceCookingStep[]
  /** 情報源が内訳なしで示した合計時間（TimeValue） */
  sourceStatedTotalTime?: TimeValue
  /** この知識を情報源から構造化した日付（ISO） */
  structuredAt: string
  /** 補足メモ（NUKITORU 自作。料理事実の追加ではない） */
  notes?: string[]
}

// ------------------------------------------------------------
// B. NUKITORU PRESENTATION
//
// SOURCE RECIPE KNOWLEDGE の料理事実を「変更せず」、スマホで・片手で・
// 料理中に 3 秒で理解できる形へ構造化した表示情報。Evidence を増やさない。
// 各事実が SOURCE の何処由来か追跡可能であること（sourceStepReference 必須）。
// ------------------------------------------------------------

export interface PresentationStep {
  /** 見出し（例: "鶏肉を焼く"） */
  title: string
  /** 一行の指示 */
  shortInstruction: string
  /** 食材の操作（例: "鶏肉を皮を下にして入れる"） */
  ingredientActions: string[]
  /** 道具の操作（任意） */
  toolAction?: string
  /**
   * 火の操作の表示（任意）。対応する SourceCookingStep が火加減／火加減変化を
   * 示していない場合は undefined（"medium" 等で勝手に埋めない）。
   */
  heatAction?: string
  /**
   * 時間の表示（任意）。対応する SourceCookingStep が時間を示していない場合は
   * undefined（"5分" 等で勝手に埋めない）。range は "2〜3分" のまま保持する。
   */
  durationDisplay?: string
  /** 完成／次へ進む合図（任意）。SourceCookingStep.completionSign 由来のみ */
  completionCue?: string
  /** 注意（任意） */
  warning?: string
  /** 追跡可能性: このステップが依拠した SourceCookingStep.order（必須） */
  sourceStepReference: number
}

/** PRE-START KNOWLEDGE（section 11）。調理 START 前に確認する項目の種別 */
export type PresentationPreCheckKind =
  | 'diners' // 食べる人数
  | 'servings' // 作る量／食数（diners とは別）
  | 'ingredients' // 使用食材
  | 'products' // 使用商品
  | 'equipment' // 使用道具
  | 'heat-source' // 熱源
  | 'ingredient-state' // 食材の現在状態
  | 'pre-cook-prep' // 事前準備
  | 'prep' // 下準備
  | 'compatibility' // Recipe 条件との Compatibility

export interface PresentationPreCheckItem {
  label: string
  kind: PresentationPreCheckKind
  /** 情報源に由来する場合の参照メモ（任意。NUKITORU 自作） */
  sourceReference?: string
}

export interface NukitoruPresentation {
  canonicalRecipeId: WorldRecipeCanonicalId
  /** どの SourceRecipeKnowledge から構造化したか（evidenceSourceId と一致させる） */
  sourceEvidenceSourceId: string
  /** 表示名（ローカライズ済み。Canonical Identity とは別） */
  displayName: string
  displayLocale: Locale
  preCookChecklist?: PresentationPreCheckItem[]
  steps: PresentationStep[]
  /** この Presentation を生成した日付（ISO） */
  generatedAt: string
}

// ============================================================
// MISSION 2.37 — Rights-Aware World Recipe Import Pipeline (types only)
//
//   RAW SOURCE DATA
//     ↓ normalize（単位換算・翻訳・欠落補完を一切しない）
//   RawRecipeImportCandidate
//     ↓ Rights Gate（evaluateRecipeImportRights / fail-closed）
//     ↓ Identity Resolution（完全一致のみ・fuzzy 禁止・新 Identity 生成禁止）
//   SourceRecipeKnowledge（+ importProvenance）
//     ↓ MISSION 2.35 buildPresentation
//   NukitoruPresentation
//
// 絶対原則（WORLD_RECIPE_IMPORT_PIPELINE.md 参照）:
// - SOURCE RIGHTS ≠ RECORD RIGHTS ≠ ASSET RIGHTS。
// - UNKNOWN を自動的に allowed へ昇格しない（fail-closed）。
// - RIGHTS EVIDENCE（保存・利用してよいか）≠ CULINARY EVIDENCE（分量・工程の根拠）。
// - Import 可能 ≠ VERIFIED / Publishable / Allergy-safe / Practically-validated /
//   AI-training permitted。
// - これらの型・関数は RecipeVerification / isRecipePublishable / Allergy Gate /
//   PracticalCookValidation / Product Time / Process Coherence を一切変更しない。
// - 画像の download / storage / render は実装しない（imageReuse は判断の保持のみ）。
// ============================================================

/** 権利フラグ。unknown は「未確認」であって「許可」ではない */
export type RightsFlag = 'allowed' | 'conditional' | 'prohibited' | 'unknown'

/** Source 全体の分類（MISSION 2.36A §0.4） */
export type SourceRightsClassification = 'use' | 'research-only' | 'do-not-ingest' | 'unknown'

/** WorldFoodSource の種別（既存 RecipeSourceType を壊さず拡張した別 union） */
export type WorldFoodSourceType =
  | RecipeSourceType
  | 'open-dataset'
  | 'encyclopedia'
  | 'academic-dataset'
  | 'commercial-api'
  | 'ugc-platform'

/**
 * ある source / record について「NUKITORU が何を保存・利用してよいか」の 5 軸。
 * これは RIGHTS EVIDENCE であって CULINARY EVIDENCE ではない。
 */
export interface WorldFoodRightsProfile {
  /** 商用利用。※ これが allowed でも Import は許可されない（structuredFactStorage を見る） */
  commercialUse: RightsFlag
  /** 構造化した料理事実を NUKITORU Knowledge DB へ保存してよいか。Import の核心条件 */
  structuredFactStorage: RightsFlag
  /** 情報源の逐語テキスト（creative prose）を保存してよいか */
  verbatimTextStorage: RightsFlag
  /** 画像を再利用してよいか（本 MISSION では判断の保持のみ・実装しない） */
  imageReuse: RightsFlag
  /** AI/ML 学習に使ってよいか。※ Import 許可条件にしない（別 dimension） */
  aiMlUse: RightsFlag
}

/**
 * Source-level 権利登録簿の 1 エントリ。MISSION 2.36 / 2.36A の Audit 結果を
 * 「実際に一次情報で確認できた範囲だけ」表現する。checkedAt 未設定 = 未確認。
 */
export interface WorldFoodSource {
  sourceId: string
  name: string
  organization: string
  sourceType: WorldFoodSourceType
  country?: CountryCode
  languages: LanguageCode[]
  officialUrl: string
  /** Source default の rights。record override が無ければこれが継承される */
  rights: WorldFoodRightsProfile
  classification: SourceRightsClassification
  /** この rights 判断を一次情報で確認した日付（ISO）。未設定 = 未確認 → Import 不可 */
  checkedAt?: string
  /** 判断根拠の URL（利用規約 / ライセンス / 政府規約ページ等） */
  rightsEvidenceUrl?: string
  notes?: string[]
}

/** 個々の Recipe（record）に第三者の権利が絡むか */
export type ThirdPartyRightsState =
  | 'none' // 第三者権利なし（例: 連邦職員の職務著作物と確認済み）
  | 'cleared' // 第三者権利はあるが利用条件を一次確認済み
  | 'unresolved' // 第三者権利があり利用条件が未確認
  | 'unknown' // 第三者権利の有無自体が不明

/** record 単位の取り込み可否ステータス */
export type RecordRightsStatus = 'use' | 'conditional' | 'do-not-ingest' | 'unknown'

/**
 * Record-level 権利。Source default を override できる（inheritance: override > source）。
 * originalContributor / adaptedFrom 等が存在する record は、その提供元の利用条件を
 * 確認するまで thirdPartyRights を 'unresolved' に保つ。
 */
export interface WorldFoodSourceRecordRights {
  /** WorldFoodSource.sourceId */
  sourceId: string
  /** source 側の record id（例: MFDS の RCP_SEQ） */
  sourceRecordId: string
  /** この record の一次 URL（provenance。空文字は「provenance 欠落」扱い） */
  sourceUrl: string

  /** "adapted from" / 提供元 / 監修者 等（あれば thirdPartyRights の確認対象） */
  originalContributor?: string
  originalSourceName?: string
  originalSourceUrl?: string
  adaptedFrom?: string

  thirdPartyRights: ThirdPartyRightsState
  rightsStatus: RecordRightsStatus

  /**
   * Source default rights を record 単位で上書きする。ここに設定された flag のみ
   * source より優先される。設定しなければ source default を継承。
   */
  rightsOverride?: Partial<WorldFoodRightsProfile>

  /** この record の rights を一次情報で確認した日付（ISO）。未設定 = 未確認 → Import 不可 */
  rightsCheckedAt?: string
  rightsEvidenceUrl?: string
  rightsNotes?: string[]
}

/** source と record を合成した実効 rights（監査用スナップショット） */
export interface EffectiveRecipeRights extends WorldFoodRightsProfile {
  /** 各 flag の値が source default 由来か record override 由来か */
  resolvedFrom: Record<keyof WorldFoodRightsProfile, 'source-default' | 'record-override'>
}

/** Import が止まった／通った理由（監査可能な decision trace） */
export type ImportDecisionReason =
  | 'SOURCE_NOT_REGISTERED'
  | 'SOURCE_DO_NOT_INGEST'
  | 'SOURCE_CLASSIFICATION_UNKNOWN'
  | 'SOURCE_RESEARCH_ONLY'
  | 'SOURCE_RIGHTS_CHECK_DATE_MISSING'
  | 'RECORD_PROVENANCE_MISSING'
  | 'RECORD_RIGHTS_DO_NOT_INGEST'
  | 'RECORD_RIGHTS_UNKNOWN'
  | 'RECORD_RIGHTS_CHECK_DATE_MISSING'
  | 'THIRD_PARTY_RIGHTS_UNRESOLVED'
  | 'STRUCTURED_FACT_STORAGE_PROHIBITED'
  | 'STRUCTURED_FACT_STORAGE_UNKNOWN'
  | 'STRUCTURED_FACT_STORAGE_CONDITIONAL_UNMET'
  | 'IDENTITY_UNRESOLVED'

export interface RecipeImportRightsDecision {
  allowed: boolean
  reasons: ImportDecisionReason[]
  /** source + record を合成した実効 rights（source 未登録時は undefined） */
  effectiveRights?: EffectiveRecipeRights
  /** structuredFactStorage=allowed の根拠が source default か record override か */
  structuredFactStorageBasis?: 'source-default' | 'record-override'
  /** 画像を Knowledge へ入れてよいか（本 MISSION の Pipeline は常に画像を入れない） */
  imageImportAllowed: boolean
  /** AI/ML 利用の実効フラグ（情報として保持。Import 可否には使わない） */
  aiMlUse: RightsFlag
}

/**
 * 外部データを Rights Gate へ通す前の staging object。
 * これは SourceRecipeKnowledge ではない（Rights Gate 通過まで昇格しない）。
 * `as SourceRecipeKnowledge` での cast は禁止（Pipeline 関数のみが昇格させる）。
 */
export interface RawRecipeImportCandidate {
  sourceRecipeName: string
  sourceLanguage: LanguageCode
  /** WorldRecipeIdentity へ完全一致で解決する id。未知なら undefined（新規生成しない） */
  canonicalRecipeId?: WorldRecipeCanonicalId
  servings?: QuantityStatement
  ingredients: SourceIngredientKnowledge[]
  preCookPreparation?: SourcePreparationKnowledge[]
  preparation?: SourcePreparationKnowledge[]
  equipment?: string[]
  cookingSteps: SourceCookingStep[]
  sourceStatedTotalTime?: TimeValue
  /**
   * 外部データにたまたま含まれる画像 URL 等。Pipeline は Knowledge へ入れない。
   * （imageReuse の判断には影響するが、SourceRecipeKnowledge には転写しない）
   */
  imageUrl?: string
  notes?: string[]
  recordRights: WorldFoodSourceRecordRights
}

/** SourceRecipeKnowledge.importProvenance — Rights Gate 通過の来歴 */
export interface RecipeImportProvenance {
  /** WorldFoodSource.sourceId（rights + publisher） */
  worldFoodSourceId: string
  sourceRecordId: string
  sourceUrl: string
  sourceLanguage: LanguageCode
  rightsCheckedAt: string
  rightsEvidenceUrl?: string
  /** Import 判定時の実効 rights スナップショット */
  effectiveRights: EffectiveRecipeRights
  structuredFactStorageBasis: 'source-default' | 'record-override'
  /** この import を実行した日付（ISO。呼び出し側が渡す。関数内で now を読まない） */
  importedAt: string
}

/** Import Pipeline の結果（例外に依存せず監査可能な reason を返す） */
export type RecipeImportResult =
  | {
      ok: true
      knowledge: SourceRecipeKnowledge
      identity: WorldRecipeIdentity
      decision: RecipeImportRightsDecision
    }
  | {
      ok: false
      reasons: ImportDecisionReason[]
      decision?: RecipeImportRightsDecision
    }

// ============================================================
// MISSION 2.38 — World Ingredient Canonicalization Foundation (types only)
//
// 「世界のレシピに登場する食材」と「ユーザーの在庫にある食材」を、表示名の
// 文字列一致ではなく同じ Canonical Ingredient Identity へ **安全・決定論的に**
// 接続するための基礎。
//
// 絶対原則（WORLD_INGREDIENT_CANONICALIZATION.md 参照）:
// - 推測による食材統合をしない。名前が似ているだけで同一食材にしない。
// - fuzzy / typo correction / stemming / substring / AI synonym / 自動翻訳 は一切しない。
// - 曖昧なら AMBIGUOUS。知らなければ UNRESOLVED。推測で埋めない（fail-closed）。
// - Canonicalization が変更してよいのは「Identity へのリンク」だけ。
//   source ingredient name / quantity / unit / semantics / preparation / notes /
//   language / wording は一切変更しない（Translation ≠ Canonicalization）。
// - Identity Evidence ≠ Recipe Evidence ≠ Rights Evidence ≠ Allergen Evidence（混ぜない）。
// - Ingredient variant を潰さない（chicken ≠ chicken thigh、tomato ≠ cherry tomato、
//   milk ≠ soy milk、olive oil ≠ sesame oil、rice ≠ cooked rice）。
// - Identity ≠ State/Preparation（raw / boiled / diced 等は Identity に含めない）。
// - Generic Ingredient Identity ≠ Specific Product Identity。
// - これらの型・関数は既存 Allergy / Substitution / Unit / Rights Gate /
//   RecipeVerification / PracticalCookValidation を一切変更・迂回しない。
// - canonicalIngredientId は既存 CanonicalFoodId 型を再利用する（新 ID 体系を作らない。
//   canonical-food.ts の既存 id（chicken / onion / rice_raw / rice_cooked）と整合させる）。
// ============================================================

/** 登録名の種別。canonical = 代表名、alias = 明示登録された別名（表記ゆれ含む） */
export type WorldIngredientNameKind = 'canonical' | 'alias'

/** WorldIngredientIdentity に紐づく 1 つの言語別名称（明示登録された事実のみ） */
export interface WorldIngredientIdentityName {
  language: LanguageCode
  /** 登録された表記（表示用） */
  name: string
  kind: WorldIngredientNameKind
}

/**
 * ある食材 Identity が「なぜその Identity として登録されているか」の来歴。
 * これは Identity Evidence であって Recipe / Rights / Allergen Evidence ではない。
 * 大規模 Evidence システムは作らない — 最小の追跡情報のみ。
 */
export interface WorldIngredientIdentityEvidence {
  /** 出典・根拠の参照（URL / dataset id / 内部辞書メモ等） */
  reference: string
  /** この登録を確認した日付（ISO） */
  checkedAt: string
  notes?: string
}

/**
 * 表示名から独立した「ある食材そのもの」の Identity。
 * canonicalIngredientId は安定した内部 id（既存 CanonicalFoodId を再利用）。
 */
export interface WorldIngredientIdentity {
  canonicalIngredientId: CanonicalFoodId
  /** 主たる表示名（識別のための固定名。表示名 ≠ Identity なので names[] とは別に固定する） */
  canonicalName: string
  /** 明示登録された言語別名称。ここに無い名前は事実として扱わない */
  names: WorldIngredientIdentityName[]
  /** 大分類（任意・自由記述の最小情報。enum 化しない） */
  category?: string
  /**
   * 将来の親子関係の「境界」だけ（例: chicken_thigh の親 = chicken）。
   * MISSION 2.38 では自動親子推論をしない。fixture に明示登録されたものだけ保持する。
   * Matching では親子で自動 MATCH しない（exact canonical id 一致のみ）。
   */
  parentCanonicalIngredientId?: CanonicalFoodId
  /** この Identity 登録の来歴（Identity Evidence。他の Evidence と混ぜない） */
  identityEvidence?: WorldIngredientIdentityEvidence
  notes?: string[]
}

/** 食材名解決の結果種別 */
export type WorldIngredientResolutionStatus = 'RESOLVED' | 'UNRESOLVED' | 'AMBIGUOUS'

export interface WorldIngredientResolution {
  status: WorldIngredientResolutionStatus
  /** 入力（正規化前） */
  query: { sourceName: string; language?: LanguageCode }
  /** 決定論的に正規化した検索キー（trim + NFKC + lowercase + 空白畳み込み のみ） */
  normalizedQuery: string
  /** RESOLVED のときのみ設定 */
  canonicalIngredientId?: CanonicalFoodId
  identity?: WorldIngredientIdentity
  /** AMBIGUOUS のとき: 候補 id 一覧（1 つも選ばない） */
  candidateIds?: CanonicalFoodId[]
  /** 判断理由（監査用） */
  reason: string
}

/**
 * SourceIngredientKnowledge を canonical id へ「安全に link した」結果。
 * original は一切変更しない。linked は Identity へのリンクだけを足したコピー。
 */
export interface CanonicalizedSourceIngredient {
  /** 元の SourceIngredientKnowledge（不変） */
  original: SourceIngredientKnowledge
  resolution: WorldIngredientResolution
  /**
   * RESOLVED のとき: original に canonicalIngredientId を link した新しいコピー。
   * それ以外 or 元々 canonicalIngredientId が設定済みのとき: 元の値を保った新しいコピー。
   * いずれの場合も sourceIngredientName / quantity / preparationState / normalizedName /
   * japaneseName / englishName / originalLanguage / role は original と同一。
   */
  linked: SourceIngredientKnowledge
}

/**
 * MISSION 2.39（双方向 Matching Engine）が使う match 分類の最小 interface。
 * MISSION 2.38 では Recipe Matching 自体は実装しない。
 * - EXACT:      両者が同じ canonicalIngredientId（exact canonical match のみ）
 * - MISSING:    片方に canonicalIngredientId がある / もう片方に無い（在庫に該当なし等）
 * - UNRESOLVED: 少なくとも片方が canonical id を持たない（未解決）
 * - AMBIGUOUS:  解決が AMBIGUOUS だった
 */
export type IngredientIdentityMatchKind = 'EXACT' | 'MISSING' | 'UNRESOLVED' | 'AMBIGUOUS'

// ============================================================
// MISSION 2.39 — Bidirectional Food Matching Engine Foundation (types only)
//
//   A. Forward:  Stock → Recipe collection → 各 Recipe の Ingredient Availability Fit
//   B. Reverse:  選択 Recipe → listed ingredients → Stock 比較 → 家にある/少ない/足りない/不明/曖昧
//   C. Meal Occasion: breakfast / lunch / snack / dinner / late-night / bento（明示 metadata のみ）
//
// 絶対原則（FOOD_MATCHING_ENGINE.md 参照）:
// - EXACT MATCH は canonicalIngredientId の **完全一致のみ**。
//   似ている ≠ 同じ / 親カテゴリ ≠ 持っている / 代用品 ≠ 一致 / UNKNOWN ≠ MATCH。
// - EXACT ≠ Quantity Sufficient（quantityStatus は常に NOT_EVALUATED）。個→g 換算・単位変換をしない。
// - LOW ≠ 必要量を満たす（Identity は存在するが十分量は保証しない）。
// - UNRESOLVED ≠ MISSING / AMBIGUOUS ≠ MISSING / AMBIGUOUS ≠ EXACT。
// - missingCount には UNRESOLVED / AMBIGUOUS を混ぜない（「あとN個」の安全計算）。
// - parentCanonicalIngredientId を EXACT に使わない。preparation state を同一視しない。
// - Meal Occasion は推測分類しない。未設定は unknown（そのまま扱う）。
// - Matching 成功 ≠ VERIFIED / Allergy Safe / Practical Validated / Rights Permission /
//   Substitution Permission / Product Identity Mapping / Recipe Quality Score。
// - これらの型・関数は SourceRecipeKnowledge / Stock schema / RecipeVerification /
//   Allergy Gate / PracticalCookValidation / Rights Gate を一切変更しない。Derived Result のみ。
// - deterministic / non-mutating / no AI / no network / no random / no time-in-ranking。
// ============================================================

// ------------------------------------------------------------
// Meal Occasion Foundation
// ------------------------------------------------------------

export type MealOccasion =
  | 'breakfast' // 朝食
  | 'lunch' // 昼食
  | 'snack' // おやつ（2.39 から正式 Foundation）
  | 'dinner' // 夕食
  | 'late-night' // 夜食
  | 'bento' // お弁当

/**
 * ある Canonical Recipe Identity に「明示的に」付与された Meal Occasion 分類。
 * 料理名・食材から推測しない。source は分類の来歴（推測は登録できない）。
 */
export interface MealOccasionMetadata {
  occasions: MealOccasion[]
  source: 'explicit' | 'trusted-source-metadata' | 'nukitoru-reviewed'
  notes?: string
}

/** STRICT occasion filter の判定（§19） */
export type MealOccasionFilterResult =
  | 'INCLUDED' // 明示的に要求 occasion を含む
  | 'EXCLUDED' // 明示的に含まない
  | 'EXCLUDED_FROM_STRICT_FILTER' // occasion 情報が無い（unknown。「向かない」という意味ではない）

// ------------------------------------------------------------
// Stock Ingredient Snapshot（既存 Stock からの pure projection）
// ------------------------------------------------------------

/** 既存 StockStatus（available/low/out）を Matching 用へ写像した状態 */
export type StockAvailabilityStatus =
  | 'available' // 今ある
  | 'low' // ある（が必要量は保証しない）
  | 'unavailable' // 明示的に無い（out）

export interface FoodStockIngredientSnapshot {
  /** 在庫アイテムの識別子（既存 stock の item 名等）。provenance */
  stockItemKey: string
  /** 在庫アイテムの元の名前（原文。canonicalize で変えない） */
  sourceName: string
  /** MISSION 2.38 で解決した canonical id。解決できなければ undefined */
  canonicalIngredientId?: CanonicalFoodId
  identityStatus: WorldIngredientResolutionStatus
  /** identityStatus === 'AMBIGUOUS' のときの候補 id（1 つも選ばない） */
  candidateIds?: CanonicalFoodId[]
  availabilityStatus: StockAvailabilityStatus
  notes?: string[]
}

// ------------------------------------------------------------
// Recipe Requirement Snapshot（SourceRecipeKnowledge からの pure projection）
// ------------------------------------------------------------

/**
 * レシピにその食材が「どういう意味で載っているか」。推測しない。
 * - SOURCE_LISTED: SourceRecipeKnowledge.ingredients に載っている（それ以上の必須性を推測しない）
 * - UNKNOWN:       中立
 */
export type RecipeRequirementKind = 'SOURCE_LISTED' | 'UNKNOWN'

export interface RecipeIngredientRequirement {
  /** SourceRecipeKnowledge の食材名（原文。翻訳しない） */
  sourceIngredientName: string
  canonicalIngredientId?: CanonicalFoodId
  identityStatus: WorldIngredientResolutionStatus
  candidateIds?: CanonicalFoodId[]
  /** SourceIngredientKnowledge.role をそのまま持つ（推測で必須性を足さない） */
  role?: SourceIngredientRole
  /** QuantityStatement.displayText（SOURCE FACT。数量評価はしない） */
  quantityDisplayText?: string
  preparationState?: string
  requirementKind: RecipeRequirementKind
}

// ------------------------------------------------------------
// Ingredient Match Classification / Explainability
// ------------------------------------------------------------

export type IngredientMatchClass =
  | 'EXACT' // canonical id 完全一致 + stock available
  | 'LOW' // canonical id 完全一致 + stock low
  | 'MISSING' // canonical id は解決済みだが、一致する available/low stock が無い（or 明示 unavailable）
  | 'UNRESOLVED' // recipe 側または関連 stock 側の Identity を確定できず一致を証明できない
  | 'AMBIGUOUS' // Identity 候補が複数で 1 つに確定できない

/** MISSION 2.39 では数量充足を評価しない（常にこの値） */
export type QuantityEvaluationStatus = 'NOT_EVALUATED'

export type FoodMatchReasonCode =
  | 'CANONICAL_ID_EXACT'
  | 'STOCK_LOW'
  | 'STOCK_ABSENT'
  | 'STOCK_EXPLICITLY_UNAVAILABLE'
  | 'RECIPE_IDENTITY_UNRESOLVED'
  | 'STOCK_IDENTITY_UNRESOLVED'
  | 'IDENTITY_AMBIGUOUS'
  | 'NON_EXACT_CANONICAL_ID'
  | 'QUANTITY_NOT_EVALUATED'
  | 'MEAL_OCCASION_EXPLICIT_MATCH'
  | 'MEAL_OCCASION_UNKNOWN'

export interface IngredientFoodMatch {
  requirement: RecipeIngredientRequirement
  matchClass: IngredientMatchClass
  /** EXACT / LOW のとき: 一致した stock snapshot（複数一致時は決定論的に 1 件） */
  matchedStock?: FoodStockIngredientSnapshot
  /** 常に 'NOT_EVALUATED'（EXACT ≠ Quantity Sufficient） */
  quantityStatus: QuantityEvaluationStatus
  reasonCodes: FoodMatchReasonCode[]
}

// ------------------------------------------------------------
// Recipe Match Result
// ------------------------------------------------------------

/** 観測できた事実だけを表すフラグ（READY_TO_COOK のような保証的名称は使わない） */
export type RecipeFoodMatchFlag =
  | 'ALL_LISTED_IDENTITIES_PRESENT' // 全 listed requirement が EXACT または LOW
  | 'HAS_LOW_STOCK'
  | 'HAS_MISSING_INGREDIENTS'
  | 'HAS_UNRESOLVED_INGREDIENTS'
  | 'HAS_AMBIGUOUS_INGREDIENTS'

export interface RecipeFoodMatchResult {
  canonicalRecipeId: WorldRecipeCanonicalId
  /** SourceRecipeKnowledge.sourceRecipeName（原文。翻訳しない） */
  recipeName: string
  /** 明示 metadata の occasion。unknown なら [] */
  mealOccasions: MealOccasion[]
  mealOccasionKnown: boolean
  ingredientMatches: IngredientFoodMatch[]
  exactCount: number
  lowCount: number
  /** 明示的に MISSING の listed identity 数のみ。UNRESOLVED / AMBIGUOUS を混ぜない */
  missingCount: number
  unresolvedCount: number
  ambiguousCount: number
  listedIngredientCount: number
  matchFlags: RecipeFoodMatchFlag[]
  /** 全 ingredient match の reason code を dedup + sort した一覧 */
  reasonCodes: FoodMatchReasonCode[]
  /** Shopping boundary（§38）: 明示的に MISSING な canonical id の一覧（dedup + sort） */
  missingCanonicalIngredientIds: CanonicalFoodId[]
}

// ============================================================
// MISSION 2.40 — Smartphone Food Decision & Swipe Cooking UX Foundation (types only)
//
//   探すときは楽しく。料理中は迷わずスワイプ。
//   1 画面 = 1 工程 / 左右スワイプ中心 / 小さいボタンを狙わせない。
//
// 絶対原則（SMARTPHONE_COOKING_UX.md 参照）:
// - MISSION 2.39 の Matching Truth（EXACT / LOW / MISSING / UNRESOLVED / AMBIGUOUS）を
//   UI 都合で統合・破壊しない。UNRESOLVED ≠ AMBIGUOUS は内部で別のまま
//   （表示だけ「確認が必要」へまとめてよい）。
// - 「家にある」は「必要量が十分」ではない（EXACT ≠ Quantity Sufficient）。
//   「十分あります」「これだけで作れます」を断定しない。
// - Source にない火加減 / 時間 / 分量 / 人数 / 国 / occasion を UI が生成・補完しない。
// - Presentation → Source Fact の mutation 禁止（一方向）。
// - Meal Occasion を料理名・食材から推測しない（明示 metadata のみ）。
// - SYNTHETIC fixture を production UI へ表示しない。fake count / fake recipe を出さない。
// - AI を使わない。「おすすめ」「AI が選びました」等を根拠なく表示しない。
//   ranking の意味は「家にある食材との一致状況」であって「おすすめ順」ではない。
// - これらの型・関数は RecipeVerification / Allergy / Rights Gate / Practical /
//   Matching Truth / Canonicalization / Stock schema を一切変更しない。
// ============================================================

// ------------------------------------------------------------
// Ingredient Match Presentation
// ------------------------------------------------------------

/** MISSION 2.39 の matchClass をユーザー向けラベルへ写像したもの（内部区別は保持） */
export type IngredientAvailabilityLabel =
  | 'at-home' // 家にある（EXACT）
  | 'low' // 少ない（LOW）
  | 'missing' // 足りない（MISSING）
  | 'needs-check' // 確認が必要（UNRESOLVED / AMBIGUOUS — 表示上のみ統合）

export interface IngredientAvailabilityPresentation {
  sourceIngredientName: string
  /** SourceIngredientKnowledge.quantity?.displayText（SOURCE FACT。そのまま表示） */
  quantityDisplayText?: string
  label: IngredientAvailabilityLabel
  /** 内部の真の分類（統合しない。UNRESOLVED / AMBIGUOUS は別のまま保持） */
  internalMatchClass: IngredientMatchClass
  /** 数量を過剰主張しないための注記（常に 'not-evaluated'） */
  quantityNote: 'not-evaluated'
}

/** Recipe 単位の見出し（観測できた事実のみ。保証的表現を避ける） */
export type RecipeMatchHeadline =
  | 'ALL_LISTED_AT_HOME' // 全 listed 材料が家にある（分量は未確認）
  | 'SOME_MISSING' // 足りない材料がある
  | 'NEEDS_CHECK_ONLY' // 確認が必要な材料だけ残っている（missing は無い）

export interface RecipeMatchPresentation {
  canonicalRecipeId: WorldRecipeCanonicalId
  /** SourceRecipeKnowledge.sourceRecipeName（原文。翻訳しない） */
  recipeName: string
  /** 明示 metadata の occasion（unknown なら []） */
  mealOccasions: MealOccasion[]
  /** 上記の日本語ラベル（known のときのみ） */
  mealOccasionLabels: string[]
  ingredients: IngredientAvailabilityPresentation[]
  atHomeCount: number
  lowCount: number
  missingCount: number
  /** 表示用: UNRESOLVED + AMBIGUOUS の合算（内部 count は別途保持） */
  needsCheckCount: number
  /** 内部区別を保持（表示では needs-check に統合するが count は分けて持つ） */
  unresolvedCount: number
  ambiguousCount: number
  listedIngredientCount: number
  headline: RecipeMatchHeadline
  /** Shopping boundary（§38）: 「あと○個」は missingCount のみ。needs-check を混ぜない */
  shoppingHint: {
    missingCount: number
    missingCanonicalIngredientIds: CanonicalFoodId[]
  }
}

/** Forward（家にあるもので作る）リスト表示 */
export interface ForwardMatchListPresentation {
  items: RecipeMatchPresentation[]
  /** 並び順の意味（「おすすめ順」ではない） */
  rankingMeaning: 'availability-fit'
  /** production 実データが無い / 候補ゼロ のときの中立文言 */
  emptyStateText?: string
}

// ------------------------------------------------------------
// Recipe Detail Presentation（Source Fact を変更しない）
// ------------------------------------------------------------

export interface RecipeDetailIngredientPresentation {
  sourceIngredientName: string
  quantityDisplayText?: string
  preparationState?: string
  /** match result が与えられた場合のみ */
  availability?: IngredientAvailabilityLabel
}

export interface RecipeDetailStepPresentation {
  displayNumber: number // 1-based
  title: string
  shortInstruction: string
  ingredientActions: string[]
  /** Source が示した場合のみ */
  heatAction?: string
  durationDisplay?: string
  completionCue?: string
  warning?: string
  sourceStepReference: number
}

export interface RecipeDetailPresentation {
  canonicalRecipeId: WorldRecipeCanonicalId
  /** 原文 */
  recipeName: string
  /** WorldRecipeIdentity に identityEvidenceSourceIds がある場合のみ */
  originCountry?: CountryCode
  originRegion?: string
  /** 明示 metadata がある場合のみ */
  mealOccasionLabels: string[]
  /** SourceRecipeKnowledge.servings?.displayText（Source にある場合のみ） */
  servingsDisplayText?: string
  ingredients: RecipeDetailIngredientPresentation[]
  /** 事前準備（SourceRecipeKnowledge.preCookPreparation[].text） */
  preCookPreparation: string[]
  /** 下準備（SourceRecipeKnowledge.preparation[].text） */
  preparation: string[]
  steps: RecipeDetailStepPresentation[]
  /** Source が内訳なしで示した合計時間（ある場合のみ） */
  sourceStatedTotalTimeDisplay?: string
  /** Evidence / Source への導線（Matching result と混同しない） */
  evidence: {
    evidenceSourceId: string
    /** MISSION 2.37 Import 由来か */
    imported: boolean
  }
}

// ------------------------------------------------------------
// Cooking Mode / Swipe Navigation
// ------------------------------------------------------------

export type CookingSessionStatus = 'cooking' | 'completed'

export interface CookingSession {
  canonicalRecipeId: WorldRecipeCanonicalId
  steps: PresentationStep[]
  currentIndex: number // 0-based。completed のとき steps.length（境界外）
  status: CookingSessionStatus
}

/** 1 画面 1 工程の表示モデル */
export interface CookingStepView {
  index: number // 0-based
  displayNumber: number // 1-based
  totalSteps: number
  title: string
  shortInstruction: string
  ingredientActions: string[]
  heatAction?: string
  durationDisplay?: string
  completionCue?: string
  warning?: string
  sourceStepReference: number
  isFirst: boolean
  isLast: boolean
}

/** スワイプ判定の結果 */
export type SwipeIntent = 'next' | 'previous' | 'none'

export interface SwipeInput {
  /** 終点X - 始点X（px）。負 = 左方向 */
  deltaX: number
  /** 終点Y - 始点Y（px） */
  deltaY: number
  elapsedMs?: number
}

export interface SwipeConfig {
  /** これ未満の水平移動は swipe 扱いしない（短い動き・誤タップ対策） */
  minHorizontalDistance: number
  /** |deltaY| > maxVerticalRatio * |deltaX| なら「主に縦」→ none */
  maxVerticalRatio: number
}

// ------------------------------------------------------------
// Completion / Share / deferred actions
// ------------------------------------------------------------

/** 完成後にのみ表示してよい二次アクション（Cooking 中は前面に出さない） */
export type FoodDeferredAction =
  | 'favorite' // ♡ お気に入り（boundary のみ・永続化は別 MISSION）
  | 'repeat' // また作る（Favorite とは別概念）
  | 'share' // みんなにシェアする
  | 'print' // プリント

export interface FoodCompletionPresentation {
  canonicalRecipeId: WorldRecipeCanonicalId
  recipeName: string
  /** 完成後に表示してよい二次アクション（順序は探す→作る→気に入る→覚える→また作る→シェア） */
  deferredActions: FoodDeferredAction[]
}

/** Share text / hashtags は FACT のみから生成する（推測でタグを付けない） */
export interface FoodShareInput {
  /** SourceRecipeKnowledge.sourceRecipeName（原文） */
  recipeName: string
  /** Evidence / 明示 metadata がある場合のみ呼び出し側が渡す（# 抜きの語） */
  factualTags?: string[]
}

// ============================================================
// MISSION 2.40A — Core UX Alignment: Existing Stock → Food Decision (types only)
//
// NUKITORU FOOD の本筋:「NUKITORU を見れば家にある食材が分かる。その家にある
// もので何が作れるか分かる。」= 既存 Stock persistence を Matching の主データにする。
//
// 絶対ルール:
// - 既存 StockStatus / StockStatusEntry / storage schema を変更しない。読むだけ。
// - available → available / low → low / out → unavailable の写像のみ。
// - Ingredient identity は MISSION 2.38 canonicalization（resolved は canonicalIngredientId
//   を保持、unresolved は UNRESOLVED、ambiguous は AMBIGUOUS。推測しない）。
// - fake count を出さない（summary は実データからのみ）。
// ============================================================

/** 家にある食材スナップショット群の概要（実データからのみ計算。fake count 禁止） */
export interface StockSummary {
  /** availabilityStatus === 'available' の件数（= 家にあるもの） */
  availableCount: number
  /** availabilityStatus === 'low' の件数（= 少ないもの） */
  lowCount: number
  /** availabilityStatus === 'unavailable' の件数（= 明示的に無いもの / out） */
  unavailableCount: number
  /** canonicalIngredientId が解決済みの件数 */
  resolvedCount: number
  /** identity 未解決の件数 */
  unresolvedCount: number
  /** identity 曖昧の件数 */
  ambiguousCount: number
  /** 総件数 */
  totalCount: number
}
