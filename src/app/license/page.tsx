'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSavedLicenseKey, saveLicenseKey, clearLicenseKey, checkIsPro, getHistorySyncEnabled, setHistorySyncEnabled } from '@/lib/license'

export default function LicensePage() {
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [currentKey, setCurrentKey] = useState<string | null>(null)
  const [isPro, setIsPro] = useState(false)
  const [syncEnabled, setSyncEnabled] = useState(false)

  useEffect(() => {
    const key = getSavedLicenseKey()
    setCurrentKey(key)
    checkIsPro().then(setIsPro)
    setSyncEnabled(getHistorySyncEnabled())
  }, [])

  const handleToggleSync = () => {
    const next = !syncEnabled
    setHistorySyncEnabled(next)
    setSyncEnabled(next)
  }

  const handleActivate = async () => {
    const trimmed = input.trim()
    if (!trimmed) return
    setStatus('checking')
    try {
      const res = await fetch('https://nukitoru-api.ume0117.workers.dev/verify-license?key=' + encodeURIComponent(trimmed))
      const data = await res.json()
      if (data.valid) {
        saveLicenseKey(trimmed)
        setCurrentKey(trimmed)
        setIsPro(true)
        setStatus('valid')
      } else {
        setStatus('invalid')
      }
    } catch {
      setStatus('invalid')
    }
  }

  const handleRemove = () => {
    clearLicenseKey()
    setCurrentKey(null)
    setIsPro(false)
    setStatus('idle')
    setInput('')
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-[10px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase hover:text-blue-600 transition-colors">← NUKITORU</Link>
        </div>

        <h1 className="text-[13px] tracking-[0.3em] text-gray-900 dark:text-white uppercase font-medium mb-8">ライセンスキー</h1>

        {currentKey ? (
          <div className="space-y-4">
            <div className="border border-blue-600 p-4 space-y-2">
              <p className="text-[9px] tracking-[0.15em] text-blue-500 uppercase">現在のステータス</p>
              <p className="text-[13px] text-gray-900 dark:text-white font-medium">{isPro ? 'PRO 有効' : 'キーは保存されていますが無効です'}</p>
              <p className="text-[10px] font-mono text-gray-500 break-all">{currentKey}</p>
            </div>

            {isPro && (
              <div className="border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-gray-900 dark:text-white font-medium mb-1">検索履歴を同期する</p>
                  <p className="text-[10px] text-gray-500 leading-relaxed">オンにすると、検索履歴をこのライセンスキーに紐付けてサーバーに保存し、別のデバイスでも同じ履歴を見られるようになります。</p>
                </div>
                <button onClick={handleToggleSync} className={`shrink-0 ml-4 w-11 h-6 rounded-full transition-colors relative ${syncEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${syncEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            )}
            <button onClick={handleRemove} className="w-full h-10 border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-500 text-[10px] tracking-[0.15em] uppercase hover:border-red-500 hover:text-red-500 transition-colors">
              このキーを削除
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[11px] text-gray-500 leading-relaxed">
              決済完了時に発行されたライセンスキーを入力すると、このブラウザでPRO機能が有効になります。
            </p>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="NKTR-XXXXXXXXXXXXXXXXXXXX"
              className="w-full h-11 px-3 text-sm font-mono border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none focus:border-blue-600 transition-colors"
            />
            <button
              onClick={handleActivate}
              disabled={status === 'checking' || !input.trim()}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[11px] tracking-[0.2em] uppercase transition-colors"
            >
              {status === 'checking' ? '確認中...' : '有効化する'}
            </button>
            {status === 'invalid' && (
              <p className="text-[10px] text-red-500 text-center">このキーは無効です。キーをご確認いただくか、サポートまでご連絡ください。</p>
            )}
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
          <Link href="/upgrade" className="text-[10px] tracking-[0.15em] text-blue-600 uppercase">ライセンスキーをお持ちでない方はこちら →</Link>
        </div>
      </div>
    </div>
  )
}
