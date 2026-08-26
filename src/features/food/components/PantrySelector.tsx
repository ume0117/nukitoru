'use client'

import type { Pantry } from '@/features/food/types'

interface Props {
  value: Pantry
  onChange: (next: Pantry) => void
}

const STAPLE_OPTIONS = ['塩', '砂糖', 'しょうゆ', '味噌', '酢', '油', 'こしょう']

export function PantrySelector({ value, onChange }: Props) {
  const toggle = (name: string) => {
    if (value.staples.includes(name)) {
      onChange({ staples: value.staples.filter((s) => s !== name) })
    } else {
      onChange({ staples: [...value.staples, name] })
    }
  }

  const selectAll = () => onChange({ staples: [...STAPLE_OPTIONS] })

  const allSelected = STAPLE_OPTIONS.every((s) => value.staples.includes(s))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between min-h-[20px]">
        <p className="text-[9px] tracking-[0.2em] leading-none text-gray-400 dark:text-gray-600 uppercase">常備調味料</p>
        <button
          onClick={selectAll}
          disabled={allSelected}
          className="text-[10px] tracking-[0.1em] leading-none text-gray-400 dark:text-gray-600 hover:text-blue-600 disabled:opacity-40 uppercase transition-colors"
        >
          全部ある
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {STAPLE_OPTIONS.map((name) => {
          const checked = value.staples.includes(name)
          return (
            <label
              key={name}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 border text-[12px] cursor-pointer transition-colors ${
                checked
                  ? 'border-blue-600 text-blue-600'
                  : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(name)}
                className="sr-only"
                aria-label={name}
              />
              {name}
            </label>
          )
        })}
      </div>
      <p className="text-[10px] text-gray-300 dark:text-gray-700">
        参考情報として保存されます。現在のバージョンでは献立の内容には反映されません。
      </p>
    </div>
  )
}
