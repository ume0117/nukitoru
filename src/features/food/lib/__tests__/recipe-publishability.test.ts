import { describe, it, expect } from 'vitest'
import type {
  Recipe,
  RecipeEvidenceSource,
  RecipeVerification,
  RecipeIngredient,
  RecipeIdentity,
} from '@/features/food/types'
import {
  isValidVerificationStatus,
  isValidSourceType,
  isValidCheckedAt,
  isValidEvidenceSource,
  getVerificationStatus,
  applicableFieldsFor,
  isRecipePublishable,
  hasUnresolvedRangeEvidence,
} from '../recipe-publishability'
import { isPlaceholderUrl } from '../evidence-sources'
import { allergyRelevantIngredients } from '../recipe-safety'
import { rankRecipes } from '../recipe-suggestion-engine'
import { productCheckMessage } from '../product-check-messages'

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

/** MISSION 2.14B — 全applicable critical fieldが単一sourceのみを参照する場合の、
 *  process不整合の余地がないcoherent状態のCoherenceReviewを組み立てるテスト用ヘルパー。 */
function makeCoherentReview(sourceId: string): RecipeVerification['coherenceReview'] {
  return {
    status: 'coherent',
    sourceProcessNotes: [{ sourceId, equipment: 'テスト器具', heatSequence: '単一source内で一貫した加熱' }],
    reviewedDimensions: ['equipment', 'heat-sequence'],
    rationale: 'テスト用: 単一sourceのみが全fieldを支持しており、process不整合の余地がない。',
  }
}

/** applicableFieldsFor(recipe)を全てカバーするfieldVerificationsを生成するヘルパー（デフォルトdirect） */
function fullFieldVerifications(recipe: Recipe, sourceIds: string[], supportType: 'direct' | 'derived' = 'direct') {
  return applicableFieldsFor(recipe).map((field) => ({ field, sourceIds, supportType }))
}

// ============================================================
// MISSION 2.11 PHASE D.6 — No Guessing Gate (AQ〜BF)
// ============================================================

