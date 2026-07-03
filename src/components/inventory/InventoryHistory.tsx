'use client'

import { useState, useEffect } from 'react'

interface InventoryItem {
  result: { type: string; value: string }
  count: number
  lastScannedAt: string
}

interface InventorySession {
  startedAt: string
  items: InventoryItem[]
}

const HISTORY_KEY = 'nukitoru_inventory_history'
const MAX_HISTORY = 30

export function saveToHistory(session: InventorySession) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const history: InventorySession[] = raw ? JSON.parse(raw) : []
    const updated = [session, ...history].slice(0, MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  } catch {}
}

export function loadHistory(): InventorySession[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function deleteHistory(index: number) {
  try {
    const history = loadHistory()
    history.splice(index, 1)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch {}
}

function downloadCSV(session: InventorySession) {
  const bom = '\uFEFF'
  const header = 'JANコード,個数,最終スキャン日時'
  const rows = session.items.map(i =>
    `${i.result.value},${i.count},${new Date(i.lastScannedAt).toLocaleString('ja-JP')}`
  )
  const csv = bom + [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const d = new Date(session.startedAt)
  a.download = `棚卸し_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

interface Props {
  onClose: () => void
}

export function InventoryHistory({ onClose }: Props) {
  const [history, setHistory] = useState<InventorySession[]>([])

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  const handleDelete = (index: number) => {
    if (!confirm('この履歴を削除しますか？')) return
    deleteHistory(index)
    setHistory(loadHistory())
  }

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-950 flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-800">
        <h2 className="font-bold text-lg">📋 棚卸し履歴</h2>
        <button onClick={onClose} className="text-gray-500 text-sm px-3 py-1">閉じる</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {history.length === 0 ? (
          <p className="text-center text-gray-400 text-sm mt-8">履歴がありません</p>
        ) : (
          history.map((session, idx) => {
            const total = session.items.reduce((s, i) => s + i.count, 0)
            return (
              <div key={idx} className="rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{formatDate(session.startedAt)}</p>
                    <p className="text-xs text-gray-500">{total}件 / {session.items.length}商品</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => downloadCSV(session)}
                      className="h-8 px-3 rounded-lg text-xs font-medium bg-emerald-600 text-white">
                      ↓ CSV
                    </button>
                    <button onClick={() => handleDelete(idx)}
                      className="h-8 px-3 rounded-lg text-xs font-medium text-red-500 border border-red-200">
                      削除
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {session.items.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex justify-between text-xs text-gray-500">
                      <span className="font-mono">{item.result.value}</span>
                      <span className="font-bold text-gray-700 dark:text-gray-300">×{item.count}</span>
                    </div>
                  ))}
                  {session.items.length > 3 && (
                    <p className="text-xs text-gray-400">他 {session.items.length - 3}商品...</p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
