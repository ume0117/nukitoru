// ============================================================
// batch1-evidence-resolution.test.ts
//
// MISSION 2.16 — Verified Starter Set / Evidence Resolution Batch 1。
//
// Batch 1で再調査した5 recipe（hiyayakko / maguro-don / gyudon / oyako-don /
// tofu-miso-soup）について:
//   - Recipe fact（材料・分量・調味・液体・手順・時間・人数・器具）が
//     Batch 1で一切変わっていないこと（凍結）
//   - RecipeIdentity が維持されていること
//   - verification status が review のまま（VERIFIEDへ昇格していない）こと
//   - isRecipePublishable が false のままであること
//   - 再調査で開いた source が catalog に登録され、recipe に linked されていること
// を固定化する。
//
// 併せて、Evidence以外のGate（Allergy HARD / Candidate A/B / max-3 /
// Recipe Coherence / Source Silence / Cooking Time / From-Now-to-Table）の
// 回帰も確認する。
// ============================================================

import { describe, it, expect } from 'vitest'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { EVIDENCE_SOURCE_CATALOG, getEvidenceSourceById } from '../evidence-sources'
import { isRecipePublishable } from '../recipe-publishability'
import { rankRecipes } from '../recipe-suggestion-engine'
import { allergyRelevantIngredients } from '../recipe-safety'
import { selectBetaCandidates, BETA_MAX_CANDIDATES } from '../beta-presentation'
import { isEligibleForMaxElapsedTime } from '../recipe-time'
import { deriveFromNowToTable } from '../from-now-to-table'

const BATCH1_IDS = ['hiyayakko', 'maguro-don', 'gyudon', 'oyako-don', 'tofu-miso-soup'] as const

function recipe(id: string) {
  const r = RECIPE_CATALOG.find((x) => x.id === id)
  if (!r) throw new Error(`recipe not found: ${id}`)
  return r
}

