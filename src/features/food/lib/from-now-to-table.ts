// ============================================================
// from-now-to-table.ts
//
// MISSION 2.15 Phase B — FROM NOW TO TABLE Foundation。
//
// NUKITORU FOODが最終的に答える問いは「このレシピは何分？」ではなく
// 「今ある家庭の状態から、何分後に食べられる？」である。これは
// Product Decision Layerであり、Recipe Evidenceそのものではない。
//
// 絶対ルール:
// - 3層を混同しない: A=Source Recipe Time / B=Active Work Time /
//   C=From-Now-to-Table Time。CはMealStartContextで変わる（静的属性ではない）。
// - RICE COUNTS: ごはんが炊けていると勝手に仮定しない。炊飯50分・冷凍ごはん解凍
//   3分・パックごはん2分・解凍時間・予熱を発明しない。Evidence/contextが
//   なければ UNKNOWN。
// - 時間を単純加算しない。parallelismは明示的に宣言されている場合のみ使用可能。
//   「並行できそう」という推測は禁止。宣言がなければ unresolved。
// - rangeをmidpoint化しない・approximateをexact化しない。approximate/unknownは
//   上限未確定として扱い、そのtaskを含む導出は unresolved にする。
// - Product Decision。RecipeVerificationStatusを上げない・Coherenceを修復
//   しない・Variantを解決しない・Evidence Rangeをexactへ潰さない。
//   このモジュールは recipe-publishability.ts / recipe-suggestion-engine.ts /
//   recipe-catalog.ts / recipe-coherence.ts を一切importしない。
// - 本MISSIONではproduction 15/30 quick filter・UIを一切変更しない。foundationのみ。
// ============================================================

import type {
  FromNowToTableResult,
  IngredientReadinessState,
  MealPlan,
  MealStartContext,
  PrepTask,
  TimeValue,
} from '@/features/food/types'
import { resolvedUpperBoundMinutes } from './recipe-time'

/**
 * Phase Aの resolvedUpperBoundMinutes と対になる下限値。
 * exact/range のみ確定し、approximate/unknown は null（発明しない）。
 * range を midpoint 化しないための、上限とは別に保持する下限。
 */
export function resolvedLowerBoundMinutes(value: TimeValue): number | null {
  switch (value.kind) {
    case 'exact':
      return value.minutes
    case 'range':
      return value.minMinutes
    case 'approximate':
      return null
    case 'unknown':
      return null
  }
}

/** 構成要素の現在状態を返す。未指定は 'unknown'（推測しない） */
export function resolveComponentReadiness(
  context: MealStartContext,
  component: string,
): IngredientReadinessState {
  return context.componentStates[component] ?? 'unknown'
}

function unresolved(reason: string): FromNowToTableResult {
  return { kind: 'unresolved', reason }
}

function describeDuration(value: TimeValue): string {
  switch (value.kind) {
    case 'exact':
      return `${value.minutes}分`
    case 'range':
      return `${value.minMinutes}〜${value.maxMinutes}分`
    case 'approximate':
      return `約${value.minutes}分`
    case 'unknown':
      return '不明'
  }
}

/**
 * active task だけの依存グラフで、各 taskの「祖先」（先行して完了している
 * 必要がある task の集合）を求める。cycle を検出したら null。
 */
function computeAncestors(
  activeTasks: PrepTask[],
  activeIds: Set<string>,
  tasksById: Map<string, PrepTask>,
): Map<string, Set<string>> | null {
  const ancestors = new Map<string, Set<string>>()
  for (const task of activeTasks) {
    const acc = new Set<string>()
    const stack = task.dependsOn.filter((id) => activeIds.has(id))
    while (stack.length > 0) {
      const cur = stack.pop() as string
      if (cur === task.id) return null // cycle
      if (acc.has(cur)) continue
      acc.add(cur)
      const curTask = tasksById.get(cur)
      if (!curTask) continue
      for (const dep of curTask.dependsOn) {
        if (activeIds.has(dep)) stack.push(dep)
      }
    }
    ancestors.set(task.id, acc)
  }
  return ancestors
}

/** active task を依存順（先行 → 後続）に並べる。cycle なら null */
function topoOrder(activeTasks: PrepTask[], activeIds: Set<string>): PrepTask[] | null {
  const indegree = new Map<string, number>()
  for (const task of activeTasks) indegree.set(task.id, 0)
  for (const task of activeTasks) {
    for (const dep of task.dependsOn) {
      if (activeIds.has(dep)) indegree.set(task.id, (indegree.get(task.id) ?? 0) + 1)
    }
  }
  const queue = activeTasks.filter((t) => (indegree.get(t.id) ?? 0) === 0).map((t) => t.id)
  const ordered: PrepTask[] = []
  const byId = new Map(activeTasks.map((t) => [t.id, t]))
  while (queue.length > 0) {
    const id = queue.shift() as string
    const task = byId.get(id)
    if (!task) continue
    ordered.push(task)
    for (const candidate of activeTasks) {
      if (!candidate.dependsOn.includes(id)) continue
      const next = (indegree.get(candidate.id) ?? 0) - 1
      indegree.set(candidate.id, next)
      if (next === 0) queue.push(candidate.id)
    }
  }
  return ordered.length === activeTasks.length ? ordered : null
}

