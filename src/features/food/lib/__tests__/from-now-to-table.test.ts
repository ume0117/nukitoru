// ============================================================
// from-now-to-table.test.ts
//
// MISSION 2.15 Phase B — FROM NOW TO TABLE Foundation Gate (FA〜).
//
// 「このレシピは何分？」ではなく「今ある家庭の状態から、何分後に
// 食べられる？」を決定論的に表現する新しい層を固定化する。
//
// - Phase A（recipe-time.ts / recipe-time.test.ts の 38 tests）は一切変更しない。
// - 実際の recipe-catalog.ts のエントリ（gyudon / shio-musubi 等）は一切変更せず、
//   MealPlan / MealStartContext は「合成 fixture」として構成する。
// - 炊飯時間・冷凍ごはん解凍時間・パックごはん時間・予熱時間を発明しない。
//   Evidence/context がなければ unresolved。
// ============================================================

import { describe, it, expect } from 'vitest'
import type {
  ActiveWorkDerivation,
  MealPlan,
  MealStartContext,
  PrepTask,
  RecipeVerification,
} from '@/features/food/types'
import {
  deriveFromNowToTable,
  resolveComponentReadiness,
  resolvedLowerBoundMinutes,
  qualifiesForStrictMaxFromNowToTable,
} from '../from-now-to-table'
import { resolvedUpperBoundMinutes } from '../recipe-time'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { rankRecipes } from '../recipe-suggestion-engine'
import { allergyRelevantIngredients } from '../recipe-safety'
import { selectBetaCandidates, BETA_MAX_CANDIDATES } from '../beta-presentation'

// ---- fixture helpers（catalog は一切変更しない） ----

function task(overrides: Partial<PrepTask> & Pick<PrepTask, 'id' | 'component'>): PrepTask {
  return {
    description: overrides.id,
    duration: { kind: 'unknown' },
    dependsOn: [],
    resultState: 'ready',
    sourceIds: [],
    ...overrides,
  }
}

function ctx(componentStates: MealStartContext['componentStates']): MealStartContext {
  return { componentStates }
}

/**
 * gyudon の合成 MealPlan。ごはん + 具（牛肉と玉ねぎの甘辛煮）の 2 構成要素。
 * 炊飯 / 冷凍ごはん解凍の所要時間は意図的に unknown（Evidence を発明しない）。
 * 具の所要時間も、実 catalog は「調理時間約30分」= approximate のため、
 * ここでは synthetic な値を必要なテストでだけ与える。
 */
function gyudonPlan(overrides?: {
  toppingDuration?: PrepTask['duration']
  riceCookDuration?: PrepTask['duration']
  riceReheatDuration?: PrepTask['duration']
  declaredParallelGroups?: string[][]
}): MealPlan {
  return {
    mealId: 'gyudon-synthetic',
    requiredComponents: ['rice', 'gyudon-topping'],
    tasks: [
      task({
        id: 'cook-rice',
        component: 'rice',
        description: '米を炊く',
        duration: overrides?.riceCookDuration ?? { kind: 'unknown' },
        requiredState: 'raw',
        resultState: 'ready',
      }),
      task({
        id: 'reheat-frozen-rice',
        component: 'rice',
        description: '冷凍ごはんを温める',
        duration: overrides?.riceReheatDuration ?? { kind: 'unknown' },
        requiredState: 'frozen-ready',
        resultState: 'ready',
      }),
      task({
        id: 'make-topping',
        component: 'gyudon-topping',
        description: '牛肉と玉ねぎを甘辛く煮る',
        duration: overrides?.toppingDuration ?? { kind: 'unknown' },
        resultState: 'ready',
        sourceIds: ['kikkoman-gyudon-2026'],
      }),
    ],
    declaredParallelGroups: overrides?.declaredParallelGroups,
  }
}

