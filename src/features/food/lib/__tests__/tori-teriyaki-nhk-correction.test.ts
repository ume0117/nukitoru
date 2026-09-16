// ============================================================
// tori-teriyaki-nhk-correction.test.ts
//
// MISSION 2.19E-RESUME-2 — tori-teriyaki NHK-anchored Evidence Correction。
//
// MISSION 2.19D で承認された Correction Candidate を、MISSION 2.20（Preparation/
// Product Time foundation）と MISSION 2.21（Ingredient taxonomy foundation）の上へ
// 実装したことを固定化する。
//
// PRIMARY PROCESS ANCHOR: NHK みんなのきょうの料理「鶏の照り焼き」/ 河野雅子
//   (kyounoryouri-toriteriyaki-kawano-2026)
//
// 完了後も status='review' / isRecipePublishable=false（VERIFIED にはしない）。
// ============================================================

import { describe, it, expect } from 'vitest'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { isRecipePublishable, isCoherenceReviewValid, applicableFieldsFor } from '../recipe-publishability'
import { productTimeStatusOf, productCookingTimeMinutes, isProductCookingTimeEstablished } from '../recipe-time'
import { rankRecipes } from '../recipe-suggestion-engine'
import { allergyRelevantIngredients } from '../recipe-safety'
import { mockMealProvider } from '../mock-meal-provider'
import type { Ingredient } from '@/features/food/types'

const tt = RECIPE_CATALOG.find((r) => r.id === 'tori-teriyaki')!
// MISSION 2.26: 監査履歴・source比較・provenance は provenanceNotes へ移動（reviewNotes は空）
const notes = [
  ...(tt.verification?.reviewNotes ?? []),
  ...(tt.verification?.provenanceNotes ?? []),
].join('\n')

describe('MISSION 2.19E-RESUME-2 — ingredient / seasoning / oil facts', () => {
  it('HA: requiredIngredients = 鶏もも肉 300g', () => {
    expect(tt.requiredIngredients).toEqual([{ name: '鶏もも肉', amount: '300g' }])
    expect(tt.servingsBase).toBe(2)
  })

  it('HB: seasonings = NHK 合わせだれ（しょうゆ/みりん/酒 各大さじ1 + 砂糖 小さじ1 + 塩 少々）+ サラダ油 小さじ1', () => {
    expect(tt.seasonings).toEqual([
      { name: 'しょうゆ', amount: '大さじ1' },
      { name: 'みりん', amount: '大さじ1' },
      { name: '酒', amount: '大さじ1' },
      { name: '砂糖', amount: '小さじ1' },
      { name: '塩', amount: '少々' },
      { name: 'サラダ油', amount: '小さじ1' },
    ])
  })

  it('HC: cooking oil は seasonings に「サラダ油 小さじ1」として保存（適量/少々/なし ではない）', () => {
    const oil = tt.seasonings?.find((s) => s.name === 'サラダ油')
    expect(oil?.amount).toBe('小さじ1')
  })

  it('HD: legacy の unsupported 値は残っていない（しょうゆ大さじ1と1/2・砂糖大さじ1・菜箸）', () => {
    const amounts = (tt.seasonings ?? []).map((s) => s.amount)
    expect(amounts).not.toContain('大さじ1と1/2')
    expect(tt.seasonings?.find((s) => s.name === '砂糖')?.amount).not.toBe('大さじ1')
    expect(tt.equipment).toEqual(['フライパン'])
  })

  it('HE: 他 source の要素を輸入していない（ほんだし/蜂蜜/水/小麦粉/片栗粉/ケチャップ/ごま油）', () => {
    const names = (tt.seasonings ?? []).map((s) => s.name)
    for (const forbidden of ['ほんだし', '蜂蜜', 'はちみつ', '水', '小麦粉', '片栗粉', 'ケチャップ', 'ごま油']) {
      expect(names).not.toContain(forbidden)
    }
    expect(tt.cookingLiquids).toBeUndefined()
    expect(tt.requiredIngredients.map((i) => i.name)).not.toContain('スナップえんどう')
  })
})

