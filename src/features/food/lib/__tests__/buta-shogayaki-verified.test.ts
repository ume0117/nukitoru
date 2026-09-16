// ============================================================
// buta-shogayaki-verified.test.ts
//
// MISSION 2.31 — BUTA-SHOGAYAKI EVIDENCE-BACKED CORRECTION & VERIFIED #2。
//
// NHK きょうの料理・河野雅子「豚のしょうが焼き」を唯一の Primary Process Anchor として
// legacy Recipe を Correction し、Recipe Evidence / Process Coherence / Allergy Identity の
// 全 Gate を満たしたうえで NUKITORU FOOD Recipe Evidence VERIFIED #2 にする。
//
// 「VERIFIED を2件にする」ために事実を曲げない。安全性ゲートも弱めない。
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
import { allergyRelevantIngredients } from '../recipe-safety'
import { stockSatisfiesRecipeIngredient } from '../ingredient-taxonomy'
import { ingredientAllergenRelations } from '../ingredient-allergens'
import { getEvidenceSourceById } from '../evidence-sources'
import { computeContentFingerprint } from '../evidence-traceability'

const bs = () => RECIPE_CATALOG.find((r) => r.id === 'buta-shogayaki')!
const tt = () => RECIPE_CATALOG.find((r) => r.id === 'tori-teriyaki')!

// ------------------------------------------------------------
// A — final Recipe facts == NHK anchor process
// ------------------------------------------------------------
describe('MISSION 2.31 A — Recipe facts match NHK anchor', () => {
  it('MA: requiredIngredients は 豚肩ロース肉 200g ＋ 玉ねぎ 1/2個（100g）', () => {
    expect(bs().requiredIngredients).toEqual([
      { name: '豚肩ロース肉', amount: '200g' },
      { name: '玉ねぎ', amount: '1/2個（100g）' },
    ])
  })

  it('MB: seasonings は NHK anchor（みりん・しょうゆ 同量、しょうが小さじ2、小麦粉、油2用途）', () => {
    expect(bs().seasonings).toEqual([
      { name: 'しょうゆ', amount: '大さじ1と1/2' },
      { name: 'みりん', amount: '大さじ1と1/2' },
      { name: 'しょうが', amount: '小さじ2（すりおろし）' },
      { name: '小麦粉', amount: '適量' },
      { name: '油', amount: '小さじ1（玉ねぎ用）と大さじ1（豚肉用）' },
    ])
  })

  it('MC: 油の2用途を1つの算術合計へ潰していない（大さじ4 等にしていない）', () => {
    const oil = bs().seasonings?.find((s) => s.name === '油')!
    expect(oil.amount).toContain('小さじ1')
    expect(oil.amount).toContain('大さじ1')
    expect(oil.amount).not.toContain('大さじ4')
    expect(oil.amount).not.toContain('小さじ4')
  })

  it('MD: servingsBase 2 / equipment フライパン・茶こし', () => {
    expect(bs().servingsBase).toBe(2)
    expect(bs().equipment).toEqual(['フライパン', '茶こし'])
  })

  it('ME: preparation は NHK anchor の3工程（漬け込み・常温戻し・筋切り・塩こしょうを追加していない）', () => {
    const prep = bs().preparation ?? []
    expect(prep).toHaveLength(3)
    const joined = prep.map((p) => p.text).join(' ')
    expect(joined).toContain('小麦粉')
    expect(joined).toContain('くし形')
    for (const forbidden of ['漬け込', '常温', '筋切り', '筋を切', '塩', 'こしょう', 'フォーク']) {
      expect(joined.includes(forbidden), forbidden).toBe(false)
    }
    // Evidence にない所要時間を付けていない
    for (const p of prep) expect(p.duration).toBeUndefined()
  })

  it('MF: steps は NHK anchor の5工程（玉ねぎを先に炒めて取り出す→豚肉→戻す→たれ）', () => {
    const steps = bs().steps ?? []
    expect(steps).toHaveLength(5)
    expect(steps[0]).toContain('玉ねぎ')
    expect(steps[0]).toContain('約1分')
    expect(steps[0]).toContain('取り出す')
    expect(steps[4]).toContain('たれ')
    expect(steps[4]).toContain('強めの中火')
  })

  it('MG: steps に Evidence にない所要時間・ふた指示を発明していない', () => {
    const joined = (bs().steps ?? []).join(' ')
    // NHK が示すのは玉ねぎの「約1分」だけ。豚肉◯分・たれ◯秒は無い
    expect(joined).not.toMatch(/豚肉を?\d+分/)
    expect(joined).not.toMatch(/たれ.*\d+秒/)
    // ふた（lid）は source silence。「ふた」指示を入れない
    expect(joined).not.toContain('ふた')
    expect(joined).not.toContain('蓋')
  })

  it('MH: NHK anchor source は observation を持ち、fingerprint が provenanceNotes のサマリから再現できる', () => {
    const src = getEvidenceSourceById('kyounoryouri-butashogayaki-kawano-2026')!
    expect(src.observation?.contentFingerprint).toMatch(/^[0-9a-f]{64}$/)
    const anchorNote = (bs().verification?.provenanceNotes ?? []).find((n) => n.includes('NHK ANCHOR 観測サマリ'))
    expect(anchorNote, 'NHK ANCHOR 観測サマリが provenanceNotes に無い').toBeDefined()
    const m = anchorNote!.match(/「(2人分\|豚肩ロース肉\(薄切り\)200g[\s\S]*?みんなのきょうの料理)」/)
    expect(m, 'NHK ANCHOR 観測サマリ本文が抽出できない').not.toBeNull()
    expect(computeContentFingerprint(m![1])).toBe(src.observation?.contentFingerprint)
  })
})

