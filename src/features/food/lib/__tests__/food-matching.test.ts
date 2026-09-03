// ============================================================
// food-matching.test.ts
//
// MISSION 2.39 — Bidirectional Food Matching Engine Foundation。
// §42 の 72 要件 + firewall + determinism + fixture discipline を固定する。
// ============================================================

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import type {
  FoodStockIngredientSnapshot,
  SourceRecipeKnowledge,
  StockStatus,
} from '@/features/food/types'
import {
  classifyIngredientMatch,
  compareByAvailabilityFit,
  describeFoodMatchReason,
  evaluateRecipeAgainstStock,
  evaluateRecipeFoodMatch,
  mapStockStatusToAvailability,
  matchRecipesFromStock,
  projectStockToSnapshots,
  toRecipeIngredientRequirement,
  toRecipeRequirementSnapshot,
  toRecipeFoodMatchSummary,
  toStockIngredientSnapshot,
} from '../food-matching'
import {
  ALL_MEAL_OCCASIONS,
  evaluateMealOccasionFilter,
  matchesStrictOccasionFilter,
  mealOccasionsOf,
  isMealOccasionKnown,
} from '../meal-occasion'
import {
  SYN_RECIPE_3,
  SYN_RECIPE_UNRESOLVED,
  SYN_RECIPE_AMBIGUOUS,
  SYN_RECIPE_PARENT_CHILD,
  SYN_RECIPE_SIMILAR,
  SYN_RECIPE_RAW_COOKED,
  SYN_OCC_BREAKFAST_LUNCH,
  SYN_OCC_SNACK,
  SYN_OCC_DINNER,
  SYN_OCC_LATE_NIGHT,
  SYN_OCC_BENTO,
  SYN_OCC_UNKNOWN,
  SYNTHETIC_MATCHING_RECIPES,
  MEAL_OCCASION_METADATA_FIXTURES,
  STOCK_ALL_FOR_3,
  STOCK_GARLIC_MISSING,
  STOCK_2_MISSING,
  STOCK_POTATO_LOW,
  STOCK_WITH_UNRESOLVED_SAME_NAME,
  STOCK_WITH_UNRELATED_UNRESOLVED,
  STOCK_WITH_AMBIGUOUS,
  STOCK_CHICKEN_GENERIC,
  STOCK_TOMATO,
  STOCK_RICE_RAW,
  STOCK_POTATO_OUT,
  STOCK_ONION_ONLY,
  STOCK_EMPTY,
} from '../food-matching-fixtures'
import { REGISTRY_WITH_SYNTHETIC_AMBIGUITY } from '../world-ingredient-fixtures'
import { WORLD_INGREDIENT_IDENTITY_REGISTRY } from '../world-ingredient-registry'
import { SOURCE_RECIPE_KNOWLEDGE_FIXTURES, TORI_TERIYAKI_SOURCE_KNOWLEDGE } from '../world-food-fixtures'
import { importRecipeCandidate } from '../world-recipe-import'
import { FIXTURE_A_PASS } from '../world-recipe-import-fixtures'
import { resolveWorldIngredientIdentity } from '../world-ingredient-canonicalization'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { isRecipePublishable, getVerificationStatus } from '../recipe-publishability'
import { practicalCookValidationStatusOf } from '../practical-cook-validation'
import { rankRecipes } from '../recipe-suggestion-engine'
import { allergyRelevantIngredients } from '../recipe-safety'

const AMBIG = { ingredientRegistry: REGISTRY_WITH_SYNTHETIC_AMBIGUITY }
const rev = (r: SourceRecipeKnowledge, s: FoodStockIngredientSnapshot[], opts = {}) =>
  evaluateRecipeAgainstStock(r, s, opts)

// build a single-ingredient requirement quickly
const reqFor = (name: string, lang: 'ja' | 'en' = 'ja') =>
  toRecipeIngredientRequirement({ sourceIngredientName: name, role: 'required', originalLanguage: lang })

// ============================================================
// §42.01–10 — Ingredient Match Classification
// ============================================================

