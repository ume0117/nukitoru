'use client'

import type { DailyCondition } from '@/features/food/types'

interface Props {
  value: DailyCondition | undefined
  onChange: (next: DailyCondition | undefined) => void
}

const CONDITION_LABELS: Record<DailyCondition, string> = {
  normal: '普通',
  tired: '疲れている',
  cold_symptoms: '風邪気味',
  low_appetite: '食欲がない',
  heavy_stomach: '胃が重い',
  summer_fatigue: '夏バテ気味',
  hangover: '二日酔い',
}

const CONDITIONS = Object.keys(CONDITION_LABELS) as DailyCondition[]

export function ConditionSelector({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">今日の体調</p>
      <div className="flex flex-wrap gap-1.5">
        {CONDITIONS.map((condition) => (
          <button
            key={condition}
            onClick={() => onChange(value === condition ? undefined : condition)}
            className={`h-9 px-3 text-[12px] border transition-colors ${
              value === condition
                ? 'border-blue-600 text-blue-600'
                : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            {CONDITION_LABELS[condition]}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-300 dark:text-gray-700">
        この情報は診断目的ではありません。記録のみ行い、献立の選定内容には反映されません。
      </p>
    </div>
  )
}