/**
 * MealStartContext から、実際に実行する必要がある task を決定する。
 * - すでに 'ready' の構成要素には task は不要。
 * - それ以外は、開始状態から始められる task（requiredState 未指定 or 一致）を
 *   起点に、dependsOn で繋がる task を辿って active にする。
 * - ready へ到達する task chain がなければ unresolved。
 */
function collectActiveTaskIds(
  plan: MealPlan,
  context: MealStartContext,
  tasksById: Map<string, PrepTask>,
): { activeIds: Set<string> } | { error: FromNowToTableResult } {
  const activeIds = new Set<string>()

  for (const component of plan.requiredComponents) {
    const startState = resolveComponentReadiness(context, component)
    if (startState === 'ready') continue

    const componentTasks = plan.tasks.filter((t) => t.component === component)
    if (componentTasks.length === 0) {
      return {
        error: unresolved(
          `構成要素「${component}」を ready にする task が存在しない（現在状態: ${startState}）`,
        ),
      }
    }

    const componentActive = new Set<string>()
    let changed = true
    while (changed) {
      changed = false
      for (const task of componentTasks) {
        if (componentActive.has(task.id)) continue
        const startable =
          task.requiredState === undefined ||
          task.requiredState === startState ||
          task.dependsOn.some((depId) => componentActive.has(depId))
        if (startable) {
          componentActive.add(task.id)
          changed = true
        }
      }
    }

    if (componentActive.size === 0) {
      return {
        error: unresolved(
          `構成要素「${component}」: 現在状態「${startState}」から開始できる task がない`,
        ),
      }
    }

    const reachesReady = [...componentActive].some(
      (id) => tasksById.get(id)?.resultState === 'ready',
    )
    if (!reachesReady) {
      return {
        error: unresolved(
          `構成要素「${component}」: 現在状態「${startState}」から ready へ到達する task chain がない`,
        ),
      }
    }

    for (const id of componentActive) activeIds.add(id)
  }

  return { activeIds }
}

function buildDerivation(
  plan: MealPlan,
  context: MealStartContext,
  activeTasks: PrepTask[],
  criticalPath: string[],
  value: TimeValue,
): string {
  const stateSummary = plan.requiredComponents
    .map((c) => `${c}=${resolveComponentReadiness(context, c)}`)
    .join(', ')
  const parallelNote =
    plan.declaredParallelGroups && plan.declaredParallelGroups.length > 0
      ? `明示的な並行宣言: ${plan.declaredParallelGroups
          .map((g) => `[${g.join('|')}]`)
          .join(' ')}`
      : '並行宣言なし（すべて依存順で直列）'
  const pathSummary =
    criticalPath
      .map((id) => {
        const task = activeTasks.find((t) => t.id === id)
        return task ? `${task.description}(${describeDuration(task.duration)})` : id
      })
      .join(' → ') || '（追加調理taskなし）'
  return (
    `開始状態: ${stateSummary}。${parallelNote}。` +
    `critical path: ${pathSummary}。` +
    `From-Now-to-Table = ${describeDuration(value)}（Product Decision。Evidence Factではない）。`
  )
}

/**
 * MISSION 2.15 Phase B の中核: 家庭の現状（MealStartContext）から、
 * meal 全体が食卓へ出せる状態になるまでの実経過時間を決定論的に導出する。
 *
 * 導出できないケースは必ず 'unresolved' を返す:
 * - 必須構成要素の現在状態が unknown
 * - active task の所要時間が unknown / approximate（上限未確定）
 * - 依存で順序付けられていない task 同士に明示的な並行宣言がない
 * - ready へ到達する task chain がない / 依存に cycle がある
 */
