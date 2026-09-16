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
import type { Ingredient, MealSuggestionRequest } from '@/features/food/types'

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

  it('Gate通過前（RECIPE_CATALOG全体）ならreview status のRecipeもmatchする＝Gateが実際に絞り込んでいることの対照実験（PUBLIC BETA RELEASE SPRINT 1D: ranking上位が入れ替わり単純な件数比較ができなくなったため、review status recipeの出現有無で直接検証する）', async () => {
    // oyako-don（review status、鶏肉・卵・玉ねぎが必要）をピンポイントで狙う食材セット。
    const targeted = request({
      ingredients: ['鶏肉', '卵', '玉ねぎ'].map(ing),
      cookingPreference: { maxCookingMinutes: null, shoppingMode: 'none' },
    })
    const gated = await mockMealProvider.suggest(targeted)
    const ungated = await createMealProvider(RECIPE_CATALOG).suggest(targeted)
    expect(RECIPE_CATALOG.find((r) => r.id === 'oyako-don')?.verification?.status).toBe('review')
    expect(gated.suggestions.some((s) => s.recipeId === 'oyako-don')).toBe(false)
    expect(ungated.suggestions.some((s) => s.recipeId === 'oyako-don')).toBe(true)
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
