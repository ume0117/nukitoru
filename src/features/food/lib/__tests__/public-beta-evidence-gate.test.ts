// ============================================================
// public-beta-evidence-gate.test.ts
//
// PUBLIC BETA RELEASE SPRINT 1 — Runtime Evidence Gate。
//
// mock-meal-provider.ts が rankRecipes() へ渡す前に isRecipePublishable() で
// 絞り込んでいることを固定する。「UIで隠すだけ」ではなく data path で除外している
// ことを、ranking結果そのもの（recipeId）で検証する。
//
// 絶対ルール:
// - isRecipePublishable() 自体のGate（recipe-publishability.ts）は一切変更しない。
// - Allergy HARD EXCLUSION（recipe-suggestion-engine.ts内部）は絞り込み後の集合に
//   対しても従来どおり適用されることを確認する（弱めていないことの回帰）。
// ============================================================

import { describe, it, expect } from 'vitest'
import { mockMealProvider, createMealProvider } from '../mock-meal-provider'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { isRecipePublishable } from '../recipe-publishability'
import { rankRecipes } from '../recipe-suggestion-engine'
import type { Ingredient, MealSuggestionRequest } from '@/features/food/types'

const BETA_PUBLISHABLE_RECIPES = RECIPE_CATALOG.filter((r) => isRecipePublishable(r))

function ing(name: string): Ingredient {
  return { id: name, name, quantityMode: 'exact' }
}

function request(overrides: Partial<MealSuggestionRequest>): MealSuggestionRequest {
  return { ingredients: [], ...overrides }
}

// 44 Recipe全体（全カテゴリ）にmatchしうるだけの幅広い食材セット
const WIDE_INGREDIENTS = [
  'ごはん', '米', 'マグロ', '卵', '豆腐', '納豆', 'キャベツ', '玉ねぎ', 'じゃがいも',
  'にんじん', '鶏もも肉', '鶏肉', '豚肉', '豚肩ロース肉', '牛肉', '鮭', 'うどん', 'パスタ',
].map(ing)

describe('Public Beta Runtime Evidence Gate — mock-meal-provider.ts', () => {
  it('本番mockMealProviderが返すsuggestionは、全てisRecipePublishable()を満たすRecipeのみ由来（ID固定ではなく不変条件として検証）', async () => {
    const result = await mockMealProvider.suggest(
      request({ ingredients: WIDE_INGREDIENTS, cookingPreference: { maxCookingMinutes: null, shoppingMode: 'none' } }),
    )
    expect(result.suggestions.length).toBeGreaterThan(0)
    for (const s of result.suggestions) {
      const recipe = RECIPE_CATALOG.find((r) => r.id === s.recipeId)
      expect(recipe, `recipeId ${s.recipeId} がRECIPE_CATALOGに存在しない`).toBeDefined()
      expect(isRecipePublishable(recipe!), `${s.recipeId} はisRecipePublishable=falseだがsuggestionに含まれている`).toBe(true)
    }
  })

  it('現時点のBeta-publishable集合は7件（PUBLIC BETA RELEASE SPRINT 1Dでnikujaga/yudofu/niku-udon/napolitan追加。実データの現状固定）', async () => {
    const result = await mockMealProvider.suggest(
      request({ ingredients: WIDE_INGREDIENTS, cookingPreference: { maxCookingMinutes: null, shoppingMode: 'none' } }),
    )
    const ids = new Set(result.suggestions.map((s) => s.recipeId).filter((id): id is string => id !== undefined))
    for (const id of ids) {
      expect(['tori-teriyaki', 'buta-shogayaki', 'nikujaga', 'medama-yaki', 'yudofu', 'niku-udon', 'napolitan']).toContain(id)
    }
  })

  it('Gate通過前（RECIPE_CATALOG全体）ならreview status のRecipeもmatchする＝Gateが実際に絞り込んでいることの対照実験（PUBLIC BETA RELEASE SPRINT 1D/2: 表示件数上限やcategory match順位変動の影響を受けないよう、rankRecipesを直接・高いmaxResultsで呼ぶ）', () => {
    // oyako-don（review status、requiredIngredientsに generic「鶏肉」を使う・卵・玉ねぎ・
    // ごはんが必要）をピンポイントで狙う食材セット。maxResults を大きくして、
    // PUBLIC BETA RELEASE SPRINT 2のcategory match（「鶏肉」→tori-teriyaki等）が
    // 表示件数上限を通じてoyako-donを押し出す影響を受けないようにする。
    const targetedParams = {
      availableIngredientNames: ['鶏肉', '卵', '玉ねぎ'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
      maxResults: 1000,
    }
    const gated = rankRecipes(BETA_PUBLISHABLE_RECIPES, targetedParams)
    const ungated = rankRecipes(RECIPE_CATALOG, targetedParams)
    expect(RECIPE_CATALOG.find((r) => r.id === 'oyako-don')?.verification?.status).toBe('review')
    expect(gated.some((c) => c.recipe.id === 'oyako-don')).toBe(false)
    expect(ungated.some((c) => c.recipe.id === 'oyako-don')).toBe(true)
  })

  it('review status の Recipe（例: まぐろ丼・冷奴 等。目玉焼きはPUBLIC BETA RELEASE SPRINT 1CでVERIFIEDへ昇格したため対象から外れた）は本番runtimeに一切出ない', async () => {
    const result = await mockMealProvider.suggest(
      request({ ingredients: WIDE_INGREDIENTS, cookingPreference: { maxCookingMinutes: null, shoppingMode: 'none' } }),
    )
    const reviewIds = new Set(
      RECIPE_CATALOG.filter((r) => r.verification?.status === 'review').map((r) => r.id),
    )
    for (const s of result.suggestions) {
      expect(s.recipeId && reviewIds.has(s.recipeId)).toBe(false)
    }
  })
})

describe('Public Beta Runtime Evidence Gate — Allergy Gate回帰（弱めていないことの確認）', () => {
  it('小麦アレルギー登録 → tori-teriyaki（しょうゆ由来）は本番runtimeでも除外される', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('鶏もも肉')],
        allergyProfile: { allergies: ['小麦'], dislikes: [] },
        cookingPreference: { maxCookingMinutes: null, shoppingMode: 'none' },
      }),
    )
    expect(result.suggestions.some((s) => s.recipeId === 'tori-teriyaki')).toBe(false)
  })

  it('大豆アレルギー登録 → buta-shogayaki（しょうゆ由来）は本番runtimeでも除外される', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('豚肩ロース肉')],
        allergyProfile: { allergies: ['大豆'], dislikes: [] },
        cookingPreference: { maxCookingMinutes: null, shoppingMode: 'none' },
      }),
    )
    expect(result.suggestions.some((s) => s.recipeId === 'buta-shogayaki')).toBe(false)
  })

  it('アレルギー未登録なら tori-teriyaki / buta-shogayaki は必要食材があれば通常どおり候補になる', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('鶏もも肉'), ing('豚肩ロース肉')],
        allergyProfile: { allergies: [], dislikes: [] },
        cookingPreference: { maxCookingMinutes: null, shoppingMode: 'none' },
      }),
    )
    const ids = result.suggestions.map((s) => s.recipeId)
    expect(ids).toContain('tori-teriyaki')
    expect(ids).toContain('buta-shogayaki')
  })
})
