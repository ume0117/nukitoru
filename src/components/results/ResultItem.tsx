'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'
import type { ScanResult } from '@/types'
import {
  detectQRContentType,
  QR_CONTENT_META,
  analyzeURL,
  extractDomain,
} from '@/lib/utils/qr-content'

// ============================================================
// コピーボタン（共通）
// ============================================================
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = value
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? 'コピー済み' : 'コピー'}
      className={cn(
        'h-8 px-3 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap',
        copied
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
      )}
    >
      {copied ? '✓ コピー済' : 'コピー'}
    </button>
  )
}

// ============================================================
// 確認ダイアログ（注意フラグありURLを開く前に表示）
// ============================================================
function ConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 m-4 max-w-sm w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <span className="text-xl mt-0.5">⚠️</span>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            注意が必要な特徴があります。
            <br />
            遷移先を十分に確認した上で開いてください。
          </p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="h-9 px-4 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-all"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="h-9 px-4 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-all"
          >
            開く
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// URL カード
// ============================================================
function URLResultCard({
  result,
  onDelete,
}: {
  result: ScanResult
  onDelete: (id: string) => void
}) {
  const [showConfirm, setShowConfirm] = useState(false)
  const analysis = analyzeURL(result.value)

  const openURL = () => {
    window.open(result.value, '_blank', 'noopener,noreferrer')
  }

  const handleOpenClick = () => {
    if (analysis.hasWarnings) {
      setShowConfirm(true)
    } else {
      openURL()
    }
  }

  return (
    <>
      {showConfirm && (
        <ConfirmDialog
          onConfirm={() => { setShowConfirm(false); openURL() }}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <div className="rounded-xl bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-900/40 shadow-sm p-4 space-y-2.5">
        {/* ヘッダー */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base">🔗</span>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
              URL
            </span>
            {result.page != null && (
              <span className="text-[10px] text-gray-400">P.{result.page}</span>
            )}
          </div>
          <button
            onClick={() => onDelete(result.id)}
            aria-label="削除"
            className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ドメイン（大きく表示） */}
        <p className="text-base font-semibold text-gray-800 dark:text-gray-100 truncate">
          {analysis.domain}
        </p>

        {/* フル URL */}
        <p className="font-mono text-xs text-gray-500 dark:text-gray-400 break-all leading-relaxed">
          {result.value}
        </p>

        {/* 注意喚起 */}
        {analysis.hasWarnings ? (
          <div className="space-y-1">
            {analysis.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <span className="shrink-0">⚠️</span>
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            ℹ️ 注意が必要な特徴は見つかりませんでした
          </p>
        )}

        {/* アクション */}
        <div className="flex gap-2 pt-0.5">
          <button
            onClick={handleOpenClick}
            className="flex-1 h-9 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            開く
          </button>
          <CopyButton value={result.value} />
        </div>
      </div>
    </>
  )
}

// ============================================================
// QR（URL以外）カード
// ============================================================
function QRResultCard({
  result,
  onDelete,
}: {
  result: ScanResult
  onDelete: (id: string) => void
}) {
  const contentType = detectQRContentType(result.value)
  const meta = QR_CONTENT_META[contentType]

  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm p-3.5 flex items-start gap-3">
      <div className="shrink-0 pt-0.5">
        <span className="text-xl">{meta.icon}</span>
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            {meta.label}
          </span>
          {result.page != null && (
            <span className="text-[10px] text-gray-400">P.{result.page}</span>
          )}
        </div>
        <p className="font-mono text-sm text-gray-800 dark:text-gray-100 break-all leading-relaxed">
          {result.value}
        </p>
      </div>

      <div className="flex flex-col gap-1.5 shrink-0">
        <CopyButton value={result.value} />
        <button
          onClick={() => onDelete(result.id)}
          aria-label="削除"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ============================================================
// 楽天商品情報フック
// ============================================================
interface RakutenProduct {
  name: string
  price: number
  affiliateUrl: string
  imageUrl: string | null
}

function useRakutenProduct(janCode: string, isJAN: boolean) {
  const [product, setProduct] = useState<RakutenProduct | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isJAN) return
    setLoading(true)
    fetch(`/api/rakuten?jan=${encodeURIComponent(janCode)}`)
      .then(r => r.json())
      .then(data => {
        if (data.found) setProduct(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [janCode, isJAN])

  return { product, loading }
}
const BARCODE_META: Record<string, { icon: string; label: string }> = {
  EAN_13:   { icon: '🏷️', label: 'JANコード' },
  EAN_8:    { icon: '🏷️', label: 'EAN-8' },
  CODE_128: { icon: '📦', label: 'CODE128' },
}

const RAKUTEN_AFFILIATE_ID = '554ce912.68635f88.554ce913.1ffa91d2'

function getRakutenSearchURL(janCode: string): string {
  const searchURL = encodeURIComponent(
    `https://search.rakuten.co.jp/search/mall/${janCode}/?s=1`
  )
  return `https://hb.afl.rakuten.co.jp/ichiba/${RAKUTEN_AFFILIATE_ID}/?pc=${searchURL}`
}

function BarcodeResultCard({
  result,
  onDelete,
}: {
  result: ScanResult
  onDelete: (id: string) => void
}) {
  const meta = BARCODE_META[result.type] ?? { icon: '📄', label: result.type }
  const isJAN = result.type === 'EAN_13' || result.type === 'EAN_8'
  const { product, loading } = useRakutenProduct(result.value, isJAN)

  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm p-3.5 space-y-2.5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 pt-0.5">
          <span className="text-xl">{meta.icon}</span>
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {meta.label}
            </span>
            {result.page != null && (
              <span className="text-[10px] text-gray-400">P.{result.page}</span>
            )}
          </div>
          <p className="font-mono text-sm text-gray-800 dark:text-gray-100 break-all leading-relaxed">
            {result.value}
          </p>
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          <CopyButton value={result.value} />
          <button
            onClick={() => onDelete(result.id)}
            aria-label="削除"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 楽天商品情報（JAN/EAN のみ） */}
      {isJAN && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-2.5 space-y-2">
          {loading && (
            <p className="text-xs text-gray-400 animate-pulse">楽天で商品を検索中...</p>
          )}
          {!loading && product && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-snug line-clamp-2">
                {product.name}
              </p>
              <p className="text-sm font-bold text-red-600 dark:text-red-400">
                ¥{product.price.toLocaleString()}
                <span className="text-xs font-normal text-gray-400 ml-1">（税込・最安値順）</span>
              </p>
              <a
                href={product.affiliateUrl}
                target="_blank"
                rel="nofollow noopener noreferrer sponsored"
                className="flex items-center justify-center gap-2 w-full h-9 rounded-lg text-sm font-medium bg-[#bf0000] hover:bg-[#a00000] text-white transition-colors"
              >
                <span>🛒</span>
                <span>楽天市場で購入</span>
              </a>
            </div>
          )}
          {!loading && !product && (
            <a
              href={getRakutenSearchURL(result.value)}
              target="_blank"
              rel="nofollow noopener noreferrer sponsored"
              className="flex items-center justify-center gap-2 w-full h-9 rounded-lg text-sm font-medium bg-[#bf0000] hover:bg-[#a00000] text-white transition-colors"
            >
              <span>🛒</span>
              <span>楽天市場で検索</span>
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// メインコンポーネント（ディスパッチャー）
// ============================================================
interface ResultItemProps {
  result: ScanResult
  onDelete: (id: string) => void
}

export function ResultItem({ result, onDelete }: ResultItemProps) {
  if (result.type === 'QR_CODE') {
    const contentType = detectQRContentType(result.value)
    if (contentType === 'URL') {
      return <URLResultCard result={result} onDelete={onDelete} />
    }
    return <QRResultCard result={result} onDelete={onDelete} />
  }

  return <BarcodeResultCard result={result} onDelete={onDelete} />
}
