// ============================================================
// practical-cook-validation.test.ts
//
// MISSION 2.33 — Practical Cook Validation Foundation。
//
// LAYER B（実地調理検証）が LAYER A（Recipe Evidence）と完全に分離され、
// observation が Recipe fact / Product Time / 味の事実へ昇格しないこと、
// tori/buta が machine-readable に not-tested であること、
// 既存の Safety / Evidence / Beta 挙動が無傷であることを固定化する。
// ============================================================

import { describe, it, expect } from 'vitest'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { isRecipePublishable } from '../recipe-publishability'
import {
  practicalCookValidationStatusOf,
  isPracticallyValidatedForBeta,
  isRecipeBetaQualityReady,
  hasUnresolvedPracticalSafetyStop,
} from '../practical-cook-validation'
import { productTimeStatusOf, productCookingTimeMinutes } from '../recipe-time'
import { STARTER_SET_RECIPE_IDS, getBetaPublishableStarterRecipes } from '../starter-set'
import { rankRecipes } from '../recipe-suggestion-engine'
import { stockSatisfiesRecipeIngredient } from '../ingredient-taxonomy'
import { ingredientAllergenRelations } from '../ingredient-allergens'
import { isProductCheckTarget } from '../product-check-messages'
import type { Recipe, PracticalCookValidation } from '@/features/food/types'

const tt = () => RECIPE_CATALOG.find((r) => r.id === 'tori-teriyaki')!
const bs = () => RECIPE_CATALOG.find((r) => r.id === 'buta-shogayaki')!

function withPractical(base: Recipe, pcv: PracticalCookValidation): Recipe {
  return { ...base, practicalCookValidation: pcv }
}
const minimalRecipe: Recipe = {
  id: 'pcv-fixture', name: 'fixture', type: 'main',
  requiredIngredients: [{ name: '鶏もも肉', amount: '100g' }],
  cookingTimeMinutes: 10, servingsBase: 2, steps: ['焼く'],
}

// ------------------------------------------------------------
// A / B / C — default & current recipes
// ------------------------------------------------------------
describe('MISSION 2.33 — default / current status', () => {
  it('A: practicalCookValidation 未設定の Recipe は not-tested', () => {
    expect(practicalCookValidationStatusOf(minimalRecipe)).toBe('not-tested')
    // catalog 全 Recipe も既定で not-tested（誰も一律 { status: not-tested } を書いていない）
    for (const r of RECIPE_CATALOG) {
      expect(practicalCookValidationStatusOf(r), r.id).toBe('not-tested')
    }
  })

  it('B: tori-teriyaki の practical status は not-tested', () => {
    expect(practicalCookValidationStatusOf(tt())).toBe('not-tested')
    expect(tt().practicalCookValidation).toBeUndefined()
  })

  it('C: buta-shogayaki の practical status は not-tested', () => {
    expect(practicalCookValidationStatusOf(bs())).toBe('not-tested')
    expect(bs().practicalCookValidation).toBeUndefined()
  })
})

// ------------------------------------------------------------
// D / E — Recipe Evidence VERIFIED / publishable は無傷
// ------------------------------------------------------------
describe('MISSION 2.33 — LAYER A（Recipe Evidence）無傷', () => {
  it('D: tori / buta とも Recipe Evidence VERIFIED のまま', () => {
    expect(tt().verification?.status).toBe('verified')
    expect(bs().verification?.status).toBe('verified')
  })

  it('E: tori / buta とも isRecipePublishable=true（practical 未実施でも成立）', () => {
    expect(isRecipePublishable(tt())).toBe(true)
    expect(isRecipePublishable(bs())).toBe(true)
  })

  it('E2: isRecipePublishable は practicalCookValidation を参照しない（safety-stop でも publishable 不変）', () => {
    const butaSafetyStop = withPractical(bs(), { status: 'safety-stop' })
    expect(isRecipePublishable(butaSafetyStop)).toBe(true) // Evidence publishability は LAYER B に影響されない
    expect(hasUnresolvedPracticalSafetyStop(butaSafetyStop)).toBe(true)
  })
})

