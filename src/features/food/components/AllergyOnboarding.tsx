'use client'

import Link from 'next/link'
import type { Member } from '@/features/food/types'
import { AllergyConfirmation } from './AllergyConfirmation'

interface Props {
  /** 今日selectedかつallergyConfirmed===falseのmembersのみを渡す（呼び出し側でfilter済み） */
  members: Member[]
  onUpdateMember: (id: string, patch: Partial<Member>) => void
}

/**
 * 初回アレルギーSafety Gate。
 * 献立生成より前に、今日食べる人のうち未確認のメンバー全員について
 * アレルギーの有無を確認させる。Member.allergyConfirmed をSource of Truthとし、
 * 専用のonboarding完了フラグは持たない（全員confirmed=trueになれば自然に消える）。
 */
export function AllergyOnboarding({ members, onUpdateMember }: Props) {
  return (
    <div className="space-y-4 border border-red-200 dark:border-red-900/50 p-4">
      <div className="space-y-1.5">
        <h2 className="text-[11px] tracking-[0.2em] text-red-600 dark:text-red-400 uppercase font-medium">
          最初にアレルギーを確認してください
        </h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          今日一緒に食べる人の食物アレルギーを、献立候補から除外するために使用します。
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-600">
          原材料表示や調理環境などは、食べる前に必ず確認してください。
        </p>
      </div>

      <div className="space-y-3">
        {members.map((member) => (
          <div key={member.id} className="space-y-1.5">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {member.label || '（呼び名未設定）'}
            </p>
            <AllergyConfirmation
              allergies={member.allergies}
              allergyConfirmed={member.allergyConfirmed}
              onUpdate={(patch) => onUpdateMember(member.id, patch)}
            />
          </div>
        ))}
      </div>

      <Link
        href="/food/settings"
        className="inline-block text-[10px] tracking-[0.1em] text-gray-400 dark:text-gray-600 hover:text-blue-600 uppercase transition-colors"
      >
        呼び名やその他の設定は「一緒に食べる人を編集」から →
      </Link>
    </div>
  )
}
