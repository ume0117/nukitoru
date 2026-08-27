// ============================================================
// members.ts
//
// 「今日、一緒に食べる人」に関する純粋関数群。
// - selectedMemberIdsに存在しないmember IDが混じっていても安全に無視する
// - 選択されたメンバー全員のアレルギーをunion（重複除去）し、
//   既存のHARD EXCLUSIONロジック（mock-meal-provider.ts）へそのまま渡せる
//   string[] を返す。mock-meal-provider.ts自体はここでは一切変更しない。
// ============================================================

import type { Member } from '@/features/food/types'

/** members に実在しない member ID を selectedMemberIds から取り除く */
export function sanitizeSelectedMemberIds(members: Member[], selectedMemberIds: string[]): string[] {
  const validIds = new Set(members.map((m) => m.id))
  return selectedMemberIds.filter((id) => validIds.has(id))
}

/** selectedMemberIds に対応する実在の Member[] を返す（存在しないIDは無視） */
export function getSelectedMembers(members: Member[], selectedMemberIds: string[]): Member[] {
  const idSet = new Set(selectedMemberIds)
  return members.filter((m) => idSet.has(m.id))
}

/**
 * 選択されたメンバー全員のallergiesを重複除去してunionする。
 * member配列の順序を保つため、結果は決定論的になる。
 */
export function mergeMemberAllergies(members: Member[], selectedMemberIds: string[]): string[] {
  const selected = getSelectedMembers(members, selectedMemberIds)
  const seen = new Set<string>()
  const result: string[] = []
  for (const member of selected) {
    for (const allergy of member.allergies) {
      if (!seen.has(allergy)) {
        seen.add(allergy)
        result.push(allergy)
      }
    }
  }
  return result
}
