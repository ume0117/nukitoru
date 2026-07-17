'use client'

import { useState } from 'react'

const WORKER_URL = 'https://nukitoru-api.ume0117.workers.dev'
const RAKUTEN_AFFILIATE_ID = '554ce912.68635f88.554ce913.1ffa91d2'
const AMAZON_ASSOCIATE_ID = 'nukitoru-22'
const VC_SID = '3774634'

type PriceItem = { name: string; price: number; url: string; shop: string; image: string | null }
type PriceData = { rakuten: PriceItem[]; yahoo: PriceItem[]; minPrice: number | null }

function usePriceData(jan: string) {
  const [data, setData] = useState<PriceData | null>(null)
  const [loading, setLoading] = useState(false)
  const fetchPrice = async () => {
    if (loading || data) return
    setLoading(true)
    try {
      const res = await fetch(WORKER_URL + '/?jan=' + jan)
      const json = await res.json()
      setData(json)
    } catch {}
    setLoading(false)
  }
  return { data, loading, fetchPrice }
}

function getRakutenURL(query: string): string {
  const digits8 = /^\d{8}$/.test(query.trim())
  const digits13 = /^\d{13}$/.test(query.trim())
  const isJAN = digits8 || digits13
  const searchTerm = isJAN ? query.trim() : '"' + query.trim() + '"'
  const searchURL = encodeURIComponent('https://search.rakuten.co.jp/search/mall/' + encodeURIComponent(searchTerm) + '/?s=2')
  return 'https://hb.afl.rakuten.co.jp/ichiba/' + RAKUTEN_AFFILIATE_ID + '/?pc=' + searchURL
}

function getAmazonURL(query: string): string {
  const q = query.trim()
  const isASIN = /^[A-Z0-9]{10}$/i.test(q)
  if (isASIN) {
    return 'https://www.amazon.co.jp/dp/' + q + '?tag=' + AMAZON_ASSOCIATE_ID
  }
  return 'https://www.amazon.co.jp/s?k=' + encodeURIComponent(q) + '&tag=' + AMAZON_ASSOCIATE_ID
}

function getYahooURL(query: string): string {
  return 'https://search.shopping.yahoo.co.jp/search?p=' + encodeURIComponent(query.trim()) + '&sort=price&sc_e=afvc_shp_' + VC_SID
}

