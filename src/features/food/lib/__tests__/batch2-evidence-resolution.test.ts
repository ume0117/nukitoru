// ============================================================
// batch2-evidence-resolution.test.ts
//
// MISSION 2.16 — Evidence Resolution Batch 2。
//
// 再調査した5 recipe（tori-soboro-don / tuna-mayo-don /
// pork-cabbage-miso-stirfry / shio-musubi / onigiri-nori）について:
//   - Recipe fact（材料・分量・調味・液体・手順・時間・人数・器具）が
//     Batch 2で一切変わっていないこと（凍結）
//   - RecipeIdentity 維持
//   - verification status が review のまま（VERIFIEDへ昇格していない）
//   - isRecipePublishable が false のまま
//   - pork-cabbage-miso-stirfry の fieldVerification.supportType が
//     direct → variant へ訂正されたこと（Recipe fact変更ではなくEvidence記録の訂正）
//   - Batch 2で開いた source が catalog に登録され linked されていること
// を固定化する。
//
// 併せて標準の回帰（Allergy HARD / Candidate A/B / max-3 / Recipe Coherence /
// Cooking Time / From-Now-to-Table / Batch 1）を確認する。
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

const BATCH2_IDS = [
  'tori-soboro-don',
  'tuna-mayo-don',
  'pork-cabbage-miso-stirfry',
  'shio-musubi',
  'onigiri-nori',
] as const

function recipe(id: string) {
  const r = RECIPE_CATALOG.find((x) => x.id === id)
  if (!r) throw new Error(`recipe not found: ${id}`)
  return r
}

