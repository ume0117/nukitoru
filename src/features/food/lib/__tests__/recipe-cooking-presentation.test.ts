// ============================================================
// recipe-cooking-presentation.test.ts
//
// PUBLIC BETA RELEASE SPRINT 2 — Cooking Mode E2E。
//
// recipe-cooking-presentation.ts が、7件のBeta-publishable Recipe全てに対して
// 変換可能であること、かつ新しい事実（heat/time/quantity/tool/safety）を
// 一切生成していないことを固定する。
// ============================================================

import { describe, it, expect } from 'vitest'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { isRecipePublishable } from '../recipe-publishability'
import { canAdaptRecipeForCooking, recipeToCookingPresentation } from '../recipe-cooking-presentation'

const BETA_PUBLISHABLE_IDS = [
  'tori-teriyaki',
  'buta-shogayaki',
  'nikujaga',
  'medama-yaki',
  'yudofu',
  'niku-udon',
  'napolitan',
]

describe('Cooking Presentation Adapter — Beta 7件すべてで変換可能', () => {
  it('現在のBeta-publishable集合は想定どおり7件（前提の固定）', () => {
    const publishable = RECIPE_CATALOG.filter((r) => isRecipePublishable(r))
    expect(publishable.map((r) => r.id).sort()).toEqual([...BETA_PUBLISHABLE_IDS].sort())
  })

  it.each(BETA_PUBLISHABLE_IDS)('%s: canAdaptRecipeForCooking = true', (id) => {
    const recipe = RECIPE_CATALOG.find((r) => r.id === id)!
    expect(recipe).toBeDefined()
    expect(canAdaptRecipeForCooking(recipe)).toBe(true)
  })

  it.each(BETA_PUBLISHABLE_IDS)('%s: recipeToCookingPresentationがundefinedにならず、必須fieldを満たす', (id) => {
    const recipe = RECIPE_CATALOG.find((r) => r.id === id)!
    const presentation = recipeToCookingPresentation(recipe)
    expect(presentation).toBeDefined()
    expect(presentation!.canonicalRecipeId).toBe(recipe.id)
    expect(presentation!.displayName).toBe(recipe.name)
    expect(presentation!.displayLocale).toEqual({ language: 'ja', country: 'JP' })
    expect(presentation!.steps.length).toBeGreaterThan(0)
    // sourceEvidenceSourceIdは実在するsourceIdでなければならない（捏造禁止）
    const allSourceIds = new Set(recipe.verification?.sourceIds ?? [])
    expect(allSourceIds.has(presentation!.sourceEvidenceSourceId)).toBe(true)
  })

  it.each(BETA_PUBLISHABLE_IDS)('%s: 各stepのshortInstructionはRecipe.preparation/stepsのテキストとそのまま一致する（新しい事実を生成していない）', (id) => {
    const recipe = RECIPE_CATALOG.find((r) => r.id === id)!
    const presentation = recipeToCookingPresentation(recipe)!
    const expectedTexts = [
      ...(recipe.preparation ?? []).map((p) => p.text),
      ...(recipe.steps ?? []),
    ]
    expect(presentation.steps.map((s) => s.shortInstruction)).toEqual(expectedTexts)
    expect(presentation.steps.map((s) => s.title)).toEqual(expectedTexts)
  })

  it.each(BETA_PUBLISHABLE_IDS)('%s: ingredientActionsは常に空（分量・食材操作をadapterで捏造していない）', (id) => {
    const recipe = RECIPE_CATALOG.find((r) => r.id === id)!
    const presentation = recipeToCookingPresentation(recipe)!
    for (const step of presentation.steps) {
      expect(step.ingredientActions).toEqual([])
    }
  })

  it('Recipe.notesがあるrecipeのみ、最終stepにwarningが引き継がれる（自作の安全文を追加しない）', () => {
    for (const id of BETA_PUBLISHABLE_IDS) {
      const recipe = RECIPE_CATALOG.find((r) => r.id === id)!
      const presentation = recipeToCookingPresentation(recipe)!
      const lastStep = presentation.steps[presentation.steps.length - 1]
      if (recipe.notes && recipe.notes.length > 0) {
        expect(lastStep.warning).toBe(recipe.notes.join(' '))
      } else {
        expect(lastStep.warning).toBeUndefined()
      }
      // warningは最終step以外には付与しない
      for (const step of presentation.steps.slice(0, -1)) {
        expect(step.warning).toBeUndefined()
      }
    }
  })

  it('sourceStepReferenceは1から始まる連番で重複がない', () => {
    for (const id of BETA_PUBLISHABLE_IDS) {
      const recipe = RECIPE_CATALOG.find((r) => r.id === id)!
      const presentation = recipeToCookingPresentation(recipe)!
      const refs = presentation.steps.map((s) => s.sourceStepReference)
      expect(refs).toEqual(Array.from({ length: refs.length }, (_, i) => i + 1))
    }
  })
})

describe('Cooking Presentation Adapter — 変換不可条件（データ捏造防止のガード）', () => {
  it('status !== verified のRecipe（例: review status）はcanAdaptRecipeForCooking = false / undefinedを返す', () => {
    const reviewRecipe = RECIPE_CATALOG.find((r) => r.verification?.status === 'review')
    expect(reviewRecipe).toBeDefined()
    expect(canAdaptRecipeForCooking(reviewRecipe!)).toBe(false)
    expect(recipeToCookingPresentation(reviewRecipe!)).toBeUndefined()
  })

  it('stepsが空のRecipeはfalseを返す（仮想のstepを生成しない）', () => {
    const fakeRecipe = {
      ...RECIPE_CATALOG.find((r) => r.id === 'tori-teriyaki')!,
      steps: [],
      preparation: [],
    }
    expect(canAdaptRecipeForCooking(fakeRecipe)).toBe(false)
    expect(recipeToCookingPresentation(fakeRecipe)).toBeUndefined()
  })
})