describe('MISSION 2.39 — ingredient match classification', () => {
  it('01. exact same canonical ID → EXACT', () => {
    const m = classifyIngredientMatch(reqFor('じゃがいも'), [
      { stockItemKey: 'k', sourceName: 'じゃがいも', canonicalIngredientId: 'potato', identityStatus: 'RESOLVED', availabilityStatus: 'available' },
    ])
    expect(m.matchClass).toBe('EXACT')
    expect(m.reasonCodes).toContain('CANONICAL_ID_EXACT')
  })

  it('02. different canonical ID → not exact (MISSING)', () => {
    const m = classifyIngredientMatch(reqFor('じゃがいも'), [
      { stockItemKey: 'k', sourceName: '玉ねぎ', canonicalIngredientId: 'onion', identityStatus: 'RESOLVED', availabilityStatus: 'available' },
    ])
    expect(m.matchClass).toBe('MISSING')
    expect(m.matchClass).not.toBe('EXACT')
  })

  it('03. available stock → EXACT', () => {
    expect(rev(SYN_RECIPE_3, STOCK_ALL_FOR_3).ingredientMatches.every((m) => m.matchClass === 'EXACT')).toBe(true)
  })

  it('04. low stock → LOW', () => {
    const r = rev(SYN_RECIPE_3, STOCK_POTATO_LOW)
    const potato = r.ingredientMatches.find((m) => m.requirement.canonicalIngredientId === 'potato')!
    expect(potato.matchClass).toBe('LOW')
    expect(potato.reasonCodes).toContain('STOCK_LOW')
  })

  it('05. explicit none (out → unavailable) → MISSING', () => {
    const r = rev(SYN_RECIPE_3, STOCK_POTATO_OUT)
    const potato = r.ingredientMatches.find((m) => m.requirement.canonicalIngredientId === 'potato')!
    expect(potato.matchClass).toBe('MISSING')
    expect(potato.reasonCodes).toContain('STOCK_EXPLICITLY_UNAVAILABLE')
  })

  it('06. absent stock → MISSING (STOCK_ABSENT)', () => {
    const r = rev(SYN_RECIPE_3, STOCK_GARLIC_MISSING)
    const garlic = r.ingredientMatches.find((m) => m.requirement.canonicalIngredientId === 'garlic')!
    expect(garlic.matchClass).toBe('MISSING')
    expect(garlic.reasonCodes).toContain('STOCK_ABSENT')
  })

  it('07. recipe identity unresolved → UNRESOLVED', () => {
    const r = rev(SYN_RECIPE_UNRESOLVED, [{ stockItemKey: 'k', sourceName: 'じゃがいも', canonicalIngredientId: 'potato', identityStatus: 'RESOLVED', availabilityStatus: 'available' }])
    const m = r.ingredientMatches.find((x) => x.requirement.sourceIngredientName === 'mystery-root-x')!
    expect(m.matchClass).toBe('UNRESOLVED')
    expect(m.reasonCodes).toContain('RECIPE_IDENTITY_UNRESOLVED')
  })

  it('08. relevant stock unresolved (same name) → UNRESOLVED', () => {
    const r = rev(SYN_RECIPE_UNRESOLVED, STOCK_WITH_UNRESOLVED_SAME_NAME)
    const m = r.ingredientMatches.find((x) => x.requirement.sourceIngredientName === 'mystery-root-x')!
    expect(m.matchClass).toBe('UNRESOLVED')
    expect(m.reasonCodes).toContain('STOCK_IDENTITY_UNRESOLVED')
  })

  it('09. ambiguous → AMBIGUOUS', () => {
    const r = rev(SYN_RECIPE_AMBIGUOUS, STOCK_ALL_FOR_3, AMBIG)
    const m = r.ingredientMatches.find((x) => x.requirement.sourceIngredientName === 'spring-onion-test')!
    expect(m.matchClass).toBe('AMBIGUOUS')
    expect(m.reasonCodes).toContain('IDENTITY_AMBIGUOUS')
  })

  it('10. ambiguous を勝手に選ばない（canonicalIngredientId 無し・候補は保持）', () => {
    const req = toRecipeIngredientRequirement(
      { sourceIngredientName: 'spring-onion-test', role: 'required', originalLanguage: 'en' },
      REGISTRY_WITH_SYNTHETIC_AMBIGUITY,
    )
    expect(req.identityStatus).toBe('AMBIGUOUS')
    expect(req.canonicalIngredientId).toBeUndefined()
    expect(req.candidateIds).toEqual(['synthetic_leek', 'synthetic_scallion'])
  })
})

// ============================================================
// §42.11–17 — Variant / state を EXACT にしない
// ============================================================

describe('MISSION 2.39 — variant / state never EXACT', () => {
  const notExact = (recipeName: string, stockName: string, stockId: string) => {
    const m = classifyIngredientMatch(reqFor(recipeName), [
      { stockItemKey: 'k', sourceName: stockName, canonicalIngredientId: stockId, identityStatus: 'RESOLVED', availabilityStatus: 'available' },
    ])
    return m
  }

  it('11. potato ≠ onion', () => expect(notExact('じゃがいも', '玉ねぎ', 'onion').matchClass).toBe('MISSING'))
  it('12. tomato ≠ cherry_tomato', () => {
    const m = rev(SYN_RECIPE_SIMILAR, STOCK_TOMATO).ingredientMatches[0]
    expect(m.matchClass).toBe('MISSING')
    expect(m.reasonCodes).toContain('NON_EXACT_CANONICAL_ID')
  })
  it('13. chicken ≠ chicken_thigh', () => {
    const m = rev(SYN_RECIPE_PARENT_CHILD, STOCK_CHICKEN_GENERIC).ingredientMatches[0]
    expect(m.matchClass).toBe('MISSING')
    expect(m.matchClass).not.toBe('EXACT')
  })
  it('14. pork ≠ pork_shoulder', () => expect(notExact('豚肩ロース肉', '豚肉', 'pork').matchClass).toBe('MISSING'))
  it('15. milk ≠ soy_milk', () => expect(notExact('牛乳', '豆乳', 'soy_milk').matchClass).toBe('MISSING'))
  it('16. olive_oil ≠ sesame_oil', () => expect(notExact('オリーブオイル', 'ごま油', 'sesame_oil').matchClass).toBe('MISSING'))
  it('17. rice_raw ≠ rice_cooked', () => {
    const m = rev(SYN_RECIPE_RAW_COOKED, STOCK_RICE_RAW).ingredientMatches[0]
    expect(m.matchClass).toBe('MISSING')
  })
})

