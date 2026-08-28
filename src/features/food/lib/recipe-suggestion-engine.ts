// ============================================================
// recipe-suggestion-engine.ts
//
// MISSION 2.11 PHASE C — RECIPE_CATALOG から複数（最大5件）の候補を
// 安全に選び出す純粋関数群。mock-meal-provider.ts はこのモジュールの
// 結果を MealSuggestionResponse の形へ変換するだけの薄いアダプタになる。
//
// 絶対ルール（安全性）:
// - allergy該当Recipeは candidatesへ一切追加しない（ランキングを下げるだけ、
//   では済ませない）。除外は canonicalization を通した
//   requiredIngredients + seasonings 全体に対して行う。
// - arrangements.addIngredients は基本Recipeの除外判定に一切使わない。
// - 候補が足りない／0件の場合も、そのまま返す。fallbackで危険な候補を
//   復活させない。
// - ranking はランダムに依存せず、常に決定論的（同一入力→同一順序）。
// ============================================================

import type { Recipe, RecipeIngredient } from '@/features/food/types'
import { canonicalizeIngredientName } from './ingredient-normalization'
import { allergyRelevantIngredients } from './recipe-safety'

export type MatchCategory = 'A' | 'B'

export interface RecipeCandidate {
  recipe: Recipe
  /** A: 必須食材が全て手元にある。B: 1件だけ不足している */
  category: MatchCategory
  /** category='B' の場合、不足している食材名（元のRecipe表記のまま） */
  missingIngredients: string[]
  /** 苦手食材を含むか（soft）。除外はしないが順位を下げる材料にする */
  hasDislikedIngredient: boolean
}

export interface RankRecipesParams {
  /** ユーザーが入力した食材名（生の表記のまま） */
  availableIngredientNames: string[]
  /** その日選択されているメンバー全員のallergiesをunionした結果（canonicalization前でよい） */
  allergyNames: string[]
  /** 苦手食材（SOFT。除外しない） */
  dislikeNames: string[]
  /** nullなら時間を気にしない */
  maxCookingMinutes: number | null
  /** 既定5。最大何件まで返すか */
  maxResults?: number
}

const DEFAULT_MAX_RESULTS = 5
/** Bカテゴリ（あと1品で作れる）で許容する不足件数の上限。2件以上不足は候補外 */
const MAX_MISSING_FOR_CATEGORY_B = 1

function canonicalSet(names: string[]): Set<string> {
  return new Set(names.map(canonicalizeIngredientName))
}

function containsAny(names: string[], canonicalTargets: Set<string>): boolean {
  return names.some((n) => canonicalTargets.has(canonicalizeIngredientName(n)))
}

/**
 * RECIPE_CATALOG（または将来数千品規模の同型配列）から、安全に候補を選ぶ。
 * 計算量は O(件数 × 1レシピあたりの食材数) 程度で、Setによる canonical名
 * 照合のみを行う単純な全件走査。1万件規模でもブラウザ内で現実的に動作する
 * （PHASE C完了報告の計算量評価を参照）。
 */
export function rankRecipes(catalog: Recipe[], params: RankRecipesParams): RecipeCandidate[] {
  // 食材が1件もない場合は「あと1品で作れる」B候補も含めて一切提案しない
  // （手元に何もない状態でrequiredIngredients=1件のRecipeがB候補として
  //   浮上してしまう境界ケースを避ける）。
  if (params.availableIngredientNames.length === 0) {
    return []
  }

  const maxResults = params.maxResults ?? DEFAULT_MAX_RESULTS
  const availableCanonical = canonicalSet(params.availableIngredientNames)
  const allergyCanonical = canonicalSet(params.allergyNames)
  const dislikeCanonical = canonicalSet(params.dislikeNames)

  const candidates: RecipeCandidate[] = []

  for (const recipe of catalog) {
    // 1. アレルギーHARD EXCLUSION（最優先。候補へ入る前に完全除外する）
    const relevant = allergyRelevantIngredients(recipe)
    if (containsAny(relevant, allergyCanonical)) {
      continue
    }

    // 2. 調理時間（ハードフィルタ。超過は候補外。fallbackで復活させない）
    if (params.maxCookingMinutes !== null && recipe.cookingTimeMinutes > params.maxCookingMinutes) {
      continue
    }

    // 3. 必須食材のmatch判定（seasoningsはmatchingの必須条件にしない）。
    // 判定・表示に使うのは ingredient.name のみ（amountはmatchingに一切使わない）。
    const missing = recipe.requiredIngredients
      .filter((ri) => !availableCanonical.has(canonicalizeIngredientName(ri.name)))
      .map((ri) => ri.name)
    const matchedCount = recipe.requiredIngredients.length - missing.length

    let category: MatchCategory
    if (missing.length === 0) {
      category = 'A'
    } else if (missing.length <= MAX_MISSING_FOR_CATEGORY_B && matchedCount >= 1) {
      // 必須食材を1件も持っていない場合はB候補にしない
      // （例: requiredIngredientsが1件だけのRecipeで、その1件が完全に
      //   手元にない場合、missing=1という数字だけを見るとBの条件を満たすが、
      //   実質的にはこのRecipeと無関係な入力なので候補に含めない）
      category = 'B'
    } else {
      continue
    }

    const hasDislikedIngredient = containsAny(
      recipe.requiredIngredients.map((ri) => ri.name),
      dislikeCanonical,
    )

    candidates.push({ recipe, category, missingIngredients: missing, hasDislikedIngredient })
  }

  const ranked = sortCandidates(candidates)
  return applyDiversity(ranked, maxResults)
}

