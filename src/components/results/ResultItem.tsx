'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import type { ScanResult } from '@/types'
import { detectQRContentType, analyzeURL } from '@/lib/utils/qr-content'


const WORKER_URL = 'https://nukitoru-api.ume0117.workers.dev'

function usePriceData(jan: string) {
  const [data, setData] = useState<{minPrice: number | null, rakuten: Array<{name: string, price: number, url: string, shop: string, image: string | null}>, yahoo: Array<{name: string, price: number, url: string, shop: string, image: string | null}>} | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchPrice = async () => {
    if (loading || data) return
    setLoading(true)
    try {
      const res = await fetch(`${WORKER_URL}/?jan=${jan}`)
      const json = await res.json()
      setData(json)
    } catch {}
    setLoading(false)
  }

  return { data, loading, fetchPrice }
}

const RAKUTEN_AFFILIATE_ID = '554ce912.68635f88.554ce913.1ffa91d2'
const AMAZON_ASSOCIATE_ID = 'nukitoru-22'
const VC_SID = '3774634'

function getRakutenURL(jan: string) {
  const searchURL = encodeURIComponent(`https://search.rakuten.co.jp/search/mall/${jan}/?s=2`)
  return `https://hb.afl.rakuten.co.jp/ichiba/${RAKUTEN_AFFILIATE_ID}/?pc=${searchURL}`
}
function getAmazonURL(jan: string) {
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(jan)}&tag=${AMAZON_ASSOCIATE_ID}`
}
function getYahooURL(jan: string) {
  return `https://search.shopping.yahoo.co.jp/search?p=${encodeURIComponent(jan)}&sort=price&sc_e=afvc_shp_${VC_SID}`
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(value) } catch {
      const ta = document.createElement('textarea'); ta.value = value
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className={cn('h-8 px-3 border text-[10px] tracking-[0.15em] uppercase font-medium transition-colors whitespace-nowrap', copied ? 'border-blue-600 text-blue-600' : 'border-gray-400 dark:border-gray-600 text-gray-400 dark:text-gray-600 hover:border-blue-600 hover:text-blue-600')}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <button onClick={onDelete} aria-label="Delete" className="w-6 h-6 flex items-center justify-center text-gray-300 dark:text-gray-700 hover:text-red-500 transition-colors shrink-0">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )
}