// ============================================================
// §42.18–22 — fuzzy / substring / translation / typo / stemming なし
// ============================================================

describe('MISSION 2.39 — no fuzzy / substring / translation / typo / stemming', () => {
  const missing = (recipeName: string, lang: 'ja' | 'en', stockName: string, stockId: string) =>
    classifyIngredientMatch(reqFor(recipeName, lang), [
      { stockItemKey: 'k', sourceName: stockName, canonicalIngredientId: stockId, identityStatus: 'RESOLVED', availabilityStatus: 'available' },
    ]).matchClass

  it('18. fuzzy matching なし（potate ≠ potato）', () => {
    expect(reqFor('potate', 'en').identityStatus).toBe('UNRESOLVED')
    expect(missing('potate', 'en', 'じゃがいも', 'potato')).toBe('UNRESOLVED')
  })
  it('19. substring matching なし（"chicken t" は解決しない）', () => {
    expect(reqFor('chicken t', 'en').identityStatus).toBe('UNRESOLVED')
  })
  it('20. automatic translation なし（recipe "potato" / stock 日本語 "じゃがいも" は EXACT にならない）', () => {
    // recipe 側 en "potato" → potato に解決。stock 側は canonical id で照合するため翻訳は不要だが、
    // "potato"(en) を "じゃがいも"(ja) の登録名として扱ったりはしない
    expect(resolveWorldIngredientIdentity('potato', 'ja').status).toBe('UNRESOLVED')
  })
  it('21. typo correction なし', () => {
    expect(reqFor('しょゆ').identityStatus).toBe('UNRESOLVED')
  })
  it('22. stemming なし（potatoes は未解決）', () => {
    expect(reqFor('potatoes', 'en').identityStatus).toBe('UNRESOLVED')
  })
})

// ============================================================
// §42.23–27 — Quantity firewall
// ============================================================

describe('MISSION 2.39 — quantity firewall', () => {
  it('23/27. EXACT でも quantityStatus は NOT_EVALUATED', () => {
    const r = rev(SYN_RECIPE_3, STOCK_ALL_FOR_3)
    for (const m of r.ingredientMatches) {
      expect(m.quantityStatus).toBe('NOT_EVALUATED')
      expect(m.reasonCodes).toContain('QUANTITY_NOT_EVALUATED')
    }
  })

  it('24/25. 単位変換・個→g 換算をしない（quantityDisplayText は SOURCE FACT のまま）', () => {
    const reqs = toRecipeRequirementSnapshot(TORI_TERIYAKI_SOURCE_KNOWLEDGE)
    const shoyu = reqs.find((x) => x.sourceIngredientName === 'しょうゆ')!
    expect(shoyu.quantityDisplayText).toBe('大さじ1') // 15ml 等へ換算しない
    const chicken = reqs.find((x) => x.sourceIngredientName === '鶏もも肉')!
    expect(chicken.quantityDisplayText).toBe('（大）1枚 300g')
  })

  it('26. LOW を十分量扱いしない（LOW は EXACT ではない・ALL_LISTED_IDENTITIES_PRESENT には入るが数量は保証しない）', () => {
    const r = rev(SYN_RECIPE_3, STOCK_POTATO_LOW)
    expect(r.lowCount).toBe(1)
    expect(r.exactCount).toBe(2)
    expect(r.matchFlags).toContain('HAS_LOW_STOCK')
    // LOW の match も quantity NOT_EVALUATED
    const potato = r.ingredientMatches.find((m) => m.matchClass === 'LOW')!
    expect(potato.quantityStatus).toBe('NOT_EVALUATED')
  })
})

// ============================================================
// §42.28–31 — non-mutation / determinism
// ============================================================

