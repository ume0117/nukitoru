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
