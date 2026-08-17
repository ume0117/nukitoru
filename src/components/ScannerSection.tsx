'use client'

import { useRef, useEffect, useState } from 'react'
import { useFileProcessor } from '@/hooks/useFileProcessor'
import { UploadArea } from '@/components/upload/UploadArea'
import { ManualSearch } from '@/components/search/ManualSearch'
import { CameraScanner } from '@/components/camera/CameraScanner'
import { CatalogMode } from '@/components/catalog/CatalogMode'
import { InventoryScanner, type InventorySession } from '@/components/camera/InventoryScanner'
import { InventoryHistory, saveToHistory } from '@/components/inventory/InventoryHistory'
import { ScanProgress } from '@/components/scanner/ScanProgress'
import { ResultList } from '@/components/results/ResultList'
import { cn } from '@/lib/utils/cn'
import { deduplicateResults } from '@/lib/utils/dedup'
import type { ScanResult } from '@/types'

const LANG_STORAGE_KEY = 'nukitoru_lang'

const TEXT = {
  ja: {
    badges: ['URL開ける', 'PDF全ページ', 'プライバシー保護', 'ブラウザ内処理'],
    introTitle: 'コア機能はすべて無料・無制限',
    introBody: '価格比較・CSV出力・出品下書き・価格改定アラートなど、日々の出品作業に使う機能はどなたでも無料でお使いいただけます。PROは、バーコード/QRコード生成やラベルシート印刷など、作業をさらに効率化する追加機能です。',
    introLink: 'PROの詳細を見る →',
    catalog: 'カタログ',
    inventory: '棚卸し',
    history: '履歴',
    noCodeFound: 'コードが見つかりませんでした',
    back: '← 戻る',
    complete: '完了',
    downloadCsv: 'CSVをダウンロード',
    viewHistory: '履歴を見る',
    newInventory: '新しい棚卸し',
    backToTop: 'トップへ戻る',
    resume: '再開',
    clear: 'クリア',
    itemsUnit: '点',
    productsUnit: '商品',
    selectAnotherFile: '別のファイルを選択',
  },
  en: {
    badges: ['URL open', 'PDF all pages', 'Privacy safe', 'Browser only'],
    introTitle: 'Core features are free and unlimited',
    introBody: 'Price comparison, CSV export, listing drafts, price drop alerts, and more are free for everyone. PRO adds extras like barcode/QR code generation and label sheet printing to speed up your workflow further.',
    introLink: 'See what PRO offers →',
    catalog: 'Catalog',
    inventory: 'Inventory',
    history: 'History',
    noCodeFound: 'No code found',
    back: '← Back',
    complete: 'Complete',
    downloadCsv: 'Download CSV',
    viewHistory: 'View History',
    newInventory: 'New Inventory',
    backToTop: 'Back to top',
    resume: 'Resume',
    clear: 'Clear',
    itemsUnit: 'items',
    productsUnit: 'products',
    selectAnotherFile: 'Select another file',
  },
}

function CompactUploadButton({ onFile, label }: { onFile: (f: File) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={ref} type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
      <button onClick={() => ref.current?.click()} className={cn('w-full h-12 border', 'flex items-center justify-center gap-2', 'text-[11px] tracking-[0.2em] uppercase text-gray-400 dark:text-gray-600', 'border-gray-100 dark:border-gray-800', 'hover:border-blue-600 hover:text-blue-600', 'transition-all duration-200')}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        {label}
      </button>
    </>
  )
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 p-4 text-sm border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400">
      <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
      <span>{message}</span>
    </div>
  )
}

