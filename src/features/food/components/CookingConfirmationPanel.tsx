'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { StockStatus, StockStatusEntry } from '@/features/food/types'
import { getStockStatus } from '@/features/food/lib/stock-status'
import type { StockUpdateEntry } from '@/features/food/lib/cooking-completion'

interface Props {
  itemNames: string[]
  stockStatus: Record<string, StockStatusEntry>
  onSave: (updates: StockUpdateEntry[]) => void
  onClose: () => void
}

const OPTIONS: { value: StockStatus; label: string }[] = [
  { value: 'available', label: 'まだある' },
  { value: 'low', label: '少ない' },
  { value: 'out', label: 'なくなった' },
]

/**
 * 「作った！」を押した後の使用食材確認パネル。
 * チェックした食品だけが保存対象になる。3択の初期値は「現在の」在庫状態であり、
 * チェックしただけ・開いただけでは絶対に値を変更・保存しない
 * （[在庫を更新する] を押した時だけ onSave が呼ばれる）。
 */
export function CookingConfirmationPanel({ itemNames, stockStatus, onSave, onClose }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(itemNames.map((name) => [name, true])),
  )
  const [selected, setSelected] = useState<Record<string, StockStatus>>(() =>
    Object.fromEntries(itemNames.map((name) => [name, getStockStatus(stockStatus, name)])),
  )
  const [saved, setSaved] = useState(false)

  const toggleChecked = (name: string) => {
    setChecked((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const setStatus = (name: string, status: StockStatus) => {
    setSelected((prev) => ({ ...prev, [name]: status }))
  }

  const handleSave = () => {
    const updates: StockUpdateEntry[] = itemNames
      .filter((name) => checked[name])
      .map((name) => ({ itemName: name, status: selected[name] }))
    onSave(updates)
    setSaved(true)
  }

  if (saved) {
    return (
      <div className="border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <p className="text-sm text-gray-800 dark:text-gray-100">在庫を更新しました</p>
        <div className="flex flex-col gap-2">
          <Link
            href="/food/stock"
            className="inline-flex items-center justify-center h-10 border border-gray-400 dark:border-gray-600 hover:border-blue-600 hover:text-blue-600 text-[11px] tracking-[0.15em] uppercase text-gray-500 dark:text-gray-400 transition-colors"
          >
            在庫を見る →
          </Link>
          <button
            onClick={onClose}
            className="h-10 border border-gray-200 dark:border-gray-800 text-[11px] tracking-[0.15em] uppercase text-gray-500 dark:text-gray-400 hover:border-blue-600 hover:text-blue-600 transition-colors"
          >
            献立に戻る
          </button>
        </div>
      </div>
    )
  }

  if (itemNames.length === 0) {
    return (
      <div className="border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <p className="text-[12px] text-gray-600 dark:text-gray-400">確認できる食材がありませんでした</p>
        <button
          onClick={onClose}
          className="h-10 w-full border border-gray-200 dark:border-gray-800 text-[11px] tracking-[0.15em] uppercase text-gray-500 dark:text-gray-400 hover:border-blue-600 hover:text-blue-600 transition-colors"
        >
          閉じる
        </button>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 dark:border-gray-800 p-4 space-y-3">
      <div className="space-y-1">
        <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">使った食材を確認</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          実際に使わなかったものはチェックを外してください
        </p>
      </div>

      <div className="space-y-2">
        {itemNames.map((name) => {
          const isChecked = checked[name]
          return (
            <div
              key={name}
              className="flex flex-wrap items-center justify-between gap-2 border border-gray-100 dark:border-gray-800 p-2.5"
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleChecked(name)}
                  className="w-4 h-4 accent-blue-600"
                />
                <span
                  className={`text-sm ${
                    isChecked ? 'text-gray-800 dark:text-gray-100' : 'text-gray-300 dark:text-gray-700'
                  }`}
                >
                  {name}
                </span>
              </label>

              <div
                role="group"
                aria-label={`${name}の在庫状態`}
                className={`inline-flex shrink-0 border border-gray-200 dark:border-gray-800 transition-opacity ${
                  isChecked ? '' : 'opacity-40'
                }`}
              >
                {OPTIONS.map((option, i) => {
                  const isSelected = selected[name] === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!isChecked}
                      onClick={() => setStatus(name, option.value)}
                      aria-pressed={isSelected}
                      className={`h-10 px-3 text-[12px] whitespace-nowrap transition-colors disabled:cursor-not-allowed ${
                        i > 0 ? 'border-l border-gray-200 dark:border-gray-800' : ''
                      } ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-500 dark:text-gray-400 hover:text-blue-600'
                      }`}
                    >
                      {isSelected ? '✓ ' : ''}
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white text-[11px] tracking-[0.15em] uppercase font-medium transition-colors"
        >
          在庫を更新する
        </button>
        <button
          onClick={onClose}
          className="h-11 px-4 border border-gray-200 dark:border-gray-800 text-[11px] tracking-[0.15em] uppercase text-gray-500 dark:text-gray-400 hover:border-blue-600 hover:text-blue-600 transition-colors"
        >
          キャンセル
        </button>
      </div>
    </div>
  )
}