describe('recipe-publishability.ts — No Guessing Gate (AQ〜BF)', () => {
  it('AQ: verification statusが有効enumかどうかを判定できる', () => {
    expect(isValidVerificationStatus('unverified')).toBe(true)
    expect(isValidVerificationStatus('review')).toBe(true)
    expect(isValidVerificationStatus('verified')).toBe(true)
    expect(isValidVerificationStatus('blocked')).toBe(true)
    expect(isValidVerificationStatus('approved')).toBe(false)
    expect(isValidVerificationStatus('')).toBe(false)
  })

  it('AS: source URLが空の場合、isValidEvidenceSourceはfalseを返す', () => {
    expect(isValidEvidenceSource(makeSource({ id: 's1', url: '' }))).toBe(false)
    expect(isValidEvidenceSource(makeSource({ id: 's1', url: '   ' }))).toBe(false)
  })

  it('AT: publisherが空の場合、isValidEvidenceSourceはfalseを返す', () => {
    expect(isValidEvidenceSource(makeSource({ id: 's1', publisher: '' }))).toBe(false)
  })

  it('AU: titleが空の場合、isValidEvidenceSourceはfalseを返す', () => {
    expect(isValidEvidenceSource(makeSource({ id: 's1', title: '' }))).toBe(false)
  })

  it('AV: checkedAtが無効な場合、isValidEvidenceSourceはfalseを返す', () => {
    expect(isValidCheckedAt('')).toBe(false)
    expect(isValidCheckedAt('not-a-date')).toBe(false)
    expect(isValidCheckedAt('2026-08-28')).toBe(true)
    expect(isValidEvidenceSource(makeSource({ id: 's1', checkedAt: 'not-a-date' }))).toBe(false)
  })

  it('AW: sourceTypeが有効enumかどうかを判定できる', () => {
    expect(isValidSourceType('government')).toBe(true)
    expect(isValidSourceType('public-institution')).toBe(true)
    expect(isValidSourceType('manufacturer')).toBe(true)
    expect(isValidSourceType('professional')).toBe(true)
    expect(isValidSourceType('other-trusted')).toBe(true)
    expect(isValidSourceType('user-generated')).toBe(false)
  })

  it('AX: verified状態でreviewNotesが残っている場合、isRecipePublishableはfalseを返す', () => {
    const source = makeSource({ id: 's1' })
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      fieldVerifications: fullFieldVerifications(recipe, ['s1']),
      reviewNotes: ['水量についてsource間で差異あり、未解決'],
      recipeIdentity: makeIdentity(),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('AY: BLOCKED Recipeは本番候補として扱えない（isRecipePublishable=false）', () => {
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    expect(isRecipePublishable({ ...recipe, verification: { status: 'blocked', sourceIds: [] } })).toBe(false)
  })

  it('AZ: UNVERIFIED Recipeはpublishableにならない（Verified表示しない）', () => {
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    expect(getVerificationStatus(recipe)).toBe('unverified')
    expect(isRecipePublishable(recipe)).toBe(false)
  })

  it('BA: 根拠(source)なしのRecipeはverifiedであってもpublishableにできない', () => {
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    expect(isRecipePublishable({ ...recipe, verification: { status: 'verified', sourceIds: [] } })).toBe(false)
  })

  it('BB: 重要fieldのverificationが不足している場合、isRecipePublishableはfalseを返す', () => {
    const source = makeSource({ id: 's1' })
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      fieldVerifications: [{ field: 'requiredIngredients', sourceIds: ['s1'], supportType: 'direct' }], // 他のfieldが未カバー
      recipeIdentity: makeIdentity(),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('BC: source metadataとRecipe verification参照が破損している（実在しないsourceId）場合、falseを返す', () => {
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['does-not-exist'],
      fieldVerifications: fullFieldVerifications(recipe, ['does-not-exist']),
      recipeIdentity: makeIdentity(),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [])).toBe(false)
  })

  it('BD: 同一source idが重複している場合、falseを返す', () => {
    const source = makeSource({ id: 's1' })
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1', 's1'],
      fieldVerifications: fullFieldVerifications(recipe, ['s1']),
      recipeIdentity: makeIdentity(),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('BE: 架空URL・placeholder URLをproduction evidenceとして許可しない', () => {
    expect(isPlaceholderUrl('https://example.com/recipe')).toBe(true)
    expect(isPlaceholderUrl('https://foo.bar/recipe')).toBe(true)
    expect(isPlaceholderUrl('http://localhost:3000/recipe')).toBe(true)
    expect(isPlaceholderUrl('https://www.maff.go.jp/recipe/somepage')).toBe(false)

    const source = makeSource({ id: 's1', url: 'https://example.com/recipe' })
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      fieldVerifications: fullFieldVerifications(recipe, ['s1']),
      recipeIdentity: makeIdentity(),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('BF: AI推測をEvidenceとして登録できない（sourceType enumにAI/推測を表す値が存在しない）', () => {
    const invalidAiLikeValues = ['ai', 'ai-generated', 'inferred', 'model', 'assistant', 'claude', 'guess']
    for (const value of invalidAiLikeValues) {
      expect(isValidSourceType(value)).toBe(false)
    }
  })
})

// ============================================================
// MISSION 2.11 PHASE D.7-B — Evidence Resolution Protocol Gate (BQ〜BZ)
// ============================================================

describe('recipe-publishability.ts — Evidence Resolution Protocol Gate (BQ〜BZ)', () => {
  it('BQ: supportType=derivedなのにderivationが空の場合、isRecipePublishableはfalseを返す', () => {
    const source = makeSource({ id: 's1' })
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const fvs = fullFieldVerifications(recipe, ['s1'], 'derived') // derivation未設定
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      fieldVerifications: fvs,
      recipeIdentity: makeIdentity(),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('BQ-2: supportType=derivedでもderivationが記録されていればisRecipePublishableはtrueになりうる', () => {
    const source = makeSource({ id: 's1' })
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const fvs = applicableFieldsFor(recipe).map((field) => ({
      field,
      sourceIds: ['s1'],
      supportType: 'derived' as const,
      derivation: 'テスト用の導出根拠（前提・計算式を明記）',
    }))
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      fieldVerifications: fvs,
      recipeIdentity: makeIdentity(),
      coherenceReview: makeCoherentReview('s1'),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(true)
  })

  it('BR: supportType=rangeはderivationの有無に関わらずVERIFIEDの解決済みに絶対にカウントされない（rangeの無言exact値化禁止）', () => {
    const source = makeSource({ id: 's1' })
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })

    // derivationなしのrange
    const fvsNoDerivation = fullFieldVerifications(recipe, ['s1'], 'derived').map((fv) =>
      fv.field === 'cookingTimeMinutes' ? { ...fv, supportType: 'range' as const } : fv,
    )
    expect(
      isRecipePublishable(
        { ...recipe, verification: { status: 'verified', sourceIds: ['s1'], fieldVerifications: fvsNoDerivation, recipeIdentity: makeIdentity() } },
        [source],
      ),
    ).toBe(false)

    // MISSION 2.11 PHASE D.7-B.1 — derivation（明示的NUKITORU Product Policy）を
    // 付けても、supportType='range'である限りVERIFIEDの解決済みにはならない。
    // 「rangeの中央値を採用すればExact値のEvidence直接支持になる」という扱いを禁止する。
    const fvsWithDerivation = fullFieldVerifications(recipe, ['s1'], 'derived').map((fv) =>
      fv.field === 'cookingTimeMinutes'
        ? {
            ...fv,
            supportType: 'range' as const,
            derivation: 'rangeの中央値をNUKITORU Product Policyとして採用（それでもEvidence解決済みにはしない）',
            evidenceRange: { min: 40, max: 60, unit: '分' },
          }
        : fv,
    )
    expect(
      isRecipePublishable(
        { ...recipe, verification: { status: 'verified', sourceIds: ['s1'], fieldVerifications: fvsWithDerivation, recipeIdentity: makeIdentity() } },
        [source],
      ),
    ).toBe(false)
  })

  it('BS: 重要fieldにCONFLICT（未解決reviewNotes）が残る場合、VERIFIEDにならない', () => {
    const source = makeSource({ id: 's1' })
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      fieldVerifications: fullFieldVerifications(recipe, ['s1']),
      recipeIdentity: makeIdentity(),
      reviewNotes: ['seasoningsの量がsourceと大きく異なる（CONFLICT、未解決）'],
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('BT: 重要fieldがNOT_FOUND（fieldVerification自体が存在しない）場合、VERIFIEDにならない', () => {
    const source = makeSource({ id: 's1' })
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      fieldVerifications: [], // 全fieldがNOT_FOUND相当
      recipeIdentity: makeIdentity(),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('BU: Recipe Identityが未設定の場合、VERIFIEDにならない', () => {
    const source = makeSource({ id: 's1' })
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      fieldVerifications: fullFieldVerifications(recipe, ['s1']),
      // recipeIdentity未設定
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('BU-2: Recipe Identityの必須項目が空文字の場合もVERIFIEDにならない', () => {
    const source = makeSource({ id: 's1' })
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      fieldVerifications: fullFieldVerifications(recipe, ['s1']),
      recipeIdentity: makeIdentity({ coreMethod: '' }),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('BV: supportType=variant（またはsupportType未設定）のfieldは「解決済み」としてカウントされない', () => {
    const source = makeSource({ id: 's1' })
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const fvsVariant = fullFieldVerifications(recipe, ['s1'], 'derived').map((fv) =>
      fv.field === 'requiredIngredients' ? { ...fv, supportType: 'variant' as const } : fv,
    )
    const verificationVariant: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      fieldVerifications: fvsVariant,
      recipeIdentity: makeIdentity(),
    }
    expect(isRecipePublishable({ ...recipe, verification: verificationVariant }, [source])).toBe(false)

    const fvsUnset = applicableFieldsFor(recipe).map((field) => ({ field, sourceIds: ['s1'] })) // supportType未設定
    const verificationUnset: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      fieldVerifications: fvsUnset,
      recipeIdentity: makeIdentity(),
    }
    expect(isRecipePublishable({ ...recipe, verification: verificationUnset }, [source])).toBe(false)
  })

  it('BW: unsupported assumption（hasUnsupportedInference=true）はいかなる他条件が満たされていてもVERIFIEDを禁止する', () => {
    const source = makeSource({ id: 's1' })
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      fieldVerifications: fullFieldVerifications(recipe, ['s1']),
      recipeIdentity: makeIdentity(),
      hasUnsupportedInference: true,
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('BX: 全applicable fieldがdirect/derived(derivation付き)で解決されて初めてVERIFIEDになる（rangeは使わない）', () => {
    const source = makeSource({ id: 's1' })
    const recipe = makeRecipe({
      id: 'r1',
      requiredIngredients: [ri('米', '1合')],
      seasonings: [ri('塩', 'ひとつまみ')],
      equipment: ['炊飯器'],
    })
    const fvs = applicableFieldsFor(recipe).map((field) =>
      field === 'cookingTimeMinutes'
        ? {
            field,
            sourceIds: ['s1'],
            supportType: 'derived' as const,
            derivation: '複数の直接事実（機種の炊飯時間の公式実測値と手順時間）を単純合算した、range代表値選択を伴わない導出',
          }
        : { field, sourceIds: ['s1'], supportType: 'direct' as const },
    )
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      fieldVerifications: fvs,
      recipeIdentity: makeIdentity({ definingIngredients: ['米', '塩'] }),
      coherenceReview: makeCoherentReview('s1'),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(true)
  })
})

// ============================================================
// MISSION 2.11 PHASE D.7-B.1 — Evidence Range Integrity Gate (CA)
// ============================================================

describe('recipe-publishability.ts — Evidence Range Integrity Gate (CA)', () => {
  it('CA-1: hasUnresolvedRangeEvidenceは、rangeのfieldVerificationが1件でもあればtrueを返す', () => {
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const withRange: Recipe = {
      ...recipe,
      verification: {
        status: 'review',
        sourceIds: ['s1'],
        fieldVerifications: [
          { field: 'cookingTimeMinutes', sourceIds: ['s1'], supportType: 'range', derivation: '中央値採用' },
        ],
      },
    }
    expect(hasUnresolvedRangeEvidence(withRange)).toBe(true)

    const withoutRange: Recipe = {
      ...recipe,
      verification: {
        status: 'review',
        sourceIds: ['s1'],
        fieldVerifications: [{ field: 'cookingTimeMinutes', sourceIds: ['s1'], supportType: 'direct' }],
      },
    }
    expect(hasUnresolvedRangeEvidence(withoutRange)).toBe(false)
  })

  it('CA-2: verification未設定・fieldVerifications未設定でもエラーにならずfalseを返す', () => {
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    expect(hasUnresolvedRangeEvidence(recipe)).toBe(false)
  })

  it('CA-3: productDecisionsはEvidence解決には一切使われない（productDecisionsだけでは絶対にVERIFIEDにならない）', () => {
    const source = makeSource({ id: 's1' })
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      fieldVerifications: [], // productDecisionsだけで埋めても解決済みにはならない
      recipeIdentity: makeIdentity(),
      productDecisions: [
        {
          field: 'cookingTimeMinutes',
          value: '60分',
          reason: 'rangeの中央値+付随工程時間を採用（Product Decisionであり、Evidence直接支持ではない）',
          referenceSourceIds: ['s1'],
        },
      ],
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })
})

// ============================================================
// MISSION 2.11 PHASE D.6 — Provenance Tests (P1〜P14)
// ============================================================

describe('recipe-publishability.ts — Provenance Tests (P1〜P14)', () => {
  it('P1: UNVERIFIEDはpublishable=false', () => {
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    expect(isRecipePublishable(recipe)).toBe(false)
  })

  it('P2: REVIEWはpublishable=false', () => {
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    expect(isRecipePublishable({ ...recipe, verification: { status: 'review', sourceIds: [] } })).toBe(false)
  })

  it('P3: BLOCKEDはpublishable=false', () => {
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    expect(isRecipePublishable({ ...recipe, verification: { status: 'blocked', sourceIds: [] } })).toBe(false)
  })

  it('P4: VERIFIED + valid evidence（全field網羅）はpublishable=true', () => {
    const source = makeSource({ id: 's1' })
    const recipe = makeRecipe({
      id: 'r1',
      requiredIngredients: [ri('米', '1合')],
      seasonings: [ri('塩', '少々')],
      equipment: ['炊飯器'],
    })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      fieldVerifications: fullFieldVerifications(recipe, ['s1']),
      recipeIdentity: makeIdentity({ definingIngredients: ['米', '塩'] }),
      coherenceReview: makeCoherentReview('s1'),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(true)
  })

  it('P5: VERIFIED + no sourceはfalse', () => {
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    expect(isRecipePublishable({ ...recipe, verification: { status: 'verified', sourceIds: [] } })).toBe(false)
  })

  it('P6: VERIFIED + incomplete critical field verificationはfalse', () => {
    const source = makeSource({ id: 's1' })
    const recipe = makeRecipe({
      id: 'r1',
      requiredIngredients: [ri('米', '1合')],
      seasonings: [ri('塩', '少々')],
    })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      fieldVerifications: [{ field: 'requiredIngredients', sourceIds: ['s1'], supportType: 'direct' }], // seasonings等が未カバー
      recipeIdentity: makeIdentity(),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('P7: invalid source参照（実在しないid）はfalse', () => {
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['ghost'],
      fieldVerifications: fullFieldVerifications(recipe, ['ghost']),
      recipeIdentity: makeIdentity(),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [])).toBe(false)
  })

  it('P8: duplicate source idを検出しfalseを返す', () => {
    const source = makeSource({ id: 's1' })
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1', 's1'],
      fieldVerifications: fullFieldVerifications(recipe, ['s1']),
      recipeIdentity: makeIdentity(),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('P9: placeholder URLを検出しfalseを返す', () => {
    const source = makeSource({ id: 's1', url: 'https://example.com/dummy' })
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      fieldVerifications: fullFieldVerifications(recipe, ['s1']),
      recipeIdentity: makeIdentity(),
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('P10: unsupported inference markerがあればfalse（他の条件が全て満たされていても）', () => {
    const source = makeSource({ id: 's1' })
    const recipe = makeRecipe({ id: 'r1', requiredIngredients: [ri('米', '1合')] })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['s1'],
      fieldVerifications: fullFieldVerifications(recipe, ['s1']),
      recipeIdentity: makeIdentity(),
      hasUnsupportedInference: true,
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })

  it('P11: 既存のAllergy HARD EXCLUSIONはverificationフィールドの有無に影響されない', () => {
    const source = makeSource({ id: 's1' })
    const recipeWithoutVerification = makeRecipe({
      id: 'egg-dish',
      requiredIngredients: [ri('卵', '1個')],
    })
    const recipeWithVerification: Recipe = {
      ...recipeWithoutVerification,
      verification: { status: 'verified', sourceIds: ['s1'] },
    }
    expect(allergyRelevantIngredients(recipeWithoutVerification)).toEqual(
      allergyRelevantIngredients(recipeWithVerification),
    )
    // どちらもverificationの有無に関わらずHARD EXCLUSIONは同一に働く
    const params = { availableIngredientNames: ['卵'], allergyNames: ['卵'], dislikeNames: [], maxCookingMinutes: null }
    expect(rankRecipes([recipeWithoutVerification], params)).toEqual([])
    expect(rankRecipes([recipeWithVerification], params)).toEqual([])
  })

  it('P12: A/B candidate rankingはverificationフィールドの有無に影響されない', () => {
    const recipeWithoutVerification = makeRecipe({
      id: 'tofu-dish',
      requiredIngredients: [ri('豆腐', '1/2丁')],
    })
    const recipeWithVerification: Recipe = {
      ...recipeWithoutVerification,
      verification: { status: 'unverified', sourceIds: [] },
    }
    const params = { availableIngredientNames: ['豆腐'], allergyNames: [], dislikeNames: [], maxCookingMinutes: null }
    const resultWithout = rankRecipes([recipeWithoutVerification], params)
    const resultWith = rankRecipes([recipeWithVerification], params)
    expect(resultWith[0].category).toBe(resultWithout[0].category)
    expect(resultWith[0].missingIngredients).toEqual(resultWithout[0].missingIngredients)
  })

  it('P13: CookingLiquidの候補判定非影響はverification追加後も維持される', () => {
    const recipe: Recipe = {
      ...makeRecipe({ id: 'soup-dish', requiredIngredients: [ri('豆腐', '1/2丁')] }),
      cookingLiquids: [{ name: '水', amount: '400ml' }],
      verification: { status: 'verified', sourceIds: [] },
    }
    const result = rankRecipes([recipe], {
      availableIngredientNames: ['豆腐'],
      allergyNames: ['水'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(result).toHaveLength(1)
  })

  it('P14: Product Check Alertはverification追加後も候補判定・表示ロジックに影響しない', () => {
    const recipe: Recipe = {
      ...makeRecipe({
        id: 'shoyu-dish',
        requiredIngredients: [ri('豆腐', '1/2丁')],
        seasonings: [ri('しょうゆ', '小さじ1')],
        ingredientChecks: [{ ingredientName: 'しょうゆ' }],
      }),
      verification: { status: 'unverified', sourceIds: [] },
    }
    expect(productCheckMessage('しょうゆ')).toBeDefined()
    const result = rankRecipes([recipe], {
      availableIngredientNames: ['豆腐'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('A')
  })
})
