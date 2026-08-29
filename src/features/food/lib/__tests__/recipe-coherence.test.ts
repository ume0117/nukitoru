// ============================================================
// recipe-coherence.test.ts
//
// MISSION 2.14B — Recipe Coherence Gate Foundation (GA〜).
//
// MISSION 2.14/2.14Aで、sake-shioyaki・medama-yakiの2件について、各Critical
// FieldにField Evidenceが個別に存在していても、複数sourceの異なる調理process
// を組み合わせることで「どのEvidence Sourceにも実在しないSynthetic Recipe」が
// VERIFIEDになり得るという問題が確認された。本ファイルは、新設した
// RecipeCoherenceReview / isCoherenceReviewValid() が、この再発を機械的に
// 防ぐことを固定化する。Field Evidence・Variant・Product Decision・Range・
// Conflictの既存ゲートとの独立性（firewall）も併せて確認する。
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type {
  Recipe,
  RecipeEvidenceSource,
  RecipeIdentity,
  RecipeIngredient,
  RecipeVerification,
} from '@/features/food/types'
import {
  isRecipePublishable,
  isCoherenceReviewValid,
  hasUnresolvedCoherenceReview,
  hasUnresolvedRangeEvidence,
  applicableFieldsFor,
} from '../recipe-publishability'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { getEvidenceSourceById } from '../evidence-sources'
import { allergyRelevantIngredients } from '../recipe-safety'
import { rankRecipes } from '../recipe-suggestion-engine'
import { selectBetaCandidates, BETA_MAX_CANDIDATES } from '../beta-presentation'
import { buildMealDecision, recordMealFeedback, loadMealFeedback } from '../storage'
import { buildCandidateShareText } from '../family-share'
import { getBetaPublishableStarterRecipes } from '../starter-set'
import { resolveCanonicalFoodId } from '../canonical-food'
import { isEstablishedVariant } from '../recipe-variant'

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

