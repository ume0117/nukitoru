// ============================================================
// ingredient-taxonomy.test.ts
//
// MISSION 2.21 — Canonical Ingredient Relation Minimal Foundation。
//
// canonicalization（表記ゆれ）と taxonomy（broader/narrower）が別レイヤーであること、
// STOCK マッチと ALLERGY カバレッジで relation を安全な向きにだけ使うことを固定化する。
// ============================================================

import { describe, it, expect } from 'vitest'
import { canonicalizeIngredientName } from '../ingredient-normalization'
import {
  broaderIngredientNames,
  isBroaderNarrowerRelated,
  stockSatisfiesRecipeIngredient,
  allergyExcludesIngredient,
  recipeIngredientsHitAllergy,
} from '../ingredient-taxonomy'
import { rankRecipes } from '../recipe-suggestion-engine'
import { RECIPE_CATALOG } from '../recipe-catalog'
import type { Recipe } from '@/features/food/types'

function makeRecipe(id: string, ingredientNames: string[], cookingTimeMinutes = 15): Recipe {
  return {
    id,
    name: id,
    type: 'main',
    requiredIngredients: ingredientNames.map((name) => ({ name, amount: '100g' })),
    seasonings: [],
    cookingTimeMinutes,
    servingsBase: 2,
    steps: ['焼く'],
  }
}

// ---- canonicalization は taxonomy で潰れない ----

describe('MISSION 2.21 — canonicalization unaffected by taxonomy', () => {
  it('GA: 鶏肉 は 鶏肉 のまま / chicken → 鶏肉', () => {
    expect(canonicalizeIngredientName('鶏肉')).toBe('鶏肉')
    expect(canonicalizeIngredientName('chicken')).toBe('鶏肉')
  })

  it('GB: 鶏もも肉・鶏むね肉・鶏ひき肉 はそれぞれ別の canonical のまま（同じ値へ潰さない）', () => {
    expect(canonicalizeIngredientName('鶏もも肉')).toBe('鶏もも肉')
    expect(canonicalizeIngredientName('鶏むね肉')).toBe('鶏むね肉')
    expect(canonicalizeIngredientName('鶏ひき肉')).toBe('鶏ひき肉')
    // 互いに別物
    expect(canonicalizeIngredientName('鶏もも肉')).not.toBe(canonicalizeIngredientName('鶏むね肉'))
    expect(canonicalizeIngredientName('鶏もも肉')).not.toBe(canonicalizeIngredientName('鶏肉'))
  })
})

// ---- taxonomy relation ----

describe('MISSION 2.21 — broader/narrower relation', () => {
  it('GC: 鶏もも肉 / 鶏むね肉 / 鶏ひき肉 の broader は 鶏肉', () => {
    expect(broaderIngredientNames('鶏もも肉')).toEqual(['鶏肉'])
    expect(broaderIngredientNames('鶏むね肉')).toEqual(['鶏肉'])
    expect(broaderIngredientNames('鶏ひき肉')).toEqual(['鶏肉'])
  })

  it('GD: 豚ひき肉 の broader は 豚肉', () => {
    expect(broaderIngredientNames('豚ひき肉')).toEqual(['豚肉'])
  })

  it('GE: 鶏肉・豚肉（generic）自身は broader を持たない', () => {
    expect(broaderIngredientNames('鶏肉')).toEqual([])
    expect(broaderIngredientNames('豚肉')).toEqual([])
  })

  it('GF: relation に無い食材は broader を持たない（近い食材へ寄せない）', () => {
    expect(broaderIngredientNames('牛肉')).toEqual([])
    expect(broaderIngredientNames('鮭')).toEqual([])
    expect(broaderIngredientNames('未知の食材')).toEqual([])
  })

  it('GG: 鶏もも肉 と 鶏むね肉 は broader/narrower 関係にない（別の narrower 同士）', () => {
    expect(isBroaderNarrowerRelated('鶏もも肉', '鶏むね肉')).toBe(false)
    expect(isBroaderNarrowerRelated('鶏もも肉', '鶏肉')).toBe(true)
    expect(isBroaderNarrowerRelated('鶏肉', '鶏もも肉')).toBe(true)
  })
})

// ---- STOCK matching: 完全一致のみ、generic → specific の自動確定なし ----