// ------------------------------------------------------------
// F〜J — isPracticallyValidatedForBeta の分類
// ------------------------------------------------------------
describe('MISSION 2.33 — isPracticallyValidatedForBeta', () => {
  const cases: Array<[PracticalCookValidation['status'], boolean]> = [
    ['not-tested', false],
    ['passed', true],
    ['passed-with-observations', true],
    ['re-review-required', false],
    ['safety-stop', false],
  ]
  it('F: not-tested → false', () => {
    expect(isPracticallyValidatedForBeta(withPractical(minimalRecipe, { status: 'not-tested' }))).toBe(false)
  })
  it('G: passed → true', () => {
    expect(isPracticallyValidatedForBeta(withPractical(minimalRecipe, { status: 'passed' }))).toBe(true)
  })
  it('H: passed-with-observations → true', () => {
    expect(isPracticallyValidatedForBeta(withPractical(minimalRecipe, { status: 'passed-with-observations' }))).toBe(true)
  })
  it('I: re-review-required → false', () => {
    expect(isPracticallyValidatedForBeta(withPractical(minimalRecipe, { status: 're-review-required' }))).toBe(false)
  })
  it('J: safety-stop → false', () => {
    expect(isPracticallyValidatedForBeta(withPractical(minimalRecipe, { status: 'safety-stop' }))).toBe(false)
  })
  it('F2: 全ケースが表どおり', () => {
    for (const [status, expected] of cases) {
      expect(isPracticallyValidatedForBeta(withPractical(minimalRecipe, { status })), status).toBe(expected)
    }
  })
})

// ------------------------------------------------------------
// K / L / M — firewall（observation は昇格しない）
// ------------------------------------------------------------
describe('MISSION 2.33 — Evidence / Product Time / 味 firewall', () => {
  it('K: practical observation を追加しても verification.status は変わらない', () => {
    const before = bs().verification?.status
    const withObs = withPractical(bs(), {
      status: 'passed-with-observations',
      tests: [{
        id: 't1', testedAt: '2026-08-31', result: 'passed-with-observations',
        observations: [{ category: 'cooking-process', note: 'IHでは玉ねぎ1分でしんなりしなかった' }],
      }],
    })
    expect(withObs.verification?.status).toBe(before)
    expect(withObs.verification?.status).toBe('verified')
    // Recipe fact（steps）も変わっていない
    expect(withObs.steps).toEqual(bs().steps)
    expect(withObs.requiredIngredients).toEqual(bs().requiredIngredients)
    expect(withObs.seasonings).toEqual(bs().seasonings)
  })

  it('L: practical timing observation は Product Time を確定しない', () => {
    const withTiming = withPractical(bs(), {
      status: 'passed',
      tests: [{
        id: 't2', testedAt: '2026-08-31', result: 'passed', observations: [],
        startedAt: '2026-08-31T18:00:00+09:00', readyAt: '2026-08-31T18:22:00+09:00',
        actualElapsedMinutes: 22,
      }],
    })
    expect(productTimeStatusOf(withTiming)).toBe('review')
    expect(productCookingTimeMinutes(withTiming)).toBeNull()
    expect(withTiming.verification?.timeVerification?.sourceStatedTotal?.value).toEqual({ kind: 'exact', minutes: 15 })
    expect(withTiming.verification?.timeVerification?.elapsedToReady).toBeUndefined()
    expect(withTiming.verification?.timeVerification?.activeWork).toBeUndefined()
  })

  it('M: taste observation は Evidence fact / フラグを作らない', () => {
    const withTaste = withPractical(bs(), {
      status: 'passed-with-observations',
      tests: [{
        id: 't3', testedAt: '2026-08-31', result: 'passed-with-observations',
        observations: [{ category: 'taste-texture', note: 'おいしかった。子どもが完食した' }],
      }],
    })
    // taste は observation の中だけ。Recipe / verification に taste フラグは存在しない
    expect(Object.keys(withTaste)).not.toContain('tasteVerified')
    expect(Object.keys(withTaste.verification ?? {})).not.toContain('tasteVerified')
    expect(withTaste.verification?.recipeIdentity?.intendedTasteProfile).toBe(bs().verification?.recipeIdentity?.intendedTasteProfile)
  })
})