describe('MISSION 2.39 — non-mutation / determinism', () => {
  it('28. SourceRecipeKnowledge を mutate しない', () => {
    const before = JSON.stringify(SYN_RECIPE_3)
    rev(SYN_RECIPE_3, STOCK_ALL_FOR_3)
    matchRecipesFromStock(STOCK_ALL_FOR_3, [SYN_RECIPE_3])
    expect(JSON.stringify(SYN_RECIPE_3)).toBe(before)
    expect(SYN_RECIPE_3.ingredients.every((i) => i.canonicalIngredientId === undefined)).toBe(true)
  })

  it('29. Stock snapshot を mutate しない', () => {
    const before = JSON.stringify(STOCK_ALL_FOR_3)
    rev(SYN_RECIPE_3, STOCK_ALL_FOR_3)
    expect(JSON.stringify(STOCK_ALL_FOR_3)).toBe(before)
  })

  it('30. deterministic output（同じ入力 → 完全に同じ結果）', () => {
    const a = JSON.stringify(rev(SYN_RECIPE_3, STOCK_GARLIC_MISSING))
    const b = JSON.stringify(rev(SYN_RECIPE_3, STOCK_GARLIC_MISSING))
    expect(a).toBe(b)
  })

  it('31. deterministic sorting（forward ranking が安定）', () => {
    const a = matchRecipesFromStock(STOCK_ALL_FOR_3, SYNTHETIC_MATCHING_RECIPES).map((r) => r.canonicalRecipeId)
    const b = matchRecipesFromStock(STOCK_ALL_FOR_3, [...SYNTHETIC_MATCHING_RECIPES].reverse()).map((r) => r.canonicalRecipeId)
    expect(a).toEqual(b)
  })
})

// ============================================================
// §42.32–40 — counts / fixtures / missingCount discipline
// ============================================================

describe('MISSION 2.39 — counts & missingCount discipline', () => {
  it('32. all exact fixture counts', () => {
    const r = rev(SYN_RECIPE_3, STOCK_ALL_FOR_3)
    expect([r.exactCount, r.lowCount, r.missingCount, r.unresolvedCount, r.ambiguousCount]).toEqual([3, 0, 0, 0, 0])
    expect(r.matchFlags).toContain('ALL_LISTED_IDENTITIES_PRESENT')
  })

  it('33. one missing fixture', () => {
    const r = rev(SYN_RECIPE_3, STOCK_GARLIC_MISSING)
    expect(r.missingCount).toBe(1)
    expect(r.exactCount).toBe(2)
    expect(r.missingCanonicalIngredientIds).toEqual(['garlic'])
  })

  it('34. two missing fixture', () => {
    const r = rev(SYN_RECIPE_3, STOCK_2_MISSING)
    expect(r.missingCount).toBe(2)
    expect(r.missingCanonicalIngredientIds).toEqual(['garlic', 'onion'])
  })

  it('35. low fixture', () => {
    expect(rev(SYN_RECIPE_3, STOCK_POTATO_LOW).lowCount).toBe(1)
  })

  it('36. unresolved fixture', () => {
    expect(rev(SYN_RECIPE_UNRESOLVED, STOCK_2_MISSING).unresolvedCount).toBe(1)
  })

  it('37. ambiguous fixture', () => {
    expect(rev(SYN_RECIPE_AMBIGUOUS, STOCK_ALL_FOR_3, AMBIG).ambiguousCount).toBe(1)
  })

  it('38. missingCount に UNRESOLVED を混ぜない（EXACT=1 MISSING=? UNRESOLVED=1）', () => {
    // recipe: potato(EXACT) + mystery-root-x(UNRESOLVED)。missing は 0
    const r = rev(SYN_RECIPE_UNRESOLVED, STOCK_2_MISSING)
    expect(r.exactCount).toBe(1)
    expect(r.unresolvedCount).toBe(1)
    expect(r.missingCount).toBe(0)
  })

  it('39. missingCount に AMBIGUOUS を混ぜない', () => {
    const r = rev(SYN_RECIPE_AMBIGUOUS, STOCK_2_MISSING, AMBIG)
    expect(r.exactCount).toBe(1)
    expect(r.ambiguousCount).toBe(1)
    expect(r.missingCount).toBe(0)
  })

  it('40. lowCount と missingCount を混ぜない', () => {
    // SYN_RECIPE_3 に potato low + garlic 無し → low 1 / missing 1
    const stock: FoodStockIngredientSnapshot[] = [
      { stockItemKey: 'k1', sourceName: 'じゃがいも', canonicalIngredientId: 'potato', identityStatus: 'RESOLVED', availabilityStatus: 'low' },
      { stockItemKey: 'k2', sourceName: '玉ねぎ', canonicalIngredientId: 'onion', identityStatus: 'RESOLVED', availabilityStatus: 'available' },
    ]
    const r = rev(SYN_RECIPE_3, stock)
    expect(r.lowCount).toBe(1)
    expect(r.missingCount).toBe(1)
    expect(r.exactCount).toBe(1)
  })

  it('38b. missingCount = 1 & unresolvedCount = 1 の同時（§12 の例）', () => {
    // potato(EXACT), garlic(MISSING), mystery(UNRESOLVED)
    const recipe = {
      ...SYN_RECIPE_3,
      canonicalRecipeId: 'syn-mix',
      ingredients: [
        SYN_RECIPE_3.ingredients[0], // じゃがいも
        SYN_RECIPE_3.ingredients[2], // にんにく
        { sourceIngredientName: 'mystery-root-x', role: 'required' as const, originalLanguage: 'en' as const },
      ],
    }
    const r = rev(recipe, STOCK_2_MISSING)
    expect(r.exactCount).toBe(1)
    expect(r.missingCount).toBe(1)
    expect(r.unresolvedCount).toBe(1)
  })
})

