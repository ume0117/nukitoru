// ============================================================
// generic-oil-allergy-identity.test.ts
//
// MISSION 2.31A — GENERIC OIL ALLERGY IDENTITY RESOLUTION。
//
// レシピ出典が油の種類を特定しない場合（generic「油」）の Safety semantics を固定化する:
//   - generic「油」から特定の油種（ごま油・落花生油・大豆油）を推測しない（UNKNOWN ≠ ALLERGEN PRESENT）
//   - generic「油」を「安全な油」として扱わない（UNKNOWN ≠ SAFE）
//   - 不確実性を既存 ingredientChecks 機構で machine-readable に表現し PRODUCT CHECK ALERT を出す
//   - false HARD EXCLUSION を生まない
//   - しょうゆ の PRODUCT CHECK / HARD EXCLUDE 挙動は不変
// ============================================================

import { describe, it, expect } from 'vitest'
import { RECIPE_CATALOG } from '../recipe-catalog'
import {
  PRODUCT_CHECK_TARGET_INGREDIENTS,
  isProductCheckTarget,
  productCheckMessage,
} from '../product-check-messages'
import { ingredientAllergenRelations, recipeIngredientsHitAllergenRisk, allIngredientAllergenRelations } from '../ingredient-allergens'
import { broaderIngredientNames } from '../ingredient-taxonomy'
import { canonicalizeIngredientName } from '../ingredient-normalization'
import { rankRecipes } from '../recipe-suggestion-engine'
import { isRecipePublishable } from '../recipe-publishability'
import { productCookingTimeMinutes, productTimeStatusOf } from '../recipe-time'
import { allergyRelevantIngredients } from '../recipe-safety'

const bs = () => RECIPE_CATALOG.find((r) => r.id === 'buta-shogayaki')!
const tt = () => RECIPE_CATALOG.find((r) => r.id === 'tori-teriyaki')!

const butaBase = {
  availableIngredientNames: ['豚肩ロース肉', '玉ねぎ'],
  dislikeNames: [] as string[],
  maxCookingMinutes: null as number | null,
}
const butaPresent = (allergyNames: string[]) =>
  rankRecipes(RECIPE_CATALOG, { ...butaBase, allergyNames }).some((c) => c.recipe.id === 'buta-shogayaki')

// ------------------------------------------------------------
// A / B / C — generic「油」から allergen を推測しない
// ------------------------------------------------------------
describe('MISSION 2.31A — generic「油」は allergen を推測しない', () => {
  it('OA: generic「油」→ ごま を推測しない（relation なし・HARD EXCLUDE しない）', () => {
    expect(ingredientAllergenRelations('油')).toEqual([])
    expect(recipeIngredientsHitAllergenRisk(['油'], ['ごま'])).toBe(false)
    expect(butaPresent(['ごま'])).toBe(true) // ごま アレルギーでも buta は候補に残る
  })

  it('OB: generic「油」→ 落花生 を推測しない', () => {
    expect(recipeIngredientsHitAllergenRisk(['油'], ['落花生'])).toBe(false)
    expect(butaPresent(['落花生'])).toBe(true)
  })

  it('OC: generic「油」→ 大豆 を（油自体からは）推測しない', () => {
    // 「油」ingredient 単体は 大豆 relation を持たない
    expect(ingredientAllergenRelations('油').some((r) => r.allergenName === '大豆')).toBe(false)
    // ただし buta は しょうゆ経由で 大豆 アレルギーでは除外される（油とは無関係の別経路）
    expect(butaPresent(['大豆'])).toBe(false)
    // 大豆経路が「油」ではなく「しょうゆ」であることの確認
    expect(recipeIngredientsHitAllergenRisk(['油'], ['大豆'])).toBe(false)
    expect(recipeIngredientsHitAllergenRisk(['しょうゆ'], ['大豆'])).toBe(true)
  })

  it('OD: 「油」は proven allergen-free として表現されていない', () => {
    // relation table に「油 → 何か = safe/none」のような safe 断定エントリが無い
    for (const r of allIngredientAllergenRelations()) {
      expect(r.ingredientName).not.toBe('油')
    }
    // taxonomy にも「油」は無い（broader なし＝規制種別へ寄せていない）
    expect(broaderIngredientNames('油')).toEqual([])
    // product-check メッセージに安全断定表現が無い
    const msg = productCheckMessage('油') ?? ''
    for (const banned of ['安全', '含みません', '心配ありません', '問題ありません', '確認しました']) {
      expect(msg.includes(banned), banned).toBe(false)
    }
  })
})

