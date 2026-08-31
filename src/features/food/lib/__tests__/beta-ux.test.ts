// ============================================================
// beta-ux.test.ts
//
// MISSION 2.12 PHASE A — First 10 Families Beta Gate (DA〜DO)。
// Dinner Decision MVP（Candidate 3 UX / MealDecision / Family Share /
// Feedback）が、既存のSafety/Evidence基盤を一切弱めていないことを
// 固定化する。
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { MealSuggestion, Recipe, RecipeIngredient } from '@/features/food/types'
import { BETA_MAX_CANDIDATES, selectBetaCandidates } from '../beta-presentation'
import { candidateAvailabilityLabel } from '../recipe-labels'
import { rankRecipes } from '../recipe-suggestion-engine'
import { buildCandidateShareText, shareCandidate } from '../family-share'
import { buildMealDecision, loadMealDecisions, recordMealDecision, loadMealFeedback, recordMealFeedback } from '../storage'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { hasUnresolvedRangeEvidence, isRecipePublishable } from '../recipe-publishability'

function ri(name: string, amount = '1個'): RecipeIngredient {
  return { name, amount }
}

function makeRecipe(overrides: Partial<Recipe> & Pick<Recipe, 'id' | 'requiredIngredients'>): Recipe {
  return {
    name: overrides.id,
    type: 'main',
    seasonings: [],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    ...overrides,
  }
}

function makeSuggestion(overrides: Partial<MealSuggestion> & Pick<MealSuggestion, 'title'>): MealSuggestion {
  return {
    reason: '',
    dishes: [],
    estimatedMinutes: 15,
    shoppingItems: [],
    notes: [],
    warnings: [],
    ...overrides,
  }
}

/** vitestは environment: 'node' のため、既定では window が存在しない（storage.test.tsと同じfixture） */
function installFakeLocalStorage() {
  const store = new Map<string, string>()
  ;(globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    },
  }
  return store
}

function removeFakeWindow() {
  delete (globalThis as unknown as { window?: unknown }).window
}

