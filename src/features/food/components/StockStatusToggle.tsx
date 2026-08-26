'use client'

import type { StockStatus } from '@/features/food/types'

interface Props {
  itemName: string
  status: StockStatus
  onChange: (next: StockStatus) => void
}

const OPTIONS: { value: StockStatus; label: string }[] = [
  { value: 'available', label: 'あり' },
  { value: 'low', label: '少ない' },
  { value: 'out', label: 'なし' },
]

/** 「あり／少ない／なし」を直接選べる3択segmented control。循環タップ方式は採用しない。 */
export function StockStatusToggle({ itemName, status, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label={`${itemName}の在庫状態`}
      className="inline-flex shrink-0 border border-gray-200 dark:border-gray-800"
    >
      {OPTIONS.map((option, i) => {
        const selected = status === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={`h-10 px-3 text-[12px] whitespace-nowrap transition-colors ${
              i > 0 ? 'border-l border-gray-200 dark:border-gray-800' : ''
            } ${
              selected
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-blue-600'
            }`}
          >
            {selected ? '✓ ' : ''}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