// ------------------------------------------------------------
// E — machine-readable PRODUCT CHECK（既存 ingredientChecks 機構）
// ------------------------------------------------------------
describe('MISSION 2.31A — 「油」の不確実性は machine-readable', () => {
  it('OE: buta-shogayaki は「油」の PRODUCT CHECK を露出する', () => {
    expect(isProductCheckTarget('油')).toBe(true)
    expect(productCheckMessage('油')).toBeDefined()
    const checks = (bs().ingredientChecks ?? []).map((c) => c.ingredientName)
    expect(checks).toContain('油')
    expect(checks).toContain('しょうゆ')
  })

  it('OF: PRODUCT_CHECK_TARGET_INGREDIENTS に「油」が含まれる（generic-category）', () => {
    expect(PRODUCT_CHECK_TARGET_INGREDIENTS).toContain('油')
  })

  it('OG: generic「油」を使う catalog Recipe はすべて ingredientChecks に「油」を持つ（catalog 一貫性）', () => {
    for (const r of RECIPE_CATALOG) {
      const usesGenericOil = [...r.requiredIngredients, ...(r.seasonings ?? [])].some(
        (i) => canonicalizeIngredientName(i.name) === '油',
      )
      if (!usesGenericOil) continue
      const checks = (r.ingredientChecks ?? []).map((c) => canonicalizeIngredientName(c.ingredientName))
      expect(checks.includes('油'), `${r.id}: generic「油」を使うのに ingredientChecks に無い`).toBe(true)
    }
  })

  it('OH: 「サラダ油」（JAS 定義の具体名）は canonical が別で PRODUCT CHECK 対象外', () => {
    expect(canonicalizeIngredientName('サラダ油')).not.toBe('油')
    expect(isProductCheckTarget('サラダ油')).toBe(false)
    expect(productCheckMessage('サラダ油')).toBeUndefined()
  })
})

// ------------------------------------------------------------
// F — しょうゆ の挙動は不変
// ------------------------------------------------------------
describe('MISSION 2.31A — しょうゆ product-check / HARD EXCLUDE は不変', () => {
  it('OI: しょうゆ は PRODUCT CHECK かつ 小麦・大豆 の HARD EXCLUDE relation を持つ', () => {
    expect(isProductCheckTarget('しょうゆ')).toBe(true)
    expect(ingredientAllergenRelations('しょうゆ').map((r) => r.allergenName).sort()).toEqual(['大豆', '小麦'])
  })

  it('OJ: buta は 小麦 / 大豆 アレルギーで HARD EXCLUDE（しょうゆ・小麦粉経由。油の変更と無関係）', () => {
    expect(butaPresent(['小麦'])).toBe(false)
    expect(butaPresent(['大豆'])).toBe(false)
  })
})