// ============================================================
// §42.41–44 — Forward / Reverse / ordering
// ============================================================

describe('MISSION 2.39 — forward / reverse / ordering', () => {
  it('41. Forward Matching（渡された Recipe collection だけを評価）', () => {
    const results = matchRecipesFromStock(STOCK_ALL_FOR_3, [SYN_RECIPE_3, SYN_RECIPE_UNRESOLVED])
    expect(results.map((r) => r.canonicalRecipeId).sort()).toEqual(['syn-recipe-3', 'syn-recipe-unresolved'])
  })

  it('42. Reverse Matching（1 Recipe の ingredient-by-ingredient 結果 + counts）', () => {
    const r = evaluateRecipeAgainstStock(SYN_RECIPE_3, STOCK_GARLIC_MISSING)
    expect(r.ingredientMatches).toHaveLength(3)
    expect(r.ingredientMatches.map((m) => m.matchClass).sort()).toEqual(['EXACT', 'EXACT', 'MISSING'])
    expect(r.listedIngredientCount).toBe(3)
    // evaluateRecipeFoodMatch は同義
    expect(JSON.stringify(evaluateRecipeFoodMatch(SYN_RECIPE_3, STOCK_GARLIC_MISSING))).toBe(JSON.stringify(r))
  })

  it('43. multiple recipe ordering（availability fit 順）', () => {
    const results = matchRecipesFromStock(STOCK_GARLIC_MISSING, [SYN_RECIPE_3, SYN_OCC_SNACK])
    // SYN_OCC_SNACK は onion 1 品 → 全 EXACT。SYN_RECIPE_3 は garlic MISSING。fit 上位は SYN_OCC_SNACK
    expect(results[0].canonicalRecipeId).toBe('syn-occ-snack')
  })

  it('44. deterministic tie-break（同 fit なら canonicalRecipeId 昇順）', () => {
    const a = { ...SYN_OCC_SNACK, canonicalRecipeId: 'zzz-recipe' }
    const b = { ...SYN_OCC_DINNER, canonicalRecipeId: 'aaa-recipe' }
    const results = matchRecipesFromStock(STOCK_ONION_ONLY, [a, b])
    expect(results.map((r) => r.canonicalRecipeId)).toEqual(['aaa-recipe', 'zzz-recipe'])
  })

  it('compareByAvailabilityFit の優先順位（ambiguous > unresolved > missing > low > exact）', () => {
    const base = { recipeName: 'x', mealOccasions: [], mealOccasionKnown: false, ingredientMatches: [], listedIngredientCount: 0, matchFlags: [], reasonCodes: [], missingCanonicalIngredientIds: [] }
    const mk = (id: string, a: number, u: number, m: number, l: number, e: number) => ({ ...base, canonicalRecipeId: id, ambiguousCount: a, unresolvedCount: u, missingCount: m, lowCount: l, exactCount: e })
    const list = [mk('r-ambig', 1, 0, 0, 0, 9), mk('r-clean', 0, 0, 0, 0, 1), mk('r-missing', 0, 0, 2, 0, 5)]
    const sorted = [...list].sort(compareByAvailabilityFit).map((r) => r.canonicalRecipeId)
    expect(sorted).toEqual(['r-clean', 'r-missing', 'r-ambig'])
  })
})

// ============================================================
// §42.45–53 — Meal Occasion
// ============================================================

