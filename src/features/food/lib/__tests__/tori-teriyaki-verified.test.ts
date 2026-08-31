// ============================================================
// tori-teriyaki-verified.test.ts
//
// MISSION 2.26 — TORI-TERIYAKI FIRST VERIFIED FINALIZATION。
//
// NUKITORU FOOD 初の Recipe Evidence VERIFIED。Decision B（Recipe Evidence
// VERIFIED ≠ Product Time VERIFIED）の実装、user-facing time firewall の維持、
// allergy safety の非弱体化、監査履歴の保全を固定化する。
// ============================================================

import { describe, it, expect } from 'vitest'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { isRecipePublishable, isCoherenceReviewValid, applicableFieldsFor } from '../recipe-publishability'
import {
  productCookingTimeMinutes,
  isProductCookingTimeEstablished,
  productTimeStatusOf,
} from '../recipe-time'
import { rankRecipes } from '../recipe-suggestion-engine'
import { mockMealProvider } from '../mock-meal-provider'
import { allergyRelevantIngredients } from '../recipe-safety'
import type { Ingredient } from '@/features/food/types'

const tt = () => RECIPE_CATALOG.find((r) => r.id === 'tori-teriyaki')!
const ing = (name: string): Ingredient => ({ id: name, name, quantityMode: 'exact' })

// ---- A. Recipe VERIFIED ----

describe('MISSION 2.26 A — Recipe VERIFIED', () => {
  it('KA: verification.status === "verified"', () => {
    expect(tt().verification?.status).toBe('verified')
  })
  it('KB: isRecipePublishable(tori-teriyaki) === true', () => {
    expect(isRecipePublishable(tt())).toBe(true)
  })
  it('KC: catalog の VERIFIED は tori-teriyaki（#1）と buta-shogayaki（#2・MISSION 2.31）', () => {
    expect(RECIPE_CATALOG.filter((r) => r.verification?.status === 'verified').map((r) => r.id)).toEqual([
      'tori-teriyaki',
      'buta-shogayaki',
    ])
  })
})

// ---- B. Product Time remains unresolved ----

describe('MISSION 2.26 B — Product Time firewall（VERIFIED でも未確定のまま）', () => {
  it('KD: productTimeStatus === "review"', () => {
    expect(productTimeStatusOf(tt())).toBe('review')
  })
  it('KE: productCookingTimeMinutes === null / not established', () => {
    expect(productCookingTimeMinutes(tt())).toBeNull()
    expect(isProductCookingTimeEstablished(tt())).toBe(false)
  })
  it('KF: mockMealProvider の estimatedMinutes === null', async () => {
    const res = await mockMealProvider.suggest({
      ingredients: [ing('鶏もも肉'), ing('しょうゆ'), ing('みりん'), ing('酒'), ing('砂糖'), ing('塩'), ing('サラダ油')],
      cookingPreference: { maxCookingMinutes: null, shoppingMode: 'none' },
    })
    const s = res.suggestions.find((x) => x.recipeId === 'tori-teriyaki')
    expect(s).toBeDefined()
    expect(s!.estimatedMinutes).toBeNull()
  })
  it('KG: strict「15分以内」フィルタは tori-teriyaki を含めない', () => {
    const ranked = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['鶏もも肉', 'しょうゆ', 'みりん', '酒', '砂糖', '塩', 'サラダ油'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: 15,
    })
    expect(ranked.some((c) => c.recipe.id === 'tori-teriyaki')).toBe(false)
  })
  it('KH: ranking は legacy 15 を「速い時間」として使わない（時間 tiebreak で +Infinity 扱い）', () => {
    // フィルタ無しなら候補には入る（在庫あり）
    const ranked = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['鶏もも肉'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked.find((c) => c.recipe.id === 'tori-teriyaki')?.category).toBe('A')
    // productCookingTimeMinutes が null＝ranking の時間比較で最後尾扱い（helper 契約）
    expect(productCookingTimeMinutes(tt())).toBeNull()
  })
})

