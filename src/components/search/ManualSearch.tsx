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
    <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">🔍</span>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          JANコード・品番で検索
        </span>
      </div>

      <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="例: 4901234567890 または ABC-1234"
          className="w-full h-10 px-3 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <a
          href={canSearch ? getRakutenURL(value) : undefined}
          target="_blank"
          rel="nofollow noopener noreferrer sponsored"
          onClick={(e) => { if (!canSearch) e.preventDefault() }}
          className={`flex items-center justify-center gap-2 w-full h-10 rounded-lg text-sm font-medium text-white transition-colors ${
            canSearch
              ? 'bg-[#bf0000] hover:bg-[#a00000] cursor-pointer'
              : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
          }`}
        >
          🛒 楽天市場で検索
        </a>

      <p className="text-[11px] text-gray-400 dark:text-gray-600 leading-relaxed">
        {value.trim().length > 0
          ? isJAN
            ? '✓ JANコードとして検索します'
            : '✓ 品番として完全一致で検索します（自動で "" を付けて検索）'
          : 'JANコード（8・13桁）は通常検索、品番は完全一致で自動検索します'}
      </p>
    </div>
  )
}