describe('MISSION 2.39 — meal occasion foundation', () => {
  it('45–50. breakfast / lunch / snack / dinner / late-night / bento を扱える', () => {
    expect(ALL_MEAL_OCCASIONS).toEqual(['breakfast', 'lunch', 'snack', 'dinner', 'late-night', 'bento'])
    expect(mealOccasionsOf('syn-occ-bl')).toEqual(['breakfast', 'lunch'])
    expect(mealOccasionsOf('syn-occ-snack')).toEqual(['snack'])
    expect(mealOccasionsOf('syn-occ-dinner')).toEqual(['dinner'])
    expect(mealOccasionsOf('syn-occ-late')).toEqual(['late-night'])
    expect(mealOccasionsOf('syn-occ-bento')).toEqual(['bento'])
  })

  it('47b. snack は正式 Foundation（ALL_MEAL_OCCASIONS に含まれ filter でき、result にも出る）', () => {
    const r = rev(SYN_OCC_SNACK, STOCK_ONION_ONLY)
    expect(r.mealOccasions).toEqual(['snack'])
    expect(r.mealOccasionKnown).toBe(true)
    expect(r.reasonCodes).toContain('MEAL_OCCASION_EXPLICIT_MATCH')
  })

  it('50b. bento = Meal Occasion であって Food Safety Guarantee ではない（result に safety フィールドなし）', () => {
    const r = rev(SYN_OCC_BENTO, STOCK_ONION_ONLY)
    expect(r.mealOccasions).toEqual(['bento'])
    expect(r).not.toHaveProperty('foodSafe')
    expect(r).not.toHaveProperty('storageSafe')
  })

  it('51. multiple occasions（複数値を保持）', () => {
    expect(mealOccasionsOf('syn-occ-bl')).toEqual(['breakfast', 'lunch'])
    expect(rev(SYN_OCC_BREAKFAST_LUNCH, STOCK_ONION_ONLY).mealOccasions).toEqual(['breakfast', 'lunch'])
  })

  it('52. occasion unknown を推測分類しない（metadata 無し → [] / known=false / MEAL_OCCASION_UNKNOWN）', () => {
    expect(isMealOccasionKnown('syn-occ-unknown')).toBe(false)
    expect(mealOccasionsOf('syn-occ-unknown')).toEqual([])
    const r = rev(SYN_OCC_UNKNOWN, STOCK_ONION_ONLY)
    expect(r.mealOccasions).toEqual([])
    expect(r.mealOccasionKnown).toBe(false)
    expect(r.reasonCodes).toContain('MEAL_OCCASION_UNKNOWN')
  })

  it('53. strict occasion filter（INCLUDED / EXCLUDED / EXCLUDED_FROM_STRICT_FILTER）', () => {
    expect(evaluateMealOccasionFilter('syn-occ-bl', 'breakfast')).toBe('INCLUDED')
    expect(evaluateMealOccasionFilter('syn-occ-bl', 'dinner')).toBe('EXCLUDED')
    expect(evaluateMealOccasionFilter('syn-occ-unknown', 'breakfast')).toBe('EXCLUDED_FROM_STRICT_FILTER')
    expect(matchesStrictOccasionFilter('syn-occ-unknown', 'breakfast')).toBe(false)
  })

  it('53b. forward matching の occasionFilter は STRICT（unknown は除外・「向かない」ではない）', () => {
    const recipes = [SYN_OCC_BREAKFAST_LUNCH, SYN_OCC_DINNER, SYN_OCC_UNKNOWN]
    const breakfast = matchRecipesFromStock(STOCK_ONION_ONLY, recipes, { occasionFilter: 'breakfast' })
    expect(breakfast.map((r) => r.canonicalRecipeId)).toEqual(['syn-occ-bl'])
    // unknown は breakfast filter から除外されるが、それは「breakfast に向かない」という意味ではない
    expect(evaluateMealOccasionFilter('syn-occ-unknown', 'breakfast')).toBe('EXCLUDED_FROM_STRICT_FILTER')
  })

  it('meal occasion metadata は実 Recipe（jp-tori-teriyaki 等）に付いていない（§18）', () => {
    for (const id of Object.keys(MEAL_OCCASION_METADATA_FIXTURES)) {
      expect(id.startsWith('syn-')).toBe(true)
    }
    expect(isMealOccasionKnown('jp-tori-teriyaki')).toBe(false)
  })
})

// ============================================================
// §42.54–60 — Match ≠ X firewalls
// ============================================================

describe('MISSION 2.39 — Match ≠ X', () => {
  const r = () => rev(SYN_RECIPE_3, STOCK_ALL_FOR_3)

  it('54. Match ≠ VERIFIED（result に verification / verified フィールドなし）', () => {
    expect(r()).not.toHaveProperty('verification')
    expect(r()).not.toHaveProperty('verified')
  })
  it('55. Match ≠ Allergy Safe', () => {
    expect(r()).not.toHaveProperty('allergySafe')
    expect(r()).not.toHaveProperty('allergens')
  })
  it('56. Match ≠ Practical Validated', () => {
    expect(r()).not.toHaveProperty('practicalCookValidation')
    expect(r()).not.toHaveProperty('practicallyValidated')
  })
  it('57. Match ≠ Rights Permission', () => {
    expect(r()).not.toHaveProperty('rights')
    expect(r()).not.toHaveProperty('commercialUse')
  })
  it('58. Match ≠ Substitution Permission', () => {
    expect(r()).not.toHaveProperty('substitutes')
    expect(r()).not.toHaveProperty('substitutions')
  })
  it('59. Match ≠ Product Identity Mapping（generic id のみ・商品名 mapping なし）', () => {
    expect(r()).not.toHaveProperty('productIdentity')
    expect(r()).not.toHaveProperty('products')
  })
  it('60. Match ≠ Recipe Quality Score（score / ratio / percentage を返さない）', () => {
    const result = r()
    expect(result).not.toHaveProperty('score')
    expect(result).not.toHaveProperty('qualityScore')
    expect(result).not.toHaveProperty('availabilityScore')
    expect(result).not.toHaveProperty('coverageRatio')
    expect(result).not.toHaveProperty('percentage')
  })
})

// ============================================================
// §42.61–65 — existing behavior regression
// ============================================================