// ------------------------------------------------------------
// B — no imported facts from other sources
// ------------------------------------------------------------
describe('MISSION 2.31 B — no imported facts (no hybrid)', () => {
  it('MI: キッコーマン／白ごはん.com／味の素KK の要素を輸入していない', () => {
    const names = [
      ...bs().requiredIngredients.map((i) => i.name),
      ...(bs().seasonings ?? []).map((s) => s.name),
    ]
    for (const forbidden of ['砂糖', '酒', 'ケチャップ', 'ごま油', 'にんにく', 'ほんだし', '味の素', 'こしょう', '豚ロース肉', '豚バラ肉']) {
      expect(names, forbidden).not.toContain(forbidden)
    }
  })

  it('MJ: verification.sourceIds の process source は NHK anchor 1件のみ（他は allergen/表示制度）', () => {
    const v = bs().verification!
    expect(v.sourceIds).toContain('kyounoryouri-butashogayaki-kawano-2026')
    // corroborator（キッコーマン・白ごはん.com）を Recipe Evidence の source に格上げしていない
    expect(v.sourceIds).not.toContain('kikkoman-butashogayaki-2026')
    expect(v.sourceIds).not.toContain('sirogohan-butashogayaki-2026')
  })

  it('MK: coherence の process note は NHK anchor 1件のみ（allergen source は入らない）', () => {
    const notes = bs().verification?.coherenceReview?.sourceProcessNotes ?? []
    expect(notes.map((n) => n.sourceId)).toEqual(['kyounoryouri-butashogayaki-kawano-2026'])
  })

  it('ML: 豚の生姜焼き の Recipe は 1 件（第2 variant 未実装）', () => {
    const dish = RECIPE_CATALOG.filter((r) => r.verification?.recipeIdentity?.canonicalDish === '豚の生姜焼き')
    expect(dish.map((r) => r.id)).toEqual(['buta-shogayaki'])
    expect(bs().verification?.recipeIdentity?.variantIdentity).toBeUndefined()
  })
})