describe('MISSION 2.19E-RESUME-2 — preparation (MISSION 2.20 model)', () => {
  it('HF: preparation は5工程、steps とは別枠', () => {
    expect(tt.preparation).toHaveLength(5)
    const prepText = (tt.preparation ?? []).map((p) => p.text).join(' ')
    const stepText = (tt.steps ?? []).join(' ')
    // 下ごしらえ用語は preparation 側にだけある
    expect(prepText).toContain('室温に戻す')
    expect(prepText).toContain('切り目')
    expect(stepText).not.toContain('室温')
    expect(stepText).not.toContain('切り目')
  })

  it('HG: prep[0] 室温戻し = passiveWait true / duration approximate 30分（exact化していない）', () => {
    const p0 = tt.preparation![0]
    expect(p0.passiveWait).toBe(true)
    expect(p0.duration).toEqual({ kind: 'approximate', minutes: 30 })
  })

  it('HH: prep 2〜5 に Evidence にない所要時間を付けていない', () => {
    for (const p of tt.preparation!.slice(1)) {
      expect(p.duration).toBeUndefined()
      expect(p.passiveWait).toBeUndefined()
    }
  })

  it('HI: prep 内容 = 脂肪を除く / 切り目 / 3等分（計6切れ）/ たれを事前に混ぜる', () => {
    const texts = tt.preparation!.map((p) => p.text)
    expect(texts.some((t) => t.includes('余分な脂肪を除く'))).toBe(true)
    expect(texts.some((t) => t.includes('切り目'))).toBe(true)
    expect(texts.some((t) => t.includes('3等分') && t.includes('6切れ'))).toBe(true)
    expect(texts.some((t) => t.includes('たれ') && t.includes('混ぜ'))).toBe(true)
  })
})

describe('MISSION 2.19E-RESUME-2 — cooking steps (NHK process order)', () => {
  it('HJ: steps = 皮目 → 返してふた蒸し焼き → 脂を拭く → たれ → 照り煮からめ', () => {
    expect(tt.steps).toEqual([
      'フライパンにサラダ油小さじ1を入れ、鶏もも肉を皮目を下にして並べ、中火で2〜3分焼く',
      '焼き色がついたら返し、ふたをして弱めの中火で3〜4分蒸し焼きにする',
      'ふたを取り、ペーパータオルで溶け出た脂を拭く',
      'あらかじめ混ぜ合わせたたれを回し入れる',
      '強めの中火で煮詰めながら、照りが出るまでからめる',
    ])
  })

  it('HK: 皮2〜3分 / 蒸し焼き3〜4分は保持、仕上げ工程に発明した所要時間は無い', () => {
    const s = tt.steps ?? []
    expect(s[0]).toContain('2〜3分')
    expect(s[1]).toContain('3〜4分')
    // 最後の照り工程に「◯分」が入っていない
    expect(s[4]).not.toMatch(/\d+分/)
  })

  it('HL: 脂を拭く工程がたれ工程より前', () => {
    const s = tt.steps ?? []
    const wipe = s.findIndex((x) => x.includes('脂を拭く'))
    const tare = s.findIndex((x) => x.includes('たれを回し入れる'))
    expect(wipe).toBeGreaterThanOrEqual(0)
    expect(tare).toBeGreaterThan(wipe)
  })
})

describe('MISSION 2.19E-RESUME-2 — Product Time firewall (MISSION 2.20)', () => {
  it('HM: productTimeStatus = review / productCookingTimeMinutes = null / not established', () => {
    expect(productTimeStatusOf(tt)).toBe('review')
    expect(productCookingTimeMinutes(tt)).toBeNull()
    expect(isProductCookingTimeEstablished(tt)).toBe(false)
  })

  it('HN: legacy cookingTimeMinutes=15 はデータ上残るが推測変更していない', () => {
    expect(tt.cookingTimeMinutes).toBe(15)
  })

  it('HO: strict max-time フィルタは 15 を established として扱わない（15分以内で候補にしない）', () => {
    const ranked = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['鶏もも肉', 'しょうゆ', 'みりん', '酒', '砂糖', '塩', 'サラダ油'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: 15,
    })
    expect(ranked.some((c) => c.recipe.id === 'tori-teriyaki')).toBe(false)
  })

  it('HP: max-time フィルタ無しなら候補に入る（鶏もも肉在庫）', () => {
    const ranked = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['鶏もも肉'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked.some((c) => c.recipe.id === 'tori-teriyaki')).toBe(true)
  })

  it('HQ: mockMealProvider の estimatedMinutes は null（確定した約◯分を出さない）', async () => {
    const ing = (name: string): Ingredient => ({ id: name, name, quantityMode: 'exact' })
    const res = await mockMealProvider.suggest({
      ingredients: [ing('鶏もも肉'), ing('しょうゆ'), ing('みりん'), ing('酒'), ing('砂糖'), ing('塩'), ing('サラダ油')],
      cookingPreference: { maxCookingMinutes: null, shoppingMode: 'none' },
    })
    const s = res.suggestions.find((x) => x.recipeId === 'tori-teriyaki')
    expect(s).toBeDefined()
    expect(s!.estimatedMinutes).toBeNull()
  })

  it('HR: sourceStatedTotal = 15分（NHK）／除外スコープは MISSION 2.26 で machine-readable な excludes に', () => {
    const sst = tt.verification?.timeVerification?.sourceStatedTotal
    expect(sst?.value).toEqual({ kind: 'exact', minutes: 15 })
    expect(sst?.sourceIds).toEqual(['kyounoryouri-toriteriyaki-kawano-2026'])
    expect(sst?.excludes).toEqual([
      {
        kind: 'restingMinutes',
        value: { kind: 'approximate', minutes: 30 },
        sourceIds: ['kyounoryouri-toriteriyaki-kawano-2026'],
      },
    ])
    // 除外スコープの説明は provenanceNotes にも残る（英語で）
    expect(notes.toLowerCase()).toContain('excludes approximately 30 minutes')
  })
})

