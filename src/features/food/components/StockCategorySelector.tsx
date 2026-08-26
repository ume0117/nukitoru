'use client'

import { useState } from 'react'
import type { MasterGroup } from '@/features/food/types'
import { toggleItem, addCustomItem } from '@/features/food/lib/stock-utils'

interface Props {
  title: string
  description?: string
  groups: MasterGroup[]
  selectedItems: string[]
  onChange: (next: string[]) => void
  customItemLabel?: string
}

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

export function StockCategorySelector({
  title,
  description,
  groups,
  selectedItems,
  onChange,
  customItemLabel = '＋ 常備品を追加',
}: Props) {
  const [showMore, setShowMore] = useState(false)
  const [customValue, setCustomValue] = useState('')

  const featuredItems = groups.flatMap((g) => g.items.filter((i) => i.featured))
  const masterLabels = new Set(groups.flatMap((g) => g.items.map((i) => i.label)))
  const customSelected = selectedItems.filter((s) => !masterLabels.has(s))

  const handleToggle = (label: string) => {
    onChange(toggleItem(selectedItems, label))
  }

  const handleAddCustom = () => {
    const trimmed = customValue.trim()
    if (!trimmed) return
    onChange(addCustomItem(selectedItems, trimmed))
    setCustomValue('')
  }

  return (
    <div className="space-y-2">
      <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">{title}</p>
      {description && <p className="text-[10px] text-gray-400 dark:text-gray-600">{description}</p>}

      <div className="flex flex-wrap gap-1.5">
        {featuredItems.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            selected={selectedItems.includes(item.label)}
            onToggle={() => handleToggle(item.label)}
          />
        ))}
      </div>

      {customSelected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {customSelected.map((label) => (
            <Chip key={label} label={label} selected onToggle={() => handleToggle(label)} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="text-[10px] tracking-[0.1em] text-gray-400 dark:text-gray-600 hover:text-blue-600 uppercase transition-colors"
      >
        {showMore ? '閉じる' : 'もっと見る'}
      </button>

      {showMore && (
        <div className="space-y-3 pt-1">
          {groups.map((group) => {
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
                      selected={selectedItems.includes(item.label)}
                      onToggle={() => handleToggle(item.label)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex gap-1.5 pt-1">
        <input
          type="text"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddCustom()
            }
          }}
          placeholder={customItemLabel}
          className="flex-1 h-10 px-3 text-sm border border-gray-100 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none focus:border-blue-600 transition-colors"
        />
        <button
          type="button"
          onClick={handleAddCustom}
          disabled={!customValue.trim()}
          className="h-10 min-w-[72px] px-3 border border-gray-200 dark:border-gray-800 text-[10px] tracking-[0.1em] text-gray-500 dark:text-gray-400 hover:border-blue-600 hover:text-blue-600 disabled:opacity-40 transition-colors"
        >
          追加
        </button>
      </div>

      {/* 将来: ここに「追加してほしい食品がありますか？」への要望導線を追加できる */}
    </div>
  )
}
