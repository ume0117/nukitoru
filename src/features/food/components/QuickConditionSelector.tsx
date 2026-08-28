'use client'

/**
 * MISSION 2.12 PHASE A — 「今日どうする？」Quick Condition Selector。
 *
 * 既存Suggestion Engineの実際の能力（maxCookingMinutesによるハードフィルタ、
 * および常にA優先という既存ランキング方針）にのみ接続する。存在しない
 * 機能をUIだけ追加しない。「家にあるもので」はrankRecipes側の挙動を
 * 変えず、既に安全な結果をUI側でisFullyAvailableのみに絞り込む
 * （呼び出し側=FoodApp.tsxが行う）。
 */
export type QuickConditionKey = '15min' | '30min' | 'available' | 'anything'

export interface ResolvedQuickCondition {
  maxCookingMinutes: number | null
  /** trueの場合、呼び出し側でisFullyAvailableな候補のみへ絞り込む（UI層のみの後処理） */
  onlyFullyAvailable: boolean
}

export function resolveQuickCondition(key: QuickConditionKey): ResolvedQuickCondition {
  switch (key) {
    case '15min':
      return { maxCookingMinutes: 15, onlyFullyAvailable: false }
    case '30min':
      return { maxCookingMinutes: 30, onlyFullyAvailable: false }
    case 'available':
      return { maxCookingMinutes: null, onlyFullyAvailable: true }
    case 'anything':
      return { maxCookingMinutes: null, onlyFullyAvailable: false }
  }
}

interface Props {
  value: QuickConditionKey
  onChange: (next: QuickConditionKey) => void
}

const OPTIONS: { key: QuickConditionKey; label: string }[] = [
  { key: '15min', label: '15分以内' },
  { key: '30min', label: '30分以内' },
  { key: 'available', label: '家にあるもので' },
  { key: 'anything', label: 'おまかせ' },
]

export function QuickConditionSelector({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">今日どうする？</p>
      <div className="grid grid-cols-2 gap-1.5">
        {OPTIONS.map((option) => (
          <button
            key={option.key}
            onClick={() => onChange(option.key)}
            className={`h-11 px-2 text-[13px] border transition-colors ${
              value === option.key
                ? 'border-blue-600 text-blue-600'
                : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