function makeCoherentReview(sourceId: string): RecipeVerification['coherenceReview'] {
  return {
    status: 'coherent',
    sourceProcessNotes: [{ sourceId, equipment: 'テスト器具', heatSequence: '単一source内で一貫した加熱' }],
    reviewedDimensions: ['equipment', 'heat-sequence'],
    rationale: 'テスト用: 単一sourceのみが全fieldを支持しており、process不整合の余地がない。',
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

describe('Recipe Coherence Gate Foundation (GA〜)', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })
  afterEach(() => {
    removeFakeWindow()
  })

  // ---- 1〜4: 実データ回帰（medama-yaki / sake-shioyaki） ----

  it('GA: medama-yakiはMISSION 2.14B CorrectionによりREVIEWである', () => {
    const medamaYaki = RECIPE_CATALOG.find((r) => r.id === 'medama-yaki')!
    expect(medamaYaki.verification?.status).toBe('review')
  })

  it('GB: medama-yakiはpublishableではない', () => {
    const medamaYaki = RECIPE_CATALOG.find((r) => r.id === 'medama-yaki')!
    expect(isRecipePublishable(medamaYaki)).toBe(false)
  })

  it('GC: sake-shioyakiはMISSION 2.14 CorrectionによりREVIEWである', () => {
    const sakeShioyaki = RECIPE_CATALOG.find((r) => r.id === 'sake-shioyaki')!
    expect(sakeShioyaki.verification?.status).toBe('review')
  })

  it('GD: sake-shioyakiはpublishableではない', () => {
    const sakeShioyaki = RECIPE_CATALOG.find((r) => r.id === 'sake-shioyaki')!
    expect(isRecipePublishable(sakeShioyaki)).toBe(false)
  })

  // ---- 5: Source Silence ----

  it('GE: 情報源の沈黙は否定的Evidenceにならない（medama-yakiのseasonings: キッコーマンが塩に沈黙していても「塩不使用」の直接支持にはならない）', () => {
    const medamaYaki = RECIPE_CATALOG.find((r) => r.id === 'medama-yaki')!
    const seasonings = medamaYaki.verification?.fieldVerifications?.find((f) => f.field === 'seasonings')
    // キッコーマンは「基本」method内で塩に一切言及しない（沈黙）が、それはsupportTypeを
    // direct/derivedにする根拠にならない。かつNHKは実際には塩・こしょうを使うと明示しており
    // 「塩味なし」を積極的に否定する。
    expect(seasonings?.sourceIds).toContain('kikkoman-medamayaki-tips-2026')
    expect(seasonings?.supportType).toBeUndefined()
  })

  // ---- 6〜13: Coherence Review自体の構造検証 ----

  it('GF: coherenceReview未設定（unreviewed相当）はpublicationをblockする', () => {
    const recipe = makeRecipe({ id: 'gf-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'gf-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gf-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['gf-s1'], supportType: 'direct' })),
      // coherenceReview未設定
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
    expect(hasUnresolvedCoherenceReview({ ...recipe, verification }, [source])).toBe(true)
  })

  it('GG: status="needs-review"はpublicationをblockする', () => {
    const recipe = makeRecipe({ id: 'gg-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'gg-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gg-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['gg-s1'], supportType: 'direct' })),
      coherenceReview: {
        status: 'needs-review',
        sourceProcessNotes: [{ sourceId: 'gg-s1' }],
        reviewedDimensions: ['equipment'],
        rationale: '情報不足のため判定できない。',
      },
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('GH: status="incoherent"はpublicationをblockする（medama-yaki/sake-shioyakiの実データで確認済み。ここでは合成fixtureで一般則を確認）', () => {
    const recipe = makeRecipe({ id: 'gh-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'gh-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gh-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['gh-s1'], supportType: 'direct' })),
      coherenceReview: {
        status: 'incoherent',
        sourceProcessNotes: [{ sourceId: 'gh-s1' }],
        reviewedDimensions: ['equipment'],
        rationale: '既知の非互換processが組み合わされている。',
      },
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('GI: status="coherent"かつ構造的要件を満たせばCoherence Gateを通過できる', () => {
    const recipe = makeRecipe({ id: 'gi-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'gi-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gi-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['gi-s1'], supportType: 'direct' })),
      coherenceReview: makeCoherentReview('gi-s1'),
    }
    expect(isCoherenceReviewValid({ ...recipe, verification }, [source])).toBe(true)
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(true)
  })

  it('GJ: coherent状態でもrationaleが空文字なら無効（naked boolean escape hatch禁止の一部）', () => {
    const recipe = makeRecipe({ id: 'gj-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'gj-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gj-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['gj-s1'], supportType: 'direct' })),
      coherenceReview: {
        status: 'coherent',
        sourceProcessNotes: [{ sourceId: 'gj-s1' }],
        reviewedDimensions: ['equipment'],
        rationale: '',
      },
    }
    expect(isCoherenceReviewValid({ ...recipe, verification }, [source])).toBe(false)
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('GK: coherent状態でもreviewedDimensionsが空なら無効', () => {
    const recipe = makeRecipe({ id: 'gk-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'gk-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gk-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['gk-s1'], supportType: 'direct' })),
      coherenceReview: {
        status: 'coherent',
        sourceProcessNotes: [{ sourceId: 'gk-s1' }],
        reviewedDimensions: [],
        rationale: '次元を比較せずcoherentと判定した（無効なはず）。',
      },
    }
    expect(isCoherenceReviewValid({ ...recipe, verification }, [source])).toBe(false)
  })

  it('GL: coherent状態でも、Field Evidenceに寄与する全sourceIdがsourceProcessNotesに含まれていなければ無効', () => {
    const recipe = makeRecipe({ id: 'gl-r1', requiredIngredients: [ri('米', '1合')] })
    const sourceA = makeSource({ id: 'gl-s1' })
    const sourceB = makeSource({ id: 'gl-s2' })
    const fieldVerifications = applicableFieldsFor(recipe).map((field, i) => ({
      field,
      sourceIds: [i % 2 === 0 ? 'gl-s1' : 'gl-s2'],
      supportType: 'direct' as const,
    }))
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gl-s1', 'gl-s2'],
      recipeIdentity: makeIdentity(),
      fieldVerifications,
      coherenceReview: {
        status: 'coherent',
        sourceProcessNotes: [{ sourceId: 'gl-s1' }], // gl-s2が漏れている
        reviewedDimensions: ['equipment'],
        rationale: 'gl-s2の寄与を見落としたcoherence判定（無効なはず）。',
      },
    }
    expect(isCoherenceReviewValid({ ...recipe, verification }, [sourceA, sourceB])).toBe(false)
    expect(isRecipePublishable({ ...recipe, verification }, [sourceA, sourceB])).toBe(false)
  })

  it('GM: sourceProcessNotesが参照するsourceIdがEVIDENCE_SOURCE_CATALOGに実在しない場合は無効', () => {
    const recipe = makeRecipe({ id: 'gm-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'gm-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gm-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['gm-s1'], supportType: 'direct' })),
      coherenceReview: {
        status: 'coherent',
        sourceProcessNotes: [{ sourceId: 'gm-nonexistent-source' }],
        reviewedDimensions: ['equipment'],
        rationale: '存在しないsourceIdを参照している（無効なはず）。',
      },
    }
    expect(getEvidenceSourceById('gm-nonexistent-source', [source])).toBeUndefined()
    expect(isCoherenceReviewValid({ ...recipe, verification }, [source])).toBe(false)
  })

  // ---- 14〜15: 複数source（互換 / 非互換）fixture ----

  it('GN: 複数sourceが互換なprocessを独立に文書化している場合、coherentとして扱えばpublishできる（multiple sources = forbiddenではないことの確認）', () => {
    const recipe = makeRecipe({ id: 'gn-r1', requiredIngredients: [ri('鮭', '1切れ')], equipment: ['フライパン'] })
    const sourceA = makeSource({ id: 'gn-s1' })
    const sourceB = makeSource({ id: 'gn-s2' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gn-s1', 'gn-s2'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({
        field,
        sourceIds: ['gn-s1', 'gn-s2'],
        supportType: 'direct',
      })),
      coherenceReview: {
        status: 'coherent',
        sourceProcessNotes: [
          { sourceId: 'gn-s1', equipment: 'フライパン', fatOrOil: 'なし', lid: 'なし', heatSequence: '中火→弱火' },
          { sourceId: 'gn-s2', equipment: 'フライパン', fatOrOil: 'なし', lid: 'なし', heatSequence: '中火→弱火' },
        ],
        reviewedDimensions: ['equipment', 'fat-or-oil', 'lid', 'heat-sequence'],
        rationale: '両sourceが独立にequipment/油/ふた/heat-sequenceについて同一のprocessを記述しており、矛盾しない。',
      },
    }
    expect(isRecipePublishable({ ...recipe, verification }, [sourceA, sourceB])).toBe(true)
  })

  it('GO: Source Aがふた+水、Source Bがふたなし+水なしという非互換processを組み合わせる場合はincoherentでありpublishできない', () => {
    const recipe = makeRecipe({ id: 'go-r1', requiredIngredients: [ri('卵', '1個')], equipment: ['フライパン'] })
    const sourceA = makeSource({ id: 'go-s1' })
    const sourceB = makeSource({ id: 'go-s2' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['go-s1', 'go-s2'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({
        field,
        sourceIds: ['go-s1', 'go-s2'],
        supportType: 'direct',
      })),
      coherenceReview: {
        status: 'incoherent',
        sourceProcessNotes: [
          { sourceId: 'go-s1', lid: 'ふたを使う（蒸し焼き）', liquidOrWater: '大さじ2の水を使う' },
          { sourceId: 'go-s2', lid: 'ふたを使わない', liquidOrWater: '水を使わない（乾式）' },
        ],
        reviewedDimensions: ['lid', 'liquid-or-water'],
        rationale: 'Source Aはふた+水を使う蒸し焼きprocess、Source Bはふたなし+水なしの乾式processであり、'
          + 'lid/liquid-or-waterの両次元で非互換。1つのRecipeとして組み合わせられない。',
      },
    }
    expect(isRecipePublishable({ ...recipe, verification }, [sourceA, sourceB])).toBe(false)
  })

  // ---- 16〜20: Field Evidence / Variant / Product Decisionとの独立性 ----

  it('GP: Field Evidenceが全解決していても、Coherence Reviewがなければpublishできない（Field EvidenceはCoherenceを含意しない）', () => {
    const recipe = makeRecipe({ id: 'gp-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'gp-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gp-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['gp-s1'], supportType: 'direct' })),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('GQ: Coherence Reviewがcoherentであっても、未支持のfield（supportType未設定）を支持済みにしない（CoherenceはField Evidenceを作らない）', () => {
    const recipe = makeRecipe({ id: 'gq-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'gq-s1' })
    const fieldVerifications = applicableFieldsFor(recipe).map((field) =>
      field === 'cookingTimeMinutes'
        ? { field, sourceIds: ['gq-s1'] } // supportType未設定
        : { field, sourceIds: ['gq-s1'], supportType: 'direct' as const },
    )
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gq-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications,
      coherenceReview: makeCoherentReview('gq-s1'),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('GR: 正当なVariantに紐づいていても、Coherence Reviewがなければpublishできない（VariantはCoherenceを含意しない）', () => {
    const recipe = makeRecipe({ id: 'gr-r1', requiredIngredients: [ri('鮭', '1切れ')] })
    const source = makeSource({ id: 'gr-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gr-s1'],
      recipeIdentity: makeIdentity({
        variantIdentity: { variantId: 'gr-established-variant', definingCharacteristics: ['明確な調理法の違い'] },
      }),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['gr-s1'], supportType: 'direct' })),
      // coherenceReview未設定
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('GS: Coherence Reviewがcoherentであっても、variantIdentityを自動的に確立しない（CoherenceはVariantを含意しない）', () => {
    const recipe = makeRecipe({ id: 'gs-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'gs-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gs-s1'],
      recipeIdentity: makeIdentity(), // variantIdentity未設定のまま
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['gs-s1'], supportType: 'direct' })),
      coherenceReview: makeCoherentReview('gs-s1'),
    }
    expect(verification.recipeIdentity?.variantIdentity).toBeUndefined()
    // isEstablishedVariantはcoherenceReviewを一切引数に取らない設計であること自体がfirewall
    expect(
      isEstablishedVariant({
        variantId: 'gs-fake-variant',
        definingCharacteristics: ['coherentだから確立'],
        dimensionKinds: ['numeric-difference'],
        sourceIds: [],
        hasExplicitAuthoritativeSource: false,
        createdOnlyToResolveConflict: false,
      }),
    ).toBe(false)
    // publishableにはなる（Field Evidence・Identity・Coherenceが揃っているため）が、それはVariant確立とは無関係
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(true)
  })

  it('GT: RecipeProductDecisionの存在はCoherenceを確立しない（isCoherenceReviewValidはproductDecisionsを一切参照しない）', () => {
    const recipe = makeRecipe({ id: 'gt-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'gt-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gt-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['gt-s1'], supportType: 'direct' })),
      productDecisions: [{ field: 'cookingTimeMinutes', value: '10分', reason: 'テスト用Product Decision' }],
      // coherenceReview未設定
    }
    expect(isCoherenceReviewValid({ ...recipe, verification }, [source])).toBe(false)
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  // ---- 21〜25: Range/Conflict/未支持field/Identity mismatch/Variant mismatchとの独立性 ----

  it('GU: coherentであっても未解決のRangeが残っていればpublishできない（Coherenceは何もrescueしない）', () => {
    const recipe = makeRecipe({ id: 'gu-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'gu-s1' })
    const fieldVerifications = applicableFieldsFor(recipe).map((field) =>
      field === 'cookingTimeMinutes'
        ? { field, sourceIds: ['gu-s1'], supportType: 'range' as const, evidenceRange: { min: 5, max: 10, unit: '分' } }
        : { field, sourceIds: ['gu-s1'], supportType: 'direct' as const },
    )
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gu-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications,
      coherenceReview: makeCoherentReview('gu-s1'),
    }
    expect(hasUnresolvedRangeEvidence({ ...recipe, verification })).toBe(true)
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('GV: coherentであっても未解決のConflict（reviewNotes）が残っていればpublishできない', () => {
    const recipe = makeRecipe({ id: 'gv-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'gv-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gv-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['gv-s1'], supportType: 'direct' })),
      coherenceReview: makeCoherentReview('gv-s1'),
      reviewNotes: ['未解決のConflictが残っている'],
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('GW: coherentであっても未支持のcritical fieldが1件でもあればpublishできない', () => {
    const recipe = makeRecipe({ id: 'gw-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'gw-s1' })
    const fieldVerifications = applicableFieldsFor(recipe).filter((f) => f !== 'servingsBase').map((field) => ({
      field,
      sourceIds: ['gw-s1'],
      supportType: 'direct' as const,
    }))
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gw-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications, // servingsBaseが欠落
      coherenceReview: makeCoherentReview('gw-s1'),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('GX: coherentであってもRecipe Identityが不完全ならpublishできない', () => {
    const recipe = makeRecipe({ id: 'gx-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'gx-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gx-s1'],
      recipeIdentity: makeIdentity({ coreMethod: '' }), // 不完全なIdentity
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['gx-s1'], supportType: 'direct' })),
      coherenceReview: makeCoherentReview('gx-s1'),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('GY: coherentであっても空のvariantIdentity（variant mismatch相当）が残っていればpublishできない', () => {
    const recipe = makeRecipe({ id: 'gy-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'gy-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['gy-s1'],
      recipeIdentity: makeIdentity({ variantIdentity: { variantId: '', definingCharacteristics: [] } }),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['gy-s1'], supportType: 'direct' })),
      coherenceReview: makeCoherentReview('gy-s1'),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  // ---- 26〜32: 既存機能の回帰確認 ----

  it('GZ: Allergy HARD EXCLUSIONはRecipe Coherence Gate追加後も無傷', () => {
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

  it('HA: Candidate A/B判定はRecipe Coherence Gate追加後も無傷（rankRecipesはisRecipePublishableを参照しない）', () => {
    const result = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['卵'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(result.find((c) => c.recipe.id === 'medama-yaki')?.category).toBe('A')
  })

  it('HB: max3候補提示（selectBetaCandidates）はRecipe Coherence Gate追加後も無傷', () => {
    expect(BETA_MAX_CANDIDATES).toBe(3)
    expect(selectBetaCandidates([1, 2, 3, 4, 5])).toEqual([1, 2, 3])
  })

  it('HC: Family Share（共有文）はRecipe Coherence Gate追加後も無傷', () => {
    const text = buildCandidateShareText({ title: '目玉焼き', estimatedMinutes: 5 })
    expect(text).toContain('目玉焼き')
    expect(text).not.toContain('検証済み')
  })

  it('HD: MealDecisionはRecipe Coherence Gate追加後も最小限のfieldのみ保持する', () => {
    const decision = buildMealDecision({
      recipeId: 'medama-yaki',
      candidateType: 'A',
      selectedMemberIds: ['self'],
      decidedAt: '2026-08-28T00:00:00.000Z',
    })
    expect(Object.keys(decision).sort()).toEqual(['candidateType', 'decidedAt', 'recipeId', 'selectedMemberIds'].sort())
  })

  it('HE: Feedbackの保存・読み込みはRecipe Coherence Gate追加後も無傷', () => {
    const before = loadMealFeedback().length
    const feedback = { recipeId: 'medama-yaki', recordedAt: '2026-08-28T00:00:00.000Z', rating: 'good' as const }
    recordMealFeedback(feedback)
    const after = loadMealFeedback()
    expect(after.length).toBe(before + 1)
    expect(after[after.length - 1]).toEqual(feedback)
  })

  it('HF: Global Foundation（canonical food id）はRecipe Coherence Gate追加後も無傷（rice_raw≠rice_cooked）', () => {
    const jaJP = { language: 'ja', country: 'JP' }
    expect(resolveCanonicalFoodId('米', jaJP)).toBe('rice_raw')
    expect(resolveCanonicalFoodId('ごはん', jaJP)).toBe('rice_cooked')
  })

  // ---- 33〜35: 移行・件数確認 ----

  it('HG: 既存44 Recipeのうち、coherenceReview.status==="coherent"であるものは0件（自動coherent移行は行っていない）', () => {
    const autoCoherent = RECIPE_CATALOG.filter((r) => r.verification?.coherenceReview?.status === 'coherent')
    expect(autoCoherent.length).toBe(0)
  })

  it('HH: MISSION 2.14B Correction後、現在VERIFIEDのRecipeは0件である', () => {
    const verified = RECIPE_CATALOG.filter((r) => r.verification?.status === 'verified')
    expect(verified.length).toBe(0)
  })

  it('HI: MISSION 2.14B Correction後、Beta Publishable Starter Setは空である', () => {
    expect(getBetaPublishableStarterRecipes()).toEqual([])
  })

  // ============================================================
  // MISSION 2.14B — FINAL COHERENCE ATTESTATION HARDENING (HJ〜HS)
  //
  // Pre-Checkpoint Diff Auditで発見された「低情報のcoherent宣言が通ってしまう」
  // 欠陥（sourceProcessNotesにsourceIdしかなくても、rationaleとreviewedDimensions
  // さえ非空ならcoherentとして通ってしまう）を修正したことを固定化する。
  // ============================================================

  it('HJ (A): reviewedDimensions=[equipment]だが、SourceProcessNoteにequipment factが一切ないcoherent宣言は無効', () => {
    const recipe = makeRecipe({ id: 'hj-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'hj-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['hj-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['hj-s1'], supportType: 'direct' })),
      coherenceReview: {
        status: 'coherent',
        sourceProcessNotes: [{ sourceId: 'hj-s1' }], // equipment未記入
        reviewedDimensions: ['equipment'],
        rationale: 'compatible',
      },
    }
    expect(isCoherenceReviewValid({ ...recipe, verification }, [source])).toBe(false)
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('HK (B): equipmentが空文字の場合も無効', () => {
    const recipe = makeRecipe({ id: 'hk-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'hk-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['hk-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['hk-s1'], supportType: 'direct' })),
      coherenceReview: {
        status: 'coherent',
        sourceProcessNotes: [{ sourceId: 'hk-s1', equipment: '' }],
        reviewedDimensions: ['equipment'],
        rationale: 'compatible',
      },
    }
    expect(isCoherenceReviewValid({ ...recipe, verification }, [source])).toBe(false)
  })

  it('HL (C): equipmentが空白のみの場合も無効', () => {
    const recipe = makeRecipe({ id: 'hl-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'hl-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['hl-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['hl-s1'], supportType: 'direct' })),
      coherenceReview: {
        status: 'coherent',
        sourceProcessNotes: [{ sourceId: 'hl-s1', equipment: '   ' }],
        reviewedDimensions: ['equipment'],
        rationale: 'compatible',
      },
    }
    expect(isCoherenceReviewValid({ ...recipe, verification }, [source])).toBe(false)
  })

  it('HM (D): equipmentに意味のある非空factが記入されていればdimension coverageは通過しうる', () => {
    const recipe = makeRecipe({ id: 'hm-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'hm-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['hm-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['hm-s1'], supportType: 'direct' })),
      coherenceReview: {
        status: 'coherent',
        sourceProcessNotes: [{ sourceId: 'hm-s1', equipment: '炊飯器' }],
        reviewedDimensions: ['equipment'],
        rationale: 'compatible',
      },
    }
    expect(isCoherenceReviewValid({ ...recipe, verification }, [source])).toBe(true)
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(true)
  })

  it('HN (E): reviewedDimensions=[equipment, heat-sequence]だがheatSequenceが未記入なら無効（equipmentのみ埋めても不十分）', () => {
    const recipe = makeRecipe({ id: 'hn-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'hn-s1' })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['hn-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['hn-s1'], supportType: 'direct' })),
      coherenceReview: {
        status: 'coherent',
        sourceProcessNotes: [{ sourceId: 'hn-s1', equipment: '炊飯器' }], // heatSequence未記入
        reviewedDimensions: ['equipment', 'heat-sequence'],
        rationale: 'compatible',
      },
    }
    expect(isCoherenceReviewValid({ ...recipe, verification }, [source])).toBe(false)
  })

  it('HO (F): 2つのcritical contributing sourceのうち1つでもequipment factを欠けば無効', () => {
    const recipe = makeRecipe({ id: 'ho-r1', requiredIngredients: [ri('米', '1合')] })
    const sourceA = makeSource({ id: 'ho-s1' })
    const sourceB = makeSource({ id: 'ho-s2' })
    const fields = applicableFieldsFor(recipe)
    const fieldVerifications = fields.map((field, i) => ({
      field,
      sourceIds: [i % 2 === 0 ? 'ho-s1' : 'ho-s2'],
      supportType: 'direct' as const,
    }))
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['ho-s1', 'ho-s2'],
      recipeIdentity: makeIdentity(),
      fieldVerifications,
      coherenceReview: {
        status: 'coherent',
        sourceProcessNotes: [
          { sourceId: 'ho-s1', equipment: '鍋' },
          { sourceId: 'ho-s2' }, // equipment未記入
        ],
        reviewedDimensions: ['equipment'],
        rationale: '両source互換のはずだったが、s2にequipment factが記入されていない。',
      },
    }
    expect(isCoherenceReviewValid({ ...recipe, verification }, [sourceA, sourceB])).toBe(false)
  })

  it('HP (G): 2つのcritical contributing sourceの両方がequipment factを持てばdimension coverageは通過しうる', () => {
    const recipe = makeRecipe({ id: 'hp-r1', requiredIngredients: [ri('米', '1合')] })
    const sourceA = makeSource({ id: 'hp-s1' })
    const sourceB = makeSource({ id: 'hp-s2' })
    const fields = applicableFieldsFor(recipe)
    const fieldVerifications = fields.map((field, i) => ({
      field,
      sourceIds: [i % 2 === 0 ? 'hp-s1' : 'hp-s2'],
      supportType: 'direct' as const,
    }))
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['hp-s1', 'hp-s2'],
      recipeIdentity: makeIdentity(),
      fieldVerifications,
      coherenceReview: {
        status: 'coherent',
        sourceProcessNotes: [
          { sourceId: 'hp-s1', equipment: '鍋' },
          { sourceId: 'hp-s2', equipment: '鍋' },
        ],
        reviewedDimensions: ['equipment'],
        rationale: '両sourceが独立に同一equipment（鍋）を明示しており矛盾しない。',
      },
    }
    expect(isCoherenceReviewValid({ ...recipe, verification }, [sourceA, sourceB])).toBe(true)
    expect(isRecipePublishable({ ...recipe, verification }, [sourceA, sourceB])).toBe(true)
  })

  it('HQ (H): unreviewed/needs-review/incoherentの挙動はdimension coverage強化後も無傷（そもそもstatusチェックで先にfalseになる）', () => {
    const recipe = makeRecipe({ id: 'hq-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'hq-s1' })
    const baseVerification = {
      status: 'verified' as const,
      sourceIds: ['hq-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['hq-s1'], supportType: 'direct' as const })),
    }
    for (const status of ['unreviewed', 'needs-review', 'incoherent'] as const) {
      const verification: RecipeVerification = {
        ...baseVerification,
        coherenceReview: {
          status,
          sourceProcessNotes: [{ sourceId: 'hq-s1', equipment: '完全に記入済み' }],
          reviewedDimensions: ['equipment'],
          rationale: '完全な記入があってもstatusがcoherentでなければ無効。',
        },
      }
      expect(isCoherenceReviewValid({ ...recipe, verification }, [source])).toBe(false)
    }
  })

  it('HR (I): Range/Conflict/Field EvidenceのfirewallはFINAL HARDENING後も無傷', () => {
    const recipe = makeRecipe({ id: 'hr-r1', requiredIngredients: [ri('米', '1合')] })
    const source = makeSource({ id: 'hr-s1' })
    const fullyDocumentedCoherence: NonNullable<RecipeVerification['coherenceReview']> = {
      status: 'coherent',
      sourceProcessNotes: [{ sourceId: 'hr-s1', equipment: '完全に記入済み' }],
      reviewedDimensions: ['equipment'],
      rationale: '単一sourceで矛盾なし。',
    }
    // Range
    const rangeFvs = applicableFieldsFor(recipe).map((field) =>
      field === 'cookingTimeMinutes'
        ? { field, sourceIds: ['hr-s1'], supportType: 'range' as const, evidenceRange: { min: 1, max: 2, unit: '分' } }
        : { field, sourceIds: ['hr-s1'], supportType: 'direct' as const },
    )
    expect(
      isRecipePublishable(
        { ...recipe, verification: { status: 'verified', sourceIds: ['hr-s1'], recipeIdentity: makeIdentity(), fieldVerifications: rangeFvs, coherenceReview: fullyDocumentedCoherence } },
        [source],
      ),
    ).toBe(false)
    // Conflict (reviewNotes)
    expect(
      isRecipePublishable(
        {
          ...recipe,
          verification: {
            status: 'verified',
            sourceIds: ['hr-s1'],
            recipeIdentity: makeIdentity(),
            fieldVerifications: applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['hr-s1'], supportType: 'direct' as const })),
            coherenceReview: fullyDocumentedCoherence,
            reviewNotes: ['未解決のConflict'],
          },
        },
        [source],
      ),
    ).toBe(false)
    // 未支持のcritical field
    const missingFvs = applicableFieldsFor(recipe).filter((f) => f !== 'servingsBase').map((field) => ({
      field,
      sourceIds: ['hr-s1'],
      supportType: 'direct' as const,
    }))
    expect(
      isRecipePublishable(
        { ...recipe, verification: { status: 'verified', sourceIds: ['hr-s1'], recipeIdentity: makeIdentity(), fieldVerifications: missingFvs, coherenceReview: fullyDocumentedCoherence } },
        [source],
      ),
    ).toBe(false)
  })

  it('HS (J): Source Silence原則はSourceProcessNoteの記入にも適用される（EVIDENCE_POLICY.mdに捏造禁止の明文規定があることを確認する。自動NLP検証は行わない）', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const policyPath = path.join(process.cwd(), 'src/features/food/EVIDENCE_POLICY.md')
    const content = fs.readFileSync(policyPath, 'utf-8')
    expect(content).toContain('SourceProcessNote')
    expect(content).toContain('捏造')
  })
})
