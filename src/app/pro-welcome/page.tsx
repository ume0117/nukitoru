'use client'

import { useEffect, useState } from 'react'

export default function ProWelcomePage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [licenseKey, setLicenseKey] = useState('')
  const [email, setEmail] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')

    if (!sessionId) {
      setStatus('error')
      return
    }

    fetch('https://nukitoru-api.ume0117.workers.dev/session-license?session_id=' + sessionId)
      .then(function (res) { return res.json() })
      .then(function (data) {
        if (data.licenseKey) {
          setLicenseKey(data.licenseKey)
          setEmail(data.email || '')
          localStorage.setItem('nukitoru_license_key', data.licenseKey)
          setStatus('success')
        } else {
          setStatus('error')
        }
      })
      .catch(function () {
        setStatus('error')
      })
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(licenseKey)
    setCopied(true)
    setTimeout(function () { setCopied(false) }, 2000)
  }

  return (
    <div className="min-h-screen bg-black text-gray-100 flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {status === 'loading' && (
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase text-gray-500 mb-4">
              ライセンスを発行しています...
            </p>
            <div className="w-6 h-6 border border-gray-600 border-t-blue-500 rounded-full animate-spin mx-auto" />
          </div>
        )}

        {status === 'success' && (
          <div>
            <p className="text-[11px] tracking-[0.3em] uppercase text-blue-500 mb-2">
              NUKITORU PRO
            </p>
            <h1 className="text-xl font-medium mb-6 tracking-wide">
              お申し込みありがとうございます
            </h1>
            {email && (
              <p className="text-[11px] text-gray-500 mb-8">{email}</p>
            )}
            <p className="text-[11px] tracking-[0.15em] uppercase text-gray-500 mb-3">
              ライセンスキー
            </p>
            <div className="border border-gray-700 px-4 py-3 mb-4 font-mono text-sm tracking-wider break-all">
              {licenseKey}
            </div>
            <button
              onClick={handleCopy}
              className="w-full h-11 border border-gray-600 hover:border-gray-400 text-[11px] tracking-[0.2em] uppercase transition-colors mb-8"
            >
              {copied ? 'コピーしました' : 'キーをコピー'}
            </button>
            <p className="text-[11px] text-gray-500 leading-relaxed mb-8">
              このキーはこのブラウザに自動保存され、Pro機能が有効になりました。
              <br />
              他のデバイスで使う場合は、このキーを控えて入力画面に貼り付けてください。
            </p>
            <a href="/" className="inline-block h-11 px-8 leading-[44px] border border-blue-600 text-blue-500 hover:bg-blue-600 hover:text-white text-[11px] tracking-[0.2em] uppercase transition-colors">
              NUKITORUを使う
            </a>
          </div>
        )}

        {status === 'error' && (
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase text-red-500 mb-4">
              ライセンスの取得に失敗しました
            </p>
            <p className="text-[11px] text-gray-500 leading-relaxed mb-8">
              決済は完了している可能性があります。お手数ですが、
              サポートまでメールアドレスをご連絡ください。
            </p>
            <a href="/" className="inline-block h-11 px-8 leading-[44px] border border-gray-600 hover:border-gray-400 text-[11px] tracking-[0.2em] uppercase transition-colors">
              トップに戻る
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
