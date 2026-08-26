'use client'

import { useState } from 'react'
import type { Pantry } from '@/features/food/types'
import { SEASONING_MASTER } from '@/features/food/lib/stock-master-data'
import { toggleItem } from '@/features/food/lib/stock-utils'

interface Props {
  value: Pantry
  onChange: (next: Pantry) => void
}

const ALL_SEASONING_LABELS = SEASONING_MASTER.flatMap((g) => g.items.map((i) => i.label))
const FEATURED_SEASONINGS = SEASONING_MASTER.flatMap((g) => g.items.filter((i) => i.featured))

function Chip({
  label,
  selected,
  onToggle,
}: {
  label: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`h-8 px-2.5 text-[12px] border transition-colors ${
        selected
          ? 'border-blue-600 text-blue-600'
          : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
      }`}
    >
      {selected ? '✓ ' : ''}
      {label}
    </button>
  )
}

export function PantrySelector({ value, onChange }: Props) {
  const [showMore, setShowMore] = useState(false)

  const toggle = (label: string) => {
    onChange({ staples: toggleItem(value.staples, label) })
  }

  const allSelected = ALL_SEASONING_LABELS.every((l) => value.staples.includes(l))

  const selectAllOrClear = () => {
    onChange({ staples: allSelected ? [] : [...ALL_SEASONING_LABELS] })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between min-h-[20px]">
        <p className="text-[9px] tracking-[0.2em] leading-none text-gray-400 dark:text-gray-600 uppercase">常備調味料</p>
        <button
          onClick={selectAllOrClear}
          className="text-[10px] tracking-[0.1em] leading-none text-gray-400 dark:text-gray-600 hover:text-blue-600 uppercase transition-colors"
        >
          {allSelected ? 'すべて解除' : '全部ある'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FEATURED_SEASONINGS.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            selected={value.staples.includes(item.label)}
            onToggle={() => toggle(item.label)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="text-[10px] tracking-[0.1em] text-gray-400 dark:text-gray-600 hover:text-blue-600 uppercase transition-colors"
      >
        {showMore ? '閉じる' : 'もっと見る'}
      </button>

      {showMore && (
        <div className="space-y-3 pt-1">
          {SEASONING_MASTER.map((group) => {
            // featured項目は上のよく使うもの行に既に表示済みのため、ここでは表示上だけ除外する
            const rest = group.items.filter((item) => !item.featured)
            if (rest.length === 0) return null
            return (
              <div key={group.label} className="space-y-1">
                <p className="text-[9px] tracking-[0.15em] text-gray-300 dark:text-gray-700 uppercase">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {rest.map((item) => (
                    <Chip
                      key={item.id}
                      label={item.label}
                      selected={value.staples.includes(item.label)}
                      onToggle={() => toggle(item.label)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[10px] text-gray-300 dark:text-gray-700">
        参考情報として保存されます。現在のバージョンでは献立の内容には反映されません。
      </p>
    </div>
  )
}