export function deriveFromNowToTable(
  plan: MealPlan,
  context: MealStartContext,
): FromNowToTableResult {
  if (plan.requiredComponents.length === 0) {
    return unresolved('requiredComponents が空（完全な食事の構成が未定義）')
  }

  const tasksById = new Map<string, PrepTask>()
  for (const task of plan.tasks) {
    if (tasksById.has(task.id)) return unresolved(`task id が重複: ${task.id}`)
    tasksById.set(task.id, task)
  }

  // 1. すべての必須構成要素の開始状態が既知（unknown でない）であること
  for (const component of plan.requiredComponents) {
    if (resolveComponentReadiness(context, component) === 'unknown') {
      return unresolved(`構成要素「${component}」の現在の状態が不明（推測しない）`)
    }
  }

  // 2. 実際に実行する必要がある task を決定する
  const collected = collectActiveTaskIds(plan, context, tasksById)
  if ('error' in collected) return collected.error
  const { activeIds } = collected

  if (activeIds.size === 0) {
    return {
      kind: 'resolved',
      value: { kind: 'exact', minutes: 0 },
      derivation:
        'すべての必須構成要素が現時点で ready。追加の調理 task なしで食卓へ出せる（0分）。',
      criticalPath: [],
    }
  }

  const activeTasks = [...activeIds].map((id) => tasksById.get(id) as PrepTask)

  // 3. 依存参照の健全性 & 所要時間の上限が確定していること（発明しない）
  for (const task of activeTasks) {
    for (const depId of task.dependsOn) {
      if (!tasksById.has(depId)) {
        return unresolved(`task「${task.id}」の依存先「${depId}」が存在しない`)
      }
    }
    if (resolvedUpperBoundMinutes(task.duration) === null) {
      return unresolved(
        `task「${task.id}」の所要時間が未確定（${task.duration.kind}）。` +
          `炊飯・解凍・予熱等の時間を発明しない`,
      )
    }
  }

  // 4. 祖先関係（cycle 検出込み）
  const ancestors = computeAncestors(activeTasks, activeIds, tasksById)
  if (ancestors === null) return unresolved('依存関係に cycle がある')

  const isOrdered = (a: string, b: string): boolean =>
    ancestors.get(a)?.has(b) === true || ancestors.get(b)?.has(a) === true

  // 5. 依存で順序付けられていない task 同士は、明示的な並行宣言がなければ
  //    関係が未確定 → overlap も単純加算も推測しない
  const parallelGroups = plan.declaredParallelGroups ?? []
  const declaredParallel = (a: string, b: string): boolean =>
    parallelGroups.some((group) => group.includes(a) && group.includes(b))

  for (let i = 0; i < activeTasks.length; i += 1) {
    for (let j = i + 1; j < activeTasks.length; j += 1) {
      const a = activeTasks[i].id
      const b = activeTasks[j].id
      if (isOrdered(a, b)) continue
      if (declaredParallel(a, b)) continue
      return unresolved(
        `task「${a}」と「${b}」の関係が未宣言（依存も並行宣言もない）。` +
          `単純加算も overlap も推測しない`,
      )
    }
  }

  // 6. longest-path で各 taskの完了時刻（下限・上限）を求める
  const order = topoOrder(activeTasks, activeIds)
  if (order === null) return unresolved('依存関係の topological 順序を決定できない（cycle）')

  const finishLower = new Map<string, number>()
  const finishUpper = new Map<string, number>()
  const pathTo = new Map<string, string[]>()

  for (const task of order) {
    const activeDeps = task.dependsOn.filter((id) => activeIds.has(id))
    let baseLower = 0
    let baseUpper = 0
    let bestPath: string[] = []
    for (const depId of activeDeps) {
      const depUpper = finishUpper.get(depId) ?? 0
      if (depUpper >= baseUpper) {
        baseUpper = depUpper
        baseLower = finishLower.get(depId) ?? 0
        bestPath = pathTo.get(depId) ?? []
      }
    }
    const lower = baseLower + (resolvedLowerBoundMinutes(task.duration) ?? 0)
    const upper = baseUpper + (resolvedUpperBoundMinutes(task.duration) ?? 0)
    finishLower.set(task.id, lower)
    finishUpper.set(task.id, upper)
    pathTo.set(task.id, [...bestPath, task.id])
  }

  // 7. complete-meal readiness（Section 11）: すべての必須構成要素が ready に
  //    なる時点 = active task の最遅完了時刻
  let tableLower = 0
  let tableUpper = 0
  let criticalPath: string[] = []
  for (const task of activeTasks) {
    const upper = finishUpper.get(task.id) ?? 0
    if (upper >= tableUpper) {
      tableUpper = upper
      tableLower = finishLower.get(task.id) ?? 0
      criticalPath = pathTo.get(task.id) ?? [task.id]
    }
  }

  const value: TimeValue =
    tableLower === tableUpper
      ? { kind: 'exact', minutes: tableUpper }
      : { kind: 'range', minMinutes: tableLower, maxMinutes: tableUpper }

  return {
    kind: 'resolved',
    value,
    derivation: buildDerivation(plan, context, activeTasks, criticalPath, value),
    criticalPath,
  }
}

/**
 * 将来の厳密な「今の家の状態から N分以内に食卓へ出せる」判定の foundation。
 * 本MISSIONでは production 15/30 quick filter（recipe-suggestion-engine.ts が
 * recipe.cookingTimeMinutes を直接比較する既存実装）には一切接続しない。
 *
 * - unresolved は絶対に適格にならない。
 * - range は上限（maxMinutes）で判定する。midpoint も下限も使わない。
 */
export function qualifiesForStrictMaxFromNowToTable(
  result: FromNowToTableResult,
  maxMinutes: number,
): boolean {
  if (result.kind !== 'resolved') return false
  const upper = resolvedUpperBoundMinutes(result.value)
  if (upper === null) return false
  return upper <= maxMinutes
}
