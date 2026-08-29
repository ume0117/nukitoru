// ============================================================
// recipe-variant.test.ts
//
// MISSION 2.13 — Evidence Variant Foundation Gate (EF〜FN)。
// 「Conflict」「Recipe Identity mismatch」「Legitimate Variant」「Range」
// 「Product Decision」を明確に分離し、Variant支援がisRecipePublishable()の
// 唯一のPublic Gateを一切弱めない・迂回しないことを固定化する。
// PHASE A（Dinner Decision UX）とAllergy HARD EXCLUSIONの回帰も併せて確認する。
// ============================================================

import { describe, it, expect } from 'vitest'
import type {
  Recipe,
  RecipeEvidenceSource,
  RecipeIdentity,
  RecipeIngredient,
  RecipeVerification,
} from '@/features/food/types'
import { isMeaningfulVariantDimension, isEstablishedVariant, type VariantEstablishmentInput } from '../recipe-variant'
import { isRecipePublishable, hasUnresolvedRangeEvidence, applicableFieldsFor } from '../recipe-publishability'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { getEvidenceSourceById } from '../evidence-sources'
import { allergyRelevantIngredients } from '../recipe-safety'
import { rankRecipes } from '../recipe-suggestion-engine'
import { selectBetaCandidates, BETA_MAX_CANDIDATES } from '../beta-presentation'
import { buildMealDecision } from '../storage'
import { buildCandidateShareText } from '../family-share'
import { getBetaPublishableStarterRecipes } from '../starter-set'
import { resolveCanonicalFoodId } from '../canonical-food'

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
    steps: ['手順1'],
    ...overrides,
  }
}

function makeSource(overrides: Partial<RecipeEvidenceSource> & Pick<RecipeEvidenceSource, 'id'>): RecipeEvidenceSource {
  return {
    publisher: '公的機関テスト',
    title: 'テスト情報源',
    url: 'https://example-trusted-source.jp/recipe/test',
    sourceType: 'government',
    checkedAt: '2026-08-28',
    ...overrides,
  }
}

function makeIdentity(overrides: Partial<RecipeIdentity> = {}): RecipeIdentity {
  return {
    canonicalDish: 'テスト料理',
    variant: '基本variant',
    servingsBasis: 2,
    intendedTasteProfile: '家庭的',
    coreMethod: '基本の調理法',
    definingIngredients: ['米'],
    ...overrides,
  }
}

/** MISSION 2.14B — 全applicable critical fieldがsourceIdを唯一の引数として参照する場合に、
 *  そのsourceを漏れなくカバーするcoherent状態のCoherenceReviewを組み立てるテスト用ヘルパー。 */
function makeCoherentReview(sourceId: string): RecipeVerification['coherenceReview'] {
  return {
    status: 'coherent',
    sourceProcessNotes: [{ sourceId, equipment: 'テスト器具', heatSequence: '単一source内で一貫した加熱' }],
    reviewedDimensions: ['equipment', 'heat-sequence'],
    rationale: 'テスト用: 単一sourceのみが全fieldを支持しており、process不整合の余地がない。',
  }
}

