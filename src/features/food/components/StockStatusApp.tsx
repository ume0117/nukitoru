'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { StockStatusToggle } from './StockStatusToggle'
import {
  loadPantry,
  loadRegularFoods,
  loadFrozenFoods,
  loadPantryFoods,
  loadStockStatus,
  saveStockStatus,
} from '@/features/food/lib/storage'
import { getStockStatus, setStockStatus } from '@/features/food/lib/stock-status'
import type { StockStatus, StockStatusEntry } from '@/features/food/types'

interface StockItem {
  name: string
  categoryLabels: string[]
}

/**
 * 現在ON（常備品登録済み）の食品を、Pantry.staples / regularFoods / frozenFoods /
 * pantryFoods から集約する。同じ食品名が複数配列に存在する場合は文字列完全一致で
 * 1件へdedupeし、由来カテゴリはすべて記録する（表示用ラベルとして使う）。
 */
function buildStockItems(
  pantryStaples: string[],
  regularFoods: string[],
  frozenFoods: string[],
  pantryFoods: string[],
  stockStatusKeys: string[],
): StockItem[] {
  const map = new Map<string, string[]>()
  const addAll = (names: string[], label: string) => {
    for (const name of names) {
      const existing = map.get(name)
      if (existing) {
        if (!existing.includes(label)) existing.push(label)
      } else {
        map.set(name, [label])
      }
    }
  }
  addAll(pantryStaples, '常備調味料')
  addAll(regularFoods, '常備食材')
  addAll(frozenFoods, '冷凍庫')
  addAll(pantryFoods, '保存食品')

  // 常備品として登録されていなくても、在庫状態が保存されている食品
  // （例: 料理後の使用食材確認で記録した非常備食品）は「その他」として表示する。
  // ライフサイクル管理（一定期間後の非表示化・削除操作等）は今回実装しない。
  for (const name of stockStatusKeys) {
    if (!map.has(name)) {
      map.set(name, ['その他'])
    }
  }

  return Array.from(map.entries()).map(([name, categoryLabels]) => ({ name, categoryLabels }))
}

const GROUPS: { status: StockStatus; label: string; badge: string }[] = [
  { status: 'out', label: 'なし', badge: '🔴' },
  { status: 'low', label: '少ない', badge: '🟡' },
  { status: 'available', label: 'あり', badge: '🟢' },
]

export function StockStatusApp() {
  const [items, setItems] = useState<StockItem[]>([])
  const [stockStatus, setStockStatusMap] = useState<Record<string, StockStatusEntry>>({})
  const [loaded, setLoaded] = useState(false)

  // 初回マウント時にのみlocalStorageから復元する。画面を開いただけでは書き込まない。
  useEffect(() => {
    const pantry = loadPantry()
    const regularFoods = loadRegularFoods()
    const frozenFoods = loadFrozenFoods()
    const pantryFoods = loadPantryFoods()
    const stockStatusMap = loadStockStatus()
    setItems(
      buildStockItems(pantry.staples, regularFoods, frozenFoods, pantryFoods, Object.keys(stockStatusMap)),
    )
    setStockStatusMap(stockStatusMap)
    setLoaded(true)
  }, [])

  // ユーザーが3択を実際に変更した時だけ保存する
  const handleChange = (itemName: string, status: StockStatus) => {
    setStockStatusMap((prev) => {
      const next = setStockStatus(prev, itemName, status)
      saveStockStatus(next)
      return next
    })
  }

  const counts = {
    out: items.filter((i) => getStockStatus(stockStatus, i.name) === 'out').length,
    low: items.filter((i) => getStockStatus(stockStatus, i.name) === 'low').length,
    available: items.filter((i) => getStockStatus(stockStatus, i.name) === 'available').length,
  }

  return (
    <div className="pt-4 pb-2 space-y-5">
      <Link
        href="/food"
        className="inline-block text-[10px] tracking-[0.15em] text-gray-400 dark:text-gray-600 hover:text-blue-600 uppercase transition-colors"
      >
        ← NUKITORU FOODに戻る
      </Link>

      <div className="space-y-1">
        <h1 className="text-[11px] tracking-[0.3em] text-gray-400 dark:text-gray-600 uppercase">今日の在庫</h1>
        <p className="text-lg font-medium text-gray-900 dark:text-white">今、本当にあるものを管理</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          家の設定で登録した食品の、現在の在庫状態を管理します。
        </p>
      </div>

      {loaded && items.length === 0 && (
        <div className="border border-gray-100 dark:border-gray-800 p-4 space-y-3 text-center">
          <p className="text-[12px] text-gray-600 dark:text-gray-400">まだ常備品が登録されていません</p>
          <p className="text-[11px] text-gray-400 dark:text-gray-600">
            家の設定から、普段家にある食品を登録してください
          </p>
          <Link
            href="/food/settings"
            className="inline-flex items-center justify-center h-10 px-4 border border-gray-400 dark:border-gray-600 hover:border-blue-600 hover:text-blue-600 text-[10px] tracking-[0.15em] uppercase text-gray-500 dark:text-gray-400 transition-colors"
          >
            家の設定へ
          </Link>
        </div>
      )}

      {loaded && items.length > 0 && (
        <>
          <div className="border border-gray-100 dark:border-gray-800 p-3 space-y-1.5">
            <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">在庫状況</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-gray-600 dark:text-gray-400">
              <span>🔴 なし {counts.out}件</span>
              <span>🟡 少ない {counts.low}件</span>
              <span>🟢 あり {counts.available}件</span>
            </div>
          </div>

          {GROUPS.map((group) => {
            const groupItems = items.filter((i) => getStockStatus(stockStatus, i.name) === group.status)
            if (groupItems.length === 0) return null
            return (
              <div key={group.status} className="space-y-2">
                <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">
                  {group.badge} {group.label}（{groupItems.length}件）
                </p>
                <div className="space-y-2">
                  {groupItems.map((item) => (
                    <div
                      key={item.name}
                      className="flex flex-wrap items-center justify-between gap-2 border border-gray-100 dark:border-gray-800 p-2.5"
                    >
                      <div>
                        <p className="text-sm text-gray-800 dark:text-gray-100">{item.name}</p>
                        <p className="text-[9px] text-gray-300 dark:text-gray-700">{item.categoryLabels.join('・')}</p>
                      </div>
                      <StockStatusToggle
                        itemName={item.name}
                        status={getStockStatus(stockStatus, item.name)}
                        onChange={(next) => handleChange(item.name, next)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}

      {/*
        将来: low の食品は「買い物候補」、out の食品は「買い物候補 / EC購入導線」へ
        接続する想定（MISSION 2.3では未実装。ボタン等は置かずコメントのみ残す）。
      */}
    </div>
  )
}