export function ManualSearch() {
  const [value, setValue] = useState('')
  const trimmed = value.trim()
  const digits8 = /^\d{8}$/.test(trimmed)
  const digits13 = /^\d{13}$/.test(trimmed)
  const isJAN = digits8 || digits13
  const isASIN = /^[A-Z0-9]{10}$/i.test(trimmed) && !/^\d+$/.test(trimmed)
  const canSearch = trimmed.length > 0
  const { data: priceData, loading: priceLoading, fetchPrice } = usePriceData(trimmed)

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
        <span className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">Search by JAN / SKU / ASIN</span>
        {inputType && (<span className="text-[9px] tracking-[0.15em] px-2 py-0.5 border border-blue-600 text-blue-600 uppercase ml-auto">{inputType}</span>)}
      </div>
      <div className="relative">
        <input type="text" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={handleKeyDown} placeholder="JAN / SKU / ASIN" className="w-full h-10 px-3 pr-8 text-sm border border-gray-100 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none focus:border-blue-600 transition-colors" />
        {value && (<button onClick={() => setValue('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-700 hover:text-gray-500 text-xs">x</button>)}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <a href={canSearch && !isASIN ? getRakutenURL(value) : undefined} target="_blank" rel="nofollow noopener noreferrer sponsored" onClick={(e) => { if (!canSearch || isASIN) e.preventDefault() }} className={`h-9 text-[10px] tracking-[0.15em] uppercase font-medium transition-all flex items-center justify-center border ${canSearch && !isASIN ? 'border-[#bf0000] text-[#bf0000] hover:bg-[#bf0000] hover:text-white cursor-pointer' : 'border-gray-100 dark:border-gray-900 text-gray-300 dark:text-gray-700 cursor-not-allowed'}`}>RAKUTEN</a>
        <a href={canSearch ? getAmazonURL(value) : undefined} target="_blank" rel="nofollow noopener noreferrer sponsored" onClick={(e) => { if (!canSearch) e.preventDefault() }} className={`h-9 text-[10px] tracking-[0.15em] uppercase font-medium transition-all flex items-center justify-center border ${canSearch ? 'border-[#FF9900] text-[#FF9900] hover:bg-[#FF9900] hover:text-white cursor-pointer' : 'border-gray-100 dark:border-gray-900 text-gray-300 dark:text-gray-700 cursor-not-allowed'}`}>{isASIN ? 'PRODUCT PAGE' : 'AMAZON'}</a>
        <a href={canSearch && !isASIN ? getYahooURL(value) : undefined} target="_blank" rel="nofollow noopener noreferrer sponsored" onClick={(e) => { if (!canSearch || isASIN) e.preventDefault() }} className={`h-9 text-[10px] tracking-[0.15em] uppercase font-medium transition-all flex items-center justify-center border ${canSearch && !isASIN ? 'border-[#FF0033] text-[#FF0033] hover:bg-[#FF0033] hover:text-white cursor-pointer' : 'border-gray-100 dark:border-gray-900 text-gray-300 dark:text-gray-700 cursor-not-allowed'}`}>YAHOO!</a>
      </div>
      {isJAN && canSearch && !priceData && (
        <button onClick={fetchPrice} disabled={priceLoading} className="w-full h-8 border border-gray-400 dark:border-gray-600 text-gray-400 dark:text-gray-600 text-[9px] tracking-[0.15em] uppercase hover:border-blue-600 hover:text-blue-600 transition-colors">
          {priceLoading ? 'Loading...' : '¥ Check Price'}
        </button>
      )}
      {priceData && priceData.rakuten.length > 0 && priceData.rakuten[0].image && (
        <div className="flex items-center gap-3 border border-gray-100 dark:border-gray-800 p-2">
          <img src={priceData.rakuten[0].image} alt={priceData.rakuten[0].name} className="w-12 h-12 object-contain shrink-0" />
          <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-tight line-clamp-2">{priceData.rakuten[0].name}</p>
        </div>
      )}
      {priceData && priceData.minPrice && (
        <div className="space-y-1">
          <p className="text-[9px] tracking-[0.15em] text-gray-400 uppercase">Price Comparison <span className="text-blue-600">Min ¥{priceData.minPrice.toLocaleString()}</span></p>
          {priceData.rakuten.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-[8px] tracking-[0.1em] text-gray-300 dark:text-gray-700 uppercase px-1">Rakuten</p>
              {priceData.rakuten.map((item, i) => (
                <a key={i} href={item.url} target="_blank" rel="nofollow noopener noreferrer sponsored" className={`flex items-center justify-between h-8 px-3 border text-[10px] transition-colors ${item.price === priceData.minPrice ? 'border-blue-600 text-blue-600' : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-500'}`}>
                  <span className="truncate mr-2">{item.shop}</span>
                  <span className="shrink-0 font-medium">¥{item.price.toLocaleString()}{item.price === priceData.minPrice ? ' ★' : ''}</span>
                </a>
              ))}
            </div>
          )}
          {priceData.yahoo && priceData.yahoo.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-[8px] tracking-[0.1em] text-gray-300 dark:text-gray-700 uppercase px-1">Yahoo!</p>
              {priceData.yahoo.map((item, i) => (
                <a key={i} href={item.url} target="_blank" rel="nofollow noopener noreferrer" className={`flex items-center justify-between h-8 px-3 border text-[10px] transition-colors ${item.price === priceData.minPrice ? 'border-blue-600 text-blue-600' : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-500'}`}>
                  <span className="truncate mr-2">{item.shop}</span>
                  <span className="shrink-0 font-medium">¥{item.price.toLocaleString()}{item.price === priceData.minPrice ? ' ★' : ''}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
