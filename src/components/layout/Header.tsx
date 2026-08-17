'use client'

import { useEffect, useState } from 'react'
import { getPlan, type PlanType } from '@/lib/license'

const LANG_STORAGE_KEY = 'nukitoru_lang'

const TEXT = {
  ja: {
    pro: 'Pro',
    proMax: 'Pro Max',
    seePlans: 'プランを見る',
  },
  en: {
    pro: 'Pro',
    proMax: 'Pro Max',
    seePlans: 'View Plans',
  },
}

export function Header() {
  const [plan, setPlan] = useState<PlanType | null>(null)
  const [lang, setLang] = useState<'ja' | 'en'>('ja')

  useEffect(() => {
    getPlan().then(setPlan)
    const saved = localStorage.getItem(LANG_STORAGE_KEY)
    if (saved === 'en' || saved === 'ja') setLang(saved)
  }, [])

  const t = TEXT[lang]

  return (
    <header className="sticky top-0 z-10 border-b border-gray-100 dark:border-gray-900 bg-white dark:bg-black">
      <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <svg
            className="w-4 h-4 text-blue-600 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="2" y="2" width="7" height="7" rx="0.5" />
            <rect x="11" y="2" width="7" height="7" rx="0.5" />
            <rect x="2" y="11" width="7" height="7" rx="0.5" />
            <rect x="13" y="13" width="2" height="2" />
            <rect x="16" y="13" width="2" height="2" />
            <rect x="13" y="16" width="5" height="2" />
          </svg>
          <span className="text-[11px] font-medium tracking-[0.25em] text-gray-900 dark:text-white uppercase">
            Nukitoru
          </span>
        </div>

        {plan === null ? (
          <span className="w-16 h-4" aria-hidden="true" />
        ) : plan === 'pro_max' ? (
          <span className="text-[9px] tracking-[0.2em] text-purple-500 uppercase border border-purple-500 px-2 py-0.5">
            {t.proMax}
          </span>
        ) : plan === 'pro' ? (
          <span className="text-[9px] tracking-[0.2em] text-blue-500 uppercase border border-blue-600 px-2 py-0.5">
            {t.pro}
          </span>
        ) : (
          <a href="/upgrade" className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-500 uppercase transition-colors">
            {t.seePlans}
          </a>
        )}
      </div>
    </header>
  )
}
