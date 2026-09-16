// ============================================================
// pork-taxonomy-wheat-allergen.test.ts
//
// MISSION 2.30 — Pork Taxonomy & Wheat Allergen Safety Gate。
//
// buta-shogayaki VERIFIED #2 候補のために、安全性ブロッカーだけを解消する:
//   (1) 豚肩ロース肉 / 豚ロース肉 → 豚肉 の taxonomy（部位 → 豚肉）
//   (2) 小麦粉 → 小麦 の allergen 関係（relationType: 'contains'）
//   (3) STOCK マッチングは弱めない（部位在庫 ≠ 別部位 recipe、generic 豚肉在庫 ≠ 部位 recipe）
//   (4) UNKNOWN を推測でアレルゲンにしない（片栗粉/米粉/パン粉 → 小麦 は作らない）
//
// Safety Gate を VERIFIED のために弱めない。buta-shogayaki は status:review のまま。
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  broaderIngredientNames,
  allergyExcludesIngredient,
  recipeIngredientsHitAllergy,
  stockSatisfiesRecipeIngredient,
} from '../ingredient-taxonomy'
import {
  ingredientAllergenRelations,
  ingredientHitsAllergen,
  recipeIngredientsHitAllergenRisk,
  allIngredientAllergenRelations,
} from '../ingredient-allergens'
import { getEvidenceSourceById } from '../evidence-sources'
import { rankRecipes } from '../recipe-suggestion-engine'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { isRecipePublishable } from '../recipe-publishability'
import type { Recipe } from '@/features/food/types'

function recipe(id: string, ingredientNames: string[], seasoningNames: string[] = []): Recipe {
  return {
    id,
    name: id,
    type: 'main',
    requiredIngredients: ingredientNames.map((name) => ({ name, amount: '200g' })),
    seasonings: seasoningNames.map((name) => ({ name, amount: '大さじ1' })),
    cookingTimeMinutes: 15,
    servingsBase: 2,
    steps: ['焼く'],
  }
}

// ------------------------------------------------------------
// Section 12-A — 豚肉 taxonomy
// ------------------------------------------------------------
describe('MISSION 2.30 — Section A: 豚部位 → 豚肉 taxonomy', () => {
  it('A1: 豚肩ロース肉 / 豚ロース肉 の broader は 豚肉', () => {
    expect(broaderIngredientNames('豚肩ロース肉')).toEqual(['豚肉'])
    expect(broaderIngredientNames('豚ロース肉')).toEqual(['豚肉'])
  })

  it('A2: 既存の taxonomy 関係は無傷（鶏系・豚ひき肉）', () => {
    expect(broaderIngredientNames('鶏もも肉')).toEqual(['鶏肉'])
    expect(broaderIngredientNames('鶏むね肉')).toEqual(['鶏肉'])
    expect(broaderIngredientNames('豚ひき肉')).toEqual(['豚肉'])
  })

  it('A3: 過剰一般化なし — 豚バラ肉 など未登録の部位は broader を持たない', () => {
    expect(broaderIngredientNames('豚バラ肉')).toEqual([])
    expect(broaderIngredientNames('豚肉')).toEqual([])
    expect(broaderIngredientNames('肉')).toEqual([])
  })
})

