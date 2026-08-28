import { describe, it, expect } from 'vitest'
import { allergyRelevantIngredients, arrangementRelevantIngredients, filterSafeArrangements } from '../recipe-safety'
import type { Recipe } from '@/features/food/types'

const baseRecipe: Recipe = {
  id: 'maguro-don',
  name: 'まぐろ丼',
  type: 'main',
  requiredIngredients: [
    { name: '米', amount: '1合' },
    { name: 'マグロ', amount: '200g' },
  ],
  seasonings: [{ name: 'しょうゆ', amount: '大さじ1' }],
  cookingTimeMinutes: 15,
  servingsBase: 2,
  arrangements: [
    { id: 'egg-yolk', label: '卵黄をのせる', addIngredients: ['卵'] },
  ],
}

describe('recipe-safety.ts', () => {
  it('A10: 基本Recipeのallergy対象は requiredIngredients + seasonings のみで、arrangement.addIngredientsを含めない', () => {
    const result = allergyRelevantIngredients(baseRecipe)
    expect(result).toEqual(['米', 'マグロ', 'しょうゆ'])
    expect(result).not.toContain('卵')
  })

  it('A10b: seasoningsが未定義でもrequiredIngredientsのみで正常に動作する', () => {
    const recipeWithoutSeasonings: Recipe = { ...baseRecipe, seasonings: undefined }
    expect(allergyRelevantIngredients(recipeWithoutSeasonings)).toEqual(['米', 'マグロ'])
  })

  it('A11: arrangement単体でaddIngredientsを取得して個別に安全判定できる', () => {
    const arrangement = baseRecipe.arrangements![0]
    expect(arrangementRelevantIngredients(arrangement)).toEqual(['卵'])
  })

  it('A11b: addIngredientsが未定義のarrangementは空配列を返す', () => {
    const plainArrangement = { id: 'sesame', label: 'ごまを加える' }
    expect(arrangementRelevantIngredients(plainArrangement)).toEqual([])
  })

  it('例: 卵アレルギーの場合でも基本のまぐろ丼は提案可能、卵黄アレンジのみ非表示にできる設計であることを確認', () => {
    const allergyNames = new Set(['卵'])
    const baseHitsAllergy = allergyRelevantIngredients(baseRecipe).some((n) => allergyNames.has(n))
    const arrangementHitsAllergy = arrangementRelevantIngredients(baseRecipe.arrangements![0]).some((n) =>
      allergyNames.has(n),
    )
    expect(baseHitsAllergy).toBe(false)
    expect(arrangementHitsAllergy).toBe(true)
  })

  it('D1: 卵アレルギーの場合、まぐろ丼の卵黄アレンジのみ非表示になり、基本Recipe自体は影響を受けない', () => {
    const safe = filterSafeArrangements(baseRecipe, ['卵'])
    expect(safe).toEqual([])
    // 基本Recipe自体（requiredIngredients）は卵アレルギーに該当しないため、
    // filterSafeArrangementsの結果に関係なく提案可能であり続ける
    expect(allergyRelevantIngredients(baseRecipe)).not.toContain('卵')
  })

  it('D2: アレルギーがそのarrangementのaddIngredientsと一致しない場合、そのアレンジは表示される', () => {
    const safe = filterSafeArrangements(baseRecipe, ['そば'])
    expect(safe).toEqual(baseRecipe.arrangements)
  })

  it('D3: allergyNamesが空配列の場合、全arrangementがそのまま表示される', () => {
    const safe = filterSafeArrangements(baseRecipe, [])
    expect(safe).toEqual(baseRecipe.arrangements)
  })

  it('D4: arrangementsが未定義のRecipeは空配列を返す', () => {
    const recipeWithoutArrangements: Recipe = { ...baseRecipe, arrangements: undefined }
    expect(filterSafeArrangements(recipeWithoutArrangements, ['卵'])).toEqual([])
  })

  it('D5: 表記ゆれ（たまご）でもcanonicalizeを通じて正しくアレンジが除外される', () => {
    const safe = filterSafeArrangements(baseRecipe, ['たまご'])
    expect(safe).toEqual([])
  })

  it('D6: 複数arrangementのうち、安全なものだけが残る', () => {
    const multiArrangementRecipe: Recipe = {
      ...baseRecipe,
      arrangements: [
        { id: 'egg-yolk', label: '卵黄をのせる', addIngredients: ['卵'] },
        { id: 'sesame', label: 'ごまをふる', addIngredients: ['ごま'] },
      ],
    }
    const safe = filterSafeArrangements(multiArrangementRecipe, ['卵'])
    expect(safe).toEqual([{ id: 'sesame', label: 'ごまをふる', addIngredients: ['ごま'] }])
  })
})
