// ============================================================
// mock-meal-provider.ts
//
// MealSuggestionProvider の決定論的・ルールベースなローカル実装。
// AI APIへの実接続は行わない（MISSION 2のスコープ外）。
//
// MISSION 2.11 PHASE C — RECIPE_CATALOG（44品、recipe-catalog.ts）を
// Source of Truthとし、recipe-suggestion-engine.ts の rankRecipes() が
// 選んだ候補（最大5件）を MealSuggestionResponse の形へ変換するだけの
// 薄いアダプタになった。候補選定・安全判定のロジック本体は
// recipe-suggestion-engine.ts / recipe-safety.ts / ingredient-normalization.ts
// 側にある（旧5品ハードコードCATALOGは削除済み）。
//
// PUBLIC BETA RELEASE SPRINT 1 — Runtime Evidence Gate。
// rankRecipes() へ渡す前に、isRecipePublishable()（recipe-publishability.ts）を
// 通過したRecipeだけへ候補集合を絞る。UIで隠すのではなくdata pathで除外する。
// isRecipePublishable()自体のsemantics・Gateの厳しさは一切変更しない
// （このファイルはGateの利用者であり、Gate自体の定義はrecipe-publishability.ts
// が唯一の場所であり続ける）。Allergy HARD EXCLUSION（rankRecipes内部）には
// 一切影響しない＝絞り込んだ集合に対して従来どおり適用される。
//
// 設計方針（維持）:
// - 献立選定に実際に使うのは「食材」「アレルギー」「苦手食材」「調理時間」のみ。
// - household / dailyCondition / season / shoppingMode / pantry は
//   選定ロジックには影響させず、notes等の参考情報にのみ反映する。
// - Date.now() 等の非決定要素は使わない。同一入力は常に同一出力になる。
// - アレルギー該当Recipeはcandidateへ一切追加しない（rankRecipes側で保証）。
//   ここでは追加のフィルタや復活処理を一切行わない。
// ============================================================

import type { MealSuggestionProvider } from './ai-provider'
import type { MealSuggestionRequest, MealSuggestionResponse, MealSuggestion, Ingredient, Recipe } from '@/features/food/types'
import { RECIPE_CATALOG } from './recipe-catalog'
import { rankRecipes, type RecipeCandidate } from './recipe-suggestion-engine'
import { canonicalizeIngredientName } from './ingredient-normalization'
import { productCookingTimeMinutes } from './recipe-time'
import { isRecipePublishable } from './recipe-publishability'

/** PUBLIC BETA RELEASE SPRINT 1 — Evidence Gateを通過したRecipeのみ（isRecipePublishable経由） */
const BETA_PUBLISHABLE_RECIPES = RECIPE_CATALOG.filter((recipe) => isRecipePublishable(recipe))

const CONDITION_NOTES: Partial<Record<string, string>> = {
  cold_symptoms: '体調メモ：風邪気味として登録されています。',
  low_appetite: '体調メモ：食欲がない状態として登録されています。',
  summer_fatigue: '体調メモ：夏バテ気味として登録されています。',
}

function buildIngredientIndex(ingredients: Ingredient[]): Map<string, Ingredient> {
  const index = new Map<string, Ingredient>()
  for (const ingredient of ingredients) {
    const key = canonicalizeIngredientName(ingredient.name)
    if (!index.has(key)) {
      index.set(key, ingredient)
    }
  }
  return index
}