function matchRatio(candidate: RecipeCandidate): number {
  const total = candidate.recipe.requiredIngredients.length
  if (total === 0) return 0
  const matched = total - candidate.missingIngredients.length
  return matched / total
}

/**
 * 決定論的ランキング:
 * 1. category（Aが常にBより上位）
 * 2. requiredIngredientsの一致度（一致率が高いほど上位）
 * 3. requiredIngredients件数（多いほど上位。Aカテゴリ同士は一致率が
 *    常に1.0で並ぶため、この基準がないと単純な1食材レシピばかりが
 *    上位を占めてしまう。より多くの手元食材を活かす具体的な料理を
 *    僅かに優先する）
 * 4. 苦手食材を含まないものを優先（SOFT。除外はしない）
 * 5. cookingTimeMinutesが短いものを優先
 * 6. catalog内の並び順（安定ソート。ランダム要素を持たない）
 */
function sortCandidates(candidates: RecipeCandidate[]): RecipeCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.category !== b.category) {
      return a.category === 'A' ? -1 : 1
    }
    const ratioDiff = matchRatio(b) - matchRatio(a)
    if (ratioDiff !== 0) return ratioDiff
    const requiredCountDiff = b.recipe.requiredIngredients.length - a.recipe.requiredIngredients.length
    if (requiredCountDiff !== 0) return requiredCountDiff
    if (a.hasDislikedIngredient !== b.hasDislikedIngredient) {
      return a.hasDislikedIngredient ? 1 : -1
    }
    if (a.recipe.cookingTimeMinutes !== b.recipe.cookingTimeMinutes) {
      return a.recipe.cookingTimeMinutes - b.recipe.cookingTimeMinutes
    }
    return 0 // catalog順（Array.prototype.sortは安定ソート）を維持
  })
}

/**
 * 上位から選びつつ、同じ (type, cuisine) の組み合わせが続けて並ばないよう
 * 最低限のdiversityを適用する。ランキング自体は変更せず、選出順序の
 * 後処理としてのみ働く（品質の低い候補をdiversityのために繰り上げない）。
 */
function applyDiversity(ranked: RecipeCandidate[], maxResults: number): RecipeCandidate[] {
  const result: RecipeCandidate[] = []
  const seenKeys = new Set<string>()
  const deferred: RecipeCandidate[] = []

  for (const candidate of ranked) {
    if (result.length >= maxResults) break
    const key = `${candidate.recipe.type}:${candidate.recipe.cuisine ?? 'unspecified'}`
    if (seenKeys.has(key)) {
      deferred.push(candidate)
      continue
    }
    seenKeys.add(key)
    result.push(candidate)
  }

  for (const candidate of deferred) {
    if (result.length >= maxResults) break
    result.push(candidate)
  }

  return result
}

export interface IngredientAvailabilitySplit {
  /** requiredIngredientsのうち、手元にある食材（name/amountとも元のRecipe表記のまま） */
  have: RecipeIngredient[]
  /** requiredIngredientsのうち、手元にない食材（name/amountとも元のRecipe表記のまま） */
  missing: RecipeIngredient[]
}

/**
 * MISSION 2.11 PHASE D / D.3 — Recipe Detail画面の「使う食材」表示用。
 * requiredIngredientsを、現在ユーザーが登録している食材とcanonical matching
 * した上で「ある/足りない」に分類する。判定に使うのは ingredient.name のみ
 * （amountはmatchingに一切使わない。amountはservingsBase人数分の基準量として
 * そのままhave/missingへ引き継ぐだけで、Stock側の保有量との比較は行わない）。
 */
export function splitRequiredIngredients(
  requiredIngredients: RecipeIngredient[],
  availableIngredientNames: string[],
): IngredientAvailabilitySplit {
  const availableCanonical = canonicalSet(availableIngredientNames)
  const have: RecipeIngredient[] = []
  const missing: RecipeIngredient[] = []
  for (const required of requiredIngredients) {
    if (availableCanonical.has(canonicalizeIngredientName(required.name))) {
      have.push(required)
    } else {
      missing.push(required)
    }
  }
  return { have, missing }
}
