// ============================================================
// preparation-time-foundation.test.ts
//
// MISSION 2.20 — Recipe Preparation & Time Semantics Minimal Foundation。
//
// MISSION 2.19E で確認された2つの blocker の最小・additive・opt-in な解消を固定化する:
//   BLOCKER A — Recipe に preparation（調理前の下ごしらえ・待機）と cooking steps の区別がない。
//   BLOCKER B — cookingTimeMinutes: number が Evidence 時間スコープに関係なく
//               filter / ranking / estimatedMinutes / 「約○分」UI に使われている。
//
// このMISSIONは tori-teriyaki を修正しない。既存44 Recipe を migration しない。
// 未設定（productTimeStatus / preparation なし）の Recipe は挙動が一切変わらない。
// ============================================================

import { describe, it, expect } from 'vitest'
import type {
  Recipe,
  RecipeEvidenceSource,
  RecipeVerification,
} from '@/features/food/types'
import {
  productTimeStatusOf,
  isProductCookingTimeEstablished,
  productCookingTimeMinutes,
} from '../recipe-time'
import { applicableFieldsFor, isRecipePublishable } from '../recipe-publishability'
import { rankRecipes } from '../recipe-suggestion-engine'
import { allergyRelevantIngredients } from '../recipe-safety'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { mockMealProvider } from '../mock-meal-provider'
import type { Ingredient } from '@/features/food/types'

function makeRecipe(overrides: Partial<Recipe> & Pick<Recipe, 'id' | 'requiredIngredients'>): Recipe {
  return {
    name: overrides.id,
    type: 'main',
    seasonings: [],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    steps: ['フライパンで炒める'],
    ...overrides,
  }
}

function reviewedTimeVerification(status: 'established' | 'review' | 'unknown'): RecipeVerification {
  return {
    status: 'review',
    sourceIds: [],
    timeVerification: { productTimeStatus: status },
  }
}

// ---- BLOCKER B: time semantics ----

