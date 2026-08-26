'use client'

import { useState } from 'react'
import type { AllergyProfile } from '@/features/food/types'

interface Props {
  value: AllergyProfile
  onChange: (next: AllergyProfile) => void
}

function TagList({
  items,
  onRemove,
  emptyLabel,
}: {
  items: string[]
  onRemove: (index: number) => void
  emptyLabel: string
}) {
  if (items.length === 0) {
    return <p className="text-[10px] text-gray-300 dark:text-gray-700">{emptyLabel}</p>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 h-7 px-2 text-[11px] border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
        >
          {item}
          <button
            onClick={() => onRemove(i)}
            aria-label={`${item}を削除`}
            className="text-gray-300 dark:text-gray-700 hover:text-red-500"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )
}

function TagInput({
  placeholder,
  onAdd,
}: {
  placeholder: string
  onAdd: (value: string) => void
}) {
  const [value, setValue] = useState('')

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue('')
  }

  return (
    <div className="flex gap-1.5">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
        }}
        placeholder={placeholder}
        className="flex-1 h-9 px-3 text-sm border border-gray-100 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none focus:border-blue-600 transition-colors"
      />
      <button
        onClick={submit}
        disabled={!value.trim()}
        className="h-9 px-3 border border-gray-200 dark:border-gray-800 text-[10px] tracking-[0.1em] text-gray-500 dark:text-gray-400 hover:border-blue-600 hover:text-blue-600 disabled:opacity-40 transition-colors"
      >
        追加
      </button>
    </div>
  )
}

export function AllergyDislikeInput({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5 border border-red-200 dark:border-red-900/50 p-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] tracking-[0.1em] text-red-600 dark:text-red-400 font-medium">
            ⚠ 必ず除外
          </span>
          <span className="text-[9px] tracking-[0.15em] text-gray-400 dark:text-gray-600 uppercase">アレルギー</span>
        </div>
        <TagInput
          placeholder="例：卵、えび"
          onAdd={(name) => onChange({ ...value, allergies: [...value.allergies, name] })}
        />
        <TagList
          items={value.allergies}
          emptyLabel="登録されているアレルギーはありません"
          onRemove={(i) => onChange({ ...value, allergies: value.allergies.filter((_, idx) => idx !== i) })}
        />
      </div>

      <div className="space-y-1.5 border border-amber-200 dark:border-amber-900/50 p-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] tracking-[0.1em] text-amber-600 dark:text-amber-400 font-medium">
            △ できるだけ避ける
          </span>
          <span className="text-[9px] tracking-[0.15em] text-gray-400 dark:text-gray-600 uppercase">苦手な食材</span>
        </div>
        <TagInput
          placeholder="例：パクチー"
          onAdd={(name) => onChange({ ...value, dislikes: [...value.dislikes, name] })}
        />
        <TagList
          items={value.dislikes}
          emptyLabel="登録されている苦手食材はありません"
          onRemove={(i) => onChange({ ...value, dislikes: value.dislikes.filter((_, idx) => idx !== i) })}
        />
      </div>
    </div>
  )
}
