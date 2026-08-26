'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const LANG_STORAGE_KEY = 'nukitoru_lang'

const TEXT = {
  ja: {
    tagline: '面倒を、抜き取る。',
    foodTitle: 'NUKITORU FOOD',
    foodDesc: '家にあるもので、今日どうする？',
    foodCta: 'FOODを開く',
    scanTitle: 'NUKITORU SCAN',
    scanDesc: 'QR・JAN・PDFをすばやく読み取る',
    scanCta: 'SCANを開く',
    comingSoonTitle: 'COMING SOON',
    comingSoonDesc: '次のNUKITORUを開発中',
  },
  en: {
    tagline: 'Cut the hassle out.',
    foodTitle: 'NUKITORU FOOD',
    foodDesc: 'What can we make with what you have?',
    foodCta: 'Open FOOD',
    scanTitle: 'NUKITORU SCAN',
    scanDesc: 'Quickly scan QR, JAN, and PDF files',
    scanCta: 'Open SCAN',
    comingSoonTitle: 'COMING SOON',
    comingSoonDesc: 'The next NUKITORU is in development',
  },
}

export function HomeLauncher() {
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

  return (
    <div className="pt-6 pb-4 space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-medium text-gray-900 dark:text-white">NUKITORU</h1>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{t.tagline}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => switchLang('ja')}
            className={`text-[9px] tracking-[0.1em] px-2 h-6 border transition-colors ${lang === 'ja' ? 'border-blue-600 text-blue-600' : 'border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600'}`}
          >
            JA
          </button>
          <button
            onClick={() => switchLang('en')}
            className={`text-[9px] tracking-[0.1em] px-2 h-6 border transition-colors ${lang === 'en' ? 'border-blue-600 text-blue-600' : 'border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600'}`}
          >
            EN
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <Link
          href="/food"
          className="block border border-gray-200 dark:border-gray-800 hover:border-blue-600 p-4 transition-colors"
        >
          <p className="text-[11px] tracking-[0.2em] text-gray-900 dark:text-white uppercase font-medium mb-1.5">
            {t.foodTitle}
          </p>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-3">{t.foodDesc}</p>
          <span className="inline-flex items-center justify-center h-10 px-4 border border-gray-400 dark:border-gray-600 text-[10px] tracking-[0.15em] uppercase text-gray-500 dark:text-gray-400">
            {t.foodCta}
          </span>
        </Link>

        <Link
          href="/scan"
          className="block border border-gray-200 dark:border-gray-800 hover:border-blue-600 p-4 transition-colors"
        >
          <p className="text-[11px] tracking-[0.2em] text-gray-900 dark:text-white uppercase font-medium mb-1.5">
            {t.scanTitle}
          </p>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-3">{t.scanDesc}</p>
          <span className="inline-flex items-center justify-center h-10 px-4 border border-gray-400 dark:border-gray-600 text-[10px] tracking-[0.15em] uppercase text-gray-500 dark:text-gray-400">
            {t.scanCta}
          </span>
        </Link>

        <div className="border border-gray-100 dark:border-gray-900 p-4 cursor-default">
          <p className="text-[11px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase font-medium mb-1.5">
            {t.comingSoonTitle}
          </p>
          <p className="text-[12px] text-gray-400 dark:text-gray-600">{t.comingSoonDesc}</p>
        </div>
      </div>
    </div>
  )
}
