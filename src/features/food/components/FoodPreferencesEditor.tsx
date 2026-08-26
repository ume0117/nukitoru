'use client'

import { useState } from 'react'
import type { Cuisine, FoodPreferences, SpiceLevel } from '@/features/food/types'
import { addCustomItem } from '@/features/food/lib/stock-utils'

interface Props {
  value: FoodPreferences
  onChange: (next: FoodPreferences) => void
}

export const CUISINE_LABELS: Record<Cuisine, string> = {
  japanese: '和食',
  western: '洋食',
  chinese: '中華',
  korean: '韓国料理',
  italian: 'イタリアン',
  other: 'その他',
}
const CUISINES = Object.keys(CUISINE_LABELS) as Cuisine[]

export const SPICE_LEVELS: { value: SpiceLevel; label: string }[] = [
  { value: 'none', label: '辛いものNG' },
  { value: 'mild', label: '少しならOK' },
  { value: 'medium', label: '普通' },
  { value: 'hot', label: '辛いもの好き' },
]

export function FoodPreferencesEditor({ value, onChange }: Props) {
  const [ingredientInput, setIngredientInput] = useState('')

  const addFavoriteIngredient = () => {
    const trimmed = ingredientInput.trim()
    if (!trimmed) return
    onChange({ ...value, favoriteIngredients: addCustomItem(value.favoriteIngredients, trimmed) })
    setIngredientInput('')
  }

  const removeFavoriteIngredient = (name: string) => {
    onChange({ ...value, favoriteIngredients: value.favoriteIngredients.filter((i) => i !== name) })
  }

  const toggleCuisine = (cuisine: Cuisine) => {
    const has = value.favoriteCuisines.includes(cuisine)
    onChange({
      ...value,
      favoriteCuisines: has
        ? value.favoriteCuisines.filter((c) => c !== cuisine)
        : [...value.favoriteCuisines, cuisine],
    })
  }

  const setSpiceLevel = (level: SpiceLevel) => {
    onChange({ ...value, spiceLevel: value.spiceLevel === level ? null : level })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">食の好み</p>
        <p className="text-[10px] text-gray-400 dark:text-gray-600">
          今後の提案改善のために保存する設定です。現在のバージョンでは献立の内容には反映されません。
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="text-[9px] tracking-[0.15em] text-gray-300 dark:text-gray-700 uppercase">好きな食材</p>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={ingredientInput}
            onChange={(e) => setIngredientInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addFavoriteIngredient()
              }
            }}
            placeholder="例：トマト"
            className="flex-1 h-10 px-3 text-sm border border-gray-100 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none focus:border-blue-600 transition-colors"
          />
          <button
            onClick={addFavoriteIngredient}
            disabled={!ingredientInput.trim()}
            className="h-10 min-w-[72px] px-3 border border-gray-200 dark:border-gray-800 text-[10px] tracking-[0.1em] text-gray-500 dark:text-gray-400 hover:border-blue-600 hover:text-blue-600 disabled:opacity-40 transition-colors"
          >
            追加
          </button>
        </div>
        {value.favoriteIngredients.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {value.favoriteIngredients.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 h-7 px-2 text-[11px] border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
              >
                {name}
                <button
                  onClick={() => removeFavoriteIngredient(name)}
                  aria-label={`${name}を削除`}
                  className="text-gray-300 dark:text-gray-700 hover:text-red-500"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-[9px] tracking-[0.15em] text-gray-300 dark:text-gray-700 uppercase">よく作る料理ジャンル</p>
        <div className="flex flex-wrap gap-1.5">
          {CUISINES.map((cuisine) => {
            const selected = value.favoriteCuisines.includes(cuisine)
            return (
              <button
                key={cuisine}
                onClick={() => toggleCuisine(cuisine)}
                aria-pressed={selected}
                className={`h-8 px-2.5 text-[12px] border transition-colors ${
                  selected
                    ? 'border-blue-600 text-blue-600'
                    : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
                }`}
              >
                {selected ? '✓ ' : ''}
                {CUISINE_LABELS[cuisine]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[9px] tracking-[0.15em] text-gray-300 dark:text-gray-700 uppercase">辛さの好み</p>
        <div className="flex flex-wrap gap-1.5">
          {SPICE_LEVELS.map((option) => {
            const selected = value.spiceLevel === option.value
            return (
              <button
                key={option.value}
                onClick={() => setSpiceLevel(option.value)}
                aria-pressed={selected}
                className={`h-9 px-3 text-[12px] border transition-colors ${
                  selected
                    ? 'border-blue-600 text-blue-600'
                    : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
                }`}
              >
                {selected ? '✓ ' : ''}
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
