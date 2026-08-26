'use client'

interface Props {
  value: number | null
  onChange: (next: number | null) => void
}

const OPTIONS: { label: string; minutes: number | null }[] = [
  { label: '10分', minutes: 10 },
  { label: '20分', minutes: 20 },
  { label: '30分', minutes: 30 },
  { label: '時間は気にしない', minutes: null },
]

export function CookingTimeSelector({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">調理時間</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {OPTIONS.map((option) => (
          <button
            key={option.label}
            onClick={() => onChange(option.minutes)}
            className={`h-10 px-2 text-[12px] border transition-colors ${
              value === option.minutes
                ? 'border-blue-600 text-blue-600'
                : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-600">
        指定した時間内でできる献立だけを提案します。
      </p>
    </div>
  )
}
