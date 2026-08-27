'use client'

import Link from 'next/link'
import type { Member } from '@/features/food/types'

interface Props {
  members: Member[]
  selectedMemberIds: string[]
  onChange: (next: string[]) => void
}

export function MemberSelector({ members, selectedMemberIds, onChange }: Props) {
  const toggle = (id: string) => {
    if (selectedMemberIds.includes(id)) {
      onChange(selectedMemberIds.filter((sid) => sid !== id))
    } else {
      onChange([...selectedMemberIds, id])
    }
  }

  const selectedCount = members.filter((m) => selectedMemberIds.includes(m.id)).length
  const hasUnconfirmedSelected = members.some(
    (m) => selectedMemberIds.includes(m.id) && !m.allergyConfirmed,
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">
          今日、一緒に食べる人
        </p>
        <Link
          href="/food/settings"
          className="text-[10px] tracking-[0.1em] text-gray-400 dark:text-gray-600 hover:text-blue-600 uppercase transition-colors shrink-0"
        >
          編集 →
        </Link>
      </div>

      <div className="space-y-1.5">
        {members.map((member) => {
          const checked = selectedMemberIds.includes(member.id)
          return (
            <label
              key={member.id}
              className="flex items-center gap-2 h-10 px-3 border border-gray-100 dark:border-gray-800 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(member.id)}
                aria-label={member.label || '呼び名未設定のメンバー'}
                className="shrink-0"
              />
              <span className="text-sm text-gray-800 dark:text-gray-100">
                {member.label || '（呼び名未設定）'}
              </span>
              {!member.allergyConfirmed && (
                <span className="ml-auto text-[10px] text-amber-600 dark:text-amber-400 shrink-0">未確認</span>
              )}
            </label>
          )
        })}
      </div>

      <p className="text-[11px] text-gray-500 dark:text-gray-400">今日の人数：{selectedCount}人</p>

      {hasUnconfirmedSelected && (
        <p className="text-[11px] text-red-600 dark:text-red-400">
          アレルギー確認が完了していない人がいます。
          <Link href="/food/settings" className="underline ml-1">
            設定から確認 →
          </Link>
        </p>
      )}
    </div>
  )
}
