'use client'

import { useState } from 'react'
import type { Ingredient, IngredientUnit, QuantityMode, VagueAmount } from '@/features/food/types'

interface Props {
  ingredients: Ingredient[]
  onChange: (next: Ingredient[]) => void
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

const EXACT_UNITS: IngredientUnit[] = ['piece', 'g', 'kg', 'ml', 'l', 'bunch', 'head', 'block', 'sheet']
const PACK_UNITS: IngredientUnit[] = ['pack', 'bag', 'box', 'bottle', 'tray']

const UNIT_LABELS: Record<IngredientUnit, string> = {
  piece: '個',
  pack: 'パック',
  bag: '袋',
  bottle: '本',
  box: '箱',
  tray: 'パック(トレー)',
  bunch: '束',
  sheet: '枚',
  head: '玉',
  block: '丁',
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'L',
  unknown: '-',
}

const VAGUE_LABELS: Record<VagueAmount, string> = {
  many: '多い',
  half: '半分くらい',
  little: '少し',
}

const MODE_LABELS: Record<QuantityMode, string> = {
  exact: '正確',
  pack: 'パック',
  vague: 'あいまい',
  unknown: '不明',
}

function quantitySummary(ingredient: Ingredient): string {
  if (ingredient.quantityMode === 'exact') {
    if (ingredient.quantity != null && ingredient.unit) {
      return `${ingredient.quantity}${UNIT_LABELS[ingredient.unit]}`
    }
    return '正確な数量'
  }
  if (ingredient.quantityMode === 'pack') {
    if (ingredient.quantity != null && ingredient.unit) {
      return `${ingredient.quantity}${UNIT_LABELS[ingredient.unit]}`
    }
    return 'パック'
  }
  if (ingredient.quantityMode === 'vague') {
    return ingredient.vagueAmount ? VAGUE_LABELS[ingredient.vagueAmount] : 'あいまい'
  }
  return '数量：不明'
}

function IngredientChip({
  ingredient,
  onUpdate,
  onDelete,
}: {
  ingredient: Ingredient
  onUpdate: (next: Ingredient) => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-gray-100 dark:border-gray-800 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-800 dark:text-gray-100">{ingredient.name}</span>
        <button
          onClick={onDelete}
          aria-label={`${ingredient.name}を削除`}
          className="w-6 h-6 flex items-center justify-center text-gray-300 dark:text-gray-700 hover:text-red-500 transition-colors shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-[10px] tracking-[0.1em] text-gray-400 dark:text-gray-600 hover:text-blue-600 uppercase transition-colors"
      >
        {expanded ? '閉じる' : quantitySummary(ingredient)}
      </button>

      {expanded && (
        <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-800">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(MODE_LABELS) as QuantityMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onUpdate({ ...ingredient, quantityMode: mode })}
                className={`h-7 px-2.5 text-[10px] border transition-colors ${
                  ingredient.quantityMode === mode
                    ? 'border-blue-600 text-blue-600'
                    : 'border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600'
                }`}
              >
                {MODE_LABELS[mode]}
              </button>
            ))}
          </div>

          {(ingredient.quantityMode === 'exact' || ingredient.quantityMode === 'pack') && (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                inputMode="decimal"
                aria-label={`${ingredient.name}の数量`}
                value={ingredient.quantity ?? ''}
                onChange={(e) =>
                  onUpdate({
                    ...ingredient,
                    quantity: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className="w-20 h-8 px-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-600"
              />
              <select
                aria-label={`${ingredient.name}の単位`}
                value={ingredient.unit ?? ''}
                onChange={(e) => onUpdate({ ...ingredient, unit: (e.target.value || null) as IngredientUnit | null })}
                className="h-8 px-1.5 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-600"
              >
                <option value="">単位</option>
                {(ingredient.quantityMode === 'exact' ? EXACT_UNITS : PACK_UNITS).map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {ingredient.quantityMode === 'vague' && (
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(VAGUE_LABELS) as VagueAmount[]).map((v) => (
                <button
                  key={v}
                  onClick={() => onUpdate({ ...ingredient, vagueAmount: v })}
                  className={`h-7 px-2.5 text-[10px] border transition-colors ${
                    ingredient.vagueAmount === v
                      ? 'border-blue-600 text-blue-600'
                      : 'border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600'
                  }`}
                >
                  {VAGUE_LABELS[v]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function IngredientInput({ ingredients, onChange }: Props) {
  const [value, setValue] = useState('')

  const addIngredient = () => {
    const name = value.trim()
    if (!name) return
    const next: Ingredient = { id: generateId(), name, quantityMode: 'unknown' }
    onChange([...ingredients, next])
    setValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (e.nativeEvent.isComposing) return
      e.preventDefault()
      addIngredient()
    }
  }

  const updateIngredient = (id: string, next: Ingredient) => {
    onChange(ingredients.map((i) => (i.id === id ? next : i)))
  }

  const deleteIngredient = (id: string) => {
    onChange(ingredients.filter((i) => i.id !== id))
  }

  return (
    <div className="space-y-2">
      <label htmlFor="food-ingredient-input" className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">
        食材
      </label>
      <div className="flex gap-1.5">
        <input
          id="food-ingredient-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="例：米、マグロ、卵、豆腐"
          className="flex-1 h-10 px-3 text-sm border border-gray-100 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none focus:border-blue-600 transition-colors"
        />
        <button
          onClick={addIngredient}
          disabled={!value.trim()}
          className="h-10 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[11px] tracking-[0.1em] font-medium transition-colors"
        >
          追加
        </button>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-600">数量は入力しなくてもOKです</p>

      {ingredients.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
          {ingredients.map((ingredient) => (
            <IngredientChip
              key={ingredient.id}
              ingredient={ingredient}
              onUpdate={(next) => updateIngredient(ingredient.id, next)}
              onDelete={() => deleteIngredient(ingredient.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
