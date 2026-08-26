import { describe, it, expect } from 'vitest'
import { getConfirmableIngredientNames, applyStockUpdates } from '../cooking-completion'
import { setStockStatus } from '../stock-status'
import type { MealSuggestion, StockStatusEntry } from '@/features/food/types'

const FIXED_NOW = '2026-08-26T00:00:00.000Z'

function suggestion(dishes: { name: string; requires: string[] }[]): MealSuggestion {
  return {
    title: dishes.map((d) => d.name).join(' + '),
    reason: 'テスト用',
    dishes: dishes.map((d) => ({
      name: d.name,
      type: 'main',
      requiredIngredients: d.requires.map((name) => ({ name })),
    })),
    estimatedMinutes: 15,
    shoppingItems: [],
    notes: [],
    warnings: [],
  }
}

describe('getConfirmableIngredientNames', () => {
  it('複数dishesにまたがる食材名を重複除去して取得できる', () => {
    const s = suggestion([
      { name: 'まぐろ丼', requires: ['米', 'マグロ'] },
      { name: '豆腐と卵のスープ', requires: ['卵', '豆腐'] },
    ])
    expect(getConfirmableIngredientNames(s, [])).toEqual(['米', 'マグロ', '卵', '豆腐'])
  })

  it('同じ食材が複数dishesに重複していても1件にまとめる', () => {
    const s = suggestion([
      { name: '料理A', requires: ['卵'] },
      { name: '料理B', requires: ['卵', '豆腐'] },
    ])
    expect(getConfirmableIngredientNames(s, [])).toEqual(['卵', '豆腐'])
  })

  it('pantryStaples に含まれる調味料（例: しょうゆ）は確認対象から除外される', () => {
    const s = suggestion([{ name: 'テスト料理', requires: ['豚肉', 'しょうゆ'] }])
    expect(getConfirmableIngredientNames(s, ['しょうゆ'])).toEqual(['豚肉'])
  })

  it('pantryStaples が空なら何も除外されない', () => {
    const s = suggestion([{ name: 'テスト料理', requires: ['豚肉', 'しょうゆ'] }])
    expect(getConfirmableIngredientNames(s, [])).toEqual(['豚肉', 'しょうゆ'])
  })

  it('使用食材がない場合は空配列を返す', () => {
    const s = suggestion([])
    expect(getConfirmableIngredientNames(s, [])).toEqual([])
  })

  it('常備品配列のどれにも属さない非常備食品（例: 豚肉）も通常どおり確認対象に含まれる', () => {
    const s = suggestion([{ name: '生姜焼き', requires: ['豚肉', 'キャベツ'] }])
    expect(getConfirmableIngredientNames(s, [])).toEqual(['豚肉', 'キャベツ'])
  })
})

describe('applyStockUpdates', () => {
  it('複数食品を一括更新できる', () => {
    const result = applyStockUpdates(
      {},
      [
        { itemName: '豚肉', status: 'out' },
        { itemName: 'キャベツ', status: 'low' },
      ],
      FIXED_NOW,
    )
    expect(result).toEqual({
      豚肉: { status: 'out', updatedAt: FIXED_NOW },
      キャベツ: { status: 'low', updatedAt: FIXED_NOW },
    })
  })

  it('更新対象外の既存エントリを保持する（非破壊）', () => {
    const existing: Record<string, StockStatusEntry> = { 卵: { status: 'available' } }
    const result = applyStockUpdates(existing, [{ itemName: '豚肉', status: 'out' }], FIXED_NOW)
    expect(result.卵).toEqual({ status: 'available' })
    expect(existing).toEqual({ 卵: { status: 'available' } })
  })

  it('注入したnowが全更新エントリに反映される', () => {
    const result = applyStockUpdates(
      {},
      [
        { itemName: 'A', status: 'available' },
        { itemName: 'B', status: 'low' },
      ],
      FIXED_NOW,
    )
    expect(result.A.updatedAt).toBe(FIXED_NOW)
    expect(result.B.updatedAt).toBe(FIXED_NOW)
  })

  it('既存の setStockStatus() を用いた場合と同一結果になる（ロジックの重複がないことの確認）', () => {
    const updates = [
      { itemName: '豚肉', status: 'out' as const },
      { itemName: 'キャベツ', status: 'low' as const },
    ]
    const viaHelper = applyStockUpdates({}, updates, FIXED_NOW)
    const viaManualChain = updates.reduce(
      (acc, u) => setStockStatus(acc, u.itemName, u.status, FIXED_NOW),
      {} as Record<string, StockStatusEntry>,
    )
    expect(viaHelper).toEqual(viaManualChain)
  })

  it('自由入力食材名（例: 自家製ピクルス）でも正しく処理できる', () => {
    const result = applyStockUpdates({}, [{ itemName: '自家製ピクルス', status: 'low' }], FIXED_NOW)
    expect(result.自家製ピクルス).toEqual({ status: 'low', updatedAt: FIXED_NOW })
  })

  it('updatesが空配列なら元のmapと同じ内容を返す', () => {
    const existing: Record<string, StockStatusEntry> = { 卵: { status: 'available' } }
    expect(applyStockUpdates(existing, [], FIXED_NOW)).toEqual(existing)
  })
})