describe('MISSION 2.21 — stock matching stays exact', () => {
  it('GH: 鶏もも肉 在庫 → 鶏もも肉 recipe は MATCH', () => {
    expect(stockSatisfiesRecipeIngredient('鶏もも肉', '鶏もも肉')).toBe(true)
  })

  it('GI: 鶏むね肉 在庫 → 鶏もも肉 recipe は NO MATCH', () => {
    expect(stockSatisfiesRecipeIngredient('鶏むね肉', '鶏もも肉')).toBe(false)
  })

  it('GJ: 鶏肉（generic）在庫 → 鶏もも肉 recipe は NOT exact MATCH（もも肉である事実を確認できない）', () => {
    expect(stockSatisfiesRecipeIngredient('鶏肉', '鶏もも肉')).toBe(false)
  })

  it('GK: 鶏もも肉 在庫 → 鶏肉 recipe も taxonomy で自動 MATCH にしない（legacy generic の意味を再定義しない）', () => {
    expect(stockSatisfiesRecipeIngredient('鶏もも肉', '鶏肉')).toBe(false)
  })

  it('GL: rankRecipes の候補判定 — 鶏肉 在庫では 鶏もも肉 recipe は category matchでdiscoverableになるが、exact matchとは区別される（PUBLIC BETA RELEASE SPRINT 2）', () => {
    const catalog = [makeRecipe('mom-recipe', ['鶏もも肉'])]
    const withMomo = rankRecipes(catalog, {
      availableIngredientNames: ['鶏もも肉'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(withMomo.map((c) => c.recipe.id)).toEqual(['mom-recipe'])
    expect(withMomo[0].category).toBe('A')
    expect(withMomo[0].categoryMatchedIngredients).toEqual([])

    const withGeneric = rankRecipes(catalog, {
      availableIngredientNames: ['鶏肉'], // generic のみ
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    // PUBLIC BETA RELEASE SPRINT 2: 鶏肉（broader category）は鶏もも肉のcandidate discovery
    // を可能にする。ただしexact matchではなくcategoryMatchedIngredientsとして区別される
    // （stockSatisfiesRecipeIngredientやsplitRequiredIngredientsのexact判定は変えていない）。
    expect(withGeneric.map((c) => c.recipe.id)).toContain('mom-recipe')
    expect(withGeneric[0].categoryMatchedIngredients).toEqual(['鶏もも肉'])

    const withMune = rankRecipes(catalog, {
      availableIngredientNames: ['鶏むね肉'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    // 鶏むね肉（sibling specific）は鶏もも肉のcategory matchにならない（directional safety）
    expect(withMune.map((c) => c.recipe.id)).not.toContain('mom-recipe')
  })
})

// ---- ALLERGY: broader allergy が narrower ingredient を覆う（安全側） ----

describe('MISSION 2.21 — allergy coverage is broader-aware (safe direction only)', () => {
  it('GM: 鶏肉 アレルギー → 鶏もも肉 recipe を HARD EXCLUDE', () => {
    expect(allergyExcludesIngredient('鶏肉', '鶏もも肉')).toBe(true)
    const ranked = rankRecipes([makeRecipe('r-momo', ['鶏もも肉'])], {
      availableIngredientNames: ['鶏もも肉'],
      allergyNames: ['鶏肉'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked).toHaveLength(0)
  })

  it('GN: 鶏肉 アレルギー → 鶏むね肉 recipe を HARD EXCLUDE', () => {
    expect(allergyExcludesIngredient('鶏肉', '鶏むね肉')).toBe(true)
    const ranked = rankRecipes([makeRecipe('r-mune', ['鶏むね肉'])], {
      availableIngredientNames: ['鶏むね肉'],
      allergyNames: ['鶏肉'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked).toHaveLength(0)
  })

  it('GO: 鶏肉 アレルギー → 鶏ひき肉 recipe を HARD EXCLUDE（既存 latent gap の安全側修正）', () => {
    expect(allergyExcludesIngredient('鶏肉', '鶏ひき肉')).toBe(true)
    const ranked = rankRecipes([makeRecipe('r-hiki', ['鶏ひき肉'])], {
      availableIngredientNames: ['鶏ひき肉'],
      allergyNames: ['鶏肉'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked).toHaveLength(0)
  })

  it('GP: 鶏もも肉 アレルギー → 鶏むね肉 recipe を自動 HARD EXCLUDE しない（narrower→narrower の推測をしない）', () => {
    expect(allergyExcludesIngredient('鶏もも肉', '鶏むね肉')).toBe(false)
    const ranked = rankRecipes([makeRecipe('r-mune2', ['鶏むね肉'])], {
      availableIngredientNames: ['鶏むね肉'],
      allergyNames: ['鶏もも肉'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked.map((c) => c.recipe.id)).toEqual(['r-mune2'])
  })

  it('GQ: 鶏もも肉 アレルギー → 鶏肉（generic）recipe を自動 HARD EXCLUDE しない（narrower allergy は broader を覆わない）', () => {
    expect(allergyExcludesIngredient('鶏もも肉', '鶏肉')).toBe(false)
  })

  it('GR: exact 一致は従来どおり除外（chicken 表記ゆれ含む）', () => {
    expect(allergyExcludesIngredient('鶏肉', '鶏肉')).toBe(true)
    expect(allergyExcludesIngredient('chicken', '鶏肉')).toBe(true)
    expect(recipeIngredientsHitAllergy(['豆腐', '鶏もも肉'], ['鶏肉'])).toBe(true)
    expect(recipeIngredientsHitAllergy(['豆腐', 'ねぎ'], ['鶏肉'])).toBe(false)
  })
})

// ---- LEGACY FIREWALL ----

describe('MISSION 2.21 — legacy firewall', () => {
  it('GS: カタログの ingredient 名で broader を持つのは 鶏もも肉 / 鶏ひき肉 / 豚ひき肉 / 豚肩ロース肉 / 生しいたけ（PUBLIC BETA RELEASE SPRINT 2でyudofuの生しいたけ→きのこを追加）', () => {
    const withBroader = new Set<string>()
    for (const r of RECIPE_CATALOG) {
      for (const ing of [...r.requiredIngredients, ...(r.seasonings ?? [])]) {
        if (broaderIngredientNames(ing.name).length > 0) withBroader.add(ing.name)
      }
    }
    expect([...withBroader].sort()).toEqual(['生しいたけ', '豚ひき肉', '豚肩ロース肉', '鶏ひき肉', '鶏もも肉'])
  })

  it('GT: アレルギー登録が無ければ、taxonomy 追加でカタログの候補結果は変わらない', () => {
    const params = {
      availableIngredientNames: ['鶏ひき肉', '豚ひき肉', 'ごはん', '卵', '豆腐', '玉ねぎ', 'にんじん'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    }
    const ranked = rankRecipes(RECIPE_CATALOG, params)
    // tori-soboro-don（鶏ひき肉）は在庫があるので従来どおり候補に入る
    expect(ranked.some((c) => c.recipe.id === 'tori-soboro-don')).toBe(true)
  })

  it('GU: tori-teriyaki は MISSION 2.19E-RESUME-2 で 鶏もも肉 300g に修正済み', () => {
    const r = RECIPE_CATALOG.find((x) => x.id === 'tori-teriyaki')!
    expect(r.requiredIngredients).toEqual([{ name: '鶏もも肉', amount: '300g' }])
  })

  it('GV: tori-teriyaki（鶏もも肉）— 鶏もも肉在庫=exact A / 鶏肉generic=category match A（discoverable、exactとは区別） / 鶏肉アレルギー=HARD EXCLUDE', () => {
    const base = { allergyNames: [] as string[], dislikeNames: [] as string[], maxCookingMinutes: null }
    const withMomo = rankRecipes(RECIPE_CATALOG, {
      ...base,
      availableIngredientNames: ['鶏もも肉'],
    })
    const momoCandidate = withMomo.find((c) => c.recipe.id === 'tori-teriyaki')
    expect(momoCandidate?.category).toBe('A')
    expect(momoCandidate?.categoryMatchedIngredients).toEqual([])

    const withGeneric = rankRecipes(RECIPE_CATALOG, {
      ...base,
      availableIngredientNames: ['鶏肉'],
    })
    // PUBLIC BETA RELEASE SPRINT 2: 鶏肉 generic は category matchでtori-teriyakiを
    // discoverableにする（category='A'だがcategoryMatchedIngredientsで区別され、
    // exactのみのcandidateより常に下位にランクされる。exact matchの意味自体は変えていない）。
    const genericCandidate = withGeneric.find((c) => c.recipe.id === 'tori-teriyaki')
    expect(genericCandidate?.category).toBe('A')
    expect(genericCandidate?.categoryMatchedIngredients).toEqual(['鶏もも肉'])

    const withAllergy = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['鶏もも肉'],
      allergyNames: ['鶏肉'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(withAllergy.some((c) => c.recipe.id === 'tori-teriyaki')).toBe(false)
  })
})

// ---- FUTURE tori-teriyaki target behavior (foundation readiness) ----

describe('MISSION 2.21 — foundation readiness for MISSION 2.19E-RESUME (tori-teriyaki → 鶏もも肉)', () => {
  // tori-teriyaki が将来 鶏もも肉 になったときの期待挙動を、合成 recipe で先に固定化する
  const futureTT = makeRecipe('future-tt', ['鶏もも肉'])

  it('GW: recipe 鶏もも肉 + stock 鶏もも肉 → exact MATCH（A候補）', () => {
    const ranked = rankRecipes([futureTT], {
      availableIngredientNames: ['鶏もも肉'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked[0]?.category).toBe('A')
  })

  it('GX: recipe 鶏もも肉 + stock 鶏むね肉 → NO MATCH', () => {
    const ranked = rankRecipes([futureTT], {
      availableIngredientNames: ['鶏むね肉'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked.map((c) => c.recipe.id)).not.toContain('future-tt')
  })

  it('GY: recipe 鶏もも肉 + stock 鶏肉 → category matchでdiscoverableだがexact matchではない（PUBLIC BETA RELEASE SPRINT 2）', () => {
    const ranked = rankRecipes([futureTT], {
      availableIngredientNames: ['鶏肉'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked.map((c) => c.recipe.id)).toContain('future-tt')
    expect(ranked[0]?.categoryMatchedIngredients).toEqual(['鶏もも肉'])
  })

  it('GZ: recipe 鶏もも肉 + allergy 鶏肉 → HARD EXCLUDE', () => {
    const ranked = rankRecipes([futureTT], {
      availableIngredientNames: ['鶏もも肉'],
      allergyNames: ['鶏肉'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked).toHaveLength(0)
  })
})
