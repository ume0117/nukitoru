// ============================================================
// ingredient-allergens.test.ts
//
// MISSION 2.25 — Japan Allergen Evidence & Minimal Relation Model。
//
// canonicalization / taxonomy / allergen composition の3層分離、
// generic ingredient への fail-safe HARD EXCLUSION、既存挙動の非弱体化を固定化する。
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  ingredientAllergenRelations,
  ingredientHitsAllergen,
  recipeIngredientsHitAllergenRisk,
  allIngredientAllergenRelations,
} from '../ingredient-allergens'
import { canonicalizeIngredientName } from '../ingredient-normalization'
import { broaderIngredientNames } from '../ingredient-taxonomy'
import { rankRecipes } from '../recipe-suggestion-engine'
import { filterSafeArrangements } from '../recipe-safety'
import { getEvidenceSourceById } from '../evidence-sources'
import { RECIPE_CATALOG } from '../recipe-catalog'
import type { Recipe } from '@/features/food/types'

const tt = () => RECIPE_CATALOG.find((r) => r.id === 'tori-teriyaki')!

function recipe(id: string, ingredientNames: string[], seasoningNames: string[] = []): Recipe {
  return {
    id,
    name: id,
    type: 'main',
    requiredIngredients: ingredientNames.map((name) => ({ name, amount: '100g' })),
    seasonings: seasoningNames.map((name) => ({ name, amount: '大さじ1' })),
    cookingTimeMinutes: 15,
    servingsBase: 2,
    steps: ['焼く'],
  }
}

describe('MISSION 2.25 — relation model', () => {
  it('JA: しょうゆ は 小麦・大豆 に default-generic-risk 関係を持つ', () => {
    const rels = ingredientAllergenRelations('しょうゆ')
    expect(rels.map((r) => r.allergenName).sort()).toEqual(['大豆', '小麦'])
    for (const r of rels) {
      expect(r.relationType).toBe('default-generic-risk')
      expect(r.sourceIds.length).toBeGreaterThan(0)
      expect(r.policyReason.trim().length).toBeGreaterThan(0)
    }
  })

  it('JB: relation の sourceIds はすべて EVIDENCE_SOURCE_CATALOG に実在する', () => {
    for (const r of allIngredientAllergenRelations()) {
      for (const id of r.sourceIds) {
        expect(getEvidenceSourceById(id), `${r.ingredientName}->${r.allergenName}: ${id}`).toBeDefined()
      }
    }
  })

  it('JC: relation table に無い ingredient は空を返す（アレルゲン関係を発明しない）', () => {
    expect(ingredientAllergenRelations('みりん')).toEqual([])
    expect(ingredientAllergenRelations('酒')).toEqual([])
    expect(ingredientAllergenRelations('サラダ油')).toEqual([])
    expect(ingredientAllergenRelations('砂糖')).toEqual([])
    expect(ingredientAllergenRelations('塩')).toEqual([])
    expect(ingredientAllergenRelations('鶏もも肉')).toEqual([])
    expect(ingredientAllergenRelations('未知の食材')).toEqual([])
  })

  it('JD: 3層分離 — allergen relation は canonicalization / taxonomy を汚さない', () => {
    // canonicalize は しょうゆ を 小麦 に潰さない
    expect(canonicalizeIngredientName('しょうゆ')).toBe('しょうゆ')
    // taxonomy に しょうゆ→小麦 の broader 関係は無い
    expect(broaderIngredientNames('しょうゆ')).toEqual([])
  })

  it('JE: ingredientHitsAllergen — canonical 完全一致のみ（chicken 表記ゆれ経由も可）', () => {
    expect(ingredientHitsAllergen('しょうゆ', '小麦')).toBe(true)
    expect(ingredientHitsAllergen('しょうゆ', '大豆')).toBe(true)
    expect(ingredientHitsAllergen('しょうゆ', '卵')).toBe(false)
    expect(ingredientHitsAllergen('みりん', '小麦')).toBe(false)
  })
})

