// ============================================================
// matching-recall.test.ts
//
// PUBLIC BETA RELEASE SPRINT 2 — Safe Matching Recall。
//
// 家庭の一般的な食材入力（例: 「鶏肉」）から、specific ingredient recipe
// （例: 「鶏もも肉」を使うtori-teriyaki）をcandidateとして安全に発見できる
// ようにする一方、以下を絶対に混同しない:
//   - Ingredient Identity（Evidence上のrecipe食材名） ≠ Search/Matching Recall
//   - narrower → narrower（sibling、例: 鶏むね肉 → 鶏もも肉）の自動代入は禁止
//   - category matchはexact matchより強く評価されてはいけない
//   - Recipe Detail / allergy / product check のいずれもこの機能で変更しない
// ============================================================

import { describe, it, expect } from 'vitest'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { rankRecipes, splitRequiredIngredients } from '../recipe-suggestion-engine'
import {
  categoryMatchesRecipeIngredient,
  stockSatisfiesRecipeIngredient,
  allergyExcludesIngredient,
} from '../ingredient-taxonomy'
import { allergyRelevantIngredients } from '../recipe-safety'
import { isProductCheckTarget, productCheckMessage } from '../product-check-messages'

function params(overrides: Partial<Parameters<typeof rankRecipes>[1]>) {
  return {
    availableIngredientNames: [] as string[],
    allergyNames: [] as string[],
    dislikeNames: [] as string[],
    maxCookingMinutes: null,
    ...overrides,
  }
}

describe('SPRINT 2 — Target Recall (Section 5)', () => {
  it('鶏肉 → 鶏もも肉（tori-teriyaki）: category matchでdiscoverable', () => {
    const ranked = rankRecipes(RECIPE_CATALOG, params({ availableIngredientNames: ['鶏肉'] }))
    const c = ranked.find((x) => x.recipe.id === 'tori-teriyaki')
    expect(c).toBeDefined()
    expect(c!.category).toBe('A')
    expect(c!.categoryMatchedIngredients).toEqual(['鶏もも肉'])
  })

  it('豚肉 → 豚肩ロース肉（buta-shogayaki）: category matchでdiscoverable', () => {
    const ranked = rankRecipes(RECIPE_CATALOG, params({ availableIngredientNames: ['豚肉', '玉ねぎ'] }))
    const c = ranked.find((x) => x.recipe.id === 'buta-shogayaki')
    expect(c).toBeDefined()
    expect(c!.category).toBe('A')
    expect(c!.categoryMatchedIngredients).toEqual(['豚肩ロース肉'])
  })

  it('きのこ → 生しいたけ（yudofu）: category matchでdiscoverable（豆腐・春菊も揃えた場合）', () => {
    const ranked = rankRecipes(RECIPE_CATALOG, params({ availableIngredientNames: ['きのこ', '豆腐', '春菊'] }))
    const c = ranked.find((x) => x.recipe.id === 'yudofu')
    expect(c).toBeDefined()
    expect(c!.category).toBe('A')
    expect(c!.categoryMatchedIngredients).toEqual(['生しいたけ'])
  })
})