describe('MISSION 2.16 — Evidence Resolution Batch 1', () => {
  // ---- Recipe fact freeze（Batch 1では0件の fact 変更） ----

  it('BA: hiyayakko の Recipe fact は Batch 1 で凍結', () => {
    const r = recipe('hiyayakko')
    expect(r.requiredIngredients).toEqual([{ name: '豆腐', amount: '1/2丁' }])
    expect(r.seasonings).toEqual([{ name: 'しょうゆ', amount: '小さじ1' }])
    expect(r.cookingTimeMinutes).toBe(5)
    expect(r.servingsBase).toBe(1)
    expect(r.steps).toEqual(['豆腐を食べやすい大きさに切る', '器に盛り、しょうゆをかける'])
    expect(r.cookingLiquids).toBeUndefined()
  })

  it('BB: maguro-don の Recipe fact は Batch 1 で凍結', () => {
    const r = recipe('maguro-don')
    expect(r.requiredIngredients).toEqual([
      { name: 'ごはん', amount: '2杯分' },
      { name: 'マグロ', amount: '200g' },
    ])
    expect(r.seasonings).toEqual([{ name: 'しょうゆ', amount: '大さじ1' }])
    expect(r.cookingTimeMinutes).toBe(15)
    expect(r.servingsBase).toBe(2)
    expect(r.steps).toHaveLength(4)
  })

  it('BC: gyudon の Recipe fact は Batch 1 で凍結', () => {
    const r = recipe('gyudon')
    expect(r.requiredIngredients).toEqual([
      { name: 'ごはん', amount: '2杯分' },
      { name: '牛肉', amount: '200g' },
      { name: '玉ねぎ', amount: '1/2個' },
    ])
    expect(r.seasonings).toEqual([
      { name: 'しょうゆ', amount: '大さじ2' },
      { name: 'みりん', amount: '大さじ3' },
      { name: '砂糖', amount: '大さじ1' },
      { name: '酒', amount: '100ml' },
    ])
    expect(r.cookingLiquids).toEqual([{ name: '水', amount: '100ml' }])
    expect(r.cookingTimeMinutes).toBe(30)
    expect(r.servingsBase).toBe(2)
  })

  it('BD: oyako-don の Recipe fact は Batch 1 で凍結（Kikkoman washoku/020 と一致のまま）', () => {
    const r = recipe('oyako-don')
    expect(r.requiredIngredients).toEqual([
      { name: 'ごはん', amount: '2杯分' },
      { name: '鶏肉', amount: '1/2枚（100〜120g）' },
      { name: '卵', amount: '3個' },
      { name: '玉ねぎ', amount: '1/2個' },
    ])
    expect(r.seasonings).toEqual([
      { name: 'しょうゆ', amount: '大さじ2' },
      { name: 'みりん', amount: '大さじ3' },
    ])
    expect(r.cookingLiquids).toEqual([{ name: '水', amount: '150ml' }])
    expect(r.cookingTimeMinutes).toBe(15)
    expect(r.servingsBase).toBe(2)
  })

  it('BE: tofu-miso-soup の Recipe fact は Batch 1 で凍結（味噌大さじ1と1/2のまま）', () => {
    const r = recipe('tofu-miso-soup')
    expect(r.requiredIngredients).toEqual([{ name: '豆腐', amount: '1/2丁' }])
    expect(r.seasonings).toEqual([
      { name: 'だしの素', amount: '小さじ1' },
      { name: '味噌', amount: '大さじ1と1/2' },
    ])
    expect(r.cookingLiquids).toEqual([{ name: '水', amount: '400ml' }])
    expect(r.cookingTimeMinutes).toBe(10)
    expect(r.servingsBase).toBe(2)
  })

  // ---- RecipeIdentity 維持 ----

  it('BF: 5 recipe の RecipeIdentity（canonicalDish / variant / coreMethod）は不変', () => {
    expect(recipe('hiyayakko').verification?.recipeIdentity?.variant).toBe(
      '基本の冷奴（薬味なし、しょうゆのみ）',
    )
    expect(recipe('maguro-don').verification?.recipeIdentity?.variant).toContain('漬けない')
    expect(recipe('gyudon').verification?.recipeIdentity?.variant).toBe(
      '基本の牛丼（つゆだくでない、家庭の甘辛煮）',
    )
    expect(recipe('oyako-don').verification?.recipeIdentity?.coreMethod).toContain(
      'だし・砂糖は使わない',
    )
    expect(recipe('tofu-miso-soup').verification?.recipeIdentity?.definingIngredients).toEqual([
      '豆腐',
      '味噌',
    ])
  })

  // ---- status / publishability ----

  it('BG: 5 recipe すべて status=review のまま（VERIFIEDへ昇格していない）', () => {
    for (const id of BATCH1_IDS) {
      expect(recipe(id).verification?.status).toBe('review')
    }
  })

  it('BH: 5 recipe すべて isRecipePublishable=false のまま', () => {
    for (const id of BATCH1_IDS) {
      expect(isRecipePublishable(recipe(id))).toBe(false)
    }
  })

  it('BI: catalog 全体の VERIFIED 数は 0 のまま', () => {
    expect(RECIPE_CATALOG.filter((r) => r.verification?.status === 'verified').map((r) => r.id)).toEqual(['tori-teriyaki']) /* MISSION 2.26: 初の VERIFIED */
  })

  // ---- source coverage ----

  it('BJ: Batch 1 で追加した5 source が catalog に登録され metadata が完全', () => {
    const added = [
      'kubara-hiyayakko-yakumi-2026',
      'kurashiru-hiyayakko-simple-2026',
      'orangepage-magurodon-2026',
      'orangepage-gyudon-2026',
      'kobayashi-tofu-misoshiru-2026',
    ]
    for (const id of added) {
      const s = getEvidenceSourceById(id)
      expect(s, id).toBeDefined()
      expect(s!.publisher.trim().length).toBeGreaterThan(0)
      expect(s!.title.trim().length).toBeGreaterThan(0)
      expect(s!.url).toMatch(/^https:\/\//)
      expect(s!.checkedAt).toBe('2026-08-29')
    }
  })

  it('BK: 追加 source が対応 recipe の sourceIds に linked されている', () => {
    expect(recipe('hiyayakko').verification?.sourceIds).toEqual(
      expect.arrayContaining(['kubara-hiyayakko-yakumi-2026', 'kurashiru-hiyayakko-simple-2026']),
    )
    expect(recipe('maguro-don').verification?.sourceIds).toContain('orangepage-magurodon-2026')
    expect(recipe('gyudon').verification?.sourceIds).toContain('orangepage-gyudon-2026')
    expect(recipe('tofu-miso-soup').verification?.sourceIds).toContain('kobayashi-tofu-misoshiru-2026')
  })

  it('BL: 全 recipe の sourceIds は EVIDENCE_SOURCE_CATALOG に実在し重複なし', () => {
    for (const r of RECIPE_CATALOG) {
      const ids = r.verification?.sourceIds ?? []
      expect(new Set(ids).size).toBe(ids.length)
      for (const id of ids) {
        expect(getEvidenceSourceById(id), `${r.id} -> ${id}`).toBeDefined()
      }
    }
  })

  it('BM: Batch 1 で新しい fieldVerification / coherenceReview を追加していない', () => {
    // hiyayakko: variant+direct の2件のまま
    expect(recipe('hiyayakko').verification?.fieldVerifications).toHaveLength(2)
    // maguro-don: variant 3件のまま
    expect(recipe('maguro-don').verification?.fieldVerifications).toHaveLength(3)
    // 5 recipe いずれも coherenceReview 未設定のまま（VERIFIED条件を満たさない）
    for (const id of BATCH1_IDS) {
      expect(recipe(id).verification?.coherenceReview).toBeUndefined()
    }
  })

  it('BN: Batch 1 recipe は時間フィルタ（elapsedToReady）に昇格していない', () => {
    for (const id of BATCH1_IDS) {
      expect(recipe(id).verification?.timeVerification).toBeUndefined()
      expect(isEligibleForMaxElapsedTime(recipe(id), 15)).toBe(false)
    }
  })

  it('BO: From-Now-to-Table を Evidence 修復に使っていない（recipe verification は不変）', () => {
    const before = recipe('gyudon').verification?.status
    deriveFromNowToTable(
      { mealId: 'gyudon', requiredComponents: ['rice'], tasks: [] },
      { componentStates: { rice: 'ready' } },
    )
    expect(recipe('gyudon').verification?.status).toBe(before)
  })

  // ---- 既存 Gate の回帰 ----

  it('BP: Allergy HARD EXCLUSION は無傷（oyako-don の卵、tofu-miso-soup の味噌相当）', () => {
    expect(allergyRelevantIngredients(recipe('oyako-don'))).toEqual(
      expect.arrayContaining(['卵']),
    )
    const result = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['ごはん', '鶏肉', '卵', '玉ねぎ'],
      allergyNames: ['卵'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(result.some((c) => c.recipe.id === 'oyako-don')).toBe(false)
  })

  it('BQ: Candidate A/B・max-3 は無傷', () => {
    expect(BETA_MAX_CANDIDATES).toBe(3)
    expect(selectBetaCandidates([1, 2, 3, 4, 5])).toEqual([1, 2, 3])
  })

  it('BR: Recipe Coherence Gate（medama-yaki / sake-shioyaki = incoherent）は無傷', () => {
    expect(recipe('medama-yaki').verification?.coherenceReview?.status).toBe('incoherent')
    expect(recipe('sake-shioyaki').verification?.coherenceReview?.status).toBe('incoherent')
  })

  it('BS: production 15/30 quick filter（cookingTimeMinutes 直接比較）は無傷', () => {
    // gyudon (30分) を全材料そろえても maxCookingMinutes:15 で除外される
    const withFilter = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['ごはん', '牛肉', '玉ねぎ', 'しょうゆ', 'みりん', '砂糖', '酒'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: 15,
    })
    expect(withFilter.some((c) => c.recipe.id === 'gyudon')).toBe(false)
    const noFilter = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['ごはん', '牛肉', '玉ねぎ', 'しょうゆ', 'みりん', '砂糖', '酒'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(noFilter.some((c) => c.recipe.id === 'gyudon')).toBe(true)
  })
})
