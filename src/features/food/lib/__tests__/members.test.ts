import { describe, it, expect } from 'vitest'
import { sanitizeSelectedMemberIds, getSelectedMembers, mergeMemberAllergies } from '../members'
import type { Member } from '@/features/food/types'

const self: Member = { id: 'self', label: '自分', allergies: [], allergyConfirmed: true }
const partner: Member = { id: 'partner', label: 'パートナー', allergies: ['えび'], allergyConfirmed: true }
const child: Member = { id: 'child', label: '子ども①', allergies: ['卵', '乳'], allergyConfirmed: true }

describe('members.ts — allergy union / sanitization', () => {
  it('TEST C1: self=[] のみ選択 → []', () => {
    expect(mergeMemberAllergies([self], ['self'])).toEqual([])
  })

  it('TEST C2: self=["卵"] → ["卵"]', () => {
    const selfWithEgg: Member = { ...self, allergies: ['卵'] }
    expect(mergeMemberAllergies([selfWithEgg], ['self'])).toEqual(['卵'])
  })

  it('TEST C3: 3人全員選択 → ["えび","卵","乳"]（member順を維持）', () => {
    expect(mergeMemberAllergies([self, partner, child], ['self', 'partner', 'child'])).toEqual([
      'えび',
      '卵',
      '乳',
    ])
  })

  it('TEST C4: partnerをselectedから外す → ["卵","乳"]', () => {
    expect(mergeMemberAllergies([self, partner, child], ['self', 'child'])).toEqual(['卵', '乳'])
  })

  it('TEST C5: 重複除去（self=["卵"], child=["卵","乳"]） → ["卵","乳"]', () => {
    const selfWithEgg: Member = { ...self, allergies: ['卵'] }
    expect(mergeMemberAllergies([selfWithEgg, child], ['self', 'child'])).toEqual(['卵', '乳'])
  })

  it('TEST C6: 存在しないselected IDは無視される', () => {
    expect(mergeMemberAllergies([self], ['self', 'deleted-member'])).toEqual([])
    expect(mergeMemberAllergies([self, partner], ['self', 'deleted-member', 'partner'])).toEqual(['えび'])
  })

  it('sanitizeSelectedMemberIds: 存在しないIDを除外する', () => {
    expect(sanitizeSelectedMemberIds([self, partner], ['self', 'deleted-member'])).toEqual(['self'])
  })

  it('sanitizeSelectedMemberIds: 全て有効なら変化しない', () => {
    expect(sanitizeSelectedMemberIds([self, partner], ['self', 'partner'])).toEqual(['self', 'partner'])
  })

  it('getSelectedMembers: 選択されたMemberオブジェクトのみ返す', () => {
    expect(getSelectedMembers([self, partner, child], ['partner'])).toEqual([partner])
  })

  it('getSelectedMembers: 空配列選択時は空配列を返す（0人選択の検出に使える）', () => {
    expect(getSelectedMembers([self, partner], [])).toEqual([])
  })
})