describe('SPRINT 2 — Directional Safety: sibling自動代入禁止（Section 3・6）', () => {
  it('鶏むね肉 → 鶏もも肉: NOT EXACT。categoryMatchesRecipeIngredientはfalse', () => {
    expect(categoryMatchesRecipeIngredient('鶏むね肉', '鶏もも肉')).toBe(false)
    expect(stockSatisfiesRecipeIngredient('鶏むね肉', '鶏もも肉')).toBe(false)
    const ranked = rankRecipes(RECIPE_CATALOG, params({ availableIngredientNames: ['鶏むね肉'] }))
    expect(ranked.some((c) => c.recipe.id === 'tori-teriyaki')).toBe(false)
  })

  it('えのき → 生しいたけ: NOT EXACT。categoryMatchesRecipeIngredientはfalse（生しいたけはcategory matchされず、truly missingのまま）', () => {
    expect(categoryMatchesRecipeIngredient('えのき', '生しいたけ')).toBe(false)
    expect(stockSatisfiesRecipeIngredient('えのき', '生しいたけ')).toBe(false)
    // 豆腐・春菊はexactで揃うため、えのきがあってもyudofuはcategory B（不足1: 生しいたけ）にはなるが、
    // 生しいたけをcategoryMatchedIngredientsへ紛れ込ませてはいけない（sibling自動代入禁止の核心）。
    const ranked = rankRecipes(RECIPE_CATALOG, params({ availableIngredientNames: ['えのき', '豆腐', '春菊'] }))
    const c = ranked.find((x) => x.recipe.id === 'yudofu')
    expect(c).toBeDefined()
    expect(c!.categoryMatchedIngredients).toEqual([])
    expect(c!.missingIngredients).toEqual(['生しいたけ'])
  })

  it('しいたけ（narrower）→ しいたけ違い（別narrower）を作らない: broaderIngredientNamesにない組はすべてfalse', () => {
    // 生しいたけの唯一のbroaderは「きのこ」であり、他のnarrower（えのき等）は
    // relation table自体に存在しないためcategory matchが成立しない。
    expect(categoryMatchesRecipeIngredient('干ししいたけ', '生しいたけ')).toBe(false)
  })

  it('category matchは常に一方向（narrower→broaderの発見のみ）。broader側のrecipeを narrower stockで満たさない', () => {
    // 「鶏もも肉」stockで「鶏肉」を使うrecipe（例: oyako-don）をcategory matchにしない
    // （broaderのrecipeをnarrower stockで自動確定しない。過大な充足方向を作らない）
    expect(categoryMatchesRecipeIngredient('鶏もも肉', '鶏肉')).toBe(false)
  })
})

describe('SPRINT 2 — Match Quality: category matchはexactより強く評価されない（Section 4）', () => {
  it('exactのみのcandidateは、category matchを含むcandidateより常に上位', () => {
    // buta-shogayaki: 豚肩ロース肉(exact) + 玉ねぎ(exact) → exactのみ
    // tori-teriyaki: 鶏もも肉(category matchのみ) → category matchあり
    // 両方が候補になる食材セットで、exactのみのbuta-shogayakiが上位に来ることを確認する
    const ranked = rankRecipes(RECIPE_CATALOG, params({ availableIngredientNames: ['鶏肉', '豚肩ロース肉', '玉ねぎ'] }))
    const toriIndex = ranked.findIndex((c) => c.recipe.id === 'tori-teriyaki')
    const butaIndex = ranked.findIndex((c) => c.recipe.id === 'buta-shogayaki')
    expect(toriIndex).toBeGreaterThanOrEqual(0)
    expect(butaIndex).toBeGreaterThanOrEqual(0)
    expect(butaIndex).toBeLessThan(toriIndex)
  })

  it('同一category（A）内でcategoryMatchedIngredients.length>0の候補は、0の候補より後ろにソートされる', () => {
    const ranked = rankRecipes(RECIPE_CATALOG, params({ availableIngredientNames: ['鶏肉', '豚肩ロース肉', '玉ねぎ'] }))
    const aCandidates = ranked.filter((c) => c.category === 'A')
    let sawCategoryMatch = false
    for (const c of aCandidates) {
      if (c.categoryMatchedIngredients.length > 0) {
        sawCategoryMatch = true
      } else {
        // exactのみの候補が、category matchありの候補より後に出現してはいけない
        expect(sawCategoryMatch, `${c.recipe.id}: exactのみだがcategory match候補より後ろにいる`).toBe(false)
      }
    }
  })
})