describe('Evidence Variant Foundation Gate (EF〜FF)', () => {
  it('EF: variantIdは安定した文字列であり、同一入力に対して常に同一の判定結果を返す（決定論的）', () => {
    const input: VariantEstablishmentInput = {
      variantId: 'test-variant-a',
      definingCharacteristics: ['特徴A'],
      dimensionKinds: ['cooking-method'],
      sourceIds: ['s1', 's2'],
      hasExplicitAuthoritativeSource: false,
      createdOnlyToResolveConflict: false,
    }
    expect(isEstablishedVariant(input)).toBe(isEstablishedVariant({ ...input }))
    expect(isEstablishedVariant(input)).toBe(true)
  })

  it('EG: 同一variant内で値が矛盾するCONFLICTは未解決のまま維持される（gyudonで実データ確認）', () => {
    const gyudon = RECIPE_CATALOG.find((r) => r.id === 'gyudon')!
    expect(gyudon.verification?.status).toBe('review')
    expect((gyudon.verification?.reviewNotes ?? []).length).toBeGreaterThan(0)
    expect(isRecipePublishable(gyudon)).toBe(false)
  })

  it('EH: 情報源の著者が異なるというだけではvariantを確立できない', () => {
    const result = isEstablishedVariant({
      variantId: 'author-only-variant',
      definingCharacteristics: ['著者Aのレシピ', '著者Bのレシピ'],
      dimensionKinds: ['source-author'],
      sourceIds: ['s1', 's2'],
      hasExplicitAuthoritativeSource: false,
      createdOnlyToResolveConflict: false,
    })
    expect(result).toBe(false)
  })

  it('EI: 数値が異なるというだけではvariantを確立できない', () => {
    const result = isEstablishedVariant({
      variantId: 'numeric-only-variant',
      definingCharacteristics: ['しょうゆ30ml', 'しょうゆ60ml'],
      dimensionKinds: ['numeric-difference'],
      sourceIds: ['s1', 's2'],
      hasExplicitAuthoritativeSource: false,
      createdOnlyToResolveConflict: false,
    })
    expect(result).toBe(false)
  })

  it('EJ: 意味のある調理上の違い（cooking-method）が権威ある情報源で明示されていればvariantを確立できる（sake-shioyakiで実データ確認）', () => {
    expect(isMeaningfulVariantDimension('cooking-method')).toBe(true)
    const result = isEstablishedVariant({
      variantId: 'sake-shioyaki-grill-no-oil',
      definingCharacteristics: ['油を使わない', 'グリル/トースターで焼く'],
      dimensionKinds: ['cooking-method'],
      sourceIds: ['kikkoman-sakeyakikata-2026'],
      hasExplicitAuthoritativeSource: true,
      createdOnlyToResolveConflict: false,
    })
    expect(result).toBe(true)

    const sakeShioyaki = RECIPE_CATALOG.find((r) => r.id === 'sake-shioyaki')!
    expect(sakeShioyaki.verification?.recipeIdentity?.variantIdentity?.variantId).toBe('sake-shioyaki-grill-no-oil')
  })

  it('EK: variant分類の存在自体はREVIEWをVERIFIEDへ昇格させない（sake-shioyakiは正当なvariantを持つが、seasonings/criticalStepsのprocess不整合によりREVIEWのまま。MISSION 2.14 CORRECTION）', () => {
    const sakeShioyaki = RECIPE_CATALOG.find((r) => r.id === 'sake-shioyaki')!
    expect(sakeShioyaki.verification?.recipeIdentity?.variantIdentity).toBeDefined()
    expect(sakeShioyaki.verification?.status).toBe('review')
    expect(isRecipePublishable(sakeShioyaki)).toBe(false)
  })

  it('EL: rangeは自動的にvariantへ変換されない（shio-musubiのcookingTimeMinutesは未解決のrangeのまま）', () => {
    const shioMusubi = RECIPE_CATALOG.find((r) => r.id === 'shio-musubi')!
    const timeField = shioMusubi.verification?.fieldVerifications?.find((f) => f.field === 'cookingTimeMinutes')
    expect(timeField?.supportType).toBe('range')
    expect(timeField?.evidenceRange).toEqual({ min: 40, max: 60, unit: '分' })
    expect(hasUnresolvedRangeEvidence(shioMusubi)).toBe(true)
  })

  it('EM: Product Decisionの存在はvariantを確立しない（isEstablishedVariantの引数にproductDecisionsは存在しない。shio-musubiで実データ確認）', () => {
    const shioMusubi = RECIPE_CATALOG.find((r) => r.id === 'shio-musubi')!
    expect((shioMusubi.verification?.productDecisions ?? []).length).toBeGreaterThan(0)
    // isEstablishedVariantはproductDecisionsを一切受け取らない設計であること自体がfirewall
    const result = isEstablishedVariant({
      variantId: 'pd-only-variant',
      definingCharacteristics: ['Product Decisionで選んだ値'],
      dimensionKinds: ['product-decision'],
      sourceIds: [],
      hasExplicitAuthoritativeSource: false,
      createdOnlyToResolveConflict: false,
    })
    expect(result).toBe(false)
  })

  it('EN: Product DecisionはConflictを解決しない（gyudonはproductDecisionsを持たずREVIEWのまま）', () => {
    const gyudon = RECIPE_CATALOG.find((r) => r.id === 'gyudon')!
    expect((gyudon.verification?.productDecisions ?? []).length).toBe(0)
    expect(isRecipePublishable(gyudon)).toBe(false)
  })

  it('EO: Product DecisionはRangeを解決しない（shio-musubiのcookingTimeMinutes fieldVerificationはproductDecisionsを参照しない）', () => {
    const shioMusubi = RECIPE_CATALOG.find((r) => r.id === 'shio-musubi')!
    const timeField = shioMusubi.verification?.fieldVerifications?.find((f) => f.field === 'cookingTimeMinutes')
    expect(timeField?.supportType).not.toBe('direct')
    expect(timeField?.supportType).not.toBe('derived')
    expect(isRecipePublishable(shioMusubi)).toBe(false)
  })

  it('EP: 未解決のvariantId（空のdefiningCharacteristics）を持つRecipeはpublishできない', () => {
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      recipeIdentity: makeIdentity({
        variantIdentity: { variantId: '', canonicalDishId: 'x', definingCharacteristics: [] },
      }),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['s1'], supportType: 'direct' })),
    }
    const source = makeSource({ id: 's1' })
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('EQ: 特定variantでVERIFIEDにするには、そのvariantでも全critical fieldがsupportされている必要がある（medama-yakiはMISSION 2.14BでREVIEWへ差し戻されたため、合成fixtureで確認）', () => {
    const recipe = makeRecipe({ id: 'eq-complete-r1', requiredIngredients: [ri('鮭', '1切れ')] })
    const source = makeSource({ id: 'eq-complete-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['eq-complete-s1'],
      recipeIdentity: makeIdentity({
        variantIdentity: { variantId: 'eq-established-variant', definingCharacteristics: ['明確な調理法の違い'] },
      }),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({
        field,
        sourceIds: ['eq-complete-s1'],
        supportType: 'direct',
      })),
      coherenceReview: makeCoherentReview('eq-complete-s1'),
    }
    const testRecipe = { ...recipe, verification }
    const coveredFields = new Set((verification.fieldVerifications ?? []).map((fv) => fv.field))
    for (const field of applicableFieldsFor(testRecipe)) {
      expect(coveredFields.has(field)).toBe(true)
    }
    expect(isRecipePublishable(testRecipe, [source])).toBe(true)
  })

  it('ER: Starter Set内Recipeのsource idsはすべてEVIDENCE_SOURCE_CATALOGに存在する', () => {
    for (const recipe of RECIPE_CATALOG) {
      for (const sourceId of recipe.verification?.sourceIds ?? []) {
        expect(getEvidenceSourceById(sourceId), `${recipe.id}: sourceId「${sourceId}」が存在しない`).toBeDefined()
      }
    }
  })

  it('ES: VERIFIED状態のRecipeはhasUnsupportedInferenceがtrueにならない', () => {
    for (const recipe of RECIPE_CATALOG) {
      if (recipe.verification?.status === 'verified') {
        expect(recipe.verification.hasUnsupportedInference).not.toBe(true)
      }
    }
  })

  it('ET: isRecipePublishableは唯一のPublic Gateであり続ける（Variant/Coherence関連フィールドを追加してもGate関数は同一の結論を返す。medama-yakiはMISSION 2.14B CorrectionによりREVIEWへ差し戻されたため、trueの例は合成fixtureで確認する）', () => {
    const recipe = makeRecipe({ id: 'et-complete-r1', requiredIngredients: [ri('鮭', '1切れ')] })
    const source = makeSource({ id: 'et-complete-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['et-complete-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({
        field,
        sourceIds: ['et-complete-s1'],
        supportType: 'direct',
      })),
      coherenceReview: makeCoherentReview('et-complete-s1'),
    }
    const medamaYaki = RECIPE_CATALOG.find((r) => r.id === 'medama-yaki')!
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(true)
    expect(isRecipePublishable(medamaYaki)).toBe(false)
  })

  it('EU: Allergy HARD EXCLUSIONはVariant Foundation追加後も無傷', () => {
    const medamaYaki = RECIPE_CATALOG.find((r) => r.id === 'medama-yaki')!
    expect(allergyRelevantIngredients(medamaYaki)).toEqual(['卵', '油'])
    const result = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['卵'],
      allergyNames: ['卵'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(result.some((c) => c.recipe.id === 'medama-yaki')).toBe(false)
  })

  it('EV: Candidate A/B判定はVariant Foundation追加後も無傷', () => {
    const result = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['卵'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(result.find((c) => c.recipe.id === 'medama-yaki')?.category).toBe('A')
  })

  it('EW: PHASE Aのmax3候補提示はVariant Foundation追加後も無傷', () => {
    expect(BETA_MAX_CANDIDATES).toBe(3)
    expect(selectBetaCandidates([1, 2, 3, 4, 5])).toEqual([1, 2, 3])
  })

  it('EX: Family Share（共有文）はVariant Foundation追加後も無傷', () => {
    const text = buildCandidateShareText({ title: '目玉焼き', estimatedMinutes: 5 })
    expect(text).toContain('目玉焼き')
    expect(text).not.toContain('検証済み')
  })

  it('EY: MealDecisionはVariant Foundation追加後も最小限のfieldのみ保持する', () => {
    const decision = buildMealDecision({
      recipeId: 'medama-yaki',
      candidateType: 'A',
      selectedMemberIds: ['self'],
      decidedAt: '2026-08-28T00:00:00.000Z',
    })
    expect(Object.keys(decision).sort()).toEqual(['candidateType', 'decidedAt', 'recipeId', 'selectedMemberIds'].sort())
  })

  it('EZ: Feedbackの型はVariant Foundation追加後も変化しない（recipeId/recordedAt/ratingのみ）', () => {
    const feedback = { recipeId: 'medama-yaki', recordedAt: '2026-08-28T00:00:00.000Z', rating: 'good' as const }
    expect(Object.keys(feedback).sort()).toEqual(['recipeId', 'recordedAt', 'rating'].sort())
  })

  it('FA: Global locale/canonical-food基盤はVariant Foundation追加後も無傷（rice_raw≠rice_cooked）', () => {
    const jaJP = { language: 'ja', country: 'JP' }
    expect(resolveCanonicalFoodId('米', jaJP)).toBe('rice_raw')
    expect(resolveCanonicalFoodId('ごはん', jaJP)).toBe('rice_cooked')
  })

  it('FB: shio-musubiは未解決rangeが残るためREVIEWのまま', () => {
    const shioMusubi = RECIPE_CATALOG.find((r) => r.id === 'shio-musubi')!
    expect(shioMusubi.verification?.status).toBe('review')
    expect(hasUnresolvedRangeEvidence(shioMusubi)).toBe(true)
  })

  it('FC: medama-yakiはMISSION 2.14B Recipe Coherence CorrectionによりREVIEWへ差し戻された（seasoningsがNHKの実際のsource内容と矛盾していたため）', () => {
    const medamaYaki = RECIPE_CATALOG.find((r) => r.id === 'medama-yaki')!
    expect(medamaYaki.verification?.status).toBe('review')
    expect(medamaYaki.verification?.coherenceReview?.status).toBe('incoherent')
  })

  it('FD: Beta Publishable Starterは現在0件（medama-yaki・sake-shioyakiともにMISSION 2.14/2.14B CORRECTIONによりREVIEWへ差し戻されたため）', () => {
    expect(getBetaPublishableStarterRecipes().map((r) => r.id)).toEqual([])
  })

  it('FE: 数値conflictを解消するためだけに作られたvariantは確立されない（gyudonのconflictを模した架空のvariant試行）', () => {
    const fakeVariantAttempt = isEstablishedVariant({
      variantId: 'gyudon-fake-sweet-variant',
      definingCharacteristics: ['砂糖が多いだけ'],
      dimensionKinds: ['numeric-difference'],
      sourceIds: ['kikkoman-gyudon-2026', 'sirogohan-gyudon-2026'],
      hasExplicitAuthoritativeSource: false,
      createdOnlyToResolveConflict: true,
    })
    expect(fakeVariantAttempt).toBe(false)

    const gyudon = RECIPE_CATALOG.find((r) => r.id === 'gyudon')!
    expect(gyudon.verification?.recipeIdentity?.variantIdentity).toBeUndefined()
    expect(isRecipePublishable(gyudon)).toBe(false)
  })

  it('FF: RecipeVariantIdentityは通常のプレーンデータとして正しくラウンドトリップする（JSON化しても情報が失われない）', () => {
    const sakeShioyaki = RECIPE_CATALOG.find((r) => r.id === 'sake-shioyaki')!
    const variantIdentity = sakeShioyaki.verification?.recipeIdentity?.variantIdentity!
    const roundTripped = JSON.parse(JSON.stringify(variantIdentity))
    expect(roundTripped).toEqual(variantIdentity)
    expect(roundTripped.variantId).toBe('sake-shioyaki-grill-no-oil')
  })

  // ============================================================
  // MISSION 2.13 SAFE CHECKPOINT COMMIT — Publishability Gate Audit (A〜J)
  // isRecipePublishable()に変更を加えたため、legacy挙動（variantIdentity未設定）
  // が無傷であること、およびVariant関連の新しい分岐が一切のbypassを作らないことを
  // 個別に確認する。
  // ============================================================

  it('FG (A): variantIdentity未設定のRecipeはlegacy挙動のまま（完全に解決していれば、かつMISSION 2.14B以降はCoherence Reviewも揃っていればpublishable）', () => {
    const recipe = makeRecipe({ id: 'legacy-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'legacy-s1' })
    const fieldVerifications = applicableFieldsFor(recipe).map((field) => ({
      field,
      sourceIds: ['legacy-s1'],
      supportType: 'direct' as const,
    }))
    const verificationWithoutCoherence: RecipeVerification = {
      status: 'verified',
      sourceIds: ['legacy-s1'],
      recipeIdentity: makeIdentity(), // variantIdentityを設定しない
      fieldVerifications,
    }
    // MISSION 2.14B: Field Evidenceが全解決していてもCoherence Reviewがなければpublishできない
    expect(isRecipePublishable({ ...recipe, verification: verificationWithoutCoherence }, [source])).toBe(false)

    const verificationWithCoherence: RecipeVerification = {
      ...verificationWithoutCoherence,
      coherenceReview: makeCoherentReview('legacy-s1'),
    }
    expect(isRecipePublishable({ ...recipe, verification: verificationWithCoherence }, [source])).toBe(true)
  })

  it('FH (B): 空のvariantIdまたは空のdefiningCharacteristicsを持つvariantIdentityはどちらの組み合わせでもpublishableにならない', () => {
    const recipe = makeRecipe({ id: 'hollow-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'hollow-s1' })
    const baseFieldVerifications = applicableFieldsFor(recipe).map((field) => ({
      field,
      sourceIds: ['hollow-s1'],
      supportType: 'direct' as const,
    }))

    const emptyVariantId: RecipeVerification = {
      status: 'verified',
      sourceIds: ['hollow-s1'],
      recipeIdentity: makeIdentity({
        variantIdentity: { variantId: '', definingCharacteristics: ['特徴はある'] },
      }),
      fieldVerifications: baseFieldVerifications,
    }
    expect(isRecipePublishable({ ...recipe, verification: emptyVariantId }, [source])).toBe(false)

    const emptyCharacteristics: RecipeVerification = {
      status: 'verified',
      sourceIds: ['hollow-s1'],
      recipeIdentity: makeIdentity({
        variantIdentity: { variantId: 'valid-id', definingCharacteristics: [] },
      }),
      fieldVerifications: baseFieldVerifications,
    }
    expect(isRecipePublishable({ ...recipe, verification: emptyCharacteristics }, [source])).toBe(false)
  })

  it('FI (D): unresolved-between-variantsとタグ付けされたfieldはpublishableにならない（タグはsupportType判定を迂回しない）', () => {
    const recipe = makeRecipe({ id: 'unresolved-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'unresolved-s1' })
    const fieldVerifications = applicableFieldsFor(recipe).map((field) =>
      field === 'cookingTimeMinutes'
        ? { field, sourceIds: ['unresolved-s1'], variantRelation: 'unresolved-between-variants' as const }
        : { field, sourceIds: ['unresolved-s1'], supportType: 'direct' as const },
    )
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['unresolved-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications,
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('FJ (E): conflicting-within-variantとタグ付けされたfieldを持つRecipeはpublishableにならない（gyudonの実データで確認）', () => {
    const gyudon = RECIPE_CATALOG.find((r) => r.id === 'gyudon')!
    const conflictingFields = (gyudon.verification?.fieldVerifications ?? []).filter(
      (fv) => fv.variantRelation === 'conflicting-within-variant',
    )
    expect(conflictingFields.length).toBeGreaterThan(0)
    expect(isRecipePublishable(gyudon)).toBe(false)
  })

  it('FK (F): 正当なVariantに紐づいていても、未解決のRangeが残っていればpublishableにならない（sake-shioyakiのcookingTimeMinutesは既にrange解決済みのため、この一般則は合成fixtureで確認する）', () => {
    const recipe = makeRecipe({ id: 'variant-range-r1', requiredIngredients: [ri('鮭', '1切れ')] })
    const source = makeSource({ id: 'variant-range-s1' })
    const identity = makeIdentity({
      variantIdentity: {
        variantId: 'variant-range-established',
        definingCharacteristics: ['グリルで焼く（無油）'],
      },
    })
    const fieldVerifications = applicableFieldsFor(recipe).map((field) =>
      field === 'cookingTimeMinutes'
        ? { field, sourceIds: [source.id], supportType: 'range' as const, evidenceRange: { min: 4, max: 8, unit: '分' } }
        : { field, sourceIds: [source.id], supportType: 'direct' as const },
    )
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: [source.id],
      recipeIdentity: identity,
      fieldVerifications,
    }
    const testRecipe = { ...recipe, verification }
    expect(testRecipe.verification?.recipeIdentity?.variantIdentity).toBeDefined()
    expect(hasUnresolvedRangeEvidence(testRecipe)).toBe(true)
    expect(isRecipePublishable(testRecipe, [source])).toBe(false)
  })

  it('FL (G): 正当なVariantに紐づいていても、未解決のConflict（reviewNotes）が残っていればpublishableにならない', () => {
    const recipe = makeRecipe({ id: 'variant-conflict-r1', requiredIngredients: [ri('牛肉', '200g')] })
    const source = makeSource({ id: 'variant-conflict-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['variant-conflict-s1'],
      recipeIdentity: makeIdentity({
        variantIdentity: {
          variantId: 'valid-established-variant',
          definingCharacteristics: ['明確な調理法の違い'],
        },
      }),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({
        field,
        sourceIds: ['variant-conflict-s1'],
        supportType: 'direct',
      })),
      reviewNotes: ['未解決のConflictが残っている'],
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('FM (H): Product Decisionが存在していても、statusがverifiedでなければpublishableにならない（REVIEW→VERIFIEDへの昇格をProduct Decisionが代替しない）', () => {
    const recipe = makeRecipe({ id: 'pd-review-r1', requiredIngredients: [ri('鮭', '1切れ')] })
    const source = makeSource({ id: 'pd-review-s1' })
    const verification: RecipeVerification = {
      status: 'review',
      sourceIds: ['pd-review-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({
        field,
        sourceIds: ['pd-review-s1'],
        supportType: 'direct',
      })),
      productDecisions: [{ field: 'cookingTimeMinutes', value: '8分', reason: 'テスト用Product Decision' }],
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('FN (I/J): 正当なVariantに紐づき、かつ全applicable fieldが独立にEvidence解決済みであれば初めてpublishableになる（isRecipePublishableが唯一のGate）', () => {
    const recipe = makeRecipe({ id: 'variant-complete-r1', requiredIngredients: [ri('鮭', '1切れ')] })
    const source = makeSource({ id: 'variant-complete-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['variant-complete-s1'],
      recipeIdentity: makeIdentity({
        variantIdentity: {
          variantId: 'valid-established-variant-2',
          definingCharacteristics: ['明確な調理法の違い'],
        },
      }),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({
        field,
        sourceIds: ['variant-complete-s1'],
        supportType: 'direct',
      })),
      coherenceReview: makeCoherentReview('variant-complete-s1'),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(true)
  })

  it('FO: sake-shioyakiが現在publishできないのはRangeではなく、seasonings/criticalStepsのprocess不整合が未解決だからである（MISSION 2.14 CORRECTION — obsoleteなReview理由を主張しないための実データ回帰）', () => {
    const sakeShioyaki = RECIPE_CATALOG.find((r) => r.id === 'sake-shioyaki')!
    // cookingTimeMinutes自体はMISSION 2.14で正当にderived解決済み・rangeは残っていない
    const timeField = sakeShioyaki.verification?.fieldVerifications?.find((f) => f.field === 'cookingTimeMinutes')
    expect(timeField?.supportType).toBe('derived')
    expect(hasUnresolvedRangeEvidence(sakeShioyaki)).toBe(false)
    // 未解決の原因はseasonings/seasoningAmounts/criticalStepsのsupportType未設定（process不整合）
    const seasonings = sakeShioyaki.verification?.fieldVerifications?.find((f) => f.field === 'seasonings')
    const seasoningAmounts = sakeShioyaki.verification?.fieldVerifications?.find((f) => f.field === 'seasoningAmounts')
    const criticalSteps = sakeShioyaki.verification?.fieldVerifications?.find((f) => f.field === 'criticalSteps')
    expect(seasonings?.supportType).toBeUndefined()
    expect(seasoningAmounts?.supportType).toBeUndefined()
    expect(criticalSteps?.supportType).toBeUndefined()
    expect(seasonings?.variantRelation).toBe('unresolved-between-variants')
    expect(criticalSteps?.variantRelation).toBe('unresolved-between-variants')
    expect(sakeShioyaki.verification?.status).toBe('review')
    expect(isRecipePublishable(sakeShioyaki)).toBe(false)
  })
})
