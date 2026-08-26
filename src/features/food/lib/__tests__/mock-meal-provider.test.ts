import { describe, it, expect } from 'vitest'
import { mockMealProvider } from '../mock-meal-provider'
import type { Ingredient, MealSuggestionRequest, QuantityMode } from '@/features/food/types'

function ing(name: string, quantityMode: QuantityMode = 'exact'): Ingredient {
  return { id: name, name, quantityMode }
}

function request(overrides: Partial<MealSuggestionRequest>): MealSuggestionRequest {
  return { ingredients: [], ...overrides }
}

describe('mockMealProvider.suggest', () => {
  it('1. 米+マグロ+卵+豆腐, maxCookingMinutes=null → まぐろ丼+豆腐と卵のスープ, estimatedMinutes=25', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('米'), ing('マグロ'), ing('卵'), ing('豆腐')],
        cookingPreference: { maxCookingMinutes: null, shoppingMode: 'none' },
      }),
    )
    expect(result.suggestions).toHaveLength(1)
    const suggestion = result.suggestions[0]
    expect(suggestion.dishes.map((d) => d.name)).toEqual(['まぐろ丼', '豆腐と卵のスープ'])
    expect(suggestion.estimatedMinutes).toBe(25)
  })

  it('2. 米+マグロ, maxCookingMinutes=20 → まぐろ丼, estimatedMinutes=15', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('米'), ing('マグロ')],
        cookingPreference: { maxCookingMinutes: 20, shoppingMode: 'none' },
      }),
    )
    const suggestion = result.suggestions[0]
    expect(suggestion.dishes.map((d) => d.name)).toEqual(['まぐろ丼'])
    expect(suggestion.estimatedMinutes).toBe(15)
  })

  it('3. 米+マグロ, maxCookingMinutes=10 → まぐろ丼は選ばれず塩むすびが選ばれる, estimatedMinutes<=10', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('米'), ing('マグロ')],
        cookingPreference: { maxCookingMinutes: 10, shoppingMode: 'none' },
      }),
    )
    const suggestion = result.suggestions[0]
    expect(suggestion.dishes.map((d) => d.name)).not.toContain('まぐろ丼')
    expect(suggestion.dishes.map((d) => d.name)).toContain('塩むすび')
    expect(suggestion.estimatedMinutes).toBeLessThanOrEqual(10)
  })

  it('4. 複数料理の合計時間が maxCookingMinutes を超えない（まぐろ丼15+スープ10=25 は maxCookingMinutes=20 で禁止）', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('米'), ing('マグロ'), ing('卵'), ing('豆腐')],
        cookingPreference: { maxCookingMinutes: 20, shoppingMode: 'none' },
      }),
    )
    const suggestion = result.suggestions[0]
    expect(suggestion.estimatedMinutes).not.toBeNull()
    expect(suggestion.estimatedMinutes as number).toBeLessThanOrEqual(20)
    // まぐろ丼(15) + 豆腐と卵のスープ(10) = 25 は上限を超えるため提案されない
    expect(suggestion.dishes.map((d) => d.name)).not.toEqual(
      expect.arrayContaining(['まぐろ丼', '豆腐と卵のスープ']),
    )
  })

  it('5. MealSuggestion.estimatedMinutes は選択された料理の estimatedMinutes 合計と一致する', async () => {
    const result = await mockMealProvider.suggest(
      request({ ingredients: [ing('米'), ing('マグロ'), ing('卵'), ing('豆腐')] }),
    )
    const suggestion = result.suggestions[0]
    const catalogMinutes: Record<string, number> = {
      塩むすび: 10,
      まぐろ丼: 15,
      冷奴: 5,
      豆腐と卵のスープ: 10,
      目玉焼き: 5,
    }
    const expectedTotal = suggestion.dishes.reduce((sum, d) => sum + catalogMinutes[d.name], 0)
    expect(suggestion.estimatedMinutes).toBe(expectedTotal)
  })

  it('6. 食材0件 → suggestions: []', async () => {
    const result = await mockMealProvider.suggest(request({ ingredients: [] }))
    expect(result.suggestions).toEqual([])
  })

  it('7. allergy=["卵"] → 卵を使う料理が一切選択されない', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('米'), ing('マグロ'), ing('卵'), ing('豆腐')],
        allergyProfile: { allergies: ['卵'], dislikes: [] },
      }),
    )
    const names = result.suggestions[0]?.dishes.map((d) => d.name) ?? []
    expect(names).not.toContain('豆腐と卵のスープ')
    expect(names).not.toContain('目玉焼き')
  })

  it('8. dislike=["卵"] → 卵料理を完全除外せず、他候補より順位を下げる', async () => {
    const withAlternative = await mockMealProvider.suggest(
      request({
        ingredients: [ing('卵'), ing('豆腐')],
        allergyProfile: { allergies: [], dislikes: ['卵'] },
      }),
    )
    expect(withAlternative.suggestions[0].dishes.map((d) => d.name)).toEqual(['冷奴'])

    const withoutAlternative = await mockMealProvider.suggest(
      request({
        ingredients: [ing('卵')],
        allergyProfile: { allergies: [], dislikes: ['卵'] },
      }),
    )
    expect(withoutAlternative.suggestions[0].dishes.map((d) => d.name)).toContain('目玉焼き')
  })

  it("9. quantityMode='vague'/'unknown' → 数量を数値化せず warning を出す", async () => {
    const result = await mockMealProvider.suggest(
      request({ ingredients: [ing('米', 'exact'), ing('マグロ', 'vague')] }),
    )
    expect(result.suggestions[0].warnings).toEqual([
      'マグロの数量は不明として扱い、具体的な数量には確定していません。',
    ])
  })

  it('10. shoppingItems は常に空配列', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('米')],
        cookingPreference: { maxCookingMinutes: null, shoppingMode: 'normal' },
      }),
    )
    expect(result.suggestions[0].shoppingItems).toEqual([])
  })

  it('11. 同一入力を2回与えた場合、結果が完全一致する', async () => {
    const input = request({ ingredients: [ing('米'), ing('マグロ'), ing('卵'), ing('豆腐')] })
    const first = await mockMealProvider.suggest(input)
    const second = await mockMealProvider.suggest(input)
    expect(second).toEqual(first)
  })

  it('12. DailyConditionのnoteに「優先しました」「治す」「治療」等の表現が含まれない', async () => {
    const conditions = [
      'normal',
      'tired',
      'cold_symptoms',
      'low_appetite',
      'heavy_stomach',
      'summer_fatigue',
      'hangover',
    ] as const

    for (const dailyCondition of conditions) {
      const result = await mockMealProvider.suggest(
        request({ ingredients: [ing('米')], dailyCondition }),
      )
      const notes = result.suggestions[0]?.notes ?? []
      for (const note of notes) {
        expect(note).not.toMatch(/優先しました|治す|治療/)
      }
    }
  })
})
