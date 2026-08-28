'use client'

import type { DishType, MealSuggestionResponse } from '@/features/food/types'
import { getRecipeById } from '@/features/food/lib/recipe-catalog'
import { cuisineLabel } from '@/features/food/lib/recipe-labels'

interface Props {
  /** 「今日の献立を考える」を押した結果。まだ押していない場合は null */
  result: MealSuggestionResponse | null
  /** 食材が1件以上登録されているか（0件の場合は専用の案内を出す） */
  hasIngredients: boolean
  /** 候補カードの「詳しく見る」が押された時、そのrecipeIdを渡す */
  onSelectRecipe?: (recipeId: string) => void
}

const DISH_TYPE_LABELS: Record<DishType, string> = {
  main: '主菜',
  side: '副菜',
  soup: '汁物',
  other: 'その他',
}

/**
 * MISSION 2.11 PHASE D — 「今日のおすすめ」候補一覧。
 * 1画面に情報を詰め込みすぎず、スマホで一瞬で比較できることを優先する
 * （料理名・cuisine・type・A/B状態・調理時間・不足食材のみ。作り方や
 * 準備するもの等はRecipe Detail側でのみ表示する）。
 *
 * A（今ある食材で作れる）は、Bカテゴリより常に上に表示される
 * （mockMealProvider.suggestの返す順序がすでにA優先になっているため、
 * ここでは並び替えを行わず順序をそのまま尊重するだけでよい）。
 */
export function MealResultView({ result, hasIngredients, onSelectRecipe }: Props) {
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
      <div className="border border-gray-100 dark:border-gray-800 p-4 space-y-1.5">
        <p className="text-[12px] text-gray-600 dark:text-gray-400">
          まだこの組み合わせの提案には対応していません
        </p>
        <p className="text-[11px] text-gray-400 dark:text-gray-600">食材を追加すると候補が増えます</p>
        <p className="text-[11px] text-gray-400 dark:text-gray-600">
          現在はRelease 0.1のため対応できる料理を限定しています
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">今日のおすすめ</p>

      {result.suggestions.map((suggestion, i) => {
        const recipe = suggestion.recipeId ? getRecipeById(suggestion.recipeId) : undefined
        const cuisine = cuisineLabel(recipe?.cuisine)
        const dishType = suggestion.dishes[0]?.type
        const isAvailable = suggestion.isFullyAvailable ?? true
        const missing = suggestion.missingIngredients ?? []

        return (
          <div key={i} className="border border-gray-200 dark:border-gray-800 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-[9px] tracking-[0.1em] px-1.5 py-0.5 border uppercase shrink-0 ${
                  isAvailable
                    ? 'border-blue-600 text-blue-600'
                    : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                {isAvailable ? 'A' : 'B'}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {[cuisine, dishType && DISH_TYPE_LABELS[dishType]].filter(Boolean).join(' ・ ')}
              </span>
            </div>

            <p className="text-base font-medium text-gray-900 dark:text-white break-words">
              {suggestion.title}
            </p>

            <p className="text-[12px] text-gray-600 dark:text-gray-400">
              {isAvailable ? '今ある食材で作れます' : 'あと1つで作れます'}
              {' ・ '}約{suggestion.estimatedMinutes ?? '-'}分
            </p>

            {!isAvailable && missing.length > 0 && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                不足：{missing.join('、')}
              </p>
            )}

            {onSelectRecipe && suggestion.recipeId && (
              <button
                onClick={() => onSelectRecipe(suggestion.recipeId as string)}
                className="w-full h-10 border border-gray-300 dark:border-gray-700 hover:border-blue-600 hover:text-blue-600 text-[11px] tracking-[0.1em] text-gray-600 dark:text-gray-400 transition-colors"
              >
                詳しく見る →
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
