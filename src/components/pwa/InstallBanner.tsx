'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'

type BannerMode = 'ios-safari' | 'ios-chrome' | 'android' | null

export function InstallBanner() {
  const [mode, setMode] = useState<BannerMode>(null)
  const [show, setShow] = useState(false)
  const [urlCopied, setUrlCopied] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    if (localStorage.getItem('nukitoru-pwa-dismissed')) return
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if ((navigator as any).standalone === true) return

    const ua = navigator.userAgent

    // PC（デスクトップ）では表示しない・モバイルのみ
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua)
    if (!isMobile) return

    const isIOS = /iPhone|iPad|iPod/.test(ua)

    if (isIOS) {
      // iPhone Chrome / Firefox → Safari への誘導
      // Brave は userAgent では検出不可なので navigator.brave で判定
      const isBrave = !!(navigator as any).brave
      const isOtherBrowser = /CriOS|FxiOS|OPiOS|Mercury/.test(ua) || isBrave
      if (isOtherBrowser) {
        setMode('ios-chrome')
        setTimeout(() => setShow(true), 2000)
        return
      }

      // iPhone Safari → ホーム画面追加の案内
      const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua)
      if (isSafari) {
        setMode('ios-safari')
        setTimeout(() => setShow(true), 3000)
        return
      }
    }

    // Android / Desktop Chrome
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setMode('android')
      setTimeout(() => setShow(true), 3000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem('nukitoru-pwa-dismissed', '1')
  }

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
      localStorage.setItem('nukitoru-pwa-dismissed', '1')
    }
    setDeferredPrompt(null)
  }

  const handleCopyURL = async () => {
    const url = 'https://nukitoru.vercel.app'
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setUrlCopied(true)
    setTimeout(() => setUrlCopied(false), 3000)
  }

  if (!show || !mode) return null

  return (
    <div
      role="banner"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-white dark:bg-gray-900',
        'border-t border-gray-200 dark:border-gray-800',
        'shadow-[0_-4px_24px_rgba(0,0,0,0.08)]',
      )}
    >
      <div className="max-w-3xl mx-auto px-4 py-3">

        {/* ── iPhone Chrome: Safari への誘導 ── */}
        {mode === 'ios-chrome' && (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                ホーム画面に追加できます
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Safari でこのページを開いてください。
                <br />
                下の「URLをコピー」→ Safari に貼り付けて開く
              </p>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleCopyURL}
                  className={cn(
                    'h-8 px-3 rounded-lg text-xs font-semibold transition-colors',
                    urlCopied
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                      : 'bg-blue-600 text-white hover:bg-blue-700',
                  )}
                >
                  {urlCopied ? '✓ コピーしました' : 'URLをコピー'}
                </button>
                <button
                  onClick={handleDismiss}
                  className="h-8 px-3 rounded-lg text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              aria-label="閉じる"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* ── iPhone Safari: ホーム画面追加の案内 ── */}
        {mode === 'ios-safari' && (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                <rect x="2" y="2" width="7" height="7" rx="1" />
                <rect x="11" y="2" width="7" height="7" rx="1" />
                <rect x="2" y="11" width="7" height="7" rx="1" />
                <rect x="13" y="13" width="2" height="2" />
                <rect x="16" y="13" width="2" height="2" />
                <rect x="13" y="16" width="5" height="2" />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                ホーム画面に追加できます
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                下の <strong>「共有」</strong> ボタン →
                <strong>「ホーム画面に追加」</strong> でアプリのように使えます
              </p>
            </div>

            <button
              onClick={handleDismiss}
              aria-label="閉じる"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* ── Android / Desktop Chrome: インストール ── */}
        {mode === 'android' && (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                <rect x="2" y="2" width="7" height="7" rx="1" />
                <rect x="11" y="2" width="7" height="7" rx="1" />
                <rect x="2" y="11" width="7" height="7" rx="1" />
                <rect x="13" y="13" width="2" height="2" />
                <rect x="16" y="13" width="2" height="2" />
                <rect x="13" y="16" width="5" height="2" />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                ホーム画面に追加できます
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                インストールするとアプリとして起動できます
              </p>
            </div>

            <div className="flex gap-2 shrink-0 pt-0.5">
              {deferredPrompt && (
                <button
                  onClick={handleInstall}
                  className="h-8 px-3 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  追加する
                </button>
              )}
              <button
                onClick={handleDismiss}
                aria-label="閉じる"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