// ------------------------------------------------------------
// C / D / E — VERIFIED gate
// ------------------------------------------------------------
describe('MISSION 2.31 C/D/E — VERIFIED gate', () => {
  it('MM: status === "verified" かつ全 gate 満たす', () => {
    expect(bs().verification?.status).toBe('verified')
    expect(bs().verification?.hasUnsupportedInference).toBe(false)
    expect(bs().verification?.reviewNotes).toEqual([])
    expect(isCoherenceReviewValid(bs())).toBe(true)
  })

  it('MN: applicable な Recipe-Evidence field はすべて direct / derived で解決', () => {
    const fvMap = new Map((bs().verification?.fieldVerifications ?? []).map((f) => [f.field, f]))
    for (const field of applicableFieldsFor(bs())) {
      const fv = fvMap.get(field)
      expect(fv, `missing FV for ${field}`).toBeDefined()
      expect(['direct', 'derived']).toContain(fv!.supportType)
      if (fv!.supportType === 'derived') expect((fv!.derivation ?? '').trim().length).toBeGreaterThan(0)
    }
  })

  it('MO: allergyIdentity は derived（NHK direct ではない）', () => {
    const ai = (bs().verification?.fieldVerifications ?? []).find((f) => f.field === 'allergyIdentity')
    expect(ai?.supportType).toBe('derived')
    expect(ai?.sourceIds).not.toContain('kyounoryouri-butashogayaki-kawano-2026')
  })

  it('MP: isRecipePublishable(buta-shogayaki) === true', () => {
    expect(isRecipePublishable(bs())).toBe(true)
  })

  it('MQ: catalog の VERIFIED は tori-teriyaki（#1）・buta-shogayaki（#2）・medama-yaki（#3・PUBLIC BETA RELEASE SPRINT 1C）', () => {
    expect(RECIPE_CATALOG.filter((r) => r.verification?.status === 'verified').map((r) => r.id)).toEqual([
      'tori-teriyaki',
      'buta-shogayaki',
      'nikujaga',
      'medama-yaki',
      'yudofu',
      'niku-udon',
      'napolitan',
    ])
    expect(RECIPE_CATALOG.filter((r) => isRecipePublishable(r)).map((r) => r.id)).toEqual([
      'tori-teriyaki',
      'buta-shogayaki',
      'nikujaga',
      'medama-yaki',
      'yudofu',
      'niku-udon',
      'napolitan',
    ])
  })
})

// ------------------------------------------------------------
// F / G / H — Product Time firewall (Decision B)
// ------------------------------------------------------------
describe('MISSION 2.31 F/G/H — Product Time firewall', () => {
  it('MR: productTimeStatus === "review"', () => {
    expect(productTimeStatusOf(bs())).toBe('review')
  })

  it('MS: productCookingTimeMinutes === null / not established', () => {
    expect(productCookingTimeMinutes(bs())).toBeNull()
    expect(isProductCookingTimeEstablished(bs())).toBe(false)
  })

  it('MT: sourceStatedTotal は exact 15分（NHK）。excludes は無い（除外注記なし）', () => {
    const sst = bs().verification?.timeVerification?.sourceStatedTotal
    expect(sst?.value).toEqual({ kind: 'exact', minutes: 15 })
    expect(sst?.sourceIds).toEqual(['kyounoryouri-butashogayaki-kawano-2026'])
    expect(sst?.excludes).toBeUndefined()
    // 算術（elapsedToReady / activeWork）はしていない
    expect(bs().verification?.timeVerification?.elapsedToReady).toBeUndefined()
    expect(bs().verification?.timeVerification?.activeWork).toBeUndefined()
  })

  it('MU: strict「15分以内」フィルタは buta-shogayaki を含めない', () => {
    const ranked = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['豚肩ロース肉', '玉ねぎ'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: 15,
    })
    expect(ranked.some((c) => c.recipe.id === 'buta-shogayaki')).toBe(false)
  })

  it('MV: legacy cookingTimeMinutes=15 はデータ上残るが Product Time ではない', () => {
    expect(bs().cookingTimeMinutes).toBe(15)
    expect(productCookingTimeMinutes(bs())).toBeNull()
  })
})

