'use client'

import { useState } from 'react'

interface Props {
  allergies: string[]
  allergyConfirmed: boolean
  onUpdate: (patch: { allergies: string[]; allergyConfirmed: boolean }) => void
}

function TagEditor({ allergies, onChange }: { allergies: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    onChange([...allergies, trimmed])
    setDraft('')
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (e.nativeEvent.isComposing) return
              e.preventDefault()
              add()
            }
          }}
          placeholder="例：卵、えび"
          className="flex-1 h-9 px-3 text-sm border border-gray-100 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none focus:border-blue-600 transition-colors"
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="h-9 px-3 border border-gray-200 dark:border-gray-800 text-[10px] tracking-[0.1em] text-gray-500 dark:text-gray-400 hover:border-blue-600 hover:text-blue-600 disabled:opacity-40 transition-colors"
        >
          追加
        </button>
      </div>
      {allergies.length === 0 ? (
        <p className="text-[10px] text-gray-300 dark:text-gray-700">登録されているアレルギーはありません</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {allergies.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 h-7 px-2 text-[11px] border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
            >
              {item}
              <button
                onClick={() => onChange(allergies.filter((_, idx) => idx !== i))}
                aria-label={`${item}を削除`}
                className="text-gray-300 dark:text-gray-700 hover:text-red-500"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 「アレルギーの有無」を確認する共通UI。
 * MemberSettings（設定画面）とAllergyOnboarding（初回Safety Gate）の両方から
 * 使われる。状態遷移ルールをここに一本化し、二重実装を避ける。
 *
 * - 「ありません」→ allergies=[], allergyConfirmed=true を即保存
 * - 「あります」→ タグ入力を表示。1件以上登録されるまでallergyConfirmed=falseのまま
 * - タグを全て削除するとallergyConfirmed=falseへ自動的に戻る（再確認を要求する）
 * - migrationで引き継いだ既存allergiesがある場合は、それを消さずに表示し、
 *   「この内容で確認する」で再入力なしにallergyConfirmed=trueにできる
 */
export function AllergyConfirmation({ allergies, allergyConfirmed, onUpdate }: Props) {
  const [showInput, setShowInput] = useState(false)

  const chooseNone = () => {
    onUpdate({ allergies: [], allergyConfirmed: true })
    setShowInput(false)
  }

  const updateAllergies = (next: string[]) => {
    onUpdate({ allergies: next, allergyConfirmed: next.length > 0 })
  }

  const confirmAsIs = () => {
    onUpdate({ allergies, allergyConfirmed: true })
  }

  if (allergyConfirmed) {
    return (
      <div className="space-y-1.5 border border-red-200 dark:border-red-900/50 p-2.5">
        <span className="text-[10px] tracking-[0.1em] text-red-600 dark:text-red-400 font-medium">⚠ 必ず除外</span>
        <TagEditor allergies={allergies} onChange={updateAllergies} />
      </div>
    )
  }

  const showEditor = showInput || allergies.length > 0

  return (
    <div className="space-y-2 border border-red-200 dark:border-red-900/50 p-2.5">
      <p className="text-[10px] tracking-[0.1em] text-red-600 dark:text-red-400 font-medium">
        アレルギーはありますか？
      </p>
      <div className="flex gap-1.5">
        <button
          onClick={chooseNone}
          className="h-8 px-3 text-[11px] border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-blue-600 hover:text-blue-600 transition-colors"
        >
          ○ ありません
        </button>
        <button
          onClick={() => setShowInput(true)}
          className={`h-8 px-3 text-[11px] border transition-colors ${
            showEditor
              ? 'border-blue-600 text-blue-600'
              : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-blue-600 hover:text-blue-600'
          }`}
        >
          ● あります
        </button>
      </div>

      {showEditor && (
        <div className="space-y-1.5">
          <TagEditor allergies={allergies} onChange={updateAllergies} />
          {allergies.length > 0 && (
            <button
              onClick={confirmAsIs}
              className="w-full h-9 border border-blue-600 text-blue-600 text-[11px] tracking-[0.1em] hover:bg-blue-600 hover:text-white transition-colors"
            >
              この内容で確認する
            </button>
          )}
        </div>
      )}
    </div>
  )
}
