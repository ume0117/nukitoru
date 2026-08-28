import { describe, it, expect } from 'vitest'
import { mockMealProvider } from '../mock-meal-provider'
import { RECIPE_CATALOG } from '../recipe-catalog'
import type { Ingredient, MealSuggestionRequest, QuantityMode } from '@/features/food/types'

function ing(name: string, quantityMode: QuantityMode = 'exact'): Ingredient {
  return { id: name, name, quantityMode }
}

function request(overrides: Partial<MealSuggestionRequest>): MealSuggestionRequest {
  return { ingredients: [], ...overrides }
}

const cookingTimeById = new Map(RECIPE_CATALOG.map((r) => [r.id, r.cookingTimeMinutes]))

describe('mockMealProvider.suggest — MISSION 2.11 PHASE C（複数候補モデル）', () => {
  it('1. ごはん+マグロ+卵+豆腐 → 複数のRecipe候補が返り、まぐろ丼が含まれる', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('ごはん'), ing('マグロ'), ing('卵'), ing('豆腐')],
        cookingPreference: { maxCookingMinutes: null, shoppingMode: 'none' },
      }),
    )
    expect(result.suggestions.length).toBeGreaterThanOrEqual(3)
    const titles = result.suggestions.map((s) => s.title)
    expect(titles).toContain('まぐろ丼')
    // 各suggestionは1レシピ=1候補（複数料理を1つのsuggestionへ合成しない）
    for (const s of result.suggestions) {
      expect(s.dishes).toHaveLength(1)
    }
  })

  it('2. ごはん+マグロ, maxCookingMinutes=20 → まぐろ丼(15分)が候補に含まれる', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('ごはん'), ing('マグロ')],
        cookingPreference: { maxCookingMinutes: 20, shoppingMode: 'none' },
      }),
    )
    const maguroDon = result.suggestions.find((s) => s.title === 'まぐろ丼')
    expect(maguroDon).toBeDefined()
    expect(maguroDon!.estimatedMinutes).toBe(15)
  })

  it('3. 米+ごはん+マグロ, maxCookingMinutes=10 → まぐろ丼(15分)も塩むすび(60分・実際の炊飯時間を反映済み)も除外される', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('米'), ing('ごはん'), ing('マグロ')],
        cookingPreference: { maxCookingMinutes: 10, shoppingMode: 'none' },
      }),
    )
    const titles = result.suggestions.map((s) => s.title)
    expect(titles).not.toContain('まぐろ丼')
    expect(titles).not.toContain('塩むすび')
  })

  it('4. maxCookingMinutesを指定した場合、返る全suggestionのestimatedMinutesが上限以下である', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('米'), ing('マグロ'), ing('卵'), ing('豆腐')],
        cookingPreference: { maxCookingMinutes: 20, shoppingMode: 'none' },
      }),
    )
    for (const s of result.suggestions) {
      expect(s.estimatedMinutes).not.toBeNull()
      expect(s.estimatedMinutes as number).toBeLessThanOrEqual(20)
    }
  })

  it('5. MealSuggestion.estimatedMinutesはそのRecipe自身のcookingTimeMinutesと一致する', async () => {
    const result = await mockMealProvider.suggest(
      request({ ingredients: [ing('米'), ing('マグロ'), ing('卵'), ing('豆腐')] }),
    )
    for (const s of result.suggestions) {
      expect(s.recipeId).toBeDefined()
      expect(s.estimatedMinutes).toBe(cookingTimeById.get(s.recipeId!))
    }
  })

  it('6. 食材0件 → suggestions: []（Bカテゴリの境界ケースでも復活しない）', async () => {
    const result = await mockMealProvider.suggest(request({ ingredients: [] }))
    expect(result.suggestions).toEqual([])
  })

  it('7. allergy=["卵"] → 卵を使う料理が一切候補に含まれない', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('米'), ing('マグロ'), ing('卵'), ing('豆腐')],
        allergyProfile: { allergies: ['卵'], dislikes: [] },
      }),
    )
    const titles = result.suggestions.map((s) => s.title)
    expect(titles).not.toContain('豆腐と卵のスープ')
    expect(titles).not.toContain('目玉焼き')
    expect(titles).not.toContain('卵焼き')
    expect(titles).not.toContain('炒り卵')
  })

  it('8. dislike=["卵"] → 卵料理を完全除外せず、代替候補があればそちらが上位、代替がなければ卵料理も表示される', async () => {
    const withAlternative = await mockMealProvider.suggest(
      request({
        ingredients: [ing('卵'), ing('豆腐')],
        allergyProfile: { allergies: [], dislikes: ['卵'] },
      }),
    )
    // 冷奴・豆腐の味噌汁など卵を含まない候補が卵を含む候補より上位に来る
    const firstNonEgg = withAlternative.suggestions.find(
      (s) => !s.dishes[0].requiredIngredients.some((ri) => ri.name === '卵'),
    )
    expect(firstNonEgg).toBeDefined()
    expect(withAlternative.suggestions[0].title).not.toBe('目玉焼き')

    const withoutAlternative = await mockMealProvider.suggest(
      request({
        ingredients: [ing('卵')],
        allergyProfile: { allergies: [], dislikes: ['卵'] },
      }),
    )
    const titles = withoutAlternative.suggestions.map((s) => s.title)
    expect(titles).toContain('目玉焼き')
  })

  it("9. quantityMode='vague'/'unknown' → 数量を数値化せず、Recipe基準量とStock保有量を混同しない集約warningを出す", async () => {
    const result = await mockMealProvider.suggest(
      request({ ingredients: [ing('ごはん', 'exact'), ing('マグロ', 'vague')] }),
    )
    const maguroDon = result.suggestions.find((s) => s.title === 'まぐろ丼')
    expect(maguroDon).toBeDefined()
    expect(maguroDon!.warnings).toContain(
      '分量が未登録の食材があります。レシピの目安量を満たすか調理前に確認してください。',
    )
  })

  it('10. shoppingItemsは常に空配列', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('米')],
        cookingPreference: { maxCookingMinutes: null, shoppingMode: 'normal' },
      }),
    )
    for (const s of result.suggestions) {
      expect(s.shoppingItems).toEqual([])
    }
  })

  it('11. 同一入力を2回与えた場合、結果が完全一致する（決定論性）', async () => {
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
      for (const s of result.suggestions) {
        for (const note of s.notes) {
          expect(note).not.toMatch(/優先しました|治す|治療/)
        }
      }
    }
  })
})