describe('MISSION 2.19E-RESUME-2 — Evidence traceability / coherence / status', () => {
  it('HS: process 系 fieldVerification は NHK anchor の direct（allergyIdentity のみ MISSION 2.26 で derived）', () => {
    const fvs = tt.verification?.fieldVerifications ?? []
    expect(fvs.length).toBeGreaterThan(0)
    for (const fv of fvs.filter((f) => f.field !== 'allergyIdentity')) {
      expect(fv.supportType).toBe('direct')
      expect(fv.sourceIds).toEqual(['kyounoryouri-toriteriyaki-kawano-2026'])
    }
    expect(fvs.some((f) => f.field === 'preparation')).toBe(true)
    // cookingTimeMinutes は productTimeStatus=review のため非該当（Decision B）
    expect(fvs.some((f) => f.field === 'cookingTimeMinutes')).toBe(false)
    // allergyIdentity は derived（NHK は allergen 分類を確立しない）
    const ai = fvs.find((f) => f.field === 'allergyIdentity')
    expect(ai?.supportType).toBe('derived')
    expect(ai?.sourceIds).not.toContain('kyounoryouri-toriteriyaki-kawano-2026')
    expect((ai?.derivation ?? '').length).toBeGreaterThan(0)
  })

  it('HT: recipeIdentity は NHK-family process を記述（甘さ控えめ/本格/絶品 等の未支持表現なし）', () => {
    const id = tt.verification?.recipeIdentity
    expect(id?.canonicalDish).toBe('鶏の照り焼き')
    expect(id?.definingIngredients).toEqual(['鶏もも肉'])
    const idText = `${id?.variant}${id?.coreMethod}${id?.intendedTasteProfile}`
    for (const banned of ['本格', '王道', 'プロの味', '絶品']) {
      expect(idText).not.toContain(banned)
    }
    expect(idText).toContain('ふた')
    expect(idText).toContain('蒸し焼き')
  })

  it('HU: coherenceReview は構造的に妥当な coherent（単一 NHK source）', () => {
    expect(tt.verification?.coherenceReview?.status).toBe('coherent')
    expect(isCoherenceReviewValid(tt)).toBe(true)
    const noteIds = tt.verification?.coherenceReview?.sourceProcessNotes.map((n) => n.sourceId)
    expect(noteIds).toEqual(['kyounoryouri-toriteriyaki-kawano-2026'])
  })

  it('HV: MISSION 2.26 — hasUnsupportedInference = false（Recipe body に未支持推測値なし。Product Time 未確定は対象外）', () => {
    expect(tt.verification?.hasUnsupportedInference).toBe(false)
    // 意味論の明確化は provenanceNotes に記録
    expect(notes).toContain('未支持の推測値は残っていない')
  })

  it('HW: MISSION 2.26 — status=verified / isRecipePublishable=true / Product Time は別 dimension で review', () => {
    expect(tt.verification?.status).toBe('verified')
    expect(isRecipePublishable(tt)).toBe(true)
    expect(tt.verification?.timeVerification?.productTimeStatus).toBe('review')
    expect(RECIPE_CATALOG.filter((r) => r.verification?.status === 'verified').map((r) => r.id)).toEqual(['tori-teriyaki', 'buta-shogayaki', 'nikujaga', 'medama-yaki', 'yudofu', 'niku-udon', 'napolitan'])
  })

  it('HX: 監査履歴（BEFORE→ANCHOR→CORROBORATION→AFTER / no-import / provenance）は provenanceNotes に保持', () => {
    expect(tt.verification?.reviewNotes).toEqual([])
    const prov = (tt.verification?.provenanceNotes ?? []).join('\n')
    expect(prov).toContain('BEFORE → ANCHOR → CORROBORATION → AFTER')
    expect(prov).toContain('PRIMARY PROCESS ANCHOR')
    expect(prov).toContain('ABSOLUTE NO-IMPORT')
    expect(prov).toContain('FUTURE_SECOND_VARIANT_CANDIDATE = YES')
  })
})