describe('MISSION 2.39 — existing behavior regression', () => {
  it('61. MISSION 2.37 import pipeline regression（FIXTURE_A_PASS は PASS）', () => {
    expect(importRecipeCandidate(FIXTURE_A_PASS, { importedAt: '2026-09-03' }).ok).toBe(true)
  })

  it('62. MISSION 2.38 canonicalization regression（じゃがいも → potato）', () => {
    expect(resolveWorldIngredientIdentity('じゃがいも', 'ja').canonicalIngredientId).toBe('potato')
  })

  it('63. tori-teriyaki VERIFIED / publishable 不変', () => {
    const tori = RECIPE_CATALOG.find((x) => x.id === 'tori-teriyaki')!
    expect(getVerificationStatus(tori)).toBe('verified')
    expect(isRecipePublishable(tori)).toBe(true)
    matchRecipesFromStock(STOCK_ALL_FOR_3, SYNTHETIC_MATCHING_RECIPES) // 走らせても
    expect(isRecipePublishable(tori)).toBe(true)
  })

  it('64. buta-shogayaki VERIFIED / publishable 不変', () => {
    const buta = RECIPE_CATALOG.find((x) => x.id === 'buta-shogayaki')!
    expect(getVerificationStatus(buta)).toBe('verified')
    expect(isRecipePublishable(buta)).toBe(true)
  })

  it('65. existing Allergy Gate 不変', () => {
    const base = { availableIngredientNames: ['鶏もも肉'], dislikeNames: [] as string[], maxCookingMinutes: null }
    for (const allergen of ['小麦', '大豆', '鶏肉']) {
      expect(rankRecipes(RECIPE_CATALOG, { ...base, allergyNames: [allergen] }).some((c) => c.recipe.id === 'tori-teriyaki')).toBe(false)
    }
    expect(allergyRelevantIngredients(RECIPE_CATALOG.find((x) => x.id === 'tori-teriyaki')!)).toContain('しょうゆ')
  })

  it('Practical Validation status 不変', () => {
    for (const id of ['tori-teriyaki', 'buta-shogayaki']) {
      expect(practicalCookValidationStatusOf(RECIPE_CATALOG.find((x) => x.id === id)!)).toBe('not-tested')
    }
  })
})

// ============================================================
// §42.66–72 — firewall / no-dependency audit
// ============================================================

