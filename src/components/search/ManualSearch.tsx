'use client'

import { useState } from 'react'

const RAKUTEN_AFFILIATE_ID = '554ce912.68635f88.554ce913.1ffa91d2'

function getRakutenURL(query: string): string {
  const isJAN = /^\d{8}$|^\d{13}$/.test(query.trim())
  const searchTerm = isJAN ? query.trim() : `"${query.trim()}"`
  const searchURL = encodeURIComponent(
    `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(searchTerm)}/?s=1`
  )
  return `https://hb.afl.rakuten.co.jp/ichiba/${RAKUTEN_AFFILIATE_ID}/?pc=${searchURL}`
}

export function ManualSearch() {
  const [value, setValue] = useState('')
  const isJAN = /^\d{8}$|^\d{13}$/.test(value.trim())
  const canSearch = value.trim().length > 0

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && canSearch) {
      window.open(getRakutenURL(value), '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">🔍</span>
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
          JAN・品番で楽天検索
        </span>
        {value.trim().length > 0 && (
          <span className="text-[10px] text-gray-400 ml-auto">
            {isJAN ? 'JANコード' : '品番（完全一致）'}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="4901234567890 または ABC-1234"
          className="flex-1 h-9 px-3 rounded-lg text-base border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <a
          href={canSearch ? getRakutenURL(value) : undefined}
          target="_blank"
          rel="nofollow noopener noreferrer sponsored"
          onClick={(e) => { if (!canSearch) e.preventDefault() }}
          className={`h-9 px-3 rounded-lg text-xs font-medium text-white transition-colors whitespace-nowrap flex items-center gap-1 ${
            canSearch
              ? 'bg-[#bf0000] hover:bg-[#a00000] cursor-pointer'
              : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
          }`}
        >
          🛒 楽天
        </a>
      </div>
    </div>
  )
}