// ------------------------------------------------------------
// I / J / K — allergy HARD EXCLUSION
// ------------------------------------------------------------
describe('MISSION 2.31 I/J/K — allergy HARD EXCLUSION', () => {
  const base = { availableIngredientNames: ['豚肩ロース肉', '玉ねぎ'], dislikeNames: [] as string[], maxCookingMinutes: null }
  const excluded = (allergyNames: string[]) =>
    rankRecipes(RECIPE_CATALOG, { ...base, allergyNames }).some((c) => c.recipe.id === 'buta-shogayaki')

  it('MW: 小麦 → HARD EXCLUDE（小麦粉 contains ＋ しょうゆ default-generic-risk）', () => {
    expect(excluded(['小麦'])).toBe(false)
  })
  it('MX: 大豆 → HARD EXCLUDE（しょうゆ default-generic-risk）', () => {
    expect(excluded(['大豆'])).toBe(false)
  })
  it('MY: 豚肉 → HARD EXCLUDE（豚肩ロース肉 → 豚肉 taxonomy）', () => {
    expect(excluded(['豚肉'])).toBe(false)
  })
  it('MZ: アレルギーなし → 通常どおり A 候補', () => {
    expect(rankRecipes(RECIPE_CATALOG, { ...base, allergyNames: [] }).find((c) => c.recipe.id === 'buta-shogayaki')?.category).toBe('A')
  })
  it('NA: allergyRelevantIngredients は 豚肩ロース肉・しょうゆ・小麦粉 を含む', () => {
    const rel = allergyRelevantIngredients(bs())
    expect(rel).toContain('豚肩ロース肉')
    expect(rel).toContain('しょうゆ')
    expect(rel).toContain('小麦粉')
  })
  it('NB: PRODUCT CHECK ALERT は しょうゆ ＋ 油（MISSION 2.31A、generic-category）', () => {
    const checks = (bs().ingredientChecks ?? []).map((c) => c.ingredientName)
    expect(checks).toContain('しょうゆ')
    expect(checks).toContain('油')
  })
})

// ------------------------------------------------------------
// L / M / N — stock matching firewall (unchanged)
// ------------------------------------------------------------
describe('MISSION 2.31 L/M/N — stock matching firewall', () => {
  it('NC: 豚肩ロース肉在庫 → 豚肩ロース肉 recipe は exact MATCH（A）', () => {
    expect(stockSatisfiesRecipeIngredient('豚肩ロース肉', '豚肩ロース肉')).toBe(true)
    const ranked = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['豚肩ロース肉', '玉ねぎ'],
      allergyNames: [], dislikeNames: [], maxCookingMinutes: null,
    })
    expect(ranked.find((c) => c.recipe.id === 'buta-shogayaki')?.category).toBe('A')
  })
  it('ND: 豚ロース肉在庫 は 豚肩ロース肉 recipe を満たさない', () => {
    expect(stockSatisfiesRecipeIngredient('豚ロース肉', '豚肩ロース肉')).toBe(false)
    const ranked = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['豚ロース肉', '玉ねぎ'],
      allergyNames: [], dislikeNames: [], maxCookingMinutes: null,
    })
    expect(ranked.find((c) => c.recipe.id === 'buta-shogayaki')?.category).not.toBe('A')
  })
  it('NE: generic 豚肉在庫 は 豚肩ロース肉 recipe を exact match にしない', () => {
    expect(stockSatisfiesRecipeIngredient('豚肉', '豚肩ロース肉')).toBe(false)
    const ranked = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['豚肉', '玉ねぎ'],
      allergyNames: [], dislikeNames: [], maxCookingMinutes: null,
    })
    expect(ranked.find((c) => c.recipe.id === 'buta-shogayaki')?.category).not.toBe('A')
  })
})

