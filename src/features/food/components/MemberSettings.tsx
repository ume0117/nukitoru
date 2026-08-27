'use client'

import type { Member } from '@/features/food/types'
import { SELF_MEMBER_ID } from '@/features/food/lib/storage'
import { AllergyConfirmation } from './AllergyConfirmation'

interface Props {
  value: Member[]
  onChange: (next: Member[]) => void
  onAdd: (member: Member) => void
  onRemove: (id: string) => void
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function MemberCard({
  member,
  onUpdate,
  onRemove,
}: {
  member: Member
  onUpdate: (patch: Partial<Member>) => void
  onRemove: () => void
}) {
  const canRemove = member.id !== SELF_MEMBER_ID

  return (
    <div className="border border-gray-100 dark:border-gray-800 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          value={member.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          aria-label="呼び名"
          placeholder="呼び名（例：自分、パートナー）"
          className="flex-1 h-9 px-2 text-sm bg-transparent border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none focus:border-blue-600"
        />
        {canRemove && (
          <button
            onClick={onRemove}
            aria-label={`${member.label || '呼び名未設定のメンバー'}を削除`}
            className="w-7 h-7 flex items-center justify-center text-gray-300 dark:text-gray-700 hover:text-red-500 transition-colors shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <AllergyConfirmation
        allergies={member.allergies}
        allergyConfirmed={member.allergyConfirmed}
        onUpdate={(patch) => onUpdate(patch)}
      />
    </div>
  )
}

export function MemberSettings({ value, onChange, onAdd, onRemove }: Props) {
  const addMember = () => {
    onAdd({ id: generateId(), label: '', allergies: [], allergyConfirmed: false })
  }

  const updateMember = (id: string, patch: Partial<Member>) => {
    onChange(value.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  return (
    <div className="space-y-3">
      <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">一緒に食べる人</p>
      <div className="space-y-2">
        {value.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            onUpdate={(patch) => updateMember(member.id, patch)}
            onRemove={() => onRemove(member.id)}
          />
        ))}
      </div>
      <button
        onClick={addMember}
        className="w-full h-9 border border-gray-200 dark:border-gray-800 text-[10px] tracking-[0.1em] text-gray-500 dark:text-gray-400 hover:border-blue-600 hover:text-blue-600 transition-colors"
      >
        ＋ 一緒に食べる人を追加
      </button>
      <p className="text-[10px] text-gray-300 dark:text-gray-700">
        本名は不要です。呼び名は自由に変更できます。
      </p>
    </div>
  )
}
