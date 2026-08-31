// ============================================================
// recipe-time.test.ts
//
// MISSION 2.15 — Cooking Time Semantics Foundation Gate (TA〜).
//
// Evidence Time（情報源が実際に述べる時間）とUser Decision Time
// （「15分以内」等のユーザー向け意思決定に使う時間）を分離する新しい
// TimeValue/RecipeTimeVerification/isEligibleForMaxElapsedTime()を固定化する。
// 既存のisRecipePublishable()・candidate ranking・15分/30分クイックフィルタ
// （legacy cookingTimeMinutes）とは完全に独立していることも確認する。
//
// sake-shioyaki/medama-yaki/shio-musubi/onigiri-nori/gyudon/oyako-donの
// characterizationは、実際のrecipe-catalog.tsのエントリを一切変更せず、
// それらのEvidenceとして既に判明している事実を反映した「合成fixture」
// として構成する（本MISSIONはRecipe fact移行を行わない）。
// ============================================================

import { describe, it, expect } from 'vitest'
import type { Recipe, RecipeIdentity, RecipeVerification, TimeComponentFact, TimeValue } from '@/features/food/types'
import {
  isKnownTimeValue,
  resolvedUpperBoundMinutes,
  hasCrossVariantArithmetic,
  isEligibleForMaxElapsedTime,
} from '../recipe-time'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { isRecipePublishable, applicableFieldsFor } from '../recipe-publishability'
import { rankRecipes } from '../recipe-suggestion-engine'
import { allergyRelevantIngredients } from '../recipe-safety'
import { selectBetaCandidates, BETA_MAX_CANDIDATES } from '../beta-presentation'

