'use client'

import { useState } from 'react'
import type { MealFeedbackRating } from '@/features/food/types'
import { recordMealFeedback } from '@/features/food/lib/storage'

interface Props {
  recipeId: string
}

const OPTIONS: { rating: MealFeedbackRating; emoji: string; label: string }[] = [
  { rating: 'good', emoji: '👍', label: 'いい' },
  { rating: 'neutral', emoji: '😐', label: 'ふつう' },
  { rating: 'bad', emoji: '👎', label: 'いまいち' },
]

/**
 * MISSION 2.12 PHASE A — Beta Feedback MVP。
 * 「この提案どうだった？」への最小限のfeedback。自由記述・料理レビュー
 * 機能ではない。localStorageのみに保存し、選んだ人・アレルギー等は
 * 一切紐付けない（MealFeedback型にそのフィールドが存在しない）。
 */
export function RecipeFeedback({ recipeId }: Props) {
  const [submitted, setSubmitted] = useState<MealFeedbackRating | null>(null)

  if (submitted) {
    return (
      <p className="text-[11px] text-gray-400 dark:text-gray-600 text-center">
        フィードバックありがとうございます
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-gray-400 dark:text-gray-600 text-center">この提案どうだった？</p>
      <div className="flex justify-center gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.rating}
            onClick={() => {
              recordMealFeedback({ recipeId, recordedAt: new Date().toISOString(), rating: option.rating })
              setSubmitted(option.rating)
            }}
            aria-label={option.label}
            className="h-10 w-10 border border-gray-200 dark:border-gray-800 hover:border-blue-600 text-lg transition-colors"
          >
            {option.emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
