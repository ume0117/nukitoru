'use client'

import { useState } from 'react'
import type { DishType, MealCandidateType, MealSuggestion, MealSuggestionResponse } from '@/features/food/types'
import { getRecipeById } from '@/features/food/lib/recipe-catalog'
import { candidateAvailabilityLabel, cuisineLabel } from '@/features/food/lib/recipe-labels'
import { selectBetaCandidates } from '@/features/food/lib/beta-presentation'
import { shareCandidate, type ShareOutcome } from '@/features/food/lib/family-share'

interface Props {
  /** 「今日の献立を考える」を押した結果。まだ押していない場合は null */
  result: MealSuggestionResponse | null
  /** 食材が1件以上登録されているか（0件の場合は専用の案内を出す） */
  hasIngredients: boolean
  /** 現在「家にあるもので」条件が選ばれているか（0件時の案内文の出し分けに使う） */
  onlyFullyAvailable?: boolean
  /** 候補カードの「これ作る」が押された時、そのrecipeIdとcandidateTypeを渡す */
  onSelectRecipe?: (recipeId: string, candidateType: MealCandidateType) => void
  /** 候補0件の時、条件を「おまかせ」に緩めるための任意コールバック */
  onRelaxConditions?: () => void
}

const DISH_TYPE_LABELS: Record<DishType, string> = {
  main: '主菜',
  side: '副菜',
  soup: '汁物',
  other: 'その他',
}

/**
 * MISSION 2.12 PHASE A — 候補1件分のカード。3秒で理解できることを優先し、
 * 内部開発用語「A」「B」はそのまま表示しない（candidateAvailabilityLabel）。
 * 主要CTAは「これ作る」（Recipe Detailへ進み、MealDecisionを記録する）、
 * 副次CTAは「家族に聞く」（Web Share API。LINE専用実装にしない）。
 */
function CandidateCard({
  suggestion,
  cuisine,
  dishTypeLabel,
  onSelectRecipe,
}: {
  suggestion: MealSuggestion
  cuisine: string | undefined
  dishTypeLabel: string | undefined
  onSelectRecipe?: (recipeId: string, candidateType: MealCandidateType) => void
}) {
  const [shareOutcome, setShareOutcome] = useState<ShareOutcome | null>(null)
  const isAvailable = suggestion.isFullyAvailable ?? true
  const missing = suggestion.missingIngredients ?? []
  // MISSION 2.20: Product Time が未確定（review/unknown）の Recipe は estimatedMinutes=null。
  // 確定値「約○分」を出さず「調理時間は確認中」と表示する。
  const timeText =
    suggestion.estimatedMinutes != null ? `約${suggestion.estimatedMinutes}分` : '調理時間は確認中'

  const handleShare = async () => {
    const outcome = await shareCandidate({ title: suggestion.title, estimatedMinutes: suggestion.estimatedMinutes })
    setShareOutcome(outcome)
  }

  return (
    <div className="border border-gray-200 dark:border-gray-800 p-3.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[11px] px-1.5 py-0.5 border shrink-0 ${
            isAvailable
              ? 'border-blue-600 text-blue-600'
              : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
          }`}
        >
          {candidateAvailabilityLabel(isAvailable, missing.length > 0)}
        </span>
        <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
          {[cuisine, dishTypeLabel].filter(Boolean).join(' ・ ')}
        </span>
      </div>

      <p className="text-base font-medium text-gray-900 dark:text-white break-words">{suggestion.title}</p>

      <p className="text-[12px] text-gray-600 dark:text-gray-400">{timeText}</p>

      {!isAvailable && missing.length > 0 && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">あと1つ：{missing.join('、')}</p>
      )}

      <div className="flex gap-1.5">
        {onSelectRecipe && suggestion.recipeId && (
          <button
            onClick={() => onSelectRecipe(suggestion.recipeId as string, isAvailable ? 'A' : 'B')}
            className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white text-[12px] tracking-[0.1em] font-medium transition-colors"
          >
            これ作る
          </button>
        )}
        <button
          onClick={handleShare}
          aria-label="家族に聞く"
          className="h-11 px-3 border border-gray-300 dark:border-gray-700 hover:border-blue-600 hover:text-blue-600 text-[12px] text-gray-600 dark:text-gray-400 transition-colors shrink-0"
        >
          家族に聞く
        </button>
      </div>

      {shareOutcome === 'shared' && (
        <p className="text-[10px] text-gray-400 dark:text-gray-600">共有しました。</p>
      )}
      {shareOutcome === 'copied' && (
        <p className="text-[10px] text-gray-400 dark:text-gray-600">
          共有文をコピーしました。LINEなどに貼り付けて送れます。
        </p>
      )}
      {shareOutcome === 'unavailable' && (
        <div className="space-y-1 border border-gray-200 dark:border-gray-800 p-2">
          <p className="text-[10px] text-gray-400 dark:text-gray-600">
            この端末では共有機能が使えません。下の文章をコピーして送ってください。
          </p>
          <textarea
            readOnly
            value={`今日これどう？\n\n${suggestion.title}\n${timeText}\n\nNUKITORU FOOD\nhttps://nukitoru.pages.dev/food`}
            aria-label="共有文"
            className="w-full h-24 text-[11px] p-1.5 border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-800 dark:text-gray-100"
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}
    </div>
  )
}

