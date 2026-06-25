'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'

type Platform = 'ios' | 'android' | null

export function InstallBanner() {
  const [show, setShow] = useState(false)
  const [platform, setPlatform] = useState<Platform>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    // すでに非表示にした場合はスキップ
    if (localStorage.getItem('nukitoru-pwa-dismissed')) return

    // すでにスタンドアロン（インストール済み）ならスキップ
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if ((navigator as any).standalone === true) return

    const ua = navigator.userAgent

    // iOS Safari 判定
    const isIOS = /iPhone|iPad|iPod/.test(ua)
    const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua)

    if (isIOS && isSafari) {
      setPlatform('ios')
      setTimeout(() => setShow(true), 3000)
      return
    }

    // Android Chrome / Desktop Chrome: beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setPlatform('android')
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

  if (!show || !platform) return null

  return (
    <div
      role="banner"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-white dark:bg-gray-900',
        'border-t border-gray-200 dark:border-gray-800',
        'shadow-[0_-4px_24px_rgba(0,0,0,0.08)]',
        'animate-in slide-in-from-bottom duration-300',
      )}
    >
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-start gap-3">
        {/* アイコン */}
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

        {/* テキスト */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            ホーム画面に追加できます
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {platform === 'ios'
              ? '下の「共有」ボタン →「ホーム画面に追加」でアプリのように使えます'
              : 'インストールするとアプリとして起動できます'}
          </p>
        </div>

        {/* アクション */}
        <div className="flex gap-2 shrink-0 pt-0.5">
          {platform === 'android' && deferredPrompt && (
            <button
              onClick={handleInstall}
              className="h-8 px-3 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors"
            >
              追加する
            </button>
          )}
          <button
            onClick={handleDismiss}
            aria-label="閉じる"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* iOS 専用: 共有ボタンの矢印 */}
      {platform === 'ios' && (
        <div className="flex justify-center pb-2">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 11l3-3m0 0l3 3m-3-3v8M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            Safari 下部の「共有」ボタンから追加できます
          </div>
        </div>
      )}
    </div>
  )
}
