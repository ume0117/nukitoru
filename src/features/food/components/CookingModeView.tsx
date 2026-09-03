'use client'

// ============================================================
// CookingModeView.tsx
//
// MISSION 2.40 — Swipe Cooking Mode。1 画面 = 1 工程 / 左右スワイプ中心。
//
// - 料理中は Share / Print / Favorite / Settings / navigation を前面に出さない。
// - 左スワイプ → 次 / 右スワイプ → 前。補助ボタンも大きい touch target。
// - Source にない heat / time を表示しない（CookingStepView をそのまま描画）。
// - prefers-reduced-motion 尊重。gesture library なし（pointer delta のみ）。
// - state は client のみ（DB 保存なし）。
// ============================================================

import { useCallback, useRef, useState } from 'react'
import type { NukitoruPresentation } from '@/features/food/types'
import {
  createCookingSession,
  currentStepView,
  progressText,
  advanceStep,
  retreatStep,
  classifySwipe,
  applySwipe,
  isCompleted,
} from '@/features/food/lib/cooking-navigation'
import { shareFood, buildSnsShareUrls } from '@/features/food/lib/food-share'

interface Props {
  presentation: NukitoruPresentation
  recipeName: string
  onExit: () => void
  onCompleted?: () => void
}


export function CookingModeView({ presentation, recipeName, onExit, onCompleted }: Props) {
  const [session, setSession] = useState(() => createCookingSession(presentation))
  const startRef = useRef<{ x: number; y: number } | null>(null)

  const step = currentStepView(session)
  const completed = isCompleted(session)

  const next = useCallback(() => setSession((s) => advanceStep(s)), [])
  const prev = useCallback(() => setSession((s) => retreatStep(s)), [])

  const onPointerDown = (e: React.PointerEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const start = startRef.current
    startRef.current = null
    if (!start) return
    const intent = classifySwipe({ deltaX: e.clientX - start.x, deltaY: e.clientY - start.y })
    if (intent === 'none') return
    setSession((s) => {
      const nextS = applySwipe(s, intent)
      if (isCompleted(nextS) && !isCompleted(s)) onCompleted?.()
      return nextS
    })
  }
  const onPointerCancel = () => {
    startRef.current = null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-black text-gray-900 dark:text-gray-100"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* 最小限のヘッダ: 進捗 + 中断のみ。Share/Print/Favorite は出さない */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <span className="text-sm font-medium tabular-nums">{progressText(session)}</span>
        <button
          type="button"
          onClick={onExit}
          className="min-h-[44px] px-4 text-sm text-gray-500 dark:text-gray-400"
        >
          中断
        </button>
      </div>

      {/* 本体: 1 画面 1 工程 */}
      <div
        className="flex-1 flex flex-col justify-center px-6 select-none touch-pan-y"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {completed || !step ? (
          <Completion recipeName={recipeName} />
        ) : (
          <div className="max-w-md mx-auto w-full space-y-5">
            <p className="text-xs tracking-widest text-gray-400 dark:text-gray-600 uppercase">
              STEP {step.displayNumber} / {step.totalSteps}
            </p>
            {step.heatAction && (
              <p className="text-lg font-semibold text-orange-600 dark:text-orange-400">🔥 {step.heatAction}</p>
            )}
            <h2 className="text-2xl font-bold leading-snug">{step.title}</h2>
            {step.ingredientActions.length > 0 && (
              <ul className="space-y-1.5 text-lg">
                {step.ingredientActions.map((a, i) => (
                  <li key={i}>・{a}</li>
                ))}
              </ul>
            )}
            <p className="text-lg text-gray-700 dark:text-gray-300">{step.shortInstruction}</p>
            {step.durationDisplay && (
              <p className="text-base text-gray-500 dark:text-gray-400">目安：{step.durationDisplay}</p>
            )}
            {step.completionCue && (
              <p className="text-base text-emerald-700 dark:text-emerald-400">👀 {step.completionCue}</p>
            )}
            {step.warning && (
              <p className="text-base text-red-600 dark:text-red-400">⚠️ {step.warning}</p>
            )}
          </div>
        )}
      </div>

      {/* 大きな補助ナビ（swipe できない環境向け。小さな target にしない） */}
      <div className="flex border-t border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={prev}
          disabled={!completed && step?.isFirst}
          className="flex-1 min-h-[64px] text-base font-medium disabled:opacity-30 border-r border-gray-200 dark:border-gray-800"
          aria-label="前の工程へ"
        >
          ← 戻る
        </button>
        {completed ? (
          <button type="button" onClick={onExit} className="flex-1 min-h-[64px] text-base font-semibold">
            とじる
          </button>
        ) : (
          <button
            type="button"
            onClick={next}
            className="flex-1 min-h-[64px] text-base font-semibold"
            aria-label={step?.isLast ? '完成へ' : '次の工程へ'}
          >
            {step?.isLast ? '完成 →' : '次へ →'}
          </button>
        )}
      </div>
    </div>
  )
}

function Completion({ recipeName }: { recipeName: string }) {
  // MISSION 2.40A: Share は実動化。未実装の Favorite / Repeat / Print は完成画面から隠す
  // （押せない UI を完成体験に並べない。型 boundary / docs は残す）。
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'unavailable'>('idle')
  const [showSns, setShowSns] = useState(false)
  const snsUrls = buildSnsShareUrls({ recipeName })

  const onShare = async () => {
    const outcome = await shareFood({ recipeName })
    if (outcome === 'copied') setShareState('copied')
    else if (outcome === 'unavailable') {
      setShareState('unavailable')
      setShowSns(true)
    }
  }

  return (
    <div className="max-w-md mx-auto w-full text-center space-y-6">
      <p className="text-5xl">🎉</p>
      <h2 className="text-3xl font-bold">今日のごはん完成！</h2>
      <p className="text-lg text-gray-600 dark:text-gray-400">{recipeName}</p>

      <div className="pt-2 space-y-2">
        <button
          type="button"
          onClick={onShare}
          className="w-full min-h-[56px] rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-black text-base font-semibold"
        >
          みんなにシェアする
        </button>
        {shareState === 'copied' && (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">クリップボードにコピーしました</p>
        )}
        {(showSns || shareState === 'unavailable') && (
          <div className="flex justify-center gap-3 text-sm">
            <a href={snsUrls.x} target="_blank" rel="noopener noreferrer" className="min-h-[44px] leading-[44px] px-2 underline">X</a>
            <a href={snsUrls.bluesky} target="_blank" rel="noopener noreferrer" className="min-h-[44px] leading-[44px] px-2 underline">Bluesky</a>
            <a href={snsUrls.facebook} target="_blank" rel="noopener noreferrer" className="min-h-[44px] leading-[44px] px-2 underline">Facebook</a>
            <a href={snsUrls.line} target="_blank" rel="noopener noreferrer" className="min-h-[44px] leading-[44px] px-2 underline">LINE</a>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-600">
        気に入ったら、覚えて、また作って、みんなにシェア。<br />#NUKITORU #NUKITORUFOOD
      </p>
    </div>
  )
}