describe('MISSION 2.19E-RESUME-2 — ingredient specificity & allergy safety (MISSION 2.21)', () => {
  it('HY: 鶏もも肉在庫→exact MATCH / 鶏むね肉→NO MATCH / 鶏肉generic→category match（discoverableだがexactではない、PUBLIC BETA RELEASE SPRINT 2）', () => {
    const base = { allergyNames: [] as string[], dislikeNames: [] as string[], maxCookingMinutes: null }
    const exactCandidate = rankRecipes(RECIPE_CATALOG, { ...base, availableIngredientNames: ['鶏もも肉'] })
      .find((c) => c.recipe.id === 'tori-teriyaki')
    expect(exactCandidate?.category).toBe('A')
    expect(exactCandidate?.categoryMatchedIngredients).toEqual([])
    expect(
      rankRecipes(RECIPE_CATALOG, { ...base, availableIngredientNames: ['鶏むね肉'] })
        .some((c) => c.recipe.id === 'tori-teriyaki'),
    ).toBe(false)
    const genericCandidate = rankRecipes(RECIPE_CATALOG, { ...base, availableIngredientNames: ['鶏肉'] })
      .find((c) => c.recipe.id === 'tori-teriyaki')
    expect(genericCandidate?.category).toBe('A')
    expect(genericCandidate?.categoryMatchedIngredients).toEqual(['鶏もも肉'])
  })

  it('HZ: 鶏肉アレルギー → tori-teriyaki は HARD EXCLUDE', () => {
    // allergyRelevantIngredients には 鶏もも肉 が含まれる
    expect(allergyRelevantIngredients(tt)).toContain('鶏もも肉')
    const ranked = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['鶏もも肉'],
      allergyNames: ['鶏肉'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(ranked.some((c) => c.recipe.id === 'tori-teriyaki')).toBe(false)
  })
})

describe('MISSION 2.22 — metadata wording cleanup (culinary facts unchanged)', () => {
  it('IB: recipeIdentity.variant に provenance（NHK 帰属）文が残っていない', () => {
    const v = tt.verification?.recipeIdentity?.variant ?? ''
    expect(v).not.toContain('NHK')
    expect(v).not.toContain('河野雅子')
    expect(v).not.toContain('primary process anchor')
    // culinary な記述は保持
    expect(v).toContain('小麦粉をまぶさず')
    expect(v).toContain('蒸し焼き')
  })

  it('IC: intendedTasteProfile は taste 推論語（効かせ/ごく少量/家庭的/本格/絶品）を含まない', () => {
    const t = tt.verification?.recipeIdentity?.intendedTasteProfile ?? ''
    for (const banned of ['効かせ', 'ごく少量', '家庭的', '本格', '絶品', '王道', 'プロの味']) {
      expect(t).not.toContain(banned)
    }
    expect(t.trim().length).toBeGreaterThan(0) // VERIFIED 要件上、空にはしない
  })

  it('ID: provenance は fieldVerifications / coherenceReview / provenanceNotes 側に保持されている', () => {
    const fvs = tt.verification?.fieldVerifications ?? []
    // process field は NHK anchor（allergyIdentity は MISSION 2.26 で allergen source）
    expect(fvs.filter((f) => f.field !== 'allergyIdentity').every((f) => f.sourceIds[0] === 'kyounoryouri-toriteriyaki-kawano-2026')).toBe(true)
    expect(tt.verification?.coherenceReview?.rationale).toContain('NHK')
    expect((tt.verification?.provenanceNotes ?? []).join('\n')).toContain('PRIMARY PROCESS ANCHOR')
  })

  it('IE: culinary fact は MISSION 2.22/2.26 でも不変（分量・工程・下ごしらえ）／status は 2.26 で verified', () => {
    expect(tt.requiredIngredients).toEqual([{ name: '鶏もも肉', amount: '300g' }])
    expect(tt.seasonings?.map((s) => `${s.name}${s.amount}`)).toEqual([
      'しょうゆ大さじ1', 'みりん大さじ1', '酒大さじ1', '砂糖小さじ1', '塩少々', 'サラダ油小さじ1',
    ])
    expect(tt.preparation).toHaveLength(5)
    expect(tt.steps).toHaveLength(5)
    expect(tt.verification?.status).toBe('verified')
    expect(tt.verification?.timeVerification?.productTimeStatus).toBe('review')
    expect(isRecipePublishable(tt)).toBe(true)
  })
})

describe('MISSION 2.19E-RESUME-2 — second variant freeze', () => {
  it('IA: 職人醤油/白扇酒造 variant の Recipe は作成されていない', () => {
    // canonicalDish 鶏の照り焼き の Recipe は 1 件だけ
    const teriyaki = RECIPE_CATALOG.filter(
      (r) => r.verification?.recipeIdentity?.canonicalDish === '鶏の照り焼き',
    )
    expect(teriyaki.map((r) => r.id)).toEqual(['tori-teriyaki'])
    expect(tt.verification?.recipeIdentity?.variantIdentity).toBeUndefined()
  })
})