// ------------------------------------------------------------
// N / O / P / Q — Starter Set / Beta / VERIFIED は不変
// ------------------------------------------------------------
describe('MISSION 2.33 — Starter Set / Beta / VERIFIED 不変', () => {
  it('N: STARTER_SET_RECIPE_IDS は不変（tori / buta を追加していない）', () => {
    expect(STARTER_SET_RECIPE_IDS).toEqual([
      'gyudon', 'oyako-don', 'maguro-don', 'medama-yaki', 'hiyayakko', 'sake-shioyaki',
      'tori-soboro-don', 'tuna-mayo-don', 'pork-cabbage-miso-stirfry', 'tofu-miso-soup',
      'shio-musubi', 'onigiri-nori', 'natto-gohan', 'curry-rice',
    ])
    expect(STARTER_SET_RECIPE_IDS).not.toContain('tori-teriyaki')
    expect(STARTER_SET_RECIPE_IDS).not.toContain('buta-shogayaki')
  })

  it('O: getBetaPublishableStarterRecipes は PUBLIC BETA RELEASE SPRINT 1C 以降 medama-yaki を含む（STARTER_SET_RECIPE_IDS に含まれ、かつ publishable になったため）', () => {
    expect(getBetaPublishableStarterRecipes().map((r) => r.id)).toEqual(['medama-yaki'])
  })

  it('O2: isRecipeBetaQualityReady は tori / buta とも false（practical not-tested のため）', () => {
    expect(isRecipeBetaQualityReady(tt())).toBe(false)
    expect(isRecipeBetaQualityReady(bs())).toBe(false)
    // Evidence publishable は true だが practical で false になる
    expect(isRecipePublishable(tt())).toBe(true)
    expect(isRecipePublishable(bs())).toBe(true)
  })

  it('O3: isRecipeBetaQualityReady = publishable && practically-validated（両方満たすと true）', () => {
    const butaPassed = withPractical(bs(), { status: 'passed' })
    expect(isRecipeBetaQualityReady(butaPassed)).toBe(true)
    const fixturePassedButNotPublishable = withPractical(minimalRecipe, { status: 'passed' })
    expect(isRecipePublishable(fixturePassedButNotPublishable)).toBe(false)
    expect(isRecipeBetaQualityReady(fixturePassedButNotPublishable)).toBe(false)
  })

  it('P/Q: VERIFIED IDs は [tori-teriyaki, buta-shogayaki, medama-yaki]、count 3（PUBLIC BETA RELEASE SPRINT 1Cでmedama-yaki追加）', () => {
    const verified = RECIPE_CATALOG.filter((r) => r.verification?.status === 'verified').map((r) => r.id)
    expect(verified).toEqual(['tori-teriyaki', 'buta-shogayaki', 'nikujaga', 'medama-yaki', 'yudofu', 'niku-udon', 'napolitan'])
    expect(RECIPE_CATALOG.filter((r) => isRecipePublishable(r)).map((r) => r.id)).toEqual(['tori-teriyaki', 'buta-shogayaki', 'nikujaga', 'medama-yaki', 'yudofu', 'niku-udon', 'napolitan'])
  })
})

// ------------------------------------------------------------
// R / S / T — generic oil / allergy / stock 不変
// ------------------------------------------------------------
describe('MISSION 2.33 — Safety / Stock regression', () => {
  const butaBase = { availableIngredientNames: ['豚肩ロース肉', '玉ねぎ'], dislikeNames: [] as string[], maxCookingMinutes: null }
  const butaPresent = (allergyNames: string[]) =>
    rankRecipes(RECIPE_CATALOG, { ...butaBase, allergyNames }).some((c) => c.recipe.id === 'buta-shogayaki')

  it('R: generic oil safety 不変（油 relation なし・PRODUCT CHECK・ごま/落花生で除外されない）', () => {
    expect(ingredientAllergenRelations('油')).toEqual([])
    expect(isProductCheckTarget('油')).toBe(true)
    expect((bs().ingredientChecks ?? []).map((c) => c.ingredientName)).toEqual(['しょうゆ', '油'])
    expect(butaPresent(['ごま'])).toBe(true)
    expect(butaPresent(['落花生'])).toBe(true)
  })

  it('S: allergy HARD EXCLUSION 不変（小麦 / 大豆 / 豚肉）', () => {
    expect(butaPresent(['小麦'])).toBe(false)
    expect(butaPresent(['大豆'])).toBe(false)
    expect(butaPresent(['豚肉'])).toBe(false)
    // tori も
    const toriPresent = (a: string[]) => rankRecipes(RECIPE_CATALOG, { availableIngredientNames: ['鶏もも肉'], dislikeNames: [], maxCookingMinutes: null, allergyNames: a }).some((c) => c.recipe.id === 'tori-teriyaki')
    expect(toriPresent(['小麦'])).toBe(false)
    expect(toriPresent(['鶏肉'])).toBe(false)
  })

  it('T: stock matching 不変（豚肩ロース肉 exact / 豚ロース肉・generic 豚肉 は不一致）', () => {
    expect(stockSatisfiesRecipeIngredient('豚肩ロース肉', '豚肩ロース肉')).toBe(true)
    expect(stockSatisfiesRecipeIngredient('豚ロース肉', '豚肩ロース肉')).toBe(false)
    expect(stockSatisfiesRecipeIngredient('豚肉', '豚肩ロース肉')).toBe(false)
    const cat = (stock: string[]) => rankRecipes(RECIPE_CATALOG, { ...butaBase, availableIngredientNames: [...stock, '玉ねぎ'], allergyNames: [] }).find((c) => c.recipe.id === 'buta-shogayaki')?.category
    expect(cat(['豚肩ロース肉'])).toBe('A')
    expect(cat(['豚ロース肉'])).not.toBe('A')
  })
})
