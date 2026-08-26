'use client'

import type { MealSuggestion, DishType, MealSuggestionResponse } from '@/features/food/types'

interface Props {
  /** 「今日の献立を考える」を押した結果。まだ押していない場合は null */
  result: MealSuggestionResponse | null
  /** 食材が1件以上登録されているか（0件の場合は専用の案内を出す） */
  hasIngredients: boolean
  /** 指定した場合のみ、各提案カードに「作った！」ボタンを表示する */
  onCookedClick?: (suggestion: MealSuggestion) => void
}

const DISH_TYPE_LABELS: Record<DishType, string> = {
  main: '主菜',
  side: '副菜',
  soup: '汁物',
  other: 'その他',
}

export function MealResultView({ result, hasIngredients, onCookedClick }: Props) {
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
      {result.suggestions.map((suggestion, i) => (
        <div key={i} className="border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <div className="space-y-1">
            <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">今日のおすすめ</p>
            <p className="text-base font-medium text-gray-900 dark:text-white">{suggestion.title}</p>
          </div>

          <div className="space-y-1">
            {suggestion.dishes.map((dish, di) => (
              <div key={di} className="flex items-center gap-2">
                <span className="text-[9px] tracking-[0.1em] px-1.5 py-0.5 border border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 uppercase shrink-0">
                  {DISH_TYPE_LABELS[dish.type]}
                </span>
                <span className="text-sm text-gray-800 dark:text-gray-100">{dish.name}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            調理時間の目安：約{suggestion.estimatedMinutes ?? '-'}分（献立全体の合計）
          </p>

          <p className="text-[11px] text-gray-500 dark:text-gray-400">{suggestion.reason}</p>

          {suggestion.notes.length > 0 && (
            <div className="space-y-0.5 pt-1 border-t border-gray-100 dark:border-gray-800">
              {suggestion.notes.map((note, ni) => (
                <p key={ni} className="text-[11px] text-gray-400 dark:text-gray-600">
                  {note}
                </p>
              ))}
            </div>
          )}

          {suggestion.warnings.length > 0 && (
            <div className="space-y-1 border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2.5">
              {suggestion.warnings.map((warning, wi) => (
                <p key={wi} className="text-[11px] text-amber-700 dark:text-amber-400">
                  ⚠ {warning}
                </p>
              ))}
            </div>
          )}

          {onCookedClick && (
            <button
              onClick={() => onCookedClick(suggestion)}
              className="w-full h-11 border border-gray-400 dark:border-gray-600 hover:border-blue-600 hover:text-blue-600 text-[11px] tracking-[0.15em] uppercase font-medium text-gray-500 dark:text-gray-400 transition-colors"
            >
              作った！
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
