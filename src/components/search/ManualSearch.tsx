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
  const q = query.trim()
  const isASIN = /^[A-Z0-9]{10}$/i.test(q)
  if (isASIN) {
    return `https://www.amazon.co.jp/dp/${q}?tag=${AMAZON_ASSOCIATE_ID}`
  }
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(q)}&tag=${AMAZON_ASSOCIATE_ID}`
}

const VC_SID = '3774634'

function getYahooURL(query: string): string {
  return `https://search.shopping.yahoo.co.jp/search?p=${encodeURIComponent(query.trim())}&sort=price&sc_e=afvc_shp_${VC_SID}`
}

export function ManualSearch() {
  const [value, setValue] = useState('')
  const trimmed = value.trim()
  const isJAN   = /^\d{8}$|^\d{13}$/.test(trimmed)
  const isASIN  = /^[A-Z0-9]{10}$/i.test(trimmed) && !/^\d+$/.test(trimmed)
  const canSearch = trimmed.length > 0

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && canSearch) {
      if (isASIN) window.open(getAmazonURL(value), '_blank', 'noopener,noreferrer')
      else window.open(getRakutenURL(value), '_blank', 'noopener,noreferrer')
    }
  }

  const inputType = isASIN ? 'ASIN' : isJAN ? 'JAN' : trimmed.length > 0 ? 'SKU' : null

  return (
    <div className="border border-gray-100 dark:border-gray-800 bg-white dark:bg-black p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">
          Search by JAN / SKU / ASIN
        </span>
        {inputType && (
          <span className="text-[9px] tracking-[0.15em] px-2 py-0.5 border border-blue-600 text-blue-600 uppercase ml-auto">
            {inputType}
          </span>
        )}
      </div>

      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="JAN / SKU / ASIN"
          className="w-full h-10 px-3 pr-8 text-sm border border-gray-100 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none focus:border-blue-600 transition-colors"
        />
        {value && (
          <button
            onClick={() => setValue('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-700 hover:text-gray-500 text-xs"
          >
            x
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <a href={canSearch && !isASIN ? getRakutenURL(value) : undefined} target="_blank" rel="nofollow noopener noreferrer sponsored" onClick={(e) => { if (!canSearch || isASIN) e.preventDefault() }} className={`h-9 text-[10px] tracking-[0.15em] uppercase font-medium transition-all flex items-center justify-center border ${canSearch && !isASIN ? 'border-[#bf0000] text-[#bf0000] hover:bg-[#bf0000] hover:text-white cursor-pointer' : 'border-gray-100 dark:border-gray-900 text-gray-300 dark:text-gray-700 cursor-not-allowed'}`}>RAKUTEN</a>
        <a href={canSearch ?