describe('mockMealProvider.suggest — C1〜C13（PHASE C 新規要件）', () => {
  it('C1: 「まぐろ」入力 → マグロを要求するRecipe（まぐろ丼）がmatchする', async () => {
    const result = await mockMealProvider.suggest(request({ ingredients: [ing('ごはん'), ing('まぐろ')] }))
    expect(result.suggestions.map((s) => s.title)).toContain('まぐろ丼')
  })

  it('C2: 「たまご」入力 → 卵を要求するRecipe（目玉焼き）がmatchする', async () => {
    const result = await mockMealProvider.suggest(request({ ingredients: [ing('たまご')] }))
    expect(result.suggestions.map((s) => s.title)).toContain('目玉焼き')
  })

  it('C3: 「海苔」入力 → のりを要求するRecipe（塩むすびのアレンジではなく、必須のりレシピ）がmatchする', async () => {
    const result = await mockMealProvider.suggest(request({ ingredients: [ing('米'), ing('海苔')] }))
    expect(result.suggestions.map((s) => s.title)).toContain('のり塩おにぎり')
  })

  it('C4: allergy=["たまご"] → 卵を使うRecipeが完全除外される（canonicalization経由でも安全性が保たれる）', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('ごはん'), ing('卵')],
        allergyProfile: { allergies: ['たまご'], dislikes: [] },
      }),
    )
    expect(result.suggestions.map((s) => s.title)).not.toContain('卵かけごはん')
  })

  it('C5: seasoningsにアレルゲンが含まれるRecipeは完全除外される', async () => {
    // 麻婆豆腐のseasoningsには「味噌」が含まれる
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('豆腐'), ing('豚ひき肉')],
        allergyProfile: { allergies: ['味噌'], dislikes: [] },
      }),
    )
    expect(result.suggestions.map((s) => s.title)).not.toContain('麻婆豆腐')
  })

  it('C6: arrangementのみに含まれるアレルゲン（まぐろ丼の卵黄アレンジ）は基本Recipeを除外しない', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('ごはん'), ing('マグロ')],
        allergyProfile: { allergies: ['卵'], dislikes: [] },
      }),
    )
    expect(result.suggestions.map((s) => s.title)).toContain('まぐろ丼')
  })

  it('C7: 十分な候補がある場合、suggestions.length >= 3', async () => {
    const result = await mockMealProvider.suggest(
      request({ ingredients: [ing('米'), ing('卵'), ing('豆腐')] }),
    )
    expect(result.suggestions.length).toBeGreaterThanOrEqual(3)
  })

  it('C8: 候補がどれだけあっても最大5件までしか返さない', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [
          ing('米'), ing('マグロ'), ing('卵'), ing('豆腐'), ing('鶏肉'), ing('豚肉'),
          ing('牛肉'), ing('キャベツ'), ing('玉ねぎ'), ing('にんじん'), ing('じゃがいも'),
          ing('大根'), ing('きのこ'), ing('鮭'), ing('サバ'), ing('ツナ'), ing('のり'),
          ing('納豆'), ing('うどん'), ing('パスタ'), ing('鶏ひき肉'), ing('豚ひき肉'),
        ],
      }),
    )
    expect(result.suggestions.length).toBeLessThanOrEqual(5)
  })

  it('C9: 候補が本当にない場合は[]を返し、fallbackで別料理を復活させない', async () => {
    const result = await mockMealProvider.suggest(request({ ingredients: [ing('存在しない謎の食材')] }))
    expect(result.suggestions).toEqual([])
  })

  it('C10: dislikeはsoft（完全除外せず、代替がなければ表示される）', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('豆腐'), ing('豚ひき肉')],
        allergyProfile: { allergies: [], dislikes: ['豚ひき肉'] },
      }),
    )
    // 他に候補がなければ麻婆豆腐も表示される（除外はしない）
    expect(result.suggestions.map((s) => s.title)).toContain('麻婆豆腐')
  })

  it('C11: maxCookingMinutes超過のRecipeは候補外になる', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('ごはん'), ing('豚肉'), ing('玉ねぎ'), ing('にんじん'), ing('じゃがいも')],
        cookingPreference: { maxCookingMinutes: 20, shoppingMode: 'none' },
      }),
    )
    // カレーライスは40分のため除外される
    expect(result.suggestions.map((s) => s.title)).not.toContain('カレーライス')
  })

  it('C12: 同一入力で同一順序（決定論的）になる', async () => {
    const input = request({ ingredients: [ing('米'), ing('卵'), ing('豆腐'), ing('のり')] })
    const first = await mockMealProvider.suggest(input)
    const second = await mockMealProvider.suggest(input)
    expect(second.suggestions.map((s) => s.title)).toEqual(first.suggestions.map((s) => s.title))
  })

  it('C13: reasonとnotesに同一文言が重複しない', async () => {
    const result = await mockMealProvider.suggest(
      request({ ingredients: [ing('米'), ing('マグロ'), ing('卵'), ing('豆腐')] }),
    )
    for (const s of result.suggestions) {
      expect(s.notes).not.toContain(s.reason)
    }
  })

  it('概念ガード: category A の候補は、常にB候補より上位に来る（BをAと同格に見せない）', async () => {
    // 米のみ入力: 塩むすび(A, 米のみ必須)と、複数のB候補(あと1品)が混在する状況
    const result = await mockMealProvider.suggest(request({ ingredients: [ing('米')] }))
    const categories = result.suggestions.map((s) =>
      s.reason === '手元の食材で作れます。' ? 'A' : 'B',
    )
    const firstBIndex = categories.indexOf('B')
    if (firstBIndex !== -1) {
      // firstBIndexより前に'A'以外が存在しないこと（Aが必ず先頭側にまとまる）
      expect(categories.slice(0, firstBIndex).every((c) => c === 'A')).toBe(true)
    }
  })
})

