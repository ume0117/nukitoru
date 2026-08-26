'use client'

import { useState } from 'react'
import type { Household } from '@/features/food/types'

interface Props {
  value: Household
  onChange: (next: Household) => void
}

export function HouseholdSettings({ value, onChange }: Props) {
  const [showAges, setShowAges] = useState(false)
  const [ageInput, setAgeInput] = useState('')

  const addAge = () => {
    const age = Number(ageInput)
    if (!Number.isFinite(age) || age < 0) return
    onChange({ ...value, childrenAges: [...value.childrenAges, age] })
    setAgeInput('')
  }

  const removeAge = (index: number) => {
    onChange({ ...value, childrenAges: value.childrenAges.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-2">
      <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">家族</p>
      <div className="flex gap-3">
        <label className="flex-1 flex items-center justify-between h-10 px-3 border border-gray-100 dark:border-gray-800">
          <span className="text-sm text-gray-600 dark:text-gray-400">大人</span>
          <input
            type="number"
            min={0}
            aria-label="大人の人数"
            value={value.adults}
            onChange={(e) => onChange({ ...value, adults: Math.max(0, Number(e.target.value) || 0) })}
            className="w-14 text-right bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
          />
        </label>
        <label className="flex-1 flex items-center justify-between h-10 px-3 border border-gray-100 dark:border-gray-800">
          <span className="text-sm text-gray-600 dark:text-gray-400">子ども</span>
          <input
            type="number"
            min={0}
            aria-label="子どもの人数"
            value={value.children}
            onChange={(e) => onChange({ ...value, children: Math.max(0, Number(e.target.value) || 0) })}
            className="w-14 text-right bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
          />
        </label>
      </div>

      <button
        onClick={() => setShowAges((v) => !v)}
        className="text-[10px] tracking-[0.1em] text-gray-400 dark:text-gray-600 hover:text-blue-600 uppercase transition-colors"
      >
        {showAges ? '年齢設定を閉じる' : '年齢を追加（任意）'}
      </button>

      {showAges && (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <input
              type="number"
              min={0}
              aria-label="子どもの年齢"
              value={ageInput}
              onChange={(e) => setAgeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addAge()
                }
              }}
              placeholder="年齢"
              className="w-20 h-9 px-2 text-sm border border-gray-100 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-600"
            />
            <button
              onClick={addAge}
              className="h-9 px-3 border border-gray-200 dark:border-gray-800 text-[10px] tracking-[0.1em] text-gray-500 dark:text-gray-400 hover:border-blue-600 hover:text-blue-600 transition-colors"
            >
              追加
            </button>
          </div>
          {value.childrenAges.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {value.childrenAges.map((age, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 h-7 px-2 text-[11px] border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
                >
                  {age}歳
                  <button
                    onClick={() => removeAge(i)}
                    aria-label={`${age}歳を削除`}
                    className="text-gray-300 dark:text-gray-700 hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-gray-300 dark:text-gray-700">
        参考情報として保存されます。現在のバージョンでは献立の内容には反映されません。
      </p>
    </div>
  )
}
