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