// ------------------------------------------------------------
// G / H / J — 既存 HARD EXCLUDE / stock / false-positive
// ------------------------------------------------------------
describe('MISSION 2.31A — 既存 Safety 挙動の非弱体化', () => {
  it('OK: buta の 豚肉 / 小麦 / 大豆 HARD EXCLUDE は不変', () => {
    expect(butaPresent(['豚肉'])).toBe(false)
    expect(butaPresent(['小麦'])).toBe(false)
    expect(butaPresent(['大豆'])).toBe(false)
  })

  it('OL: buta の stock 挙動は不変（豚肩ロース肉→A / 豚ロース肉→not A / generic 豚肉→not A）', () => {
    const cat = (stock: string[]) =>
      rankRecipes(RECIPE_CATALOG, { ...butaBase, availableIngredientNames: [...stock, '玉ねぎ'], allergyNames: [] })
        .find((c) => c.recipe.id === 'buta-shogayaki')?.category
    expect(cat(['豚肩ロース肉'])).toBe('A')
    expect(cat(['豚ロース肉'])).not.toBe('A')
    expect(cat(['豚肉'])).not.toBe('A')
  })

  it('OM: generic「油」由来の false HARD EXCLUSION が無い（アレルギーなしで通常どおり A）', () => {
    expect(rankRecipes(RECIPE_CATALOG, { ...butaBase, allergyNames: [] }).find((c) => c.recipe.id === 'buta-shogayaki')?.category).toBe('A')
  })

  it('ON: ingredientChecks は allergyRelevantIngredients / rankRecipes に影響しない（firewall 不変）', () => {
    const rel = allergyRelevantIngredients(bs())
    expect(rel).toContain('油') // req+seasonings なので含まれるが…
    // …HARD EXCLUDE は起きない（relation が無いため）
    expect(butaPresent(['ごま'])).toBe(true)
  })
})

// ------------------------------------------------------------
// I — tori-teriyaki VERIFIED 無傷
// ------------------------------------------------------------
describe('MISSION 2.31A — VERIFIED #1 / #2 無傷', () => {
  it('OO: tori-teriyaki は VERIFIED / publishable のまま。ingredientChecks は しょうゆ のみ（サラダ油は対象外）', () => {
    expect(tt().verification?.status).toBe('verified')
    expect(isRecipePublishable(tt())).toBe(true)
    expect((tt().ingredientChecks ?? []).map((c) => c.ingredientName)).toEqual(['しょうゆ'])
  })

  it('OP: buta-shogayaki は VERIFIED #2 のまま。Product Time は review、cookingTime は null', () => {
    expect(bs().verification?.status).toBe('verified')
    expect(isRecipePublishable(bs())).toBe(true)
    expect(productTimeStatusOf(bs())).toBe('review')
    expect(productCookingTimeMinutes(bs())).toBeNull()
  })

  it('OQ: VERIFIED は tori-teriyaki（#1）と buta-shogayaki（#2）', () => {
    expect(RECIPE_CATALOG.filter((r) => isRecipePublishable(r)).map((r) => r.id)).toEqual([
      'tori-teriyaki',
      'buta-shogayaki',
    ])
  })
})

// ------------------------------------------------------------
// Explainability
// ------------------------------------------------------------
describe('MISSION 2.31A — Explainability', () => {
  it('OR: allergyIdentity derivation が「油」を PRODUCT_IDENTITY_UNSPECIFIED として説明する', () => {
    const ai = (bs().verification?.fieldVerifications ?? []).find((f) => f.field === 'allergyIdentity')
    const d = ai?.derivation ?? ''
    expect(d).toContain('PRODUCT_IDENTITY_UNSPECIFIED')
    expect(d).toContain('油種を推測しない')
    expect(d).toContain('UNKNOWN ≠ ALLERGEN PRESENT')
    expect(d).toContain('UNKNOWN ≠ SAFE')
    expect(d).toContain('PRODUCT CHECK')
    // 「油だから安全」という趣旨の断定が無い
    expect(d).not.toContain('油は安全')
  })

  it('OS: provenanceNotes に MISSION 2.31A の3状態分離が記録されている', () => {
    const prov = (bs().verification?.provenanceNotes ?? []).join('\n')
    expect(prov).toContain('MISSION 2.31A')
    expect(prov).toContain('PRODUCT_IDENTITY_UNSPECIFIED')
    expect(prov).toContain('NO_REGULATED_RELATION')
    expect(prov).toContain('DEFAULT_GENERIC_RISK')
  })
})
