// ============================================================
// starter-set.test.ts
//
// MISSION 2.12 PHASE B — First 10 Families Starter Set Gate (DP〜EE)。
// Starter Setが「Product selection layer」に留まり、Safety/Evidence Gateの
// 唯一の最終判定者であるisRecipePublishable()を一切迂回・弱体化しないことを
// 固定化する。既存PHASE AのDinner Decision UX（Candidate A/B・max3・share/
// decision/feedback）とAllergy HARD EXCLUSIONの回帰も併せて確認する。
// ============================================================

import { describe, it, expect } from 'vitest'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { getEvidenceSourceById } from '../evidence-sources'
import { isRecipePublishable, hasUnresolvedRangeEvidence } from '../recipe-publishability'
import { STARTER_SET_RECIPE_IDS, getStarterSetRecipes, getBetaPublishableStarterRecipes } from '../starter-set'
import { allergyRelevantIngredients } from '../recipe-safety'
import { rankRecipes } from '../recipe-suggestion-engine'
import { selectBetaCandidates, BETA_MAX_CANDIDATES } from '../beta-presentation'
import { buildMealDecision } from '../storage'
import { buildCandidateShareText } from '../family-share'

describe('First 10 Families Starter Set Gate (DP〜EE)', () => {
  it('DP: Starter Setは実在するRECIPE_CATALOGのidのみで構成される', () => {
    const catalogIds = new Set(RECIPE_CATALOG.map((r) => r.id))
    for (const id of STARTER_SET_RECIPE_IDS) {
      expect(catalogIds.has(id), `${id}はRECIPE_CATALOGに存在しない`).toBe(true)
    }
  })

  it('DQ: Starter Set内にid重複がない', () => {
    const unique = new Set(STARTER_SET_RECIPE_IDS)
    expect(unique.size).toBe(STARTER_SET_RECIPE_IDS.length)
  })

  it('DR: Starter Setに載っているだけではVerifiedを意味しない（review/unverifiedのRecipeも含まれる）', () => {
    const starterRecipes = getStarterSetRecipes()
    const statuses = new Set(starterRecipes.map((r) => r.verification?.status ?? 'unverified'))
    // Starter Setは選定layerであり、含まれる全Recipeがverifiedである必要はない
    expect(statuses.has('review') || statuses.has('unverified')).toBe(true)
  })

  it('DS: getBetaPublishableStarterRecipesはisRecipePublishable()を経由した結果のみを返す', () => {
    const publishable = getBetaPublishableStarterRecipes()
    for (const recipe of publishable) {
      expect(isRecipePublishable(recipe), `${recipe.id}はisRecipePublishableがfalseなのに含まれている`).toBe(true)
    }
  })

  it('DT: REVIEW状態のRecipeはPublic Publishable Starter Setへ漏れない', () => {
    const publishable = getBetaPublishableStarterRecipes()
    for (const recipe of publishable) {
      expect(recipe.verification?.status).not.toBe('review')
    }
  })

  it('DU: UNVERIFIED（verification未設定）のRecipeはPublic Publishable Starter Setへ漏れない', () => {
    const publishable = getBetaPublishableStarterRecipes()
    for (const recipe of publishable) {
      expect(recipe.verification).toBeDefined()
    }
  })

  it('DV: BLOCKED状態のRecipeはPublic Publishable Starter Setへ漏れない', () => {
    const publishable = getBetaPublishableStarterRecipes()
    for (const recipe of publishable) {
      expect(recipe.verification?.status).not.toBe('blocked')
    }
  })

  it('DW: 未解決のrange Evidenceを持つRecipeはPublic Publishable Starter Setへ漏れない', () => {
    const publishable = getBetaPublishableStarterRecipes()
    for (const recipe of publishable) {
      expect(hasUnresolvedRangeEvidence(recipe), `${recipe.id}はrange未解決なのに公開対象に含まれている`).toBe(false)
    }
  })

  it('DX: RecipeProductDecisionの存在はisRecipePublishableのEvidence解決判定を代替しない（shio-musubiで再確認）', () => {
    const shioMusubi = RECIPE_CATALOG.find((r) => r.id === 'shio-musubi')!
    expect((shioMusubi.verification?.productDecisions ?? []).length).toBeGreaterThan(0)
    expect(hasUnresolvedRangeEvidence(shioMusubi)).toBe(true)
    expect(isRecipePublishable(shioMusubi)).toBe(false)
  })

  it('DY: Starter Set内Recipeが参照するsourceIdsはすべてEVIDENCE_SOURCE_CATALOGに実在する', () => {
    for (const recipe of getStarterSetRecipes()) {
      for (const sourceId of recipe.verification?.sourceIds ?? []) {
        expect(getEvidenceSourceById(sourceId), `${recipe.id}: sourceId「${sourceId}」が存在しない`).toBeDefined()
      }
    }
  })

  it('DZ: VERIFIED状態のRecipeはhasUnsupportedInferenceがtrueにならない', () => {
    for (const recipe of RECIPE_CATALOG) {
      if (recipe.verification?.status === 'verified') {
        expect(recipe.verification.hasUnsupportedInference).not.toBe(true)
      }
    }
  })

  it('EA: medama-yakiはMISSION 2.14B Recipe Coherence CorrectionによりREVIEWへ差し戻され、publishableではない（seasonings/criticalSteps/cookingTimeMinutesのEvidence解決が未完了なため）', () => {
    const medamaYaki = RECIPE_CATALOG.find((r) => r.id === 'medama-yaki')!
    expect(medamaYaki.verification?.status).toBe('review')
    expect(isRecipePublishable(medamaYaki)).toBe(false)
  })

  it('EB: Allergy HARD EXCLUSIONはStarter Set/Evidence作業後も無傷（requiredIngredients+seasoningsのみ対象）', () => {
    const medamaYaki = RECIPE_CATALOG.find((r) => r.id === 'medama-yaki')!
    const relevant = allergyRelevantIngredients(medamaYaki)
    expect(relevant).toEqual(['卵', '油'])

    const result = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['卵'],
      allergyNames: ['卵'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(result.some((c) => c.recipe.id === 'medama-yaki')).toBe(false)
  })

  it('EC: Candidate A/B判定はStarter Set/Evidence作業後も無傷（必須食材が全てあればA、1件不足でB）', () => {
    const result = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['卵'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    const medamaYaki = result.find((c) => c.recipe.id === 'medama-yaki')
    expect(medamaYaki?.category).toBe('A')
  })

  it('ED: PHASE Aのmax3候補提示（selectBetaCandidates）はStarter Set/Evidence作業後も無傷', () => {
    expect(BETA_MAX_CANDIDATES).toBe(3)
    expect(selectBetaCandidates([1, 2, 3, 4, 5])).toEqual([1, 2, 3])
  })

  it('EE: share/decision/feedbackの最小データ保存はStarter Set/Evidence作業後も無傷', () => {
    const decision = buildMealDecision({
      recipeId: 'medama-yaki',
      candidateType: 'A',
      selectedMemberIds: ['self'],
      decidedAt: '2026-08-28T00:00:00.000Z',
    })
    expect(Object.keys(decision).sort()).toEqual(['candidateType', 'decidedAt', 'recipeId', 'selectedMemberIds'].sort())

    const shareText = buildCandidateShareText({ title: '目玉焼き', estimatedMinutes: 5 })
    expect(shareText).toContain('目玉焼き')
    expect(shareText).not.toContain('検証済み')
  })
})