describe('mockMealProvider.suggest — PHASE C.1（英語食材入力対応）', () => {
  it('C14: "tuna" + ごはん → マグロRecipe（まぐろ丼）にmatchする', async () => {
    const result = await mockMealProvider.suggest(request({ ingredients: [ing('tuna'), ing('ごはん')] }))
    expect(result.suggestions.map((s) => s.title)).toContain('まぐろ丼')
  })

  it('C15: "egg" → 卵Recipeにmatchする', async () => {
    const result = await mockMealProvider.suggest(request({ ingredients: [ing('egg')] }))
    expect(result.suggestions.map((s) => s.title)).toContain('目玉焼き')
  })

  it('C16: "tofu" → 豆腐Recipeにmatchする', async () => {
    const result = await mockMealProvider.suggest(request({ ingredients: [ing('tofu')] }))
    expect(result.suggestions.map((s) => s.title)).toContain('冷奴')
  })

  it('C17: allergy="egg", Recipe ingredient="卵" → HARD EXCLUSION', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('ごはん'), ing('卵')],
        allergyProfile: { allergies: ['egg'], dislikes: [] },
      }),
    )
    expect(result.suggestions.map((s) => s.title)).not.toContain('卵かけごはん')
  })

  it('C18: allergy="tuna", Recipe ingredient="マグロ" → HARD EXCLUSION', async () => {
    const result = await mockMealProvider.suggest(
      request({
        ingredients: [ing('ごはん'), ing('マグロ')],
        allergyProfile: { allergies: ['tuna'], dislikes: [] },
      }),
    )
    expect(result.suggestions.map((s) => s.title)).not.toContain('まぐろ丼')
  })

  it('C19: 未知の英単語入力は勝手に既存食材へ変換されず、誤候補を生まない', async () => {
    const result = await mockMealProvider.suggest(request({ ingredients: [ing('cilantro')] }))
    expect(result.suggestions).toEqual([])
  })

  it('C20: "salmon" → 鮭Recipeにmatchする', async () => {
    const result = await mockMealProvider.suggest(request({ ingredients: [ing('salmon')] }))
    expect(result.suggestions.map((s) => s.title)).toContain('鮭の塩焼き')
  })

  it('C21: "chicken" → 鶏肉Recipeにmatchする', async () => {
    const result = await mockMealProvider.suggest(request({ ingredients: [ing('chicken')] }))
    expect(result.suggestions.map((s) => s.title)).toContain('鶏の照り焼き')
  })

  it('C22: "rice" → 米Recipeにmatchする', async () => {
    const result = await mockMealProvider.suggest(request({ ingredients: [ing('rice')] }))
    expect(result.suggestions.map((s) => s.title)).toContain('塩むすび')
  })

  it('C23: "seaweed" / "nori" → のりRecipeにmatchする', async () => {
    const resultSeaweed = await mockMealProvider.suggest(
      request({ ingredients: [ing('rice'), ing('seaweed')] }),
    )
    expect(resultSeaweed.suggestions.map((s) => s.title)).toContain('のり塩おにぎり')

    const resultNori = await mockMealProvider.suggest(
      request({ ingredients: [ing('rice'), ing('nori')] }),
    )
    expect(resultNori.suggestions.map((s) => s.title)).toContain('のり塩おにぎり')
  })

  it('C24: "ground pork"は通常のporkへ意図せず潰されず、豚肉が「手元にある」扱いにならない', async () => {
    const result = await mockMealProvider.suggest(
      request({ ingredients: [ing('ground pork'), ing('キャベツ')] }),
    )
    // 「豚肉とキャベツの味噌炒め」(requiredIngredients=[豚肉,キャベツ])は、
    // ground porkが豚肉として扱われていないため「あと1品（豚肉）」のB候補
    // としてのみ現れてよい。全required一致のA候補（reason='手元の食材で作れます。'）
    // として出てはいけない（=ground porkをporkと同一視していないことの確認）。
    const stirFry = result.suggestions.find((s) => s.title === '豚肉とキャベツの味噌炒め')
    if (stirFry) {
      expect(stirFry.reason).not.toBe('手元の食材で作れます。')
      expect(stirFry.notes.some((n) => n.includes('豚肉'))).toBe(true)
    }
  })
})