function candidateToSuggestion(
  candidate: RecipeCandidate,
  ingredientIndex: Map<string, Ingredient>,
  dailyCondition: MealSuggestionRequest['dailyCondition'],
): MealSuggestion {
  const { recipe, category, missingIngredients, categoryMatchedIngredients, hasDislikedIngredient } = candidate

  const notes: string[] = []
  const conditionNote = dailyCondition ? CONDITION_NOTES[dailyCondition] : undefined
  if (conditionNote) {
    notes.push(conditionNote)
  }
  if (category === 'B' && missingIngredients.length > 0) {
    notes.push(`あと${missingIngredients.length}品あれば作れます（不足：${missingIngredients.join('、')}）。`)
  }
  // PUBLIC BETA RELEASE SPRINT 2 — category match（例:「鶏肉」で「鶏もも肉」を発見）で
  // 見つかった候補は、具体的な部位・品種の確認を促す（確定して持っているとは断定しない）。
  if (categoryMatchedIngredients.length > 0) {
    notes.push(
      `${categoryMatchedIngredients.join('、')}は、登録した食材に近い種類の候補です。実際に使う部位・品種をご確認ください。`,
    )
  }
  if (hasDislikedIngredient) {
    notes.push('苦手食材として登録されているものを含みますが、他候補と併せて表示しています。')
  }

  // MISSION 2.11 PHASE D.3 — Recipe側にamount（servingsBase人数分の基準量）が
  // 加わったため、食材ごとに警告を並べると「家にその量がある」という誤解を
  // 招きやすい。Stock側の数量が不明な食材が1件以上あれば、まとめて1件だけ
  // 警告する（Recipe基準量とStock保有量を混同しないコピーにする）。
  const warnings: string[] = []
  let hasVagueQuantity = false
  for (const required of recipe.requiredIngredients) {
    const ingredient = ingredientIndex.get(canonicalizeIngredientName(required.name))
    const mode = ingredient?.quantityMode
    if (ingredient && (mode === 'vague' || mode === 'unknown')) {
      hasVagueQuantity = true
      break
    }
  }
  if (hasVagueQuantity) {
    warnings.push('分量が未登録の食材があります。レシピの目安量を満たすか調理前に確認してください。')
  }

  // PUBLIC BETA RELEASE SPRINT 2 — category matchだけで category='A' になった場合、
  // 「作れます」と言い切らず、具体的な部位・品種の確認を促す文言にする
  // （CATEGORY_MATCHをEXACTと同じ強さの断定で見せない）。
  const isFullyExactMatch = categoryMatchedIngredients.length === 0
  return {
    title: recipe.name,
    reason:
      category === 'A'
        ? isFullyExactMatch
          ? '手元の食材で作れます。'
          : '近い食材から作れるかもしれません。'
        : `あと${missingIngredients.length}品あれば作れます。`,
    dishes: [
      {
        name: recipe.name,
        type: recipe.type,
        requiredIngredients: recipe.requiredIngredients.map((ri) => ({ name: ri.name, amount: ri.amount })),
      },
    ],
    // MISSION 2.20: Product Time が未確定（review/unknown）の Recipe は null。
    // MealSuggestion.estimatedMinutes は元々 number | null で、UI/共有側も null を扱える。
    estimatedMinutes: productCookingTimeMinutes(recipe),
    shoppingItems: [],
    notes,
    warnings,
    recipeId: recipe.id,
    // PUBLIC BETA RELEASE SPRINT 2 — category matchだけでcategory='A'になった候補は、
    // 「家にあるものだけで作れる」という確定判定（isFullyAvailable）には含めない
    // （部位・品種が未確認のため。「今日、何つくる？」の通常候補には引き続き表示される）。
    isFullyAvailable: category === 'A' && isFullyExactMatch,
    missingIngredients: category === 'B' ? missingIngredients : undefined,
  }
}

/**
 * PUBLIC BETA RELEASE SPRINT 1 — catalogを引数化したfactory。
 * 本番はBETA_PUBLISHABLE_RECIPES（Evidence Gate通過分）で作った`mockMealProvider`のみを使う。
 * RECIPE_CATALOG全体を渡すのはテスト（matching/canonicalizationエンジン自体の検証）専用。
 */
export function createMealProvider(catalog: Recipe[]): MealSuggestionProvider {
  return {
    async suggest(input: MealSuggestionRequest): Promise<MealSuggestionResponse> {
      const ingredientIndex = buildIngredientIndex(input.ingredients)

      const candidates = rankRecipes(catalog, {
        availableIngredientNames: input.ingredients.map((i) => i.name),
        allergyNames: input.allergyProfile?.allergies ?? [],
        dislikeNames: input.allergyProfile?.dislikes ?? [],
        maxCookingMinutes: input.cookingPreference?.maxCookingMinutes ?? null,
      })

      const suggestions = candidates.map((candidate) =>
        candidateToSuggestion(candidate, ingredientIndex, input.dailyCondition),
      )

      return { suggestions }
    },
  }
}

export const mockMealProvider: MealSuggestionProvider = createMealProvider(BETA_PUBLISHABLE_RECIPES)