export function ScannerSection() {
  const { results, progress, error, isScanning, processFile, addResults, deleteResult, clearAll } = useFileProcessor()
  const resultRef = useRef<HTMLDivElement>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [inventoryResult, setInventoryResult] = useState<InventorySession | null>(null)
  const [showInventoryHistory, setShowInventoryHistory] = useState(false)
  const [showInventoryComplete, setShowInventoryComplete] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [lang, setLang] = useState<'ja' | 'en'>('ja')

  useEffect(() => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY)
    if (saved === 'en' || saved === 'ja') setLang(saved)
  }, [])

  const switchLang = (next: 'ja' | 'en') => {
    setLang(next)
    localStorage.setItem(LANG_STORAGE_KEY, next)
  }

  const t = TEXT[lang]

  const handleInventoryFinish = (session: InventorySession) => {
    setInventoryOpen(false)
    saveToHistory(session)
    setInventoryResult(session)
    setShowInventoryComplete(true)
  }

  const isIdle = progress.status === 'idle'
  const isDone = progress.status === 'done'
  const hasResults = results.length > 0

  const handleDelete = (id: string) => {
    if (results.length === 1) { clearAll() } else { deleteResult(id) }
  }

  const handleCameraResult = (newResults: ScanResult[]) => {
    const merged = deduplicateResults([...newResults, ...results])
    addResults(merged)
  }

  useEffect(() => {
    if (isDone && hasResults && resultRef.current) {
      setTimeout(() => { resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 150)
    }
  }, [isDone, hasResults])

  const downloadCSV = (items: InventorySession['items'], startedAt: string) => {
    const bom = '\uFEFF'
    const header = 'JANコード,個数,最終スキャン日時'
    const rows = items.map(i => `${i.result.value},${i.count},${new Date(i.lastScannedAt).toLocaleString('ja-JP')}`)
    const csv = bom + [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const d = new Date(startedAt)
    a.download = `棚卸し_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className={cn('overflow-hidden transition-all duration-500 ease-in-out', isIdle ? 'max-h-[900px] opacity-100 pt-6 pb-4' : 'max-h-0 opacity-0 pointer-events-none')} aria-hidden={!isIdle}>
        <div className="flex items-center justify-between">
          <h1 className="text-[11px] tracking-[0.3em] text-gray-400 dark:text-gray-600 uppercase">PDF · Image · Barcode Extractor</h1>
          <div className="flex gap-1.5 shrink-0 ml-3">
            <button onClick={() => switchLang('ja')} className={`text-[9px] tracking-[0.1em] px-2 h-6 border transition-colors ${lang === 'ja' ? 'border-blue-600 text-blue-600' : 'border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600'}`}>JA</button>
            <button onClick={() => switchLang('en')} className={`text-[9px] tracking-[0.1em] px-2 h-6 border transition-colors ${lang === 'en' ? 'border-blue-600 text-blue-600' : 'border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600'}`}>EN</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {t.badges.map((label) => (
            <span key={label} className="text-[9px] tracking-[0.15em] px-2.5 py-1 border border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-600 uppercase">{label}</span>
          ))}
        </div>

        <div className="mt-4 border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-3">
          <p className="text-[10px] tracking-[0.1em] text-blue-600 dark:text-blue-400 uppercase font-medium mb-1">{t.introTitle}</p>
          <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed">{t.introBody}</p>
          <a href="/upgrade" className="inline-block text-[9px] tracking-[0.1em] text-blue-600 dark:text-blue-400 hover:underline mt-1.5">{t.introLink}</a>
        </div>
      </div>

      {!isDone && (
        <div className="space-y-3">
          <UploadArea onFileSelect={processFile} isScanning={isScanning} onCameraClick={() => setCameraOpen(true)} />
          <ManualSearch />
          <div className="flex gap-2 pt-1">
            <button onClick={() => setCatalogOpen(true)} className="flex-1 h-11 border border-gray-400 dark:border-gray-600 bg-gray-900/30 hover:border-gray-300 dark:hover:border-gray-400 flex items-center justify-center gap-2 text-[11px] tracking-[0.2em] font-medium text-gray-300 dark:text-gray-400 uppercase transition-colors">{t.catalog}</button>
            <button onClick={() => setInventoryOpen(true)} className="flex-1 h-11 border border-gray-400 dark:border-gray-600 bg-gray-900/30 hover:border-gray-300 dark:hover:border-gray-400 flex items-center justify-center gap-2 text-[11px] tracking-[0.2em] font-medium text-gray-300 dark:text-gray-400 uppercase transition-colors">{t.inventory}</button>
            <button onClick={() => setShowInventoryHistory(true)} className="h-11 px-4 border border-gray-400 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-400 text-gray-300 dark:text-gray-400 text-[11px] tracking-[0.15em] uppercase transition-colors">{t.history}</button>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <a href="/draft" className="h-10 border border-gray-100 dark:border-gray-800 hover:border-blue-600 flex items-center justify-center gap-1.5 text-[9px] tracking-[0.15em] text-gray-400 dark:text-gray-600 hover:text-blue-600 uppercase transition-colors">出品下書き生成</a>
            <a href="/recheck" className="h-10 border border-gray-100 dark:border-gray-800 hover:border-blue-600 flex items-center justify-center gap-1.5 text-[9px] tracking-[0.15em] text-gray-400 dark:text-gray-600 hover:text-blue-600 uppercase transition-colors">一括再チェック</a>
            <a href="/watch" className="h-10 border border-gray-100 dark:border-gray-800 hover:border-blue-600 flex items-center justify-center gap-1.5 text-[9px] tracking-[0.15em] text-gray-400 dark:text-gray-600 hover:text-blue-600 uppercase transition-colors">価格改定アラート</a>
            <a href="/barcode-generator" className="h-10 border border-gray-100 dark:border-gray-800 hover:border-blue-600 flex items-center justify-center gap-1.5 text-[9px] tracking-[0.15em] text-gray-400 dark:text-gray-600 hover:text-blue-600 uppercase transition-colors">バーコード / QRコード生成<span className="text-blue-500 ml-1">PRO</span></a>
          </div>
          {error && <ErrorAlert message={error} />}
          {progress.status !== 'idle' && <ScanProgress current={progress.current} total={progress.total} message={progress.message} status={progress.status} />}
        </div>
      )}

      {isDone && (
        <div ref={resultRef} className="space-y-4 pt-2">
          {!hasResults && (
            <div className="space-y-3">
              <div className="text-center space-y-2 py-4">
                <p className="text-[11px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">{t.noCodeFound}</p>
                <p className="text-[10px] text-gray-300 dark:text-gray-700">高解像度の画像をお試しください</p>
                <button onClick={clearAll} className="text-[10px] tracking-[0.15em] text-blue-600 uppercase underline underline-offset-2">{t.back}</button>
              </div>
              <UploadArea onFileSelect={processFile} isScanning={isScanning} />
            </div>
          )}
          {hasResults && (
            <div className="space-y-2">
              <ResultList results={results} onDelete={handleDelete} onClear={clearAll} />
              <div className="text-center pt-1">
                <button onClick={clearAll} className="text-[10px] tracking-[0.15em] text-blue-600 uppercase underline underline-offset-2">{t.back}</button>
              </div>
            </div>
          )}
          {hasResults && (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <ManualSearch />
            </div>
          )}
        </div>
      )}

      {showInventoryHistory && <InventoryHistory onClose={() => setShowInventoryHistory(false)} />}

      {showInventoryComplete && inventoryResult && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-black flex flex-col items-center justify-center p-6 gap-5">
          <div className="text-[11px] tracking-[0.3em] text-gray-400 uppercase">{t.complete}</div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white tracking-wide">棚卸しが完了しました</p>
            <p className="text-[10px] text-gray-400 tracking-wider">{new Date(inventoryResult.startedAt).toLocaleString('ja-JP')}<br/>{inventoryResult.items.reduce((s,i)=>s+i.count,0)} {t.itemsUnit} · {inventoryResult.items.length} {t.productsUnit}</p>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <button onClick={() => downloadCSV(inventoryResult.items, inventoryResult.startedAt)} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-[11px] tracking-[0.2em] uppercase transition-colors">{t.downloadCsv}</button>
            <button onClick={() => { setShowInventoryComplete(false); setShowInventoryHistory(true) }} className="w-full h-12 border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 text-[11px] tracking-[0.2em] uppercase">{t.viewHistory}</button>
            <button onClick={() => { setShowInventoryComplete(false); setInventoryOpen(true) }} className="w-full h-12 border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 text-[11px] tracking-[0.2em] uppercase">{t.newInventory}</button>
            <button onClick={() => { setShowInventoryComplete(false); setInventoryResult(null) }} className="w-full h-10 text-gray-300 dark:text-gray-700 text-[10px] tracking-[0.15em] uppercase">{t.backToTop}</button>
          </div>
        </div>
      )}

      {inventoryOpen && <InventoryScanner onFinish={handleInventoryFinish} onClose={() => setInventoryOpen(false)} />}

      {inventoryResult && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[11px] tracking-[0.2em] text-gray-600 dark:text-gray-400 uppercase">{t.inventory} · <span className="text-blue-600">{inventoryResult.items.reduce((s,i)=>s+i.count,0)} {t.itemsUnit}</span></h2>
              <p className="text-[10px] text-gray-300 dark:text-gray-700 mt-0.5">{new Date(inventoryResult.startedAt).toLocaleString('ja-JP')}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => downloadCSV(inventoryResult.items, inventoryResult.startedAt)} className="h-8 px-3 text-[10px] tracking-[0.15em] uppercase bg-blue-600 hover:bg-blue-700 text-white transition-colors">CSV</button>
              <button onClick={() => { setInventoryResult(null); setInventoryOpen(true) }} className="h-8 px-3 text-[10px] tracking-[0.15em] uppercase border border-gray-100 dark:border-gray-800 text-gray-400">{t.resume}</button>
              <button onClick={() => setInventoryResult(null)} className="h-8 px-3 text-[10px] tracking-[0.15em] uppercase text-gray-300 dark:text-gray-700 hover:text-red-500 transition-colors">{t.clear}</button>
            </div>
          </div>
          <div className="space-y-1.5">
            {inventoryResult.items.map((item, idx) => (
              <div key={idx} className="border border-gray-100 dark:border-gray-800 p-3 flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm text-gray-800 dark:text-gray-100 tracking-wider">{item.result.value}</p>
                  <p className="text-[10px] text-gray-300 dark:text-gray-700 tracking-wider mt-0.5">{new Date(item.lastScannedAt).toLocaleTimeString('ja-JP')}</p>
                </div>
                <span className="text-lg font-light text-blue-600 tracking-wider">×{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cameraOpen && <CameraScanner onResult={handleCameraResult} onClose={() => setCameraOpen(false)} />}
      {catalogOpen && <CatalogMode onClose={() => setCatalogOpen(false)} />}
    </div>
  )
}