// ---- C. Source time ----

describe('MISSION 2.26 C — Source displayed time / exclusion scope', () => {
  it('KI: sourceStatedTotal.value = exact 15分（NHK）', () => {
    const sst = tt().verification?.timeVerification?.sourceStatedTotal
    expect(sst?.value).toEqual({ kind: 'exact', minutes: 15 })
    expect(sst?.sourceIds).toEqual(['kyounoryouri-toriteriyaki-kawano-2026'])
  })
  it('KJ: excludes に約30分の restingMinutes（machine-readable）。45分の導出はしていない', () => {
    const sst = tt().verification?.timeVerification?.sourceStatedTotal
    expect(sst?.excludes).toEqual([
      { kind: 'restingMinutes', value: { kind: 'approximate', minutes: 30 }, sourceIds: ['kyounoryouri-toriteriyaki-kawano-2026'] },
    ])
    // elapsedToReady は未設定（15+30=45 の arithmetic をしていない）
    expect(tt().verification?.timeVerification?.elapsedToReady).toBeUndefined()
    expect(tt().verification?.timeVerification?.activeWork).toBeUndefined()
  })
  it('KK: legacy cookingTimeMinutes=15 はデータ上残るが Product Time ではない', () => {
    expect(tt().cookingTimeMinutes).toBe(15)
    expect(productCookingTimeMinutes(tt())).toBeNull()
  })
})

// ---- D. Evidence fields ----

describe('MISSION 2.26 D — Evidence fields', () => {
  it('KL: applicableFieldsFor に cookingTimeMinutes は含まれない（productTimeStatus=review）', () => {
    expect(applicableFieldsFor(tt())).not.toContain('cookingTimeMinutes')
  })
  it('KM: applicable な Recipe-Evidence field はすべて direct または derived で解決', () => {
    const fvMap = new Map((tt().verification?.fieldVerifications ?? []).map((f) => [f.field, f]))
    for (const field of applicableFieldsFor(tt())) {
      const fv = fvMap.get(field)
      expect(fv, `missing FV for ${field}`).toBeDefined()
      expect(['direct', 'derived']).toContain(fv!.supportType)
      if (fv!.supportType === 'derived') expect((fv!.derivation ?? '').trim().length).toBeGreaterThan(0)
    }
  })
  it('KN: allergyIdentity は derived（NHK direct ではない）', () => {
    const ai = (tt().verification?.fieldVerifications ?? []).find((f) => f.field === 'allergyIdentity')
    expect(ai?.supportType).toBe('derived')
    expect(ai?.sourceIds).not.toContain('kyounoryouri-toriteriyaki-kawano-2026')
    expect(ai?.sourceIds).toEqual([
      'caa-food-allergy-labeling-2026',
      'kikkoman-shoyu-allergen-2026',
      'sanj-glutenfree-shoyu-2026',
    ])
  })
})

// ---- E. Coherence ----

describe('MISSION 2.26 E — coherence source separation', () => {
  it('KO: isCoherenceReviewValid === true', () => {
    expect(isCoherenceReviewValid(tt())).toBe(true)
  })
  it('KP: NHK（process source）は sourceProcessNotes に必要。allergen source は不要', () => {
    const notes = tt().verification?.coherenceReview?.sourceProcessNotes ?? []
    const noteIds = notes.map((n) => n.sourceId)
    expect(noteIds).toEqual(['kyounoryouri-toriteriyaki-kawano-2026'])
    // allergen source は sourceProcessNotes に無いが coherence は valid
    for (const allergenSrc of ['caa-food-allergy-labeling-2026', 'kikkoman-shoyu-allergen-2026', 'sanj-glutenfree-shoyu-2026']) {
      expect(noteIds).not.toContain(allergenSrc)
    }
    expect(isCoherenceReviewValid(tt())).toBe(true)
  })
})

// ---- F. Allergy ----

