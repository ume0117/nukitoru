'use client'

import { useState } from 'react'

const RAKUTEN_AFFILIATE_ID = '554ce912.68635f88.554ce913.1ffa91d2'
const AMAZON_ASSOCIATE_ID = 'nukitoru-22'

function getRakutenURL(query: string): string {
  const isJAN = /^\d{8}$|^\d{13}$/.test(query.trim())
  const searchTerm = isJAN ? query.trim() : `"${query.trim()}"`
  const searchURL = encodeURIComponent(
    `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(searchTerm)}/?s=2`
  )
  return `https://hb.afl.rakuten.co.jp/ichiba/${RAKUTEN_AFFILIATE_ID}/?pc=${searchURL}`
}

function getAmazonURL(query: string): string {
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(query.trim())}&tag=${AMAZON_ASSOCIATE_ID}`
}

const VC_SID = '3774634'
const VC_PID = '892648734'

function getYahooURL(query: string): string {
  const yahooSearchUrl = `https://search.shopping.yahoo.co.jp/search?p=${encodeURIComponent(query.trim())}&sort=price`
  const vcUrl = encodeURIComponent(yahooSearchUrl)
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${VC_SID}&pid=${VC_PID}&vc_url=${vcUrl}`
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
    <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm">🔍</span>
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
          JAN・品番で検索
        </span>
        {value.trim().length > 0 && (
          <span className="text-[10px] text-gray-400 ml-auto">
            {isJAN ? 'JANコード' : '品番（完全一致）'}
          </span>
        )}
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="4901234567890 または ABC-1234"
        className="w-full h-9 px-3 rounded-lg text-base border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      <div className="grid grid-cols-3 gap-1.5">
        <a
          href={canSearch ? getRakutenURL(value) : undefined}
          target="_blank"
          rel="nofollow noopener noreferrer sponsored"
          onClick={(e) => { if (!canSearch) e.preventDefault() }}
          className={`h-9 rounded-lg text-[11px] font-medium text-white transition-colors flex items-center justify-center gap-1 ${
            canSearch ? 'bg-[#bf0000] hover:bg-[#a00000] cursor-pointer' : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
          }`}
        >
          🛒 楽天
        </a>
        <a
          href={canSearch ? getAmazonURL(value) : undefined}
          target="_blank"
          rel="nofollow noopener noreferrer sponsored"
          onClick={(e) => { if (!canSearch) e.preventDefault() }}
          className={`h-9 rounded-lg text-[11px] font-medium text-white transition-colors flex items-center justify-center gap-1 ${
            canSearch ? 'bg-[#FF9900] hover:bg-[#e68a00] cursor-pointer' : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
          }`}
        >
          📦 Amazon
        </a>
        <a
          href={canSearch ? getYahooURL(value) : undefined}
          target="_blank"
          rel="nofollow noopener noreferrer sponsored"
          onClick={(e) => { if (!canSearch) e.preventDefault() }}
          className={`h-9 rounded-lg text-[11px] font-medium text-white transition-colors flex items-center justify-center gap-1 ${
            canSearch ? 'bg-[#FF0033] hover:bg-[#e6002e] cursor-pointer' : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
          }`}
        >
          🛍️ Yahoo!
        </a>
      </div>
    </div>
  )
}