describe('SPRINT 2 — 変更されないもの（Section 6: UNCHANGED requirements）', () => {
  it('specific ingredient identity: UNCHANGED（Recipe.requiredIngredientsの表記は変更していない）', () => {
    const tori = RECIPE_CATALOG.find((r) => r.id === 'tori-teriyaki')!
    expect(tori.requiredIngredients).toEqual([{ name: '鶏もも肉', amount: '300g' }])
    const buta = RECIPE_CATALOG.find((r) => r.id === 'buta-shogayaki')!
    expect(buta.requiredIngredients.find((i) => i.name === '豚肩ロース肉')?.amount).toBe('200g')
    const yudofu = RECIPE_CATALOG.find((r) => r.id === 'yudofu')!
    expect(yudofu.requiredIngredients.find((i) => i.name === '生しいたけ')?.amount).toBe('8個')
  })

  it('Recipe Detail quantity: UNCHANGED（splitRequiredIngredientsは引き続きexact一致のみ。category matchで「ある」にしない）', () => {
    const tori = RECIPE_CATALOG.find((r) => r.id === 'tori-teriyaki')!
    // 「鶏肉」だけを在庫に入れても、splitRequiredIngredientsは「鶏もも肉」を
    // have扱いにしない（category matchはcandidate discoveryにのみ使う）
    const { have, missing } = splitRequiredIngredients(tori.requiredIngredients, ['鶏肉'])
    expect(have).toEqual([])
    expect(missing).toEqual([{ name: '鶏もも肉', amount: '300g' }])
  })

  it('Allergy exclusion: UNCHANGED（鶏肉アレルギーは引き続き鶏もも肉recipeをHARD EXCLUDEする。broader方向のみ）', () => {
    expect(allergyExcludesIngredient('鶏肉', '鶏もも肉')).toBe(true)
    const ranked = rankRecipes(RECIPE_CATALOG, params({ availableIngredientNames: ['鶏もも肉'], allergyNames: ['鶏肉'] }))
    expect(ranked.some((c) => c.recipe.id === 'tori-teriyaki')).toBe(false)
  })

  it('Allergy exclusion: 鶏もも肉アレルギーは鶏むね肉recipeへ自動拡張しない（narrower→narrower不可、従来どおり）', () => {
    expect(allergyExcludesIngredient('鶏もも肉', '鶏むね肉')).toBe(false)
  })

  it('Product Check: UNCHANGED（生しいたけ・鶏もも肉・豚肩ロース肉はPRODUCT_CHECK_TARGET_INGREDIENTSに追加されていない）', () => {
    expect(isProductCheckTarget('生しいたけ')).toBe(false)
    expect(isProductCheckTarget('鶏もも肉')).toBe(false)
    expect(isProductCheckTarget('豚肩ロース肉')).toBe(false)
    expect(productCheckMessage('しょうゆ')).toBeDefined() // 既存対象は無傷
  })

  it('allergyRelevantIngredients: UNCHANGED（category matchの導入で対象食材リストの計算方法は変えていない）', () => {
    const tori = RECIPE_CATALOG.find((r) => r.id === 'tori-teriyaki')!
    expect(allergyRelevantIngredients(tori)).toEqual(
      tori.requiredIngredients.map((i) => i.name).concat((tori.seasonings ?? []).map((i) => i.name)),
    )
  })
})

describe('SPRINT 2 — Ranking regression（既存の安全な候補選定を弱めていない）', () => {
  it('allergy該当recipeはcategory matchがあっても引き続き候補に一切現れない', () => {
    const ranked = rankRecipes(RECIPE_CATALOG, params({
      availableIngredientNames: ['鶏肉'],
      allergyNames: ['鶏肉'],
    }))
    expect(ranked.some((c) => c.recipe.id === 'tori-teriyaki')).toBe(false)
  })

  it('食材が0件なら、category matchが理論上成立する状況でも一切提案しない（既存の空入力ガードは無傷）', () => {
    const ranked = rankRecipes(RECIPE_CATALOG, params({ availableIngredientNames: [] }))
    expect(ranked).toEqual([])
  })
})
