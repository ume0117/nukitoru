// ============================================================
// cooking-navigation.ts
//
// MISSION 2.40 — Swipe Cooking Mode の決定論的ナビゲーション純粋関数。
//
//   1 画面 = 1 工程 / 左スワイプ→次 / 右スワイプ→前 /
//   小さいボタンを狙わせない（swipe を主要操作にする）。
//
// 絶対ルール:
// - Recipe step（PresentationStep）を mutate しない。session は derived state のみ。
// - Source にない heat / time を UI が生成しない（CookingStepView は
//   PresentationStep の値をそのまま通す。undefined は undefined のまま）。
// - swipe 判定は決定論的な純粋関数。gesture library を追加しない
//   （browser pointer/touch delta を渡してもらう前提）。
// - 境界安全: first step で previous → 負数にしない。last step で next → completed。
// - deterministic（乱数・現在時刻・ネットワークなし）。
// - Firewall: このモジュールは domain / UI いずれの重い依存も持たない。
// ============================================================

import type {
  CookingSession,
  CookingStepView,
  NukitoruPresentation,
  PresentationStep,
  SwipeConfig,
  SwipeInput,
  SwipeIntent,
} from '@/features/food/types'

// ------------------------------------------------------------
// Session
// ------------------------------------------------------------

/** NukitoruPresentation から Cooking Session を作る（step が無ければ即 completed） */
export function createCookingSession(presentation: NukitoruPresentation): CookingSession {
  const steps = [...presentation.steps]
  return {
    canonicalRecipeId: presentation.canonicalRecipeId,
    steps,
    currentIndex: 0,
    status: steps.length === 0 ? 'completed' : 'cooking',
  }
}

export function totalSteps(session: CookingSession): number {
  return session.steps.length
}

/** 現在の step 表示。completed のときは null */
export function currentStepView(session: CookingSession): CookingStepView | null {
  if (session.status === 'completed') return null
  const total = session.steps.length
  const idx = session.currentIndex
  const step: PresentationStep | undefined = session.steps[idx]
  if (!step) return null
  return {
    index: idx,
    displayNumber: idx + 1,
    totalSteps: total,
    title: step.title,
    shortInstruction: step.shortInstruction,
    ingredientActions: [...step.ingredientActions],
    ...(step.heatAction !== undefined ? { heatAction: step.heatAction } : {}),
    ...(step.durationDisplay !== undefined ? { durationDisplay: step.durationDisplay } : {}),
    ...(step.completionCue !== undefined ? { completionCue: step.completionCue } : {}),
    ...(step.warning !== undefined ? { warning: step.warning } : {}),
    sourceStepReference: step.sourceStepReference,
    isFirst: idx === 0,
    isLast: idx === total - 1,
  }
}

/** "STEP 3 / 7" or "完成" */
export function progressText(session: CookingSession): string {
  if (session.status === 'completed') return '完成'
  return `STEP ${session.currentIndex + 1} / ${session.steps.length}`
}

// ------------------------------------------------------------
// Advance / Retreat（境界安全）
// ------------------------------------------------------------

/**
 * 次の工程へ。最終工程で呼ぶと status='completed'（currentIndex は steps.length）。
 * completed で呼んでも completed のまま。
 */
export function advanceStep(session: CookingSession): CookingSession {
  if (session.status === 'completed') return session
  const nextIndex = session.currentIndex + 1
  if (nextIndex >= session.steps.length) {
    return { ...session, currentIndex: session.steps.length, status: 'completed' }
  }
  return { ...session, currentIndex: nextIndex }
}

/**
 * 前の工程へ。first step で呼んでも currentIndex は 0（負数にしない）。
 * completed で呼ぶと最終工程（steps.length - 1）へ戻り status='cooking'。
 */
export function retreatStep(session: CookingSession): CookingSession {
  if (session.steps.length === 0) return session
  if (session.status === 'completed') {
    return { ...session, currentIndex: session.steps.length - 1, status: 'cooking' }
  }
  if (session.currentIndex <= 0) {
    return { ...session, currentIndex: 0 }
  }
  return { ...session, currentIndex: session.currentIndex - 1 }
}

// ------------------------------------------------------------
// Swipe 判定（決定論的・pure）
// ------------------------------------------------------------

export const DEFAULT_SWIPE_CONFIG: SwipeConfig = {
  minHorizontalDistance: 48,
  maxVerticalRatio: 0.6,
}

/**
 * pointer/touch の delta から swipe intent を決める。
 * - |deltaX| < minHorizontalDistance → 'none'（短い動き・誤タップを swipe にしない）
 * - |deltaY| > maxVerticalRatio * |deltaX| → 'none'（主に縦の動きは誤 navigation しない）
 * - deltaX < 0（左方向）→ 'next'
 * - deltaX > 0（右方向）→ 'previous'
 */
export function classifySwipe(
  input: SwipeInput,
  config: SwipeConfig = DEFAULT_SWIPE_CONFIG,
): SwipeIntent {
  const absX = Math.abs(input.deltaX)
  const absY = Math.abs(input.deltaY)
  if (absX < config.minHorizontalDistance) return 'none'
  if (absY > config.maxVerticalRatio * absX) return 'none'
  if (input.deltaX < 0) return 'next'
  if (input.deltaX > 0) return 'previous'
  return 'none'
}

/** swipe intent を session へ適用（'none' は不変） */
export function applySwipe(session: CookingSession, intent: SwipeIntent): CookingSession {
  switch (intent) {
    case 'next':
      return advanceStep(session)
    case 'previous':
      return retreatStep(session)
    case 'none':
      return session
  }
}

/** swipe 入力を直接 session へ適用（classify + apply） */
export function applySwipeInput(
  session: CookingSession,
  input: SwipeInput,
  config: SwipeConfig = DEFAULT_SWIPE_CONFIG,
): CookingSession {
  return applySwipe(session, classifySwipe(input, config))
}

/** キーボード / 補助ボタン用（swipe と同じ意味） */
export function goToNextStep(session: CookingSession): CookingSession {
  return advanceStep(session)
}
export function goToPreviousStep(session: CookingSession): CookingSession {
  return retreatStep(session)
}

/** completed かどうか */
export function isCompleted(session: CookingSession): boolean {
  return session.status === 'completed'
}