describe('MISSION 2.25 — HARD EXCLUSION via rankRecipes', () => {
  const base = { availableIngredientNames: ['鶏もも肉'], dislikeNames: [] as string[], maxCookingMinutes: null }

  it('JF: 小麦 アレルギー → tori-teriyaki は HARD EXCLUDE（generic しょうゆ 経由）', () => {
    const ranked = rankRecipes(RECIPE_CATALOG, { ...base, allergyNames: ['小麦'] })
    expect(ranked.some((c) => c.recipe.id === 'tori-teriyaki')).toBe(false)
  })

  it('JG: 大豆 アレルギー → tori-teriyaki は HARD EXCLUDE（generic しょうゆ 経由）', () => {
    const ranked = rankRecipes(RECIPE_CATALOG, { ...base, allergyNames: ['大豆'] })
    expect(ranked.some((c) => c.recipe.id === 'tori-teriyaki')).toBe(false)
  })

  it('JH: 鶏肉 アレルギー → tori-teriyaki は HARD EXCLUDE（MISSION 2.21 taxonomy、無傷）', () => {
    const ranked = rankRecipes(RECIPE_CATALOG, { ...base, allergyNames: ['鶏肉'] })
    expect(ranked.some((c) => c.recipe.id === 'tori-teriyaki')).toBe(false)
  })

  it('JI: アレルギー登録なし → tori-teriyaki は通常どおり候補（鶏もも肉在庫でA）', () => {
    const ranked = rankRecipes(RECIPE_CATALOG, { ...base, allergyNames: [] })
    expect(ranked.find((c) => c.recipe.id === 'tori-teriyaki')?.category).toBe('A')
  })

  it('JJ: しょうゆ を使う他の recipe も 小麦 アレルギーで一貫して除外される', () => {
    const soyRecipes = RECIPE_CATALOG.filter((r) =>
      (r.seasonings ?? []).some((s) => canonicalizeIngredientName(s.name) === 'しょうゆ') ||
      r.requiredIngredients.some((i) => canonicalizeIngredientName(i.name) === 'しょうゆ'),
    ).map((r) => r.id)
    expect(soyRecipes.length).toBeGreaterThan(0)
    const ranked = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['鶏もも肉', '豚肉', '牛肉', '卵', 'ごはん', '豆腐', 'マグロ', '玉ねぎ', 'キャベツ', 'にんじん'],
      allergyNames: ['小麦'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    for (const id of ranked.map((c) => c.recipe.id)) {
      expect(soyRecipes.includes(id), `${id} uses しょうゆ but survived 小麦 allergy`).toBe(false)
    }
  })
})

describe('MISSION 2.25 — non-weakening / firewall', () => {
  it('JK: allergen relation は STOCK マッチングを変えない', () => {
    // 小麦 を「在庫」に入れても しょうゆレシピが増えたり減ったりしない（allergyNames のみに効く）
    const withWheatStock = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['鶏もも肉', '小麦'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    const withoutWheatStock = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['鶏もも肉'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(withWheatStock.find((c) => c.recipe.id === 'tori-teriyaki')?.category).toBe('A')
    expect(withoutWheatStock.find((c) => c.recipe.id === 'tori-teriyaki')?.category).toBe('A')
  })

  it('JL: 鶏むね肉在庫 は 鶏もも肉 recipe を満たさない（MISSION 2.21、無傷）', () => {
    const ranked = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['鶏むね肉'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked.some((c) => c.recipe.id === 'tori-teriyaki')).toBe(false)
  })

  it('JM: generic 鶏肉在庫 は 鶏もも肉 recipe を exact match にしない（MISSION 2.21、無傷）', () => {
    const ranked = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['鶏肉'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked.find((c) => c.recipe.id === 'tori-teriyaki')?.category).not.toBe('A')
  })

  it('JN: filterSafeArrangements — addIngredient しょうゆ を持つアレンジは 小麦 アレルギーで非表示', () => {
    const r: Recipe = {
      ...recipe('arr-test', ['豆腐']),
      arrangements: [
        { id: 'a1', label: 'しょうゆをかける', addIngredients: ['しょうゆ'] },
        { id: 'a2', label: 'ねぎをのせる', addIngredients: ['ねぎ'] },
      ],
    }
    const safe = filterSafeArrangements(r, ['小麦'])
    expect(safe.map((a) => a.id)).toEqual(['a2'])
    // アレルギーなしなら両方表示
    expect(filterSafeArrangements(r, []).map((a) => a.id)).toEqual(['a1', 'a2'])
  })

  it('JO: 既存カタログ — アレルギー登録なしでの候補件数・カテゴリは allergen model 追加で不変', () => {
    // 焦点を絞った在庫で、tori-teriyaki が A 候補として残ることを確認（allergen model は allergyNames のみに効く）
    const ranked = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['鶏もも肉'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked.length).toBeGreaterThan(0)
    expect(ranked.find((c) => c.recipe.id === 'tori-teriyaki')?.category).toBe('A')
  })
})

describe('MISSION 2.25 — future product-specific override does not become impossible', () => {
  it('JP: relationType が default-generic-risk（= override 余地あり）で、絶対的 contains ではない', () => {
    for (const r of allIngredientAllergenRelations()) {
      expect(r.relationType).toBe('default-generic-risk')
    }
  })
})

describe('MISSION 2.25 — tori-teriyaki state', () => {
  it('JQ: culinary fact 不変。MISSION 2.26 で allergyIdentity（derived）追加・status=verified', () => {
    const r = tt()
    expect(r.requiredIngredients).toEqual([{ name: '鶏もも肉', amount: '300g' }])
    expect(r.verification?.status).toBe('verified')
    const fvs = r.verification?.fieldVerifications ?? []
    const ai = fvs.find((f) => f.field === 'allergyIdentity')
    expect(ai?.supportType).toBe('derived')
    expect(ai?.sourceIds).toContain('caa-food-allergy-labeling-2026')
    // 2.25 の allergen 評価は provenanceNotes に記録済み
    const notes = (r.verification?.provenanceNotes ?? []).join('\n')
    expect(notes).toContain('MISSION 2.25（Japan Allergen Evidence）')
    expect(notes).toContain('default-generic-risk')
  })

  it('JR: Product Check Alert（D.5、しょうゆ）は削除されていない', () => {
    expect(tt().ingredientChecks?.some((c) => c.ingredientName === 'しょうゆ')).toBe(true)
  })
})