function URLResultCard({ result, onDelete }: { result: ScanResult; onDelete: (id: string) => void }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const analysis = analyzeURL(result.value)
  const openURL = () => window.open(result.value, '_blank', 'noopener,noreferrer')
  const handleOpen = () => { if (analysis.hasWarnings) { setShowConfirm(true) } else { openURL() } }

  return (
    <>
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowConfirm(false)}>
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 p-6 m-4 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <p className="text-[11px] tracking-[0.15em] text-gray-400 uppercase mb-4">Warning</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">注意が必要な特徴があります。遷移先を十分に確認した上で開いてください。</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowConfirm(false)} className="h-9 px-4 border border-gray-400 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-[10px] tracking-[0.15em] uppercase transition-colors">Cancel</button>
              <button onClick={() => { setShowConfirm(false); openURL() }} className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-[10px] tracking-[0.15em] uppercase transition-colors">Open</button>
            </div>
          </div>
        </div>
      )}
      <div className="border border-blue-600/30 dark:border-blue-600/20 bg-white dark:bg-black p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-[0.2em] text-blue-600 uppercase font-medium">URL</span>
            {result.page != null && <span className="text-[9px] text-gray-400">P.{result.page}</span>}
          </div>
          <DeleteButton onDelete={() => onDelete(result.id)} />
        </div>
        <p className="font-mono text-sm text-gray-800 dark:text-gray-100 break-all leading-relaxed">{result.value}</p>
        {analysis.hasWarnings && (
          <div className="space-y-1">
            {analysis.warnings.map((w, i) => (
              <p key={i} className="text-[10px] text-amber-600 dark:text-amber-400">⚠ {w.message}</p>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={handleOpen} className="flex-1 h-9 bg-blue-600 hover:bg-blue-700 text-white text-[10px] tracking-[0.15em] uppercase font-medium transition-colors">Open</button>
          <CopyButton value={result.value} />
        </div>
      </div>
    </>
  )
}

function BarcodeResultCard({ result, onDelete }: { result: ScanResult; onDelete: (id: string) => void }) {
  const TYPE_LABEL: Record<string, string> = { EAN_13: 'JAN', EAN_8: 'EAN-8', CODE_128: 'CODE128' }
  const label = TYPE_LABEL[result.type] ?? result.type
  const isJAN = result.type === 'EAN_13' || result.type === 'EAN_8'
  const { data: priceData, loading: priceLoading, fetchPrice } = usePriceData(result.value as string)

  return (
    <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] tracking-[0.2em] text-gray-500 dark:text-gray-500 uppercase font-medium">{label}</span>
          {result.page != null && <span className="text-[9px] text-gray-400">P.{result.page}</span>}
        </div>
        <div className="flex items-center gap-2">
          <CopyButton value={result.value} />
          <DeleteButton onDelete={() => onDelete(result.id)} />
        </div>
      </div>
      <p className="font-mono text-sm text-gray-800 dark:text-gray-100 break-all leading-relaxed">{result.value}</p>
      {isJAN && (
        <div className="space-y-1.5 border-t border-gray-100 dark:border-gray-800 pt-2.5">
          {!priceData && (
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
          <a href={getRakutenURL(result.value)} target="_blank" rel="nofollow noopener noreferrer sponsored" className="flex items-center justify-center w-full h-9 border border-[#bf0000] text-[#bf0000] hover:bg-[#bf0000] hover:text-white text-[10px] tracking-[0.15em] uppercase font-medium transition-colors">RAKUTEN</a>
          <div className="grid grid-cols-2 gap-1.5">
            <a href={getAmazonURL(result.value)} target="_blank" rel="nofollow noopener noreferrer sponsored" className="flex items-center justify-center h-9 border border-[#FF9900] text-[#FF9900] hover:bg-[#FF9900] hover:text-white text-[10px] tracking-[0.15em] uppercase font-medium transition-colors">AMAZON</a>
            <a href={getYahooURL(result.value)} target="_blank" rel="nofollow noopener noreferrer sponsored" className="flex items-center justify-center h-9 border border-[#FF0033] text-[#FF0033] hover:bg-[#FF0033] hover:text-white text-[10px] tracking-[0.15em] uppercase font-medium transition-colors">YAHOO!</a>
          </div>
        </div>
      )}
    </div>
  )
}

function QRResultCard({ result, onDelete }: { result: ScanResult; onDelete: (id: string) => void }) {
  return (
    <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black p-3.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] tracking-[0.2em] text-gray-500 dark:text-gray-500 uppercase font-medium">QR</span>
          {result.page != null && <span className="text-[9px] text-gray-400">P.{result.page}</span>}
        </div>
        <div className="flex items-center gap-2">
          <CopyButton value={result.value} />
          <DeleteButton onDelete={() => onDelete(result.id)} />
        </div>
      </div>
      <p className="font-mono text-sm text-gray-800 dark:text-gray-100 break-all leading-relaxed">{result.value}</p>
    </div>
  )
}

interface ResultItemProps {
  result: ScanResult
  onDelete: (id: string) => void
}

export function ResultItem({ result, onDelete }: ResultItemProps) {
  if (result.type === 'QR_CODE') {
    const contentType = detectQRContentType(result.value)
    if (contentType === 'URL') return <URLResultCard result={result} onDelete={onDelete} />
    return <QRResultCard result={result} onDelete={onDelete} />
  }
  return <BarcodeResultCard result={result} onDelete={onDelete} />
}