// ------------------------------------------------------------
// Section 12-B / C — 豚肉 アレルギー → 部位 recipe HARD EXCLUDE
// ------------------------------------------------------------
describe('MISSION 2.30 — Section B/C: 豚肉 アレルギー HARD EXCLUDE', () => {
  it('B1: 豚肉 アレルギー は 豚肩ロース肉 を使う recipe を除外対象にする', () => {
    expect(allergyExcludesIngredient('豚肉', '豚肩ロース肉')).toBe(true)
    expect(recipeIngredientsHitAllergy(['豚肩ロース肉', '玉ねぎ'], ['豚肉'])).toBe(true)
  })

  it('C1: 豚肉 アレルギー は 豚ロース肉 を使う recipe を除外対象にする', () => {
    expect(allergyExcludesIngredient('豚肉', '豚ロース肉')).toBe(true)
    expect(recipeIngredientsHitAllergy(['豚ロース肉'], ['豚肉'])).toBe(true)
  })

  it('BC-engine: rankRecipes — 豚肉 アレルギーで 豚肩ロース肉 / 豚ロース肉 recipe が候補から消える', () => {
    const catalog = [
      recipe('katarosu-yaki', ['豚肩ロース肉', '玉ねぎ']),
      recipe('rosu-yaki', ['豚ロース肉']),
    ]
    const withAllergy = rankRecipes(catalog, {
      availableIngredientNames: ['豚肩ロース肉', '豚ロース肉', '玉ねぎ'],
      allergyNames: ['豚肉'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(withAllergy).toHaveLength(0)
  })

  it('BC-narrower: 豚肩ロース肉 アレルギーは 豚ロース肉 recipe を自動除外しない（narrower→narrower 拡張禁止）', () => {
    expect(allergyExcludesIngredient('豚肩ロース肉', '豚ロース肉')).toBe(false)
    expect(recipeIngredientsHitAllergy(['豚ロース肉'], ['豚肩ロース肉'])).toBe(false)
  })
})

// ------------------------------------------------------------
// Section 12-D — STOCK マッチング firewall（弱めない）
// ------------------------------------------------------------
describe('MISSION 2.30 — Section D: STOCK マッチングは taxonomy で変わらない', () => {
  it('D1: 同一部位在庫 → 同一部位 recipe は MATCH', () => {
    expect(stockSatisfiesRecipeIngredient('豚肩ロース肉', '豚肩ロース肉')).toBe(true)
  })

  it('D2: 別部位在庫（豚ロース肉）→ 豚肩ロース肉 recipe は NO MATCH', () => {
    expect(stockSatisfiesRecipeIngredient('豚ロース肉', '豚肩ロース肉')).toBe(false)
  })

  it('D3: generic 豚肉在庫 → 豚肩ロース肉 recipe は NO MATCH（generic→specific 自動確定なし）', () => {
    expect(stockSatisfiesRecipeIngredient('豚肉', '豚肩ロース肉')).toBe(false)
  })

  it('D4: rankRecipes — generic 豚肉在庫は 豚肩ロース肉 recipe をcategory matchでdiscoverableにするが、exact matchではない（PUBLIC BETA RELEASE SPRINT 2）', () => {
    const catalog = [recipe('katarosu-yaki', ['豚肩ロース肉'])]
    const ranked = rankRecipes(catalog, {
      availableIngredientNames: ['豚肉'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    const candidate = ranked.find((c) => c.recipe.id === 'katarosu-yaki')
    expect(candidate?.category).toBe('A')
    expect(candidate?.categoryMatchedIngredients).toEqual(['豚肩ロース肉'])
  })

  it('D5: 別部位在庫（豚ロース肉）だけでは 豚肩ロース肉 recipe は A にならない', () => {
    const catalog = [recipe('katarosu-yaki', ['豚肩ロース肉'])]
    const ranked = rankRecipes(catalog, {
      availableIngredientNames: ['豚ロース肉'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked.find((c) => c.recipe.id === 'katarosu-yaki')?.category).not.toBe('A')
  })
})

// ------------------------------------------------------------
// Section 12-E — 小麦 アレルギー → 小麦粉 recipe HARD EXCLUDE
// ------------------------------------------------------------
describe('MISSION 2.30 — Section E: 小麦粉 → 小麦（contains）', () => {
  it('E1: 小麦粉 は 小麦 に contains 関係を持つ', () => {
    const rels = ingredientAllergenRelations('小麦粉')
    expect(rels.map((r) => r.allergenName)).toEqual(['小麦'])
    expect(rels[0]?.relationType).toBe('contains')
    expect(rels[0]?.sourceIds.length).toBeGreaterThan(0)
    for (const id of rels[0]?.sourceIds ?? []) {
      expect(getEvidenceSourceById(id), id).toBeDefined()
    }
  })

  it('E2: ingredientHitsAllergen — 小麦粉 × 小麦 = true、小麦粉 × 大豆 = false', () => {
    expect(ingredientHitsAllergen('小麦粉', '小麦')).toBe(true)
    expect(ingredientHitsAllergen('小麦粉', '大豆')).toBe(false)
  })

  it('E3: しょうゆ の default-generic-risk 関係とは独立に効く', () => {
    // しょうゆを含まない、小麦粉だけの recipe でも 小麦 アレルギーで除外される
    expect(recipeIngredientsHitAllergenRisk(['豚肩ロース肉', '小麦粉'], ['小麦'])).toBe(true)
  })

  it('E4: rankRecipes — 小麦 アレルギーで 小麦粉 を使う recipe が候補から消える', () => {
    const catalog = [recipe('flour-dish', ['豚肩ロース肉'], ['小麦粉', 'みりん'])]
    const ranked = rankRecipes(catalog, {
      availableIngredientNames: ['豚肩ロース肉'],
      allergyNames: ['小麦'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked).toHaveLength(0)
  })
})

// ------------------------------------------------------------
// Section 12-F — false-positive firewall（推測でアレルゲンを増やさない）
// ------------------------------------------------------------
describe('MISSION 2.30 — Section F: 小麦を推測で拡張しない', () => {
  it('F1: 片栗粉 / 米粉 / パン粉 / コーンスターチ → 小麦 は推測しない', () => {
    for (const name of ['片栗粉', '米粉', 'パン粉', 'コーンスターチ', '上新粉', 'きな粉']) {
      expect(ingredientAllergenRelations(name)).toEqual([])
      expect(ingredientHitsAllergen(name, '小麦')).toBe(false)
    }
  })

  it('F2: substring ロジックなし — 「粉」を含むだけでは 小麦 に当たらない', () => {
    expect(ingredientHitsAllergen('粉チーズ', '小麦')).toBe(false)
    expect(ingredientHitsAllergen('からし粉', '小麦')).toBe(false)
  })

  it('F3: 小麦粉 以外の食材は 小麦 アレルギーで rankRecipes から消えない', () => {
    const catalog = [recipe('katakuri-dish', ['豚肩ロース肉'], ['片栗粉'])]
    const ranked = rankRecipes(catalog, {
      availableIngredientNames: ['豚肩ロース肉'],
      allergyNames: ['小麦'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked.some((c) => c.recipe.id === 'katakuri-dish')).toBe(true)
  })
})

// ------------------------------------------------------------
// Section 12-G — 既存挙動の非弱体化 / regression firewall
// ------------------------------------------------------------
describe('MISSION 2.30 — Section G: 非弱体化 / regression', () => {
  it('G1: しょうゆ → 小麦 / 大豆（default-generic-risk）は不変', () => {
    const rels = ingredientAllergenRelations('しょうゆ')
    expect(rels.map((r) => r.allergenName).sort()).toEqual(['大豆', '小麦'])
    for (const r of rels) expect(r.relationType).toBe('default-generic-risk')
  })

  it('G2: relation table の contains は 小麦粉→小麦 のみ（Food Graph 化していない）', () => {
    const contains = allIngredientAllergenRelations().filter((r) => r.relationType === 'contains')
    expect(contains.map((r) => `${r.ingredientName}→${r.allergenName}`)).toEqual(['小麦粉→小麦'])
  })

  it('G3: アレルギー登録なし → 豚肩ロース肉 recipe は在庫一致で通常どおり A 候補', () => {
    const catalog = [recipe('katarosu-yaki', ['豚肩ロース肉', '玉ねぎ'])]
    const ranked = rankRecipes(catalog, {
      availableIngredientNames: ['豚肩ロース肉', '玉ねぎ'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked.find((c) => c.recipe.id === 'katarosu-yaki')?.category).toBe('A')
  })

  it('G4: tori-teriyaki は VERIFIED のまま（MISSION 2.31でbuta-shogayakiもVERIFIED #2に昇格、PUBLIC BETA RELEASE SPRINT 1Cでmedama-yakiもVERIFIED #3に昇格）', () => {
    const verified = RECIPE_CATALOG.filter((r) => isRecipePublishable(r))
    expect(verified.map((r) => r.id)).toEqual(['tori-teriyaki', 'buta-shogayaki', 'nikujaga', 'medama-yaki', 'yudofu', 'niku-udon', 'napolitan'])
  })

  it('G5: MISSION 2.30 時点では buta-shogayaki は review のままだった（安全性ゲートを VERIFIED のために弱めていない）。'
    + ' MISSION 2.31 の Evidence-backed correction で NHK anchor に一致させたうえで VERIFIED #2 になった', () => {
    const buta = RECIPE_CATALOG.find((r) => r.id === 'buta-shogayaki')!
    // MISSION 2.30 は taxonomy / allergen relation の追加のみで recipe fact を触っていない。
    // その後 MISSION 2.31 が NHK anchor で correction し verified 化した。
    expect(buta.verification?.status).toBe('verified')
    expect(isRecipePublishable(buta)).toBe(true)
    // MISSION 2.30 が確立した安全関係が VERIFIED 後も効いていること
    expect(recipeIngredientsHitAllergenRisk(['小麦粉'], ['小麦'])).toBe(true)
  })
})