describe('MISSION 2.20 — Product Time status (BLOCKER B)', () => {
  it('FA: productTimeStatus 未設定の Recipe は legacy 扱い（数値をそのまま product time にする）', () => {
    const r = makeRecipe({ id: 'fa', requiredIngredients: [{ name: '鶏肉', amount: '200g' }], cookingTimeMinutes: 12 })
    expect(productTimeStatusOf(r)).toBe('legacy')
    expect(isProductCookingTimeEstablished(r)).toBe(true)
    expect(productCookingTimeMinutes(r)).toBe(12)
  })

  it('FB: catalog Recipe は tori-teriyaki 以外すべて legacy（productTimeStatus 未設定）＝挙動不変', () => {
    for (const r of RECIPE_CATALOG) {
      if (r.id === 'tori-teriyaki') {
        // MISSION 2.19E-RESUME-2: NHK anchor 修正で productTimeStatus='review'（唯一の非 legacy）
        expect(productTimeStatusOf(r)).toBe('review')
        expect(productCookingTimeMinutes(r)).toBeNull()
        continue
      }
      expect(productTimeStatusOf(r), r.id).toBe('legacy')
      expect(productCookingTimeMinutes(r), r.id).toBe(r.cookingTimeMinutes)
    }
  })

  it('FC: productTimeStatus="established" は product time として使用可能', () => {
    const r = makeRecipe({
      id: 'fc',
      requiredIngredients: [{ name: '鶏肉', amount: '200g' }],
      cookingTimeMinutes: 18,
      verification: reviewedTimeVerification('established'),
    })
    expect(isProductCookingTimeEstablished(r)).toBe(true)
    expect(productCookingTimeMinutes(r)).toBe(18)
  })

  it('FD: productTimeStatus="review" は確定値として扱わない（product time は null）', () => {
    const r = makeRecipe({
      id: 'fd',
      requiredIngredients: [{ name: '鶏肉', amount: '200g' }],
      cookingTimeMinutes: 15,
      verification: reviewedTimeVerification('review'),
    })
    expect(isProductCookingTimeEstablished(r)).toBe(false)
    expect(productCookingTimeMinutes(r)).toBeNull()
    // legacy の数値自体は消えていない（削除も一括変更もしない）
    expect(r.cookingTimeMinutes).toBe(15)
  })

  it('FE: productTimeStatus="unknown" も確定値として扱わない（product time は null）', () => {
    const r = makeRecipe({
      id: 'fe',
      requiredIngredients: [{ name: '鶏肉', amount: '200g' }],
      cookingTimeMinutes: 15,
      verification: reviewedTimeVerification('unknown'),
    })
    expect(isProductCookingTimeEstablished(r)).toBe(false)
    expect(productCookingTimeMinutes(r)).toBeNull()
  })

  it('FF: 「約○分」表示判定 — review/unknown は確定表示に使わない（RecipeDetailView が使う契約）', () => {
    const established = makeRecipe({ id: 'ff1', requiredIngredients: [{ name: 'a', amount: '1' }] })
    const review = makeRecipe({
      id: 'ff2',
      requiredIngredients: [{ name: 'a', amount: '1' }],
      verification: reviewedTimeVerification('review'),
    })
    // RecipeDetailView は isProductCookingTimeEstablished() の真偽で「約○分」/「確認中」を切替える
    expect(isProductCookingTimeEstablished(established)).toBe(true)
    expect(isProductCookingTimeEstablished(review)).toBe(false)
  })

  it('FG: strict max-time フィルタは review time を確定数値として扱わない（≤max を主張できず候補外）', () => {
    const legacyFast = makeRecipe({
      id: 'fg-legacy',
      name: 'fg-legacy',
      requiredIngredients: [{ name: 'にんじん', amount: '1本' }],
      cookingTimeMinutes: 10,
    })
    const reviewTime = makeRecipe({
      id: 'fg-review',
      name: 'fg-review',
      requiredIngredients: [{ name: 'にんじん', amount: '1本' }],
      cookingTimeMinutes: 10, // legacy数値は10だが productTimeStatus=review
      verification: reviewedTimeVerification('review'),
    })
    const catalog = [legacyFast, reviewTime]
    const withFilter = rankRecipes(catalog, {
      availableIngredientNames: ['にんじん'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: 15,
    })
    const ids = withFilter.map((c) => c.recipe.id)
    expect(ids).toContain('fg-legacy')
    expect(ids).not.toContain('fg-review') // review time は「15分以内」と確定できない

    // フィルタ無し（maxCookingMinutes=null）なら両方候補に入る
    const noFilter = rankRecipes(catalog, {
      availableIngredientNames: ['にんじん'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(noFilter.map((c) => c.recipe.id).sort()).toEqual(['fg-legacy', 'fg-review'])
  })

  it('FH: ranking — review time の Recipe は「時間が短い順」基準で最後尾扱い（確定時間として比較しない）', () => {
    // カテゴリ・一致率・必須数・苦手 をすべて同条件にし、時間基準だけで並ぶ状況を作る
    const slowLegacy = makeRecipe({
      id: 'fh-slow',
      name: 'fh-slow',
      requiredIngredients: [{ name: 'キャベツ', amount: '1/4個' }],
      cookingTimeMinutes: 30,
    })
    const reviewButLooksFast = makeRecipe({
      id: 'fh-review',
      name: 'fh-review',
      requiredIngredients: [{ name: 'キャベツ', amount: '1/4個' }],
      cookingTimeMinutes: 5, // legacy数値は最速だが productTimeStatus=review
      verification: reviewedTimeVerification('review'),
    })
    const ranked = rankRecipes([reviewButLooksFast, slowLegacy], {
      availableIngredientNames: ['キャベツ'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    // review time は +Infinity 扱いなので、確定30分の slowLegacy が先に来る
    expect(ranked.map((c) => c.recipe.id)).toEqual(['fh-slow', 'fh-review'])
  })

  it('FI: legacy Recipe 同士の ranking / filter は従来どおり（順序を全面変更しない）', () => {
    const a = makeRecipe({ id: 'fi-a', name: 'fi-a', requiredIngredients: [{ name: 'たまねぎ', amount: '1個' }], cookingTimeMinutes: 8 })
    const b = makeRecipe({ id: 'fi-b', name: 'fi-b', requiredIngredients: [{ name: 'たまねぎ', amount: '1個' }], cookingTimeMinutes: 20 })
    const ranked = rankRecipes([b, a], {
      availableIngredientNames: ['たまねぎ'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked.map((c) => c.recipe.id)).toEqual(['fi-a', 'fi-b']) // 短い順、従来どおり
  })

  it('FJ: mockMealProvider の estimatedMinutes — 既存44 Recipe はすべて数値のまま', async () => {
    const ing = (name: string): Ingredient => ({ id: name, name, quantityMode: 'exact' })
    const res = await mockMealProvider.suggest({
      ingredients: [ing('ごはん'), ing('マグロ'), ing('卵'), ing('豆腐')],
      cookingPreference: { maxCookingMinutes: null, shoppingMode: 'none' },
    })
    expect(res.suggestions.length).toBeGreaterThan(0)
    for (const s of res.suggestions) {
      expect(typeof s.estimatedMinutes, s.title).toBe('number')
    }
  })
})

// ---- publishability (Section 8) ----

describe('MISSION 2.20 — publishability time firewall (Section 8)', () => {
  const source: RecipeEvidenceSource = {
    id: 'pt-s1',
    publisher: '公的機関テスト',
    title: 'テスト情報源',
    url: 'https://example-trusted-source.jp/recipe/test',
    sourceType: 'government',
    checkedAt: '2026-08-28',
  }

  function publishableBase(): { recipe: Recipe; verification: RecipeVerification } {
    const recipe = makeRecipe({ id: 'pt-r1', name: 'pt-r1', requiredIngredients: [{ name: '米', amount: '1合' }] })
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['pt-s1'],
      fieldVerifications: applicableFieldsFor(recipe).map((field) => ({
        field,
        sourceIds: ['pt-s1'],
        supportType: 'direct' as const,
      })),
      recipeIdentity: {
        canonicalDish: 'テスト料理',
        variant: '基本variant',
        servingsBasis: 2,
        intendedTasteProfile: '家庭的',
        coreMethod: '基本の調理法',
        definingIngredients: ['米'],
      },
      coherenceReview: {
        status: 'coherent',
        sourceProcessNotes: [{ sourceId: 'pt-s1', equipment: 'テスト器具', heatSequence: '一貫した加熱' }],
        reviewedDimensions: ['equipment', 'heat-sequence'],
        rationale: 'テスト用: 単一sourceが全fieldを支持。',
      },
    }
    return { recipe, verification }
  }

  it('FK: baseline — この fixture は publishable（回帰検出用）', () => {
    const { recipe, verification } = publishableBase()
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(true)
  })

  it('FL: MISSION 2.26 Decision B — productTimeStatus="review" でも Recipe-Evidence VERIFIED は可能（cookingTimeMinutes は非該当）', () => {
    const { recipe, verification } = publishableBase()
    verification.timeVerification = { productTimeStatus: 'review' }
    const r = { ...recipe, verification }
    expect(applicableFieldsFor(r)).not.toContain('cookingTimeMinutes')
    expect(isRecipePublishable(r, [source])).toBe(true)
  })

  it('FM: MISSION 2.26 Decision B — productTimeStatus="unknown" でも Recipe-Evidence VERIFIED は可能', () => {
    const { recipe, verification } = publishableBase()
    verification.timeVerification = { productTimeStatus: 'unknown' }
    const r = { ...recipe, verification }
    expect(applicableFieldsFor(r)).not.toContain('cookingTimeMinutes')
    expect(isRecipePublishable(r, [source])).toBe(true)
  })

  it('FN: productTimeStatus="established" — cookingTimeMinutes は該当し、FV があれば publishable', () => {
    const { recipe, verification } = publishableBase()
    verification.timeVerification = { productTimeStatus: 'established' }
    const r = { ...recipe, verification }
    expect(applicableFieldsFor(r)).toContain('cookingTimeMinutes')
    // publishableBase の FV は build 時の applicableFieldsFor（cookingTimeMinutes 含む）で作られている
    expect(isRecipePublishable(r, [source])).toBe(true)
  })

  it('FN2: established で cookingTimeMinutes の FV が無ければ publishable にならない', () => {
    const { recipe, verification } = publishableBase()
    verification.timeVerification = { productTimeStatus: 'established' }
    verification.fieldVerifications = (verification.fieldVerifications ?? []).filter(
      (fv) => fv.field !== 'cookingTimeMinutes',
    )
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })
})

// ---- BLOCKER A: preparation model ----

describe('MISSION 2.20 — Recipe preparation model (BLOCKER A)', () => {
  it('FO: preparation は steps と別枠のデータとして保持できる', () => {
    const r = makeRecipe({
      id: 'fo',
      requiredIngredients: [{ name: '鶏肉', amount: '300g' }],
      steps: ['フライパンで皮目から焼く', 'たれを加えて煮からめる'],
      preparation: [
        { text: '鶏肉を冷蔵庫から出して約30分室温に戻す', passiveWait: true, duration: { kind: 'approximate', minutes: 30 } },
        { text: '余分な脂肪を除く' },
        { text: 'たれを混ぜ合わせておく' },
      ],
    })
    expect(r.preparation).toHaveLength(3)
    expect(r.preparation?.[0].passiveWait).toBe(true)
    expect(r.preparation?.[0].duration).toEqual({ kind: 'approximate', minutes: 30 })
    expect(r.preparation?.[1].passiveWait).toBeUndefined() // active prep
    // steps（加熱調理）とは混ざっていない
    expect(r.steps).toEqual(['フライパンで皮目から焼く', 'たれを加えて煮からめる'])
    const prepText = (r.preparation ?? []).map((p) => p.text).join(' ')
    expect(r.steps?.join(' ')).not.toContain('室温に戻す')
    expect(prepText).toContain('室温に戻す')
  })

  it('FP: preparation を持つ Recipe は applicableFieldsFor に "preparation" が含まれる', () => {
    const withPrep = makeRecipe({
      id: 'fp1',
      requiredIngredients: [{ name: 'a', amount: '1' }],
      preparation: [{ text: '室温に戻す', passiveWait: true }],
    })
    expect(applicableFieldsFor(withPrep)).toContain('preparation')
  })

  it('FQ: preparation を持たない Recipe は applicableFieldsFor が従来どおり（"preparation" 非対象）', () => {
    const noPrep = makeRecipe({ id: 'fq1', requiredIngredients: [{ name: 'a', amount: '1' }] })
    expect(applicableFieldsFor(noPrep)).not.toContain('preparation')
    // catalog は tori-teriyaki（2.19E-RESUME-2 で preparation 追加）以外は非対象
    for (const r of RECIPE_CATALOG) {
      if (r.id === 'tori-teriyaki') {
        expect(applicableFieldsFor(r)).toContain('preparation')
        continue
      }
      expect(applicableFieldsFor(r), r.id).not.toContain('preparation')
    }
  })

  it('FR: preparation fieldVerification が無ければ、preparation 付き Recipe は publishable にならない', () => {
    const source: RecipeEvidenceSource = {
      id: 'fr-s1',
      publisher: 'テスト',
      title: 'テスト',
      url: 'https://example-trusted-source.jp/x',
      sourceType: 'government',
      checkedAt: '2026-08-28',
    }
    const recipe = makeRecipe({
      id: 'fr-r1',
      name: 'fr-r1',
      requiredIngredients: [{ name: '米', amount: '1合' }],
      preparation: [{ text: '室温に戻す', passiveWait: true }],
    })
    // preparation を除く全 applicable field は direct でカバーする
    const fvs = applicableFieldsFor(recipe)
      .filter((f) => f !== 'preparation')
      .map((field) => ({ field, sourceIds: ['fr-s1'], supportType: 'direct' as const }))
    const verification: RecipeVerification = {
      status: 'verified',
      sourceIds: ['fr-s1'],
      fieldVerifications: fvs,
      recipeIdentity: {
        canonicalDish: 'x',
        variant: 'x',
        servingsBasis: 2,
        intendedTasteProfile: 'x',
        coreMethod: 'x',
        definingIngredients: ['米'],
      },
      coherenceReview: {
        status: 'coherent',
        sourceProcessNotes: [{ sourceId: 'fr-s1', equipment: 'テスト器具', heatSequence: '一貫' }],
        reviewedDimensions: ['equipment', 'heat-sequence'],
        rationale: 'テスト',
      },
    }
    expect(isRecipePublishable({ ...recipe, verification }, [source])).toBe(false)
  })
})

// ---- Section 7: allergy / A・B safety ----

describe('MISSION 2.20 — preparation does not affect allergy / matching / A・B', () => {
  it('FS: allergyRelevantIngredients は preparation を一切参照しない', () => {
    const r = makeRecipe({
      id: 'fs',
      requiredIngredients: [{ name: '豚肉', amount: '150g' }],
      seasonings: [{ name: 'しょうゆ', amount: '大さじ1' }],
      preparation: [{ text: '卵を溶いておく' }, { text: '牛乳を計量する' }],
    })
    // preparation に「卵」「牛乳」があっても allergy 対象は requiredIngredients + seasonings のみ
    expect(allergyRelevantIngredients(r).sort()).toEqual(['しょうゆ', '豚肉'])
  })

  it('FT: preparation の有無で allergy HARD EXCLUSION の結果が変わらない', () => {
    const base = makeRecipe({
      id: 'ft',
      name: 'ft',
      requiredIngredients: [{ name: '豚肉', amount: '150g' }],
    })
    const withPrep: Recipe = { ...base, preparation: [{ text: '卵を溶いておく' }] }
    const params = {
      availableIngredientNames: ['豚肉'],
      allergyNames: ['卵'],
      dislikeNames: [],
      maxCookingMinutes: null,
    }
    const a = rankRecipes([base], params)
    const b = rankRecipes([withPrep], params)
    // preparation に「卵」があっても除外されない（allergy 判定に流れない）
    expect(a.map((c) => c.recipe.id)).toEqual(['ft'])
    expect(b.map((c) => c.recipe.id)).toEqual(['ft'])
  })

  it('FU: preparation の有無で A/B 分類が変わらない', () => {
    const base = makeRecipe({
      id: 'fu',
      name: 'fu',
      requiredIngredients: [{ name: '鶏肉', amount: '200g' }, { name: '玉ねぎ', amount: '1個' }],
    })
    const withPrep: Recipe = { ...base, preparation: [{ text: '鶏肉を室温に戻す', passiveWait: true }] }
    const params = {
      availableIngredientNames: ['鶏肉'], // 玉ねぎ不足 → B
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    }
    const a = rankRecipes([base], params)
    const b = rankRecipes([withPrep], params)
    expect(a[0]?.category).toBe('B')
    expect(b[0]?.category).toBe('B')
    expect(a[0]?.missingIngredients).toEqual(b[0]?.missingIngredients)
  })
})
