import { describe, it, expect } from 'vitest'
import { rankRecipes, splitRequiredIngredients } from '../recipe-suggestion-engine'
import type { Recipe, RecipeIngredient } from '@/features/food/types'

function ri(name: string, amount = '1個'): RecipeIngredient {
  return { name, amount }
}

describe('recipe-suggestion-engine.ts - splitRequiredIngredients', () => {
  it('D7: 全ての必須食材が手元にある場合、haveに全件、missingは空になる', () => {
    const result = splitRequiredIngredients([ri('米', '1合'), ri('マグロ', '200g')], ['米', 'マグロ', '卵'])
    expect(result).toEqual({ have: [ri('米', '1合'), ri('マグロ', '200g')], missing: [] })
  })

  it('D8: 一部の必須食材が手元にない場合、have/missingに正しく分かれる', () => {
    const result = splitRequiredIngredients([ri('米', '1合'), ri('マグロ', '200g')], ['米'])
    expect(result).toEqual({ have: [ri('米', '1合')], missing: [ri('マグロ', '200g')] })
  })

  it('D9: 手元の食材が0件の場合、全てmissingになる', () => {
    const result = splitRequiredIngredients([ri('米', '1合'), ri('マグロ', '200g')], [])
    expect(result).toEqual({ have: [], missing: [ri('米', '1合'), ri('マグロ', '200g')] })
  })

  it('D10: 英語表記（tuna）でも日本語のマグロと同一食材としてhaveに分類される', () => {
    const result = splitRequiredIngredients([ri('米', '1合'), ri('マグロ', '200g')], ['米', 'tuna'])
    expect(result).toEqual({ have: [ri('米', '1合'), ri('マグロ', '200g')], missing: [] })
  })

  it('D11: 元のRecipe表記のまま返し、availableIngredientNames側の表記に置き換えない', () => {
    const result = splitRequiredIngredients([ri('マグロ', '200g')], ['tuna'])
    expect(result.have).toEqual([ri('マグロ', '200g')])
  })

  it('D12: requiredIngredientsが空配列の場合、have/missing共に空配列を返す', () => {
    const result = splitRequiredIngredients([], ['米'])
    expect(result).toEqual({ have: [], missing: [] })
  })

  it('D13: amountはmatching判定に一切使わない（amountが違ってもname一致ならhaveに分類される）', () => {
    const result = splitRequiredIngredients([ri('マグロ', '999個（実在しない分量）')], ['マグロ'])
    expect(result.have).toEqual([ri('マグロ', '999個（実在しない分量）')])
  })
})

// ============================================================
// MISSION 2.11 PHASE D.5 — HARD EXCLUSION Regression (H1〜H6) & AP
//
// ingredientChecks（PRODUCT CHECK ALERT）追加がrankRecipes()の
// HARD EXCLUSION・A/B判定・順序に一切影響しないことを固定化する。
// ============================================================

function makeRecipe(overrides: Partial<Recipe> & Pick<Recipe, 'id' | 'requiredIngredients'>): Recipe {
  return {
    name: overrides.id,
    type: 'main',
    seasonings: [],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    ...overrides,
  }
}

describe('recipe-suggestion-engine.ts - rankRecipes HARD EXCLUSION regression (H1〜H6, AP)', () => {
  it('H1: requiredIngredientsに登録allergyがあるRecipeはcandidateに一切出ない', () => {
    const recipe = makeRecipe({ id: 'egg-dish', requiredIngredients: [ri('卵', '1個')] })
    const result = rankRecipes([recipe], {
      availableIngredientNames: ['卵'],
      allergyNames: ['卵'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(result).toEqual([])
  })

  it('H2: seasoningsに登録allergyがあるRecipeもcandidateに一切出ない（表記ゆれcanonicalization経由も含む）', () => {
    const recipe = makeRecipe({
      id: 'egg-seasoning-dish',
      requiredIngredients: [ri('パン', '1枚')],
      seasonings: [ri('たまご', '1個')], // canonicalizeIngredientNameで「卵」と同一視される
    })
    const result = rankRecipes([recipe], {
      availableIngredientNames: ['パン'],
      allergyNames: ['卵'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(result).toEqual([])
  })

  it('H3: ingredientChecksがあるだけ（allergy非該当）のRecipeは候補に残る', () => {
    const recipe = makeRecipe({
      id: 'shoyu-dish',
      requiredIngredients: [ri('豆腐', '1/2丁')],
      seasonings: [ri('しょうゆ', '小さじ1')],
      ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    })
    const result = rankRecipes([recipe], {
      availableIngredientNames: ['豆腐'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('A')
  })

  it('H4/AP: 同一Recipeでingredientchecksの有無だけを変えてもcategory/順序が変化しない', () => {
    const base = { id: 'x', requiredIngredients: [ri('豆腐', '1/2丁')], seasonings: [ri('しょうゆ', '小さじ1')] }
    const withoutChecks = makeRecipe(base)
    const withChecks = makeRecipe({ ...base, ingredientChecks: [{ ingredientName: 'しょうゆ' }] })
    const params = {
      availableIngredientNames: ['豆腐'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    }
    const resultWithout = rankRecipes([withoutChecks], params)
    const resultWith = rankRecipes([withChecks], params)
    expect(resultWith[0].category).toBe(resultWithout[0].category)
    expect(resultWith[0].missingIngredients).toEqual(resultWithout[0].missingIngredients)
    expect(resultWith[0].hasDislikedIngredient).toBe(resultWithout[0].hasDislikedIngredient)
  })

  it('H5: cookingLiquidsはallergy判定に一切使われない（水がallergyNamesに入っても除外されない）', () => {
    const recipe = makeRecipe({
      id: 'soup-dish',
      requiredIngredients: [ri('豆腐', '1/2丁')],
      cookingLiquids: [{ name: '水', amount: '400ml' }],
    })
    const result = rankRecipes([recipe], {
      availableIngredientNames: ['豆腐'],
      allergyNames: ['水'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(result).toHaveLength(1)
  })

  it('H6: dislikeとallergyは混同されない（dislike一致は除外せずhasDislikedIngredientのみtrueになる）', () => {
    const recipe = makeRecipe({ id: 'natto-dish', requiredIngredients: [ri('納豆', '1パック')] })
    const result = rankRecipes([recipe], {
      availableIngredientNames: ['納豆'],
      allergyNames: [],
      dislikeNames: ['納豆'],
      maxCookingMinutes: null,
    })
    expect(result).toHaveLength(1)
    expect(result[0].hasDislikedIngredient).toBe(true)
  })
})