function ri(name: string, amount = '1個') {
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

describe('Cooking Time Semantics Foundation Gate (TA〜)', () => {
  // ---- 1〜4: TimeValueの精度保持 ----

  it('TA (1): exact timeはそのまま保持される', () => {
    const value: TimeValue = { kind: 'exact', minutes: 12 }
    expect(isKnownTimeValue(value)).toBe(true)
    expect(resolvedUpperBoundMinutes(value)).toBe(12)
  })

  it('TB (2): range timeはminMinutes/maxMinutesをそのまま保持する', () => {
    const value: TimeValue = { kind: 'range', minMinutes: 3, maxMinutes: 4 }
    expect(isKnownTimeValue(value)).toBe(true)
    expect(value.minMinutes).toBe(3)
    expect(value.maxMinutes).toBe(4)
  })

  it('TC (3): approximate timeはそのまま保持される（exact化しない）', () => {
    const value: TimeValue = { kind: 'approximate', minutes: 10 }
    expect(isKnownTimeValue(value)).toBe(true)
    expect(value.kind).not.toBe('exact')
    expect(value.minutes).toBe(10)
  })

  it('TD (4): unknownはunknownのまま保持される', () => {
    const value: TimeValue = { kind: 'unknown' }
    expect(isKnownTimeValue(value)).toBe(false)
    expect(resolvedUpperBoundMinutes(value)).toBeNull()
  })

  it('TE (5): range 3〜4分はmidpoint(3.5)へ変換されない', () => {
    const value: TimeValue = { kind: 'range', minMinutes: 3, maxMinutes: 4 }
    // TimeValueの型自体にmidpointを表現する手段が存在しないことがno-midpoint原則の構造的裏付け
    expect('minutes' in value).toBe(false)
    expect(resolvedUpperBoundMinutes(value)).toBe(4) // 上限であり中央値(3.5)ではない
  })

  // ---- 6〜10: 保守的フィルタリングポリシー ----

  it('TF (6): exact12はmax15に適格', () => {
    const recipe = makeRecipe({ id: 'tf-r1', requiredIngredients: [ri('米')] })
    const verification: RecipeVerification = {
      status: 'review',
      sourceIds: ['tf-s1'],
      timeVerification: {
        elapsedToReady: { value: { kind: 'exact', minutes: 12 }, derivation: 'source直接記載の12分', contributingSourceIds: ['tf-s1'] },
      },
    }
    expect(isEligibleForMaxElapsedTime({ ...recipe, verification }, 15)).toBe(true)
  })

  it('TG (7): range10-15はmax15に適格（上限=15）', () => {
    const recipe = makeRecipe({ id: 'tg-r1', requiredIngredients: [ri('米')] })
    const verification: RecipeVerification = {
      status: 'review',
      sourceIds: ['tg-s1'],
      timeVerification: {
        elapsedToReady: { value: { kind: 'range', minMinutes: 10, maxMinutes: 15 }, derivation: 'source直接記載の10〜15分', contributingSourceIds: ['tg-s1'] },
      },
    }
    expect(isEligibleForMaxElapsedTime({ ...recipe, verification }, 15)).toBe(true)
  })

  it('TH (8): range10-20はmax15に不適格（上限=20>15）', () => {
    const recipe = makeRecipe({ id: 'th-r1', requiredIngredients: [ri('米')] })
    const verification: RecipeVerification = {
      status: 'review',
      sourceIds: ['th-s1'],
      timeVerification: {
        elapsedToReady: { value: { kind: 'range', minMinutes: 10, maxMinutes: 20 }, derivation: 'source直接記載の10〜20分', contributingSourceIds: ['th-s1'] },
      },
    }
    expect(isEligibleForMaxElapsedTime({ ...recipe, verification }, 15)).toBe(false)
  })

  it('TI (9): approximate15は既定でmax15に不適格', () => {
    const recipe = makeRecipe({ id: 'ti-r1', requiredIngredients: [ri('米')] })
    const verification: RecipeVerification = {
      status: 'review',
      sourceIds: ['ti-s1'],
      timeVerification: {
        elapsedToReady: { value: { kind: 'approximate', minutes: 15 }, derivation: 'source記載の約15分', contributingSourceIds: ['ti-s1'] },
      },
    }
    expect(isEligibleForMaxElapsedTime({ ...recipe, verification }, 15)).toBe(false)
  })

  it('TJ (10): unknownはmax15に不適格', () => {
    const recipe = makeRecipe({ id: 'tj-r1', requiredIngredients: [ri('米')] })
    const verification: RecipeVerification = {
      status: 'review',
      sourceIds: ['tj-s1'],
      timeVerification: {
        elapsedToReady: { value: { kind: 'unknown' }, derivation: '不明', contributingSourceIds: ['tj-s1'] },
      },
    }
    expect(isEligibleForMaxElapsedTime({ ...recipe, verification }, 15)).toBe(false)
  })

  // ---- 11〜14: component意味論 ----

  it('TK (11): activeWorkMinutesはelapsedToReadyと独立な概念であり、必ずしも一致しない', () => {
    const recipe = makeRecipe({ id: 'tk-r1', requiredIngredients: [ri('米')] })
    const verification: RecipeVerification = {
      status: 'review',
      sourceIds: ['tk-s1'],
      timeVerification: {
        elapsedToReady: { value: { kind: 'exact', minutes: 20 }, derivation: '放置込みで20分', contributingSourceIds: ['tk-s1'] },
        activeWork: { value: { kind: 'exact', minutes: 5 }, derivation: '実際に手を動かすのは5分のみ（残りは放置）' },
      },
    }
    const timeVerification = verification.timeVerification!
    expect(timeVerification.activeWork!.value).not.toEqual(timeVerification.elapsedToReady!.value)
  })

  it('TL (12): passiveCookingMinutesはsequentialに必要な場合elapsedへ寄与しうる（明示的derivation経由）', () => {
    const recipe = makeRecipe({ id: 'tl-r1', requiredIngredients: [ri('米')] })
    const components: TimeComponentFact[] = [
      { kind: 'activePrepMinutes', value: { kind: 'exact', minutes: 5 }, sourceIds: ['tl-s1'] },
      { kind: 'passiveCookingMinutes', value: { kind: 'exact', minutes: 40 }, sourceIds: ['tl-s1'] },
    ]
    const verification: RecipeVerification = {
      status: 'review',
      sourceIds: ['tl-s1'],
      timeVerification: {
        components,
        elapsedToReady: {
          value: { kind: 'exact', minutes: 45 },
          derivation: '準備5分の後、炊飯器での炊飯40分が続けて発生する（sequential）。5+40=45。',
          contributingSourceIds: ['tl-s1'],
        },
      },
    }
    expect(isEligibleForMaxElapsedTime({ ...recipe, verification }, 45)).toBe(true)
  })

  it('TM (13): residualHeatMinutesはrequiredな場合elapsedへ寄与しうる（sake-shioyaki型のderivation）', () => {
    const recipe = makeRecipe({ id: 'tm-r1', requiredIngredients: [ri('鮭')] })
    const components: TimeComponentFact[] = [
      { kind: 'activeHeatingMinutes', value: { kind: 'exact', minutes: 4 }, sourceIds: ['tm-s1'] },
      { kind: 'residualHeatMinutes', value: { kind: 'exact', minutes: 3 }, sourceIds: ['tm-s1'] },
    ]
    const verification: RecipeVerification = {
      status: 'review',
      sourceIds: ['tm-s1'],
      timeVerification: {
        components,
        elapsedToReady: {
          value: { kind: 'exact', minutes: 7 },
          derivation: '活火4分の後、火を止めて余熱3分置くことが中心まで火を通すために必須。4+3=7（予熱は含まない）。',
          contributingSourceIds: ['tm-s1'],
        },
      },
    }
    expect(isEligibleForMaxElapsedTime({ ...recipe, verification }, 7)).toBe(true)
  })

  it('TN (14): preheatMinutesはrequiredな場合のみelapsedへ寄与する（含める/含めないの両方が明示derivationとして表現できる）', () => {
    const recipe = makeRecipe({ id: 'tn-r1', requiredIngredients: [ri('鮭')] })
    const withPreheat: RecipeVerification = {
      status: 'review',
      sourceIds: ['tn-s1'],
      timeVerification: {
        elapsedToReady: {
          value: { kind: 'exact', minutes: 10 },
          derivation: '予熱3分は調理開始前に必須の経過時間であり、活火4分+余熱3分に先行してelapsedへ含める。3+4+3=10。',
          contributingSourceIds: ['tn-s1'],
        },
      },
    }
    expect(isEligibleForMaxElapsedTime({ ...recipe, verification: withPreheat }, 10)).toBe(true)
  })

  // ---- 15〜16: overlap / 無根拠合算の禁止 ----

  it('TO (15): overlapを主張するにはderivationが必須（空文字なら未解決）', () => {
    const recipe = makeRecipe({ id: 'to-r1', requiredIngredients: [ri('米')] })
    const verification: RecipeVerification = {
      status: 'review',
      sourceIds: ['to-s1'],
      timeVerification: {
        elapsedToReady: { value: { kind: 'exact', minutes: 15 }, derivation: '', contributingSourceIds: ['to-s1'] },
      },
    }
    expect(isEligibleForMaxElapsedTime({ ...recipe, verification }, 15)).toBe(false)
  })

  it('TP (16): elapsedToReady未設定（無根拠合算を試みない）はmax filterに不適格', () => {
    const recipe = makeRecipe({ id: 'tp-r1', requiredIngredients: [ri('米')] })
    const verification: RecipeVerification = {
      status: 'review',
      sourceIds: ['tp-s1'],
      timeVerification: {
        components: [
          { kind: 'activePrepMinutes', value: { kind: 'exact', minutes: 5 }, sourceIds: ['tp-s1'] },
          { kind: 'passiveCookingMinutes', value: { kind: 'exact', minutes: 40 }, sourceIds: ['tp-s1'] },
        ],
        // elapsedToReadyは意図的に未設定（重なりが未立証のため合算しない）
      },
    }
    expect(isEligibleForMaxElapsedTime({ ...recipe, verification }, 60)).toBe(false)
  })

  // ---- 17〜18: cross-Variant / cross-Identity arithmeticの禁止 ----

  it('TQ (17): 異なるvariantIdを持つcomponent同士の合算はhasCrossVariantArithmeticで検出され、eligibilityをblockする', () => {
    const recipe = makeRecipe({ id: 'tq-r1', requiredIngredients: [ri('鮭')] })
    const components: TimeComponentFact[] = [
      { kind: 'activeHeatingMinutes', value: { kind: 'exact', minutes: 4 }, sourceIds: ['tq-s1'], variantId: 'grill-variant' },
      { kind: 'activeHeatingMinutes', value: { kind: 'exact', minutes: 5 }, sourceIds: ['tq-s2'], variantId: 'frypan-variant' },
    ]
    expect(hasCrossVariantArithmetic(components, ['tq-s1', 'tq-s2'])).toBe(true)
    const verification: RecipeVerification = {
      status: 'review',
      sourceIds: ['tq-s1', 'tq-s2'],
      timeVerification: {
        components,
        elapsedToReady: {
          value: { kind: 'exact', minutes: 9 },
          derivation: 'グリルとフライパンという異なるvariantのactiveHeatingを合算（不正な例）',
          contributingSourceIds: ['tq-s1', 'tq-s2'],
        },
      },
    }
    expect(isEligibleForMaxElapsedTime({ ...recipe, verification }, 9)).toBe(false)
  })

  it('TR (18): cross-Recipe-Identity arithmeticはCoherence Reviewの不整合として捕捉される（Time Evidence自体は別Identityの判定を持たないため、Coherence Gate側でblockされることを確認する）', () => {
    const recipe = makeRecipe({ id: 'tr-r1', requiredIngredients: [ri('鮭')] })
    const verification: RecipeVerification = {
      status: 'review',
      sourceIds: ['tr-s1'],
      coherenceReview: {
        status: 'incoherent',
        sourceProcessNotes: [{ sourceId: 'tr-s1' }],
        reviewedDimensions: ['equipment'],
        rationale: '異なるRecipe Identityのsourceを跨いでtimeを合算しようとしたため不整合と判定。',
      },
      timeVerification: {
        elapsedToReady: {
          value: { kind: 'exact', minutes: 10 },
          derivation: '別々のRecipe Identityのsourceから時間を合算（不正な例）',
          contributingSourceIds: ['tr-s1'],
        },
      },
    }
    expect(isEligibleForMaxElapsedTime({ ...recipe, verification }, 10)).toBe(false)
  })

  // ---- 19〜20: Evidence vs Product Decision ----

  it('TS (19): Product Decision（elapsedToReady）はEvidence Fact（component）を書き換えない', () => {
    const component: TimeComponentFact = { kind: 'activeHeatingMinutes', value: { kind: 'range', minMinutes: 3, maxMinutes: 4 }, sourceIds: ['ts-s1'] }
    const elapsedToReady = { value: { kind: 'exact' as const, minutes: 4 }, derivation: '保守的に上限4分を採用', contributingSourceIds: ['ts-s1'] }
    // Product Decisionの値(4)が、元のEvidence component(range 3-4)を書き換えていないことを確認する
    expect(component.value).toEqual({ kind: 'range', minMinutes: 3, maxMinutes: 4 })
    expect(elapsedToReady.value).toEqual({ kind: 'exact', minutes: 4 })
  })

  it('TT (20): Product Decision適用後もEvidence rangeはrangeのまま残る（sake-shioyaki型のderivationを模した例）', () => {
    const recipe = makeRecipe({ id: 'tt-r1', requiredIngredients: [ri('鮭')] })
    const components: TimeComponentFact[] = [
      { kind: 'activeHeatingMinutes', value: { kind: 'range', minMinutes: 7, maxMinutes: 8 }, sourceIds: ['tt-s1'] },
    ]
    const verification: RecipeVerification = {
      status: 'review',
      sourceIds: ['tt-s1'],
      timeVerification: {
        components,
        elapsedToReady: { value: { kind: 'exact', minutes: 8 }, derivation: '保守的に上限8分を採用', contributingSourceIds: ['tt-s1'] },
      },
    }
    expect(verification.timeVerification!.components![0].value.kind).toBe('range')
    expect(isEligibleForMaxElapsedTime({ ...recipe, verification }, 8)).toBe(true)
  })

  // ---- 21〜23: sake-shioyaki characterization ----

  it('TU (21): sake-shioyakiの4分+3分は同一source・同一variantのEvidence直接事実の合算として正当に表現できる（合成fixture。実際のcatalogは変更しない）', () => {
    const components: TimeComponentFact[] = [
      { kind: 'activeHeatingMinutes', value: { kind: 'exact', minutes: 4 }, sourceIds: ['kikkoman-sakeyakikata-2026'], variantId: 'sake-shioyaki-grill-no-oil' },
      { kind: 'residualHeatMinutes', value: { kind: 'exact', minutes: 3 }, sourceIds: ['kikkoman-sakeyakikata-2026'], variantId: 'sake-shioyaki-grill-no-oil' },
    ]
    expect(hasCrossVariantArithmetic(components, ['kikkoman-sakeyakikata-2026'])).toBe(false)
    const foodProcessTime = components[0].value.kind === 'exact' && components[1].value.kind === 'exact'
      ? components[0].value.minutes + components[1].value.minutes
      : null
    expect(foodProcessTime).toBe(7)
  })

  it('TV (22): sake-shioyakiのpreheat 3分はこの7分（食品への実加熱プロセス）には含まれない', () => {
    const preheat: TimeComponentFact = { kind: 'preheatMinutes', value: { kind: 'exact', minutes: 3 }, sourceIds: ['kikkoman-sakeyakikata-2026'] }
    const activeHeating: TimeComponentFact = { kind: 'activeHeatingMinutes', value: { kind: 'exact', minutes: 4 }, sourceIds: ['kikkoman-sakeyakikata-2026'] }
    const residual: TimeComponentFact = { kind: 'residualHeatMinutes', value: { kind: 'exact', minutes: 3 }, sourceIds: ['kikkoman-sakeyakikata-2026'] }
    // 「4+3=7」というfood-process timeの計算にpreheatのkindは一切登場しない
    expect([activeHeating, residual].every((c) => c.kind !== 'preheatMinutes')).toBe(true)
    expect(preheat.kind).toBe('preheatMinutes')
  })

  it('TW (23): sake-shioyakiの7分は自動的にelapsedToReadyにはならない（明示的derivationがなければunresolvedのまま）', () => {
    const recipe = makeRecipe({ id: 'tw-r1', requiredIngredients: [ri('鮭')] })
    const verification: RecipeVerification = {
      status: 'review',
      sourceIds: ['kikkoman-sakeyakikata-2026'],
      timeVerification: {
        components: [
          { kind: 'preheatMinutes', value: { kind: 'exact', minutes: 3 }, sourceIds: ['kikkoman-sakeyakikata-2026'] },
          { kind: 'activeHeatingMinutes', value: { kind: 'exact', minutes: 4 }, sourceIds: ['kikkoman-sakeyakikata-2026'] },
          { kind: 'residualHeatMinutes', value: { kind: 'exact', minutes: 3 }, sourceIds: ['kikkoman-sakeyakikata-2026'] },
        ],
        // elapsedToReadyは意図的に未設定。「食品プロセス時間=7分」を「調理開始からの経過時間」
        // と自動的にみなさない（予熱を含めるかどうかの判断が必要なため）。
      },
    }
    expect(isEligibleForMaxElapsedTime({ ...recipe, verification }, 15)).toBe(false)
    // 実際のcatalogのsake-shioyakiもtimeVerification未設定であることを確認する（fact変更なし）
    const realSake = RECIPE_CATALOG.find((r) => r.id === 'sake-shioyaki')!
    expect(realSake.verification?.timeVerification).toBeUndefined()
    expect(realSake.cookingTimeMinutes).toBe(7) // legacy fieldは本MISSIONで変更していない
  })

  // ---- 24: medama-yaki characterization ----

  it('TX (24): medama-yakiのlegacy cookingTimeMinutes=5は自動的にverified elapsedToReadyにならない（scope混在のため）', () => {
    const realMedama = RECIPE_CATALOG.find((r) => r.id === 'medama-yaki')!
    expect(realMedama.cookingTimeMinutes).toBe(5) // legacy fieldは本MISSIONで変更していない
    expect(realMedama.verification?.timeVerification).toBeUndefined()
    expect(isEligibleForMaxElapsedTime(realMedama, 15)).toBe(false)
    // 合成fixtureとして、NHKの「弱めの中火で3分ほど」（活火・予熱抜き）とキッコーマンの
    // 「弱火3〜4分」（活火・予熱抜き）は同じscope（active heating、予熱抜き）だが、
    // 実際のNUKITORU cookingTimeMinutes=5はこれに独自の予熱見積もりを混在させており、
    // その5という値自体をEvidence componentとして表現することはできない。
    const nhkActive: TimeComponentFact = { kind: 'activeHeatingMinutes', value: { kind: 'approximate', minutes: 3 }, sourceIds: ['kyounoryouri-medamayaki-2026'] }
    const kikkomanActive: TimeComponentFact = { kind: 'activeHeatingMinutes', value: { kind: 'range', minMinutes: 3, maxMinutes: 4 }, sourceIds: ['kikkoman-medamayaki-tips-2026'] }
    expect(nhkActive.value.kind).not.toBe('exact')
    expect(kikkomanActive.value.kind).toBe('range')
  })

  // ---- 25〜26: shio-musubi / onigiri-nori characterization ----

  it('TY (25): shio-musubiの炊飯器passive timeと握るactive prepは別componentであり、無根拠に合算しない', () => {
    const realShioMusubi = RECIPE_CATALOG.find((r) => r.id === 'shio-musubi')!
    expect(realShioMusubi.verification?.timeVerification).toBeUndefined() // fact変更なし
    const riceCooker: TimeComponentFact = {
      kind: 'passiveCookingMinutes',
      value: { kind: 'range', minMinutes: 40, maxMinutes: 60 },
      sourceIds: ['hitachi-rice-cooker-time-2026'],
    }
    const forming: TimeComponentFact = {
      kind: 'activePrepMinutes',
      value: { kind: 'exact', minutes: 10 },
      sourceIds: ['sirogohan-siomusubi-2026'],
    }
    expect(riceCooker.kind).not.toBe(forming.kind)
    // 合算するにはelapsedToReadyとしての明示derivationが必要（本テストでは意図的に未設定のまま）
    const verification: RecipeVerification = {
      status: 'review',
      sourceIds: ['hitachi-rice-cooker-time-2026', 'sirogohan-siomusubi-2026'],
      timeVerification: { components: [riceCooker, forming] },
    }
    expect(isEligibleForMaxElapsedTime({ ...makeRecipe({ id: 'ty-r1', requiredIngredients: [ri('米')] }), verification }, 60)).toBe(false)
  })

  it('TZ (26): onigiri-noriもshio-musubiと同型のEvidence構造（炊飯器range + 握るactive prep）を持ち、同じ原則が適用される', () => {
    const realOnigiriNori = RECIPE_CATALOG.find((r) => r.id === 'onigiri-nori')!
    expect(realOnigiriNori.verification?.timeVerification).toBeUndefined() // fact変更なし
    expect(realOnigiriNori.verification?.fieldVerifications?.find((f) => f.field === 'cookingTimeMinutes')?.supportType).toBe('range')
  })

  // ---- 27〜28: gyudon / oyako-don characterization（source-stated total） ----

  it('UA (27): gyudonのcookingTimeMinutes=30はsource-stated total（内訳不明）として表現でき、内訳分解を偽装しない', () => {
    const realGyudon = RECIPE_CATALOG.find((r) => r.id === 'gyudon')!
    expect(realGyudon.cookingTimeMinutes).toBe(30) // fact変更なし
    const timeVerification = {
      sourceStatedTotal: { value: { kind: 'approximate' as const, minutes: 30 }, sourceIds: ['kikkoman-gyudon-2026'] },
      // componentsは意図的に設定しない＝内訳不明であることをそのまま表現する
    }
    expect(timeVerification.sourceStatedTotal.value.kind).toBe('approximate')
    expect('components' in timeVerification).toBe(false)
  })

  it('UB (28): oyako-donのcookingTimeMinutes=15も同様にsource-stated totalとして表現でき、内訳を推測しない', () => {
    const realOyakoDon = RECIPE_CATALOG.find((r) => r.id === 'oyako-don')!
    expect(realOyakoDon.cookingTimeMinutes).toBe(15) // fact変更なし
    const sourceStatedTotal = { value: { kind: 'approximate' as const, minutes: 15 }, sourceIds: ['kikkoman-oyakodon-2026'] }
    expect(sourceStatedTotal.value.kind).toBe('approximate')
  })

  // ---- 29〜30: publishability / eligibility独立性 ----

  it('UC (29): time-filter eligibilityはRecipe publishabilityと独立している（片方がtrueでも他方に影響しない）', () => {
    // medama-yaki: 過去VERIFIEDだった実データ。現在はREVIEW（MISSION 2.14B）で、
    // どちらにせよtimeVerificationは未設定のためeligibleではないが、
    // isRecipePublishableとisEligibleForMaxElapsedTimeが別々の関数として
    // 完全に独立に評価されることを確認する。
    const medamaYaki = RECIPE_CATALOG.find((r) => r.id === 'medama-yaki')!
    const publishable = isRecipePublishable(medamaYaki)
    const eligible = isEligibleForMaxElapsedTime(medamaYaki, 15)
    expect(publishable).toBe(false)
    expect(eligible).toBe(false)
    // 合成例: publishable=trueだがelapsedToReady未設定＝eligibleにはならない、という
    // 組み合わせが構造的に可能であることを示す
    const recipe = makeRecipe({ id: 'uc-r1', requiredIngredients: [ri('米', '1合')] })
    const source = { id: 'uc-s1', publisher: '公的機関テスト', title: 'テスト', url: 'https://example-trusted-source.jp/x', sourceType: 'government' as const, checkedAt: '2026-08-28' }
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['uc-s1'],
      recipeIdentity: makeIdentity(),
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({
        field,
        sourceIds: ['uc-s1'],
        supportType: 'direct' as const,
      })),
      coherenceReview: {
        status: 'coherent',
        sourceProcessNotes: [{ sourceId: 'uc-s1', equipment: 'テスト器具' }],
        reviewedDimensions: ['equipment'],
        rationale: '単一sourceで矛盾なし。',
      },
      // timeVerification未設定
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(true)
    expect(isEligibleForMaxElapsedTime({ ...recipe, verification }, 15)).toBe(false)
  })

  it('UD (30): 未解決のtimeVerificationは15分フィルタに絶対に適格にならない', () => {
    const recipe = makeRecipe({ id: 'ud-r1', requiredIngredients: [ri('米')] })
    expect(isEligibleForMaxElapsedTime(recipe, 15)).toBe(false) // timeVerification自体が存在しない
  })

  it('UE (31): Coherence不整合は、それに依存するtime qualificationをblockする', () => {
    const recipe = makeRecipe({ id: 'ue-r1', requiredIngredients: [ri('鮭')] })
    const verification: RecipeVerification = {
      status: 'review',
      sourceIds: ['ue-s1'],
      coherenceReview: {
        status: 'incoherent',
        sourceProcessNotes: [{ sourceId: 'ue-s1' }],
        reviewedDimensions: ['equipment'],
        rationale: 'process不整合。',
      },
      timeVerification: {
        elapsedToReady: { value: { kind: 'exact', minutes: 7 }, derivation: '4+3=7', contributingSourceIds: ['ue-s1'] },
      },
    }
    expect(isEligibleForMaxElapsedTime({ ...recipe, verification }, 15)).toBe(false)
  })

  // ---- 既存機能の回帰確認 ----

  it('UF: Allergy HARD EXCLUSIONはCooking Time Semantics Foundation追加後も無傷', () => {
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

  it('UG: Candidate A/B判定はCooking Time Semantics Foundation追加後も無傷', () => {
    const result = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['卵'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(result.find((c) => c.recipe.id === 'medama-yaki')?.category).toBe('A')
  })

  it('UH: max3候補提示はCooking Time Semantics Foundation追加後も無傷', () => {
    expect(BETA_MAX_CANDIDATES).toBe(3)
    expect(selectBetaCandidates([1, 2, 3, 4, 5])).toEqual([1, 2, 3])
  })

  it('UI: 既存の15分/30分クイックフィルタ（legacy cookingTimeMinutes直接比較）はCooking Time Semantics Foundation追加後も無傷（rankRecipesはmaxCookingMinutesをrecipe.cookingTimeMinutesと直接比較する既存実装のまま）', () => {
    const shortRecipe = makeRecipe({ id: 'ui-short', requiredIngredients: [ri('米')], cookingTimeMinutes: 10 })
    const longRecipe = makeRecipe({ id: 'ui-long', requiredIngredients: [ri('米')], cookingTimeMinutes: 20 })
    const result = rankRecipes([shortRecipe, longRecipe], {
      availableIngredientNames: ['米'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: 15,
    })
    expect(result.some((c) => c.recipe.id === 'ui-short')).toBe(true)
    expect(result.some((c) => c.recipe.id === 'ui-long')).toBe(false)
  })

  it('UJ: Recipe Coherence Gateの既存挙動（medama-yaki/sake-shioyaki=incoherent）はCooking Time Semantics Foundation追加後も無傷', () => {
    const medamaYaki = RECIPE_CATALOG.find((r) => r.id === 'medama-yaki')!
    const sakeShioyaki = RECIPE_CATALOG.find((r) => r.id === 'sake-shioyaki')!
    expect(medamaYaki.verification?.coherenceReview?.status).toBe('incoherent')
    expect(sakeShioyaki.verification?.coherenceReview?.status).toBe('incoherent')
    // MISSION 2.26: VERIFIED は tori-teriyaki のみ（Cooking Time Semantics Foundation とは無関係）
    expect(RECIPE_CATALOG.filter((r) => r.verification?.status === 'verified').map((r) => r.id)).toEqual(['tori-teriyaki'])
  })

  it('UK: Source Silence原則（EVIDENCE_POLICY.md）はCooking Time Semantics Foundation追加後も無傷', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const content = fs.readFileSync(path.join(process.cwd(), 'src/features/food/EVIDENCE_POLICY.md'), 'utf-8')
    expect(content).toContain('Source Silence')
    expect(content).toContain('情報源の沈黙は、否定的事実のEvidenceにならない')
  })

  it('UL: Global Foundation（rice_raw≠rice_cooked）はCooking Time Semantics Foundation追加後も無傷', async () => {
    const { resolveCanonicalFoodId } = await import('../canonical-food')
    const jaJP = { language: 'ja', country: 'JP' }
    expect(resolveCanonicalFoodId('米', jaJP)).toBe('rice_raw')
    expect(resolveCanonicalFoodId('ごはん', jaJP)).toBe('rice_cooked')
  })
})