/**
 * MISSION 2.11 PHASE D / MISSION 2.12 PHASE A — 「今日のおすすめ」候補一覧。
 * First 10 Families Betaでは候補を大量に見せない（最大3件、selectBetaCandidates）。
 * 候補が3件未満の場合も無理に増やさない。
 *
 * A（今ある食材で作れる）は、Bカテゴリより常に上に表示される
 * （mockMealProvider.suggestの返す順序がすでにA優先になっているため、
 * ここでは並び替えを行わず順序をそのまま尊重するだけでよい）。
 */
export function MealResultView({
  result,
  hasIngredients,
  onlyFullyAvailable,
  onSelectRecipe,
  onRelaxConditions,
}: Props) {
  if (!hasIngredients) {
    return (
      <div className="border border-gray-100 dark:border-gray-800 p-4 text-center">
        <p className="text-[12px] text-gray-500 dark:text-gray-400">食材を1つ以上追加してください</p>
      </div>
    )
  }

  if (!result) {
    return null
  }

  if (result.suggestions.length === 0) {
    return (
      <div className="border border-gray-100 dark:border-gray-800 p-4 space-y-2">
        <p className="text-[12px] text-gray-600 dark:text-gray-400">今の条件では候補が見つかりませんでした</p>
        <ul className="text-[11px] text-gray-400 dark:text-gray-600 space-y-0.5 list-disc list-inside">
          <li>食材を追加する</li>
          <li>時間条件を広げる</li>
        </ul>
        {onRelaxConditions && onlyFullyAvailable && (
          <button
            onClick={onRelaxConditions}
            className="w-full h-9 border border-gray-300 dark:border-gray-700 hover:border-blue-600 hover:text-blue-600 text-[11px] text-gray-600 dark:text-gray-400 transition-colors"
          >
            条件を「おまかせ」にする
          </button>
        )}
      </div>
    )
  }

  const candidates = selectBetaCandidates(result.suggestions)

  return (
    <div className="space-y-3">
      <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">今日のおすすめ</p>

      {candidates.map((suggestion, i) => {
        const recipe = suggestion.recipeId ? getRecipeById(suggestion.recipeId) : undefined
        const cuisine = cuisineLabel(recipe?.cuisine)
        const dishType = suggestion.dishes[0]?.type
        return (
          <CandidateCard
            key={i}
            suggestion={suggestion}
            cuisine={cuisine}
            dishTypeLabel={dishType ? DISH_TYPE_LABELS[dishType] : undefined}
            onSelectRecipe={onSelectRecipe}
          />
        )
      })}
    </div>
  )
}