describe('First 10 Families Beta Gate (DA〜DO)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })
  afterEach(() => {
    removeFakeWindow()
  })

  it('DA: selectBetaCandidatesは最大3件（BETA_MAX_CANDIDATES）にキャップする', () => {
    expect(BETA_MAX_CANDIDATES).toBe(3)
    const five = [1, 2, 3, 4, 5]
    expect(selectBetaCandidates(five)).toEqual([1, 2, 3])
  })

  it('DB: 候補が1件・2件の場合、無理に3件へ水増ししない（そのまま返す）', () => {
    expect(selectBetaCandidates([1])).toEqual([1])
    expect(selectBetaCandidates([1, 2])).toEqual([1, 2])
    expect(selectBetaCandidates([])).toEqual([])
  })

  it('DC: Candidate Aの自然文言は開発用語"A"を含まない', () => {
    const label = candidateAvailabilityLabel(true)
    expect(label).toBe('家にあるもので作れます')
    expect(label).not.toMatch(/^A$/)
  })

  it('DD: Candidate Bの自然文言は開発用語"B"を含まず、missingIngredientsはそのまま保持される', () => {
    const label = candidateAvailabilityLabel(false)
    expect(label).toBe('あと1つで作れます')
    expect(label).not.toMatch(/^B$/)
    const suggestion = makeSuggestion({ title: 'まぐろの山かけ', isFullyAvailable: false, missingIngredients: ['長芋'] })
    expect(suggestion.missingIngredients).toEqual(['長芋'])
  })

  it('DE: allergy除外されたRecipeは、候補が3件未満でもselectBetaCandidates後に一切出現しない', () => {
    const safeDish = makeRecipe({ id: 'safe-dish', requiredIngredients: [ri('マグロ', '200g')] })
    const eggDish = makeRecipe({ id: 'egg-dish', requiredIngredients: [ri('卵', '1個')] })
    const ranked = rankRecipes([safeDish, eggDish], {
      availableIngredientNames: ['マグロ', '卵'],
      allergyNames: ['卵'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    const presented = selectBetaCandidates(ranked)
    expect(presented.length).toBe(1)
    expect(presented.some((c) => c.recipe.id === 'egg-dish')).toBe(false)
  })

  it('DF: buildMealDecisionは渡されたrecipeId/candidateTypeをそのまま保持する（差し替えない）', () => {
    const decision = buildMealDecision({
      recipeId: 'maguro-don',
      candidateType: 'B',
      selectedMemberIds: ['self'],
      decidedAt: '2026-08-28T00:00:00.000Z',
    })
    expect(decision.recipeId).toBe('maguro-don')
    expect(decision.candidateType).toBe('B')
  })

  it('DG: MealDecisionは必要最小限の4フィールドのみを持つ', () => {
    const decision = buildMealDecision({
      recipeId: 'maguro-don',
      candidateType: 'A',
      selectedMemberIds: ['self'],
      decidedAt: '2026-08-28T00:00:00.000Z',
    })
    expect(Object.keys(decision).sort()).toEqual(
      ['candidateType', 'decidedAt', 'recipeId', 'selectedMemberIds'].sort(),
    )
  })

  it('DH: MealDecisionにはアレルギー情報が一切複製されない', () => {
    const decision = buildMealDecision({
      recipeId: 'maguro-don',
      candidateType: 'A',
      selectedMemberIds: ['self'],
    })
    const keys = Object.keys(decision)
    expect(keys).not.toContain('allergies')
    expect(keys).not.toContain('allergyProfile')
    expect(keys).not.toContain('mergedAllergies')
  })

  it('DI: 共有文には候補（Recipe名）が含まれる', () => {
    const text = buildCandidateShareText({ title: '親子丼', estimatedMinutes: 15 })
    expect(text).toContain('親子丼')
  })

  it('DJ: 共有文はVerified/Safety等の断定表現を一切含まない', () => {
    const text = buildCandidateShareText({ title: '親子丼', estimatedMinutes: 15 })
    for (const forbidden of ['検証済み', '安全です', '根拠あり', 'Verified', '確認済み']) {
      expect(text).not.toContain(forbidden)
    }
  })

  it('DK: Web Share/Clipboardが使えない環境ではshareCandidateが"unavailable"を返す（vitestのnode環境で実測）', async () => {
    expect(typeof navigator === 'undefined' || typeof navigator.share !== 'function').toBe(true)
    const outcome = await shareCandidate({ title: '親子丼', estimatedMinutes: 15 })
    expect(outcome).toBe('unavailable')
  })

  it('DL: MealFeedbackは必要最小限（recipeId/recordedAt/rating）のみを保存する', () => {
    const feedback = { recipeId: 'maguro-don', recordedAt: '2026-08-28T00:00:00.000Z', rating: 'good' as const }
    expect(Object.keys(feedback).sort()).toEqual(['recipeId', 'recordedAt', 'rating'].sort())
    recordMealFeedback(feedback)
    const all = loadMealFeedback()
    expect(all[all.length - 1]).toEqual(feedback)
  })

  it('DM: 共有文・Feedbackのいずれにも共有先/連絡先を保存するフィールドが存在しない', () => {
    const text = buildCandidateShareText({ title: '親子丼', estimatedMinutes: 15 })
    expect(text).not.toMatch(/@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) // メールアドレス的な文字列を含まない
    const decision = buildMealDecision({ recipeId: 'x', candidateType: 'A', selectedMemberIds: [] })
    expect(Object.keys(decision)).not.toContain('shareDestination')
    expect(Object.keys(decision)).not.toContain('contact')
  })

  it('DN: isRecipePublishable()の挙動はPHASE A追加後も無傷（range Evidenceは引き続き解決済みにならない）', () => {
    const recipeWithRange = RECIPE_CATALOG.find((r) =>
      r.verification?.fieldVerifications?.some((fv) => fv.supportType === 'range'),
    )
    expect(recipeWithRange).toBeDefined()
    expect(hasUnresolvedRangeEvidence(recipeWithRange!)).toBe(true)
    expect(isRecipePublishable(recipeWithRange!)).toBe(false)
  })

  it('DO: VERIFIED件数はPHASE A（Dinner Decision UX）自体によっては変化しない（MISSION 2.14B Recipe Coherence Correctionによりmedama-yakiもREVIEWへ差し戻され、現在VERIFIEDは0件。本Gateの対象はPHASE A UX自体が件数を動かさないことの確認であり、件数目標は設定しない）', () => {
    const verifiedIds = RECIPE_CATALOG.filter((r) => r.verification?.status === 'verified').map((r) => r.id)
    expect(verifiedIds).toEqual(['tori-teriyaki', 'buta-shogayaki']) /* MISSION 2.26: 初の VERIFIED。この Gate は当該 Foundation が件数を動かさないことの確認 */
    expect(RECIPE_CATALOG.length).toBe(44)
  })

  it('補足: recordMealDecision/loadMealDecisionsのround-tripが正しく機能する', () => {
    const before = loadMealDecisions().length
    const decision = buildMealDecision({
      recipeId: 'gyudon',
      candidateType: 'A',
      selectedMemberIds: ['self'],
      decidedAt: '2026-08-28T00:00:00.000Z',
    })
    recordMealDecision(decision)
    const after = loadMealDecisions()
    expect(after.length).toBe(before + 1)
    expect(after[after.length - 1]).toEqual(decision)
  })
})