describe('MISSION 2.26 F — allergy HARD EXCLUSION 無傷', () => {
  const base = { availableIngredientNames: ['鶏もも肉'], dislikeNames: [] as string[], maxCookingMinutes: null }
  it('KQ: 小麦 → HARD EXCLUDE', () => {
    expect(rankRecipes(RECIPE_CATALOG, { ...base, allergyNames: ['小麦'] }).some((c) => c.recipe.id === 'tori-teriyaki')).toBe(false)
  })
  it('KR: 大豆 → HARD EXCLUDE', () => {
    expect(rankRecipes(RECIPE_CATALOG, { ...base, allergyNames: ['大豆'] }).some((c) => c.recipe.id === 'tori-teriyaki')).toBe(false)
  })
  it('KS: 鶏肉 → HARD EXCLUDE', () => {
    expect(rankRecipes(RECIPE_CATALOG, { ...base, allergyNames: ['鶏肉'] }).some((c) => c.recipe.id === 'tori-teriyaki')).toBe(false)
  })
  it('KT: アレルギーなし → 通常どおり A 候補', () => {
    expect(rankRecipes(RECIPE_CATALOG, { ...base, allergyNames: [] }).find((c) => c.recipe.id === 'tori-teriyaki')?.category).toBe('A')
  })
  it('KU: allergyRelevantIngredients は 鶏もも肉 と しょうゆ を含む（VERIFIED 後も対象範囲不変）', () => {
    const rel = allergyRelevantIngredients(tt())
    expect(rel).toContain('鶏もも肉')
    expect(rel).toContain('しょうゆ')
  })
  it('KV: PRODUCT CHECK ALERT（しょうゆ）は残っている', () => {
    expect(tt().ingredientChecks?.some((c) => c.ingredientName === 'しょうゆ')).toBe(true)
  })
})

// ---- G. Stock ----

describe('MISSION 2.26 G — stock matching 無傷', () => {
  const base = { allergyNames: [] as string[], dislikeNames: [] as string[], maxCookingMinutes: null }
  it('KW: 鶏もも肉在庫 → exact match（A）', () => {
    expect(rankRecipes(RECIPE_CATALOG, { ...base, availableIngredientNames: ['鶏もも肉'] }).find((c) => c.recipe.id === 'tori-teriyaki')?.category).toBe('A')
  })
  it('KX: 鶏むね肉在庫 → no match', () => {
    expect(rankRecipes(RECIPE_CATALOG, { ...base, availableIngredientNames: ['鶏むね肉'] }).some((c) => c.recipe.id === 'tori-teriyaki')).toBe(false)
  })
  it('KY: generic 鶏肉在庫 → not exact match', () => {
    expect(rankRecipes(RECIPE_CATALOG, { ...base, availableIngredientNames: ['鶏肉'] }).find((c) => c.recipe.id === 'tori-teriyaki')?.category).not.toBe('A')
  })
})

// ---- H. Notes ----

describe('MISSION 2.26 H — reviewNotes / provenanceNotes', () => {
  it('KZ: reviewNotes === []（未解決の Recipe-Evidence 問題は無い）', () => {
    expect(tt().verification?.reviewNotes).toEqual([])
  })
  it('LA: provenanceNotes に監査履歴が保全されている（MISSION 2.18〜2.26）', () => {
    const prov = (tt().verification?.provenanceNotes ?? []).join('\n')
    expect((tt().verification?.provenanceNotes ?? []).length).toBeGreaterThan(10)
    expect(prov).toContain('MISSION 2.18 Batch 3')
    expect(prov).toContain('MISSION 2.19A')
    expect(prov).toContain('MISSION 2.19E-RESUME-2')
    expect(prov).toContain('MISSION 2.25（Japan Allergen Evidence）')
    expect(prov).toContain('MISSION 2.26（First VERIFIED Finalization）')
    // SOURCE A〜D の観測サマリ（Evidence 記録）も保全
    expect(prov).toContain('SOURCE A: kikkoman-toriteriyaki-2026')
    expect(prov).toContain('SOURCE D: kyounoryouri-toriteriyaki-kawano-2026')
  })
})