describe('FROM NOW TO TABLE Foundation Gate (FA〜)', () => {
  // ---- 1〜2: 3つの時間レイヤーの分離 ----

  it('FA (1): Source Recipe Time != From-Now-to-Table（同じ料理でも別概念）', () => {
    const realGyudon = RECIPE_CATALOG.find((r) => r.id === 'gyudon')!
    expect(realGyudon.cookingTimeMinutes).toBe(30) // Source 由来の legacy 値（不変）
    // 生米しかない家庭では、そもそも From-Now-to-Table は解決できない（炊飯時間 unknown）
    const result = deriveFromNowToTable(gyudonPlan(), ctx({ rice: 'raw', 'gyudon-topping': 'raw' }))
    expect(result.kind).toBe('unresolved')
    // 30 という数字が From-Now-to-Table として流用されていないこと
    expect(JSON.stringify(result)).not.toContain('"minutes":30')
  })

  it('FA (2): Active Work Time != From-Now-to-Table', () => {
    const activeWork: ActiveWorkDerivation = {
      value: { kind: 'exact', minutes: 5 },
      derivation: '実際に手を動かすのは 5 分（炊飯中は放置）',
    }
    const result = deriveFromNowToTable(
      gyudonPlan({
        toppingDuration: { kind: 'exact', minutes: 12 },
        riceCookDuration: { kind: 'exact', minutes: 45 },
        declaredParallelGroups: [['cook-rice', 'make-topping']],
      }),
      ctx({ rice: 'raw', 'gyudon-topping': 'raw' }),
    )
    expect(result.kind).toBe('resolved')
    if (result.kind === 'resolved') {
      expect(result.value).toEqual({ kind: 'exact', minutes: 45 })
      // Active Work (5) と From-Now-to-Table (45) は一致しない
      expect(activeWork.value).not.toEqual(result.value)
    }
  })

  // ---- 3〜7: household starting state ----

  it('FB (3): household starting state が結果を変える（同じ plan・別 context）', () => {
    const plan = gyudonPlan({
      toppingDuration: { kind: 'exact', minutes: 12 },
      riceCookDuration: { kind: 'exact', minutes: 45 },
      declaredParallelGroups: [['cook-rice', 'make-topping']],
    })
    const readyRice = deriveFromNowToTable(plan, ctx({ rice: 'ready', 'gyudon-topping': 'raw' }))
    const rawRice = deriveFromNowToTable(plan, ctx({ rice: 'raw', 'gyudon-topping': 'raw' }))
    expect(readyRice.kind).toBe('resolved')
    expect(rawRice.kind).toBe('resolved')
    if (readyRice.kind === 'resolved' && rawRice.kind === 'resolved') {
      expect(readyRice.value).toEqual({ kind: 'exact', minutes: 12 })
      expect(rawRice.value).toEqual({ kind: 'exact', minutes: 45 })
      expect(readyRice.value).not.toEqual(rawRice.value)
    }
  })

  it('FC (4): ready rice が区別できる', () => {
    expect(resolveComponentReadiness(ctx({ rice: 'ready' }), 'rice')).toBe('ready')
  })

  it('FD (5): frozen-ready rice が区別できる', () => {
    expect(resolveComponentReadiness(ctx({ rice: 'frozen-ready' }), 'rice')).toBe('frozen-ready')
  })

  it('FE (6): raw rice が区別できる', () => {
    expect(resolveComponentReadiness(ctx({ rice: 'raw' }), 'rice')).toBe('raw')
  })

  it('FF (7): unknown rice が区別できる（未指定は unknown、推測しない）', () => {
    expect(resolveComponentReadiness(ctx({}), 'rice')).toBe('unknown')
    expect(resolveComponentReadiness(ctx({ rice: 'unknown' }), 'rice')).toBe('unknown')
  })

  // ---- 8〜11: raw rice / 発明の禁止 ----

  it('FG (8): raw rice は preparation path を必要とする（task がなければ unresolved）', () => {
    const planNoRiceTask: MealPlan = {
      mealId: 'x',
      requiredComponents: ['rice'],
      tasks: [], // rice を ready にする task がない
    }
    const result = deriveFromNowToTable(planNoRiceTask, ctx({ rice: 'raw' }))
    expect(result.kind).toBe('unresolved')

    // task があり、かつ duration が確定していれば解決する
    const planWithRiceTask: MealPlan = {
      mealId: 'x',
      requiredComponents: ['rice'],
      tasks: [
        task({
          id: 'cook',
          component: 'rice',
          description: '炊飯',
          duration: { kind: 'exact', minutes: 45 },
          requiredState: 'raw',
          resultState: 'ready',
        }),
      ],
    }
    const ok = deriveFromNowToTable(planWithRiceTask, ctx({ rice: 'raw' }))
    expect(ok.kind).toBe('resolved')
    if (ok.kind === 'resolved') expect(ok.criticalPath).toEqual(['cook'])
  })

  it('FH (9): 炊飯時間が unresolved なら From-Now-to-Table も unresolved', () => {
    const result = deriveFromNowToTable(
      gyudonPlan({ toppingDuration: { kind: 'exact', minutes: 12 } }),
      ctx({ rice: 'raw', 'gyudon-topping': 'raw' }),
    )
    expect(result.kind).toBe('unresolved')
    if (result.kind === 'unresolved') expect(result.reason).toContain('cook-rice')
  })

  it('FI (10): 炊飯器の所要時間を 50 分と勝手に仮定しない', () => {
    const result = deriveFromNowToTable(
      gyudonPlan({
        toppingDuration: { kind: 'exact', minutes: 12 },
        declaredParallelGroups: [['cook-rice', 'make-topping']],
      }),
      ctx({ rice: 'raw', 'gyudon-topping': 'raw' }),
    )
    expect(result.kind).toBe('unresolved')
    expect(JSON.stringify(result)).not.toContain('50')
  })

  it('FJ (11): 冷凍ごはんの解凍時間を 3 分と勝手に仮定しない', () => {
    const result = deriveFromNowToTable(
      gyudonPlan({ toppingDuration: { kind: 'exact', minutes: 12 } }),
      ctx({ rice: 'frozen-ready', 'gyudon-topping': 'raw' }),
    )
    expect(result.kind).toBe('unresolved')
    if (result.kind === 'unresolved') expect(result.reason).toContain('reheat-frozen-rice')
    expect(JSON.stringify(result)).not.toContain('"minutes":3')
  })

  // ---- 12〜15: 加算 / 並行 / 依存順 ----

  it('FK (12): no blind sum — 炊飯45 + 具15 を並行宣言なしに 60 と合算しない', () => {
    const result = deriveFromNowToTable(
      gyudonPlan({
        riceCookDuration: { kind: 'exact', minutes: 45 },
        toppingDuration: { kind: 'exact', minutes: 15 },
        // declaredParallelGroups なし
      }),
      ctx({ rice: 'raw', 'gyudon-topping': 'raw' }),
    )
    expect(result.kind).toBe('unresolved')
    expect(JSON.stringify(result)).not.toContain('60')
  })

  it('FL (13): explicit parallel branches で critical-path を導出できる（max(45,15)=45）', () => {
    const result = deriveFromNowToTable(
      gyudonPlan({
        riceCookDuration: { kind: 'exact', minutes: 45 },
        toppingDuration: { kind: 'exact', minutes: 15 },
        declaredParallelGroups: [['cook-rice', 'make-topping']],
      }),
      ctx({ rice: 'raw', 'gyudon-topping': 'raw' }),
    )
    expect(result.kind).toBe('resolved')
    if (result.kind === 'resolved') {
      expect(result.value).toEqual({ kind: 'exact', minutes: 45 })
      expect(result.criticalPath).toEqual(['cook-rice'])
      expect(result.derivation).not.toBe('')
    }
  })

  it('FM (14): 並行宣言がなければ overlap を推測できない（独立2 task → unresolved）', () => {
    const plan: MealPlan = {
      mealId: 'x',
      requiredComponents: ['a', 'b'],
      tasks: [
        task({ id: 'ta', component: 'a', duration: { kind: 'exact', minutes: 10 } }),
        task({ id: 'tb', component: 'b', duration: { kind: 'exact', minutes: 20 } }),
      ],
    }
    const result = deriveFromNowToTable(plan, ctx({ a: 'raw', b: 'raw' }))
    expect(result.kind).toBe('unresolved')
    if (result.kind === 'unresolved') expect(result.reason).toContain('未宣言')
  })

  it('FN (15): dependency ordering は尊重される（A→B は直列 = A+B）', () => {
    const plan: MealPlan = {
      mealId: 'x',
      requiredComponents: ['dish'],
      tasks: [
        task({
          id: 'prep',
          component: 'dish',
          duration: { kind: 'exact', minutes: 5 },
          resultState: 'raw',
        }),
        task({
          id: 'cook',
          component: 'dish',
          duration: { kind: 'exact', minutes: 8 },
          dependsOn: ['prep'],
          resultState: 'ready',
        }),
      ],
    }
    const result = deriveFromNowToTable(plan, ctx({ dish: 'raw' }))
    expect(result.kind).toBe('resolved')
    if (result.kind === 'resolved') {
      expect(result.value).toEqual({ kind: 'exact', minutes: 13 })
      expect(result.criticalPath).toEqual(['prep', 'cook'])
    }
  })

  // ---- 16〜17: complete-meal readiness ----

  it('FO (16): すべての必須構成要素が ready になって初めて TABLE READY', () => {
    const plan: MealPlan = {
      mealId: 'x',
      requiredComponents: ['rice', 'soup'],
      tasks: [
        task({
          id: 'heat-soup',
          component: 'soup',
          duration: { kind: 'exact', minutes: 10 },
          resultState: 'ready',
        }),
      ],
    }
    // rice はすでに ready、soup だけ 10 分 → meal ready = 10 分（0 分ではない）
    const result = deriveFromNowToTable(plan, ctx({ rice: 'ready', soup: 'raw' }))
    expect(result.kind).toBe('resolved')
    if (result.kind === 'resolved') expect(result.value).toEqual({ kind: 'exact', minutes: 10 })
  })

  it('FP (17): 片方の branch が完成しても不十分（具だけ完成・生米 → unresolved）', () => {
    const result = deriveFromNowToTable(
      gyudonPlan({ toppingDuration: { kind: 'exact', minutes: 12 } }),
      ctx({ rice: 'raw', 'gyudon-topping': 'raw' }),
    )
    expect(result.kind).toBe('unresolved') // 具が 12 分で終わっても米が未解決
  })

  // ---- 18〜22: Evidence / Product Decision firewall ----

  it('FQ (18): Product Decision は Evidence（入力 plan / context）を書き換えない', () => {
    const plan = Object.freeze(
      gyudonPlan({
        riceCookDuration: { kind: 'exact', minutes: 45 },
        toppingDuration: { kind: 'exact', minutes: 15 },
        declaredParallelGroups: [['cook-rice', 'make-topping']],
      }),
    )
    const before = JSON.stringify(plan)
    const context = ctx({ rice: 'raw', 'gyudon-topping': 'raw' })
    const beforeCtx = JSON.stringify(context)
    deriveFromNowToTable(plan, context)
    expect(JSON.stringify(plan)).toBe(before)
    expect(JSON.stringify(context)).toBe(beforeCtx)
  })

  it('FR (19): Product Decision は VERIFIED を作れない（recipe verification は不変）', () => {
    const realGyudon = RECIPE_CATALOG.find((r) => r.id === 'gyudon')!
    const statusBefore = realGyudon.verification?.status
    deriveFromNowToTable(gyudonPlan(), ctx({ rice: 'raw', 'gyudon-topping': 'raw' }))
    expect(realGyudon.verification?.status).toBe(statusBefore)
    expect(realGyudon.verification?.status).not.toBe('verified')
  })

  it('FS (20): Product Decision は Coherence を修復しない（incoherent は incoherent のまま）', async () => {
    const verification: RecipeVerification = {
      status: 'review',
      sourceIds: ['x'],
      coherenceReview: {
        status: 'incoherent',
        sourceProcessNotes: [{ sourceId: 'x' }],
        reviewedDimensions: ['equipment'],
        rationale: 'process 不整合。',
      },
    }
    const snapshot = JSON.stringify(verification)
    deriveFromNowToTable(gyudonPlan(), ctx({ rice: 'ready', 'gyudon-topping': 'ready' }))
    expect(JSON.stringify(verification)).toBe(snapshot)
    // モジュールが coherence / publishability / ranking を import していないこと
    const fs = await import('node:fs')
    const path = await import('node:path')
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/features/food/lib/from-now-to-table.ts'),
      'utf-8',
    )
    // import 文としての参照がないこと（header コメントでの言及は firewall の説明なので許容）
    const importLines = src.split('\n').filter((line) => /^\s*import\b/.test(line))
    for (const forbidden of [
      'recipe-publishability',
      'recipe-suggestion-engine',
      'recipe-catalog',
      'recipe-coherence',
    ]) {
      expect(importLines.some((line) => line.includes(forbidden))).toBe(false)
    }
  })

  it('FT (21): Product Decision は Variant conflict を解決しない', () => {
    // 2 つの異なる調理法（グリル / フライパン）が別々の duration を持つ場合でも、
    // MealPlan はどちらか一方の task chain しか含まない（合成の選択）。
    // deriveFromNowToTable が「両者を合成して 1 つの Variant に決める」ことはない。
    const grillPlan: MealPlan = {
      mealId: 'grill',
      requiredComponents: ['fish'],
      tasks: [
        task({
          id: 'grill',
          component: 'fish',
          duration: { kind: 'exact', minutes: 7 },
          resultState: 'ready',
        }),
      ],
    }
    const frypanPlan: MealPlan = {
      mealId: 'frypan',
      requiredComponents: ['fish'],
      tasks: [
        task({
          id: 'frypan',
          component: 'fish',
          duration: { kind: 'exact', minutes: 9 },
          resultState: 'ready',
        }),
      ],
    }
    const g = deriveFromNowToTable(grillPlan, ctx({ fish: 'raw' }))
    const f = deriveFromNowToTable(frypanPlan, ctx({ fish: 'raw' }))
    expect(g.kind === 'resolved' && g.value).toEqual({ kind: 'exact', minutes: 7 })
    expect(f.kind === 'resolved' && f.value).toEqual({ kind: 'exact', minutes: 9 })
    // 2 つの Variant が別々のままであることの確認（平均 8 等に潰れない）
  })

  it('FU (22): Product Decision は Evidence Range を exact へ潰さない（range は range のまま）', () => {
    const plan: MealPlan = {
      mealId: 'x',
      requiredComponents: ['dish'],
      tasks: [
        task({
          id: 'cook',
          component: 'dish',
          duration: { kind: 'range', minMinutes: 40, maxMinutes: 60 },
          resultState: 'ready',
        }),
      ],
    }
    const result = deriveFromNowToTable(plan, ctx({ dish: 'raw' }))
    expect(result.kind).toBe('resolved')
    if (result.kind === 'resolved') {
      expect(result.value).toEqual({ kind: 'range', minMinutes: 40, maxMinutes: 60 })
      // midpoint (50) へ潰れていない
      expect(JSON.stringify(result.value)).not.toContain('50')
    }
  })

  // ---- 23〜26: gyudon characterization ----

  it('FV (23): gyudon + ready rice は表現できる（具の synthetic exact time で解決）', () => {
    const result = deriveFromNowToTable(
      gyudonPlan({ toppingDuration: { kind: 'exact', minutes: 12 } }),
      ctx({ rice: 'ready', 'gyudon-topping': 'raw' }),
    )
    expect(result.kind).toBe('resolved')
    if (result.kind === 'resolved') expect(result.value).toEqual({ kind: 'exact', minutes: 12 })
    // 実 catalog の gyudon は「調理時間約30分」= approximate のため、その値では unresolved
    const withRealApprox = deriveFromNowToTable(
      gyudonPlan({ toppingDuration: { kind: 'approximate', minutes: 30 } }),
      ctx({ rice: 'ready', 'gyudon-topping': 'raw' }),
    )
    expect(withRealApprox.kind).toBe('unresolved')
    // gyudon の catalog fact は不変
    const realGyudon = RECIPE_CATALOG.find((r) => r.id === 'gyudon')!
    expect(realGyudon.cookingTimeMinutes).toBe(30)
    expect(realGyudon.requiredIngredients).toEqual([
      { name: 'ごはん', amount: '2杯分' },
      { name: '牛肉', amount: '200g' },
      { name: '玉ねぎ', amount: '1/2個' },
    ])
  })

  it('FW (24): gyudon + frozen rice は fake duration なしで表現できる（unresolved）', () => {
    const result = deriveFromNowToTable(
      gyudonPlan({ toppingDuration: { kind: 'exact', minutes: 12 } }),
      ctx({ rice: 'frozen-ready', 'gyudon-topping': 'raw' }),
    )
    expect(result.kind).toBe('unresolved') // 解凍時間 unknown を発明しない
  })

  it('FX (25): gyudon + raw rice は fake duration なしで表現できる（unresolved）', () => {
    const result = deriveFromNowToTable(
      gyudonPlan({ toppingDuration: { kind: 'exact', minutes: 12 } }),
      ctx({ rice: 'raw', 'gyudon-topping': 'raw' }),
    )
    expect(result.kind).toBe('unresolved') // 炊飯時間 unknown を発明しない
  })

  it('FY (26): gyudon + unknown rice は unresolved のまま', () => {
    const result = deriveFromNowToTable(
      gyudonPlan({ toppingDuration: { kind: 'exact', minutes: 12 } }),
      ctx({ 'gyudon-topping': 'raw' }), // rice 未指定 = unknown
    )
    expect(result.kind).toBe('unresolved')
    if (result.kind === 'unresolved') expect(result.reason).toContain('rice')
  })

  // ---- 27: shio-musubi negative case ----

  it('FZ (27): shio-musubi + raw rice は「5分で食べられる」と主張できない', () => {
    const shioMusubiPlan: MealPlan = {
      mealId: 'shio-musubi-synthetic',
      requiredComponents: ['rice'],
      tasks: [
        task({
          id: 'cook-rice',
          component: 'rice',
          description: '米を炊く',
          duration: { kind: 'unknown' }, // 炊飯時間 UNKNOWN
          requiredState: 'raw',
          resultState: 'raw',
        }),
        task({
          id: 'form',
          component: 'rice',
          description: 'おにぎりを握る',
          duration: { kind: 'exact', minutes: 5 },
          dependsOn: ['cook-rice'],
          resultState: 'ready',
        }),
      ],
    }
    const result = deriveFromNowToTable(shioMusubiPlan, ctx({ rice: 'raw' }))
    expect(result.kind).toBe('unresolved') // 握るのが 5 分でも、炊飯 dependency が未解決
    expect(qualifiesForStrictMaxFromNowToTable(result, 15)).toBe(false)
    // 実 catalog の shio-musubi は不変
    const realShioMusubi = RECIPE_CATALOG.find((r) => r.id === 'shio-musubi')!
    expect(realShioMusubi.verification?.timeVerification).toBeUndefined()
  })

  // ---- 28〜30: 将来の厳密な <=15 semantics ----

  it('GA (28): unresolved From-Now-to-Table は strict <=15 に絶対に適格にならない', () => {
    expect(qualifiesForStrictMaxFromNowToTable({ kind: 'unresolved', reason: 'x' }, 15)).toBe(false)
  })

  it('GB (29): range 上限 >15 は <=15 に適格にならない', () => {
    const plan: MealPlan = {
      mealId: 'x',
      requiredComponents: ['dish'],
      tasks: [
        task({
          id: 'cook',
          component: 'dish',
          duration: { kind: 'range', minMinutes: 10, maxMinutes: 20 },
          resultState: 'ready',
        }),
      ],
    }
    const result = deriveFromNowToTable(plan, ctx({ dish: 'raw' }))
    expect(result.kind).toBe('resolved')
    expect(qualifiesForStrictMaxFromNowToTable(result, 15)).toBe(false)
  })

  it('GC (30): 明示的な <=15 の resolved 結果は適格になりうる', () => {
    const exactPlan: MealPlan = {
      mealId: 'x',
      requiredComponents: ['dish'],
      tasks: [
        task({
          id: 'cook',
          component: 'dish',
          duration: { kind: 'exact', minutes: 12 },
          resultState: 'ready',
        }),
      ],
    }
    const rangePlan: MealPlan = {
      mealId: 'y',
      requiredComponents: ['dish'],
      tasks: [
        task({
          id: 'cook',
          component: 'dish',
          duration: { kind: 'range', minMinutes: 10, maxMinutes: 15 },
          resultState: 'ready',
        }),
      ],
    }
    expect(
      qualifiesForStrictMaxFromNowToTable(deriveFromNowToTable(exactPlan, ctx({ dish: 'raw' })), 15),
    ).toBe(true)
    expect(
      qualifiesForStrictMaxFromNowToTable(deriveFromNowToTable(rangePlan, ctx({ dish: 'raw' })), 15),
    ).toBe(true)
    // ready 済みの meal は 0 分 → 適格
    expect(
      qualifiesForStrictMaxFromNowToTable(
        deriveFromNowToTable(
          { mealId: 'z', requiredComponents: ['dish'], tasks: [] },
          ctx({ dish: 'ready' }),
        ),
        15,
      ),
    ).toBe(true)
  })

  // ---- 31〜35: 既存機能の回帰確認 ----

  it('GD (31): Allergy HARD EXCLUSION は Phase B 追加後も無傷', () => {
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

  it('GE (32): Candidate A/B 判定は Phase B 追加後も無傷', () => {
    const result = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['卵'],
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(result.find((c) => c.recipe.id === 'medama-yaki')?.category).toBe('A')
  })

  it('GF (33): max3 候補提示は Phase B 追加後も無傷', () => {
    expect(BETA_MAX_CANDIDATES).toBe(3)
    expect(selectBetaCandidates([1, 2, 3, 4, 5])).toEqual([1, 2, 3])
  })

  it('GG (34): Recipe Coherence Gate（medama-yaki/sake-shioyaki=incoherent, VERIFIED=0）は無傷', () => {
    const medamaYaki = RECIPE_CATALOG.find((r) => r.id === 'medama-yaki')!
    const sakeShioyaki = RECIPE_CATALOG.find((r) => r.id === 'sake-shioyaki')!
    expect(medamaYaki.verification?.coherenceReview?.status).toBe('incoherent')
    expect(sakeShioyaki.verification?.coherenceReview?.status).toBe('incoherent')
    expect(RECIPE_CATALOG.filter((r) => r.verification?.status === 'verified').length).toBe(0)
  })

  it('GH (35): Source Silence 原則（EVIDENCE_POLICY.md）は Phase B 追加後も無傷', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const content = fs.readFileSync(
      path.join(process.cwd(), 'src/features/food/EVIDENCE_POLICY.md'),
      'utf-8',
    )
    expect(content).toContain('Source Silence')
    expect(content).toContain('情報源の沈黙は、否定的事実のEvidenceにならない')
  })

  // ---- 36〜39: 追加の構造的確認 ----

  it('GI (36): recipe-catalog.ts は凍結（gyudon / shio-musubi の中核 fact 不変）', () => {
    const gyudon = RECIPE_CATALOG.find((r) => r.id === 'gyudon')!
    expect(gyudon.cookingTimeMinutes).toBe(30)
    expect(gyudon.servingsBase).toBe(2)
    expect(gyudon.seasonings).toEqual([
      { name: 'しょうゆ', amount: '大さじ2' },
      { name: 'みりん', amount: '大さじ3' },
      { name: '砂糖', amount: '大さじ1' },
      { name: '酒', amount: '100ml' },
    ])
    const shioMusubi = RECIPE_CATALOG.find((r) => r.id === 'shio-musubi')!
    expect(shioMusubi.type).toBe('main')
  })

  it('GJ (37): production 15/30 quick filter は cookingTimeMinutes 直接比較のまま（不変）', () => {
    const short = { ...RECIPE_CATALOG[0], id: 's', cookingTimeMinutes: 10 }
    const long = { ...RECIPE_CATALOG[0], id: 'l', cookingTimeMinutes: 25 }
    const result = rankRecipes([short, long], {
      availableIngredientNames: short.requiredIngredients.map((i) => i.name),
      allergyNames: [],
      dislikeNames: [],
      maxCookingMinutes: 15,
    })
    expect(result.some((c) => c.recipe.id === 's')).toBe(true)
    expect(result.some((c) => c.recipe.id === 'l')).toBe(false)
  })

  it('GK (38): 3 つの時間レイヤーは同時に別の値を取りうる', () => {
    // A: Source Recipe Time（legacy cookingTimeMinutes）
    const sourceRecipeTime = 30
    // B: Active Work Time
    const activeWork: ActiveWorkDerivation = {
      value: { kind: 'exact', minutes: 5 },
      derivation: '手を動かすのは 5 分',
    }
    // C: From-Now-to-Table（生米 + 並行宣言あり）
    const c = deriveFromNowToTable(
      gyudonPlan({
        riceCookDuration: { kind: 'exact', minutes: 45 },
        toppingDuration: { kind: 'exact', minutes: 15 },
        declaredParallelGroups: [['cook-rice', 'make-topping']],
      }),
      ctx({ rice: 'raw', 'gyudon-topping': 'raw' }),
    )
    expect(c.kind).toBe('resolved')
    if (c.kind === 'resolved') {
      expect(resolvedUpperBoundMinutes(c.value)).toBe(45)
      expect(resolvedUpperBoundMinutes(activeWork.value)).toBe(5)
      expect(sourceRecipeTime).toBe(30)
      // 3 値がすべて異なる
      expect(new Set([45, 5, 30]).size).toBe(3)
    }
  })

  it('GL (39): resolvedLowerBoundMinutes は range を midpoint 化しない', () => {
    expect(resolvedLowerBoundMinutes({ kind: 'range', minMinutes: 3, maxMinutes: 4 })).toBe(3)
    expect(resolvedLowerBoundMinutes({ kind: 'exact', minutes: 12 })).toBe(12)
    expect(resolvedLowerBoundMinutes({ kind: 'approximate', minutes: 10 })).toBeNull()
    expect(resolvedLowerBoundMinutes({ kind: 'unknown' })).toBeNull()
  })
})