describe('MISSION 2.39 — module firewall', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const read = (rel: string) => readFileSync(resolve(here, '..', rel), 'utf8')

  const FORBIDDEN = [
    './recipe-publishability',
    './recipe-safety',
    './practical-cook-validation',
    './recipe-catalog',
    './recipe-suggestion-engine',
    './mock-meal-provider',
    './ingredient-normalization',
    './ingredient-taxonomy',
    './ingredient-allergens',
    './ai-provider',
    './from-now-to-table',
    './recipe-time',
    './world-recipe-import',
  ]

  for (const file of ['food-matching.ts', 'meal-occasion.ts', 'food-matching-fixtures.ts']) {
    it(`66/70/71. ${file} が禁止モジュールを import しない`, () => {
      const src = read(file)
      for (const mod of FORBIDDEN) {
        expect(src.includes(`from '${mod}'`), `${file} imports ${mod}`).toBe(false)
      }
    })
  }

  it('67. no fetch / network', () => {
    for (const f of ['food-matching.ts', 'meal-occasion.ts', 'food-matching-fixtures.ts']) {
      const src = read(f)
      expect(/\bfetch\s*\(/.test(src)).toBe(false)
      expect(/XMLHttpRequest|WebSocket|http:\/\/|https:\/\//.test(src)).toBe(false)
    }
  })

  it('68. no embeddings / vector / semantic', () => {
    const src = read('food-matching.ts')
    expect(/embedding|vector|cosine|semantic/i.test(src)).toBe(false)
  })

  it('69. no random / time dependency in ranking', () => {
    for (const f of ['food-matching.ts', 'meal-occasion.ts']) {
      const src = read(f)
      expect(src.includes('Math.random')).toBe(false)
      expect(src.includes('Date.now')).toBe(false)
      expect(src.includes('new Date')).toBe(false)
    }
  })

  it('72. no DB / migration / prisma', () => {
    for (const f of ['food-matching.ts', 'meal-occasion.ts', 'food-matching-fixtures.ts']) {
      const src = read(f)
      expect(/prisma|migration|CREATE TABLE|d1|drizzle/i.test(src)).toBe(false)
    }
  })
})

// ============================================================
// Stock adapter / connection / summary
// ============================================================

describe('MISSION 2.39 — stock adapter & connection', () => {
  it('mapStockStatusToAvailability（既存 available/low/out を写像）', () => {
    const cases: [StockStatus, string][] = [['available', 'available'], ['low', 'low'], ['out', 'unavailable']]
    for (const [s, exp] of cases) expect(mapStockStatusToAvailability(s)).toBe(exp)
  })

  it('projectStockToSnapshots（生 stock 入力 → snapshot、MISSION 2.38 で名前解決）', () => {
    const snaps = projectStockToSnapshots([
      { stockItemKey: 'a', sourceName: 'じゃがいも', availabilityStatus: 'available', language: 'ja' },
      { stockItemKey: 'b', sourceName: 'quokka berry', availabilityStatus: 'available', language: 'en' },
    ])
    expect(snaps[0].canonicalIngredientId).toBe('potato')
    expect(snaps[0].identityStatus).toBe('RESOLVED')
    expect(snaps[1].canonicalIngredientId).toBeUndefined()
    expect(snaps[1].identityStatus).toBe('UNRESOLVED')
  })

  it('toStockIngredientSnapshot は元入力を mutate しない', () => {
    const input = { stockItemKey: 'a', sourceName: 'じゃがいも', availabilityStatus: 'available' as const }
    const before = JSON.stringify(input)
    toStockIngredientSnapshot(input)
    expect(JSON.stringify(input)).toBe(before)
  })

  it('§13. imported SourceRecipeKnowledge を Matching へ接続できる', () => {
    const imported = importRecipeCandidate(FIXTURE_A_PASS, { importedAt: '2026-09-03' })
    expect(imported.ok).toBe(true)
    if (!imported.ok) return
    const stock: FoodStockIngredientSnapshot[] = [
      { stockItemKey: 'k1', sourceName: 'egg', canonicalIngredientId: 'egg', identityStatus: 'RESOLVED', availabilityStatus: 'available' },
    ]
    const r = evaluateRecipeAgainstStock(imported.knowledge, stock)
    expect(r.canonicalRecipeId).toBe('kr-kimchi-bokkeumbap')
    const egg = r.ingredientMatches.find((m) => m.requirement.sourceIngredientName === 'egg')!
    expect(egg.matchClass).toBe('EXACT')
    const gochugaru = r.ingredientMatches.find((m) => m.requirement.sourceIngredientName === 'gochugaru')!
    expect(gochugaru.matchClass).toBe('UNRESOLVED')
    // imported knowledge は不変（canonicalIngredientId は付かない）
    expect(imported.knowledge.ingredients.every((i) => i.canonicalIngredientId === undefined)).toBe(true)
  })

  it('§39. toRecipeFoodMatchSummary は 2.40 が必要とする最小サマリを返す（Cooking Steps なし）', () => {
    const s = toRecipeFoodMatchSummary(rev(SYN_RECIPE_3, STOCK_GARLIC_MISSING))
    expect(s.canonicalRecipeId).toBe('syn-recipe-3')
    expect(s.missingCount).toBe(1)
    expect(s).not.toHaveProperty('cookingSteps')
    expect(s).not.toHaveProperty('ingredientMatches')
  })

  it('§30. describeFoodMatchReason は事実ラベルを返す', () => {
    expect(describeFoodMatchReason('CANONICAL_ID_EXACT')).toContain('完全一致')
    expect(describeFoodMatchReason('QUANTITY_NOT_EVALUATED')).toContain('数量')
  })
})

// ============================================================
// SYNTHETIC fixture discipline
// ============================================================

describe('MISSION 2.39 — SYNTHETIC fixture discipline', () => {
  it('SYNTHETIC recipes は MISSION 2.35 の実 fixture に混ざらない', () => {
    const realIds = new Set(SOURCE_RECIPE_KNOWLEDGE_FIXTURES.map((f) => f.canonicalRecipeId))
    for (const syn of SYNTHETIC_MATCHING_RECIPES) {
      expect(syn.canonicalRecipeId.startsWith('syn-')).toBe(true)
      expect(realIds.has(syn.canonicalRecipeId)).toBe(false)
      expect(syn.notes?.some((n) => n.includes('SYNTHETIC'))).toBe(true)
      expect(syn.evidenceSourceId).toBe('synthetic-matching-fixture')
    }
  })

  it('タコライス専用ロジック / タコライス fixture が存在しない', () => {
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'food-matching.ts'), 'utf8')
    expect(/taco|タコライス/i.test(src)).toBe(false)
    for (const syn of SYNTHETIC_MATCHING_RECIPES) {
      expect(/taco|タコライス/i.test(syn.canonicalRecipeId)).toBe(false)
    }
  })

  it('§40 完成条件 E: UNKNOWN を MATCH にしない / AMBIGUOUS を選ばない / 代用しない', () => {
    // UNKNOWN → 決して EXACT/LOW にならない
    const unresolved = rev(SYN_RECIPE_UNRESOLVED, STOCK_2_MISSING).ingredientMatches.find((m) => m.matchClass === 'UNRESOLVED')!
    expect(unresolved.matchedStock).toBeUndefined()
    // AMBIGUOUS → 候補を選ばない
    const ambig = rev(SYN_RECIPE_AMBIGUOUS, STOCK_ALL_FOR_3, AMBIG).ingredientMatches.find((m) => m.matchClass === 'AMBIGUOUS')!
    expect(ambig.matchedStock).toBeUndefined()
    expect(ambig.requirement.canonicalIngredientId).toBeUndefined()
  })
})