// ---- I. Unsupported inference ----

describe('MISSION 2.26 I — hasUnsupportedInference', () => {
  it('LB: hasUnsupportedInference === false（Recipe body に未支持推測値なし）', () => {
    expect(tt().verification?.hasUnsupportedInference).toBe(false)
  })
})

// ---- J. Recipe facts frozen ----

describe('MISSION 2.26 J — Recipe facts frozen', () => {
  it('LC: 食材・分量・人数・下ごしらえ・工程・器具 は 2.19E-RESUME-2 のまま不変', () => {
    const r = tt()
    expect(r.requiredIngredients).toEqual([{ name: '鶏もも肉', amount: '300g' }])
    expect(r.servingsBase).toBe(2)
    expect(r.seasonings).toEqual([
      { name: 'しょうゆ', amount: '大さじ1' },
      { name: 'みりん', amount: '大さじ1' },
      { name: '酒', amount: '大さじ1' },
      { name: '砂糖', amount: '小さじ1' },
      { name: '塩', amount: '少々' },
      { name: 'サラダ油', amount: '小さじ1' },
    ])
    expect(r.equipment).toEqual(['フライパン'])
    expect(r.preparation).toHaveLength(5)
    expect(r.preparation?.[0].passiveWait).toBe(true)
    expect(r.preparation?.[0].duration).toEqual({ kind: 'approximate', minutes: 30 })
    expect(r.steps).toEqual([
      'フライパンにサラダ油小さじ1を入れ、鶏もも肉を皮目を下にして並べ、中火で2〜3分焼く',
      '焼き色がついたら返し、ふたをして弱めの中火で3〜4分蒸し焼きにする',
      'ふたを取り、ペーパータオルで溶け出た脂を拭く',
      'あらかじめ混ぜ合わせたたれを回し入れる',
      '強めの中火で煮詰めながら、照りが出るまでからめる',
    ])
    expect(r.cookingLiquids).toBeUndefined()
  })
  it('LD: RecipeIdentity は事実のみ（NHK 帰属 / 本格 / 絶品 / 甘さ控えめ / 家庭的 などを含まない）', () => {
    const id = tt().verification?.recipeIdentity
    const idText = `${id?.variant}${id?.coreMethod}${id?.intendedTasteProfile}`
    for (const banned of ['NHK', '河野雅子', 'primary process anchor', '本格', '王道', '絶品', 'プロの味', '甘さ控えめ', '家庭的', '効かせ', 'ごく少量']) {
      expect(idText, banned).not.toContain(banned)
    }
    expect(id?.canonicalDish).toBe('鶏の照り焼き')
    expect(id?.intendedTasteProfile?.trim().length).toBeGreaterThan(0)
  })
})

// ---- K. No imported facts ----

describe('MISSION 2.26 K — no imported facts / no second variant', () => {
  it('LE: 他 source の要素を輸入していない', () => {
    const names = [
      ...tt().requiredIngredients.map((i) => i.name),
      ...(tt().seasonings ?? []).map((s) => s.name),
    ]
    for (const forbidden of ['ほんだし', '蜂蜜', 'はちみつ', '水', '小麦粉', '片栗粉', 'ケチャップ', 'ごま油', 'スナップえんどう']) {
      expect(names).not.toContain(forbidden)
    }
  })
  it('LF: 鶏の照り焼き の Recipe は 1 件（第2 variant 未実装）', () => {
    const teriyaki = RECIPE_CATALOG.filter((r) => r.verification?.recipeIdentity?.canonicalDish === '鶏の照り焼き')
    expect(teriyaki.map((r) => r.id)).toEqual(['tori-teriyaki'])
    expect(tt().verification?.recipeIdentity?.variantIdentity).toBeUndefined()
  })
})