describe('MISSION 2.16 — Evidence Resolution Batch 2', () => {
  // ---- Recipe fact freeze（Batch 2では0件の fact 変更） ----

  it('CA: tori-soboro-don の Recipe fact は Batch 2 で凍結', () => {
    const r = recipe('tori-soboro-don')
    expect(r.requiredIngredients).toEqual([
      { name: 'ごはん', amount: '2杯分' },
      { name: '鶏ひき肉', amount: '200g' },
    ])
    expect(r.seasonings).toEqual([
      { name: 'しょうゆ', amount: '大さじ1と1/2' },
      { name: '砂糖', amount: '大さじ1' },
      { name: 'みりん', amount: '大さじ1' },
    ])
    expect(r.cookingTimeMinutes).toBe(20)
    expect(r.servingsBase).toBe(2)
    expect(r.steps).toHaveLength(3)
  })

  it('CB: tuna-mayo-don の Recipe fact は Batch 2 で凍結', () => {
    const r = recipe('tuna-mayo-don')
    expect(r.requiredIngredients).toEqual([
      { name: 'ごはん', amount: '1杯分' },
      { name: 'ツナ', amount: '1缶（70g）' },
    ])
    expect(r.seasonings).toEqual([
      { name: 'マヨネーズ', amount: '大さじ2' },
      { name: 'しょうゆ', amount: '小さじ1/2' },
    ])
    expect(r.cookingTimeMinutes).toBe(10)
    expect(r.servingsBase).toBe(1)
  })

  it('CC: pork-cabbage-miso-stirfry の Recipe fact は Batch 2 で凍結（味噌大さじ1のまま）', () => {
    const r = recipe('pork-cabbage-miso-stirfry')
    expect(r.requiredIngredients).toEqual([
      { name: '豚肉', amount: '200g' },
      { name: 'キャベツ', amount: '1/4個' },
    ])
    expect(r.seasonings).toEqual([
      { name: '味噌', amount: '大さじ1' },
      { name: '砂糖', amount: '小さじ1' },
      { name: '酒', amount: '大さじ1' },
    ])
    expect(r.cookingTimeMinutes).toBe(15)
    expect(r.servingsBase).toBe(2)
  })

  it('CD: shio-musubi / onigiri-nori の Recipe fact は Batch 2 で凍結（塩「ひとつまみ」・時間60分のまま）', () => {
    const sm = recipe('shio-musubi')
    expect(sm.requiredIngredients).toEqual([{ name: '米', amount: '1合' }])
    expect(sm.seasonings).toEqual([{ name: '塩', amount: 'ひとつまみ' }])
    expect(sm.cookingTimeMinutes).toBe(60)
    expect(sm.servingsBase).toBe(2)
    const on = recipe('onigiri-nori')
    expect(on.requiredIngredients).toEqual([
      { name: '米', amount: '1合' },
      { name: 'のり', amount: '2枚' },
    ])
    expect(on.seasonings).toEqual([{ name: '塩', amount: 'ひとつまみ' }])
    expect(on.cookingTimeMinutes).toBe(60)
  })

  it('CE: 塩が数値へ変換されていない（「ひとつまみ」文字列のまま）', () => {
    for (const id of ['shio-musubi', 'onigiri-nori']) {
      const salt = recipe(id).seasonings?.find((s) => s.name === '塩')
      expect(salt?.amount).toBe('ひとつまみ')
      expect(salt?.amount).not.toMatch(/[0-9]/)
      expect(salt?.amount).not.toMatch(/g|グラム|小さじ|大さじ/)
    }
  })

  // ---- RecipeIdentity 維持 ----

  it('CF: 5 recipe の RecipeIdentity は不変', () => {
    expect(recipe('tori-soboro-don').verification?.recipeIdentity?.coreMethod).toContain(
      '二色丼の卵そぼろは作らない',
    )
    expect(recipe('tuna-mayo-don').verification?.recipeIdentity?.variant).toContain(
      'めんつゆ使用ではない',
    )
    expect(recipe('pork-cabbage-miso-stirfry').verification?.recipeIdentity?.variant).toContain(
      '汁気のない乾いた炒め物',
    )
    expect(recipe('shio-musubi').verification?.recipeIdentity?.definingIngredients).toEqual([
      '米',
      '塩',
    ])
    expect(recipe('onigiri-nori').verification?.recipeIdentity?.definingIngredients).toEqual([
      '米',
      '塩',
      'のり',
    ])
  })

  // ---- status / publishability ----

  it('CG: 5 recipe すべて status=review のまま', () => {
    for (const id of BATCH2_IDS) {
      expect(recipe(id).verification?.status).toBe('review')
    }
  })

  it('CH: 5 recipe すべて isRecipePublishable=false のまま', () => {
    for (const id of BATCH2_IDS) {
      expect(isRecipePublishable(recipe(id))).toBe(false)
    }
  })

  it('CI: catalog 全体の VERIFIED 数は 0 のまま', () => {
    expect(RECIPE_CATALOG.filter((r) => r.verification?.status === 'verified').map((r) => r.id)).toEqual(['tori-teriyaki']) /* MISSION 2.26: 初の VERIFIED */
  })

  // ---- pork-cabbage: Evidence記録の訂正（direct → variant） ----

  it('CJ: pork-cabbage-miso-stirfry の fieldVerification が direct → variant へ訂正された', () => {
    const fvs = recipe('pork-cabbage-miso-stirfry').verification?.fieldVerifications ?? []
    const ri = fvs.find((f) => f.field === 'requiredIngredients')
    const se = fvs.find((f) => f.field === 'seasonings')
    expect(ri?.supportType).toBe('variant')
    expect(se?.supportType).toBe('variant')
    // direct のままの critical field が無いこと（＝解決済みfieldが1件も無い）
    expect(fvs.every((f) => f.supportType !== 'direct')).toBe(true)
  })

  // ---- source coverage ----

  it('CK: Batch 2 で追加した4 source が catalog に登録され metadata が完全', () => {
    const added = [
      'kyounoryouri-torisoborodon-oba-2026',
      'orangepage-tunamayodon-2026',
      'kurashiru-tunamayodon-2026',
      'hoteifoods-tunamayodon-2026',
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

  it('CL: 追加 source が対応 recipe の sourceIds に linked されている', () => {
    expect(recipe('tori-soboro-don').verification?.sourceIds).toContain(
      'kyounoryouri-torisoborodon-oba-2026',
    )
    expect(recipe('tuna-mayo-don').verification?.sourceIds).toEqual(
      expect.arrayContaining([
        'orangepage-tunamayodon-2026',
        'kurashiru-tunamayodon-2026',
        'hoteifoods-tunamayodon-2026',
      ]),
    )
  })

  it('CM: 全 recipe の sourceIds は実在し重複なし（Batch 1 + Batch 2 込み）', () => {
    for (const r of RECIPE_CATALOG) {
      const ids = r.verification?.sourceIds ?? []
      expect(new Set(ids).size).toBe(ids.length)
      for (const id of ids) {
        expect(getEvidenceSourceById(id), `${r.id} -> ${id}`).toBeDefined()
      }
    }
  })

  it('CN: Batch 2 recipe に coherenceReview / timeVerification を追加していない', () => {
    for (const id of BATCH2_IDS) {
      expect(recipe(id).verification?.coherenceReview).toBeUndefined()
      expect(recipe(id).verification?.timeVerification).toBeUndefined()
      expect(isEligibleForMaxElapsedTime(recipe(id), 15)).toBe(false)
    }
  })

  it('CO: From-Now-to-Table は Evidence 修復に使われていない（rice-cooking dependency と assembly time の混同なし）', () => {
    // shio-musubi の cookingTimeMinutes は依然 60（Product Decision）で、
    // deriveFromNowToTable の呼び出しは recipe を変えない
    const before = recipe('shio-musubi').cookingTimeMinutes
    deriveFromNowToTable(
      { mealId: 'shio-musubi', requiredComponents: ['rice'], tasks: [] },
      { componentStates: { rice: 'unknown' } },
    )
    expect(recipe('shio-musubi').cookingTimeMinutes).toBe(before)
  })

  // ---- 標準回帰 ----

  it('CP: Allergy HARD EXCLUSION 無傷（medama-yaki の卵は除外され続ける）', () => {
    expect(BETA_MAX_CANDIDATES).toBe(3)
    expect(allergyRelevantIngredients(recipe('medama-yaki'))).toEqual(
      expect.arrayContaining(['卵']),
    )
    const result = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['卵', '油'],
      allergyNames: ['卵'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(result.some((c) => c.recipe.id === 'medama-yaki')).toBe(false)
  })

  it('CP2: tuna-mayo-don の マヨネーズ は Product Check Alert 対象のまま（allergy semantics 不変）', () => {
    const checks = recipe('tuna-mayo-don').ingredientChecks?.map((c) => c.ingredientName) ?? []
    expect(checks).toContain('マヨネーズ')
    // allergyRelevantIngredients は名前をそのまま返す（マヨネーズ→卵の自動展開はしない）
    expect(allergyRelevantIngredients(recipe('tuna-mayo-don'))).toEqual([
      'ごはん',
      'ツナ',
      'マヨネーズ',
      'しょうゆ',
    ])
  })

  it('CQ: Candidate A/B・max-3 無傷', () => {
    expect(selectBetaCandidates([1, 2, 3, 4, 5])).toEqual([1, 2, 3])
  })

  it('CR: Recipe Coherence Gate（medama-yaki / sake-shioyaki = incoherent）無傷', () => {
    expect(recipe('medama-yaki').verification?.coherenceReview?.status).toBe('incoherent')
    expect(recipe('sake-shioyaki').verification?.coherenceReview?.status).toBe('incoherent')
  })

  it('CS: Batch 1 recipe（hiyayakko / maguro-don / gyudon / oyako-don / tofu-miso-soup）も review のまま', () => {
    for (const id of ['hiyayakko', 'maguro-don', 'gyudon', 'oyako-don', 'tofu-miso-soup']) {
      expect(recipe(id).verification?.status).toBe('review')
      expect(isRecipePublishable(recipe(id))).toBe(false)
    }
  })
})