// ------------------------------------------------------------
// O — 小麦粉 relation の false-positive firewall
// ------------------------------------------------------------
describe('MISSION 2.31 O — 小麦粉 relation は false-positive を生まない', () => {
  it('NF: 米粉・片栗粉・パン粉 → 小麦 は推測しない', () => {
    for (const name of ['米粉', '片栗粉', 'パン粉', 'コーンスターチ']) {
      expect(ingredientAllergenRelations(name)).toEqual([])
    }
  })
  it('NG: 片栗粉だけ（しょうゆ無し）の recipe は 小麦 アレルギーで消えない', () => {
    const katakuriOnly = {
      id: 'nf-katakuri', name: 'nf', type: 'main' as const,
      requiredIngredients: [{ name: '鶏むね肉', amount: '200g' }],
      seasonings: [{ name: '片栗粉', amount: '大さじ2' }, { name: '塩', amount: '少々' }],
      cookingTimeMinutes: 15, servingsBase: 2, steps: ['焼く'],
    }
    const ranked = rankRecipes([katakuriOnly], {
      availableIngredientNames: ['鶏むね肉'],
      allergyNames: ['小麦'], dislikeNames: [], maxCookingMinutes: null,
    })
    expect(ranked.some((c) => c.recipe.id === 'nf-katakuri')).toBe(true)
  })
})

// ------------------------------------------------------------
// P / Q / R — VERIFIED #1 (tori-teriyaki) regression firewall
// ------------------------------------------------------------
describe('MISSION 2.31 P/Q/R — VERIFIED #1 無傷', () => {
  it('NH: tori-teriyaki は VERIFIED / publishable のまま', () => {
    expect(tt().verification?.status).toBe('verified')
    expect(isRecipePublishable(tt())).toBe(true)
  })
  it('NI: tori-teriyaki の Recipe facts は不変', () => {
    expect(tt().requiredIngredients).toEqual([{ name: '鶏もも肉', amount: '300g' }])
    expect(tt().seasonings).toEqual([
      { name: 'しょうゆ', amount: '大さじ1' },
      { name: 'みりん', amount: '大さじ1' },
      { name: '酒', amount: '大さじ1' },
      { name: '砂糖', amount: '小さじ1' },
      { name: '塩', amount: '少々' },
      { name: 'サラダ油', amount: '小さじ1' },
    ])
    expect(tt().steps).toHaveLength(5)
    expect(tt().preparation).toHaveLength(5)
  })
  it('NJ: VERIFIED #1 の Product Time は引き続き review / excludes 30分', () => {
    expect(productTimeStatusOf(tt())).toBe('review')
    expect(productCookingTimeMinutes(tt())).toBeNull()
    expect(tt().verification?.timeVerification?.sourceStatedTotal?.excludes).toEqual([
      { kind: 'restingMinutes', value: { kind: 'approximate', minutes: 30 }, sourceIds: ['kyounoryouri-toriteriyaki-kawano-2026'] },
    ])
  })
})

// ------------------------------------------------------------
// Explainability — recipeIdentity は評価語を含まない
// ------------------------------------------------------------
describe('MISSION 2.31 — RecipeIdentity は事実のみ', () => {
  it('NK: 評価語（家庭的 / おいしい / 本格的 / 王道 / 絶品 / 甘辛 / NHK 帰属）を含まない', () => {
    const id = bs().verification?.recipeIdentity
    const text = `${id?.variant}${id?.coreMethod}${id?.intendedTasteProfile}`
    for (const banned of ['家庭的', 'おいしい', '本格', '王道', '絶品', '甘辛', 'しょうがが効いた', 'NHK', '河野雅子', 'primary process anchor']) {
      expect(text, banned).not.toContain(banned)
    }
    expect(id?.canonicalDish).toBe('豚の生姜焼き')
    expect(id?.definingIngredients).toEqual(['豚肩ロース肉', '玉ねぎ'])
  })
})
