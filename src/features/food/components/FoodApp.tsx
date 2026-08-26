'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { IngredientInput } from './IngredientInput'
import { HouseholdSettings } from './HouseholdSettings'
import { AllergyDislikeInput } from './AllergyDislikeInput'
import { PantrySelector } from './PantrySelector'
import { ConditionSelector } from './ConditionSelector'
import { CookingTimeSelector } from './CookingTimeSelector'
import { MealResultView } from './MealResultView'
import { mockMealProvider } from '@/features/food/lib/mock-meal-provider'
import { getSeasonFromDate } from '@/features/food/lib/season'
import {
  DEFAULT_ALLERGY_PROFILE,
  DEFAULT_COOKING_PREFERENCE,
  DEFAULT_HOUSEHOLD,
  DEFAULT_PANTRY,
  loadAllergyProfile,
  loadCookingPreference,
  loadHousehold,
  loadPantry,
  saveAllergyProfile,
  saveCookingPreference,
  saveHousehold,
  savePantry,
} from '@/features/food/lib/storage'
import type {
  AllergyProfile,
  DailyCondition,
  Household,
  Ingredient,
  MealSuggestionRequest,
  MealSuggestionResponse,
  Pantry,
  Season,
} from '@/features/food/types'

type Status = 'idle' | 'loading' | 'result' | 'error'

const SEASON_LABELS: Record<Season, string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/**
 * ページ表示時点の日時を表示用に整形する（新規dependency不要の手動実装）。
 * この日時は表示のみに使用し、mockMealProviderへは渡さない
 * （献立選定ロジックは日時に依存しない）。
 *
 * 将来メモ: 献立履歴機能を実装する際は、この「画面を開いた時刻」ではなく
 * 「献立を生成した時刻」を createdAt として別途保存する設計にする予定
 * （MISSION 2.1では履歴保存・createdAtは未実装）。
 */
function formatDateTime(d: Date): string {
  const wd = WEEKDAYS[d.getDay()]
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${wd}） ${hh}:${mm}`
}

export function FoodApp() {
  const season = useMemo(() => getSeasonFromDate(new Date()), [])

  // hydration mismatchを避けるため、日時はマウント後にクライアント側だけで計算する
  const [now, setNow] = useState<string | null>(null)
  useEffect(() => {
    setNow(formatDateTime(new Date()))
  }, [])

  // 食材とその日の体調は「今日限り」の入力なので永続化しない
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [dailyCondition, setDailyCondition] = useState<DailyCondition | undefined>(undefined)

  // 変更頻度が低い設定はFOOD専用のlocalStorageへ保存する
  const [household, setHousehold] = useState<Household>(DEFAULT_HOUSEHOLD)
  const [allergyProfile, setAllergyProfile] = useState<AllergyProfile>(DEFAULT_ALLERGY_PROFILE)
  const [pantry, setPantry] = useState<Pantry>(DEFAULT_PANTRY)
  const [maxCookingMinutes, setMaxCookingMinutes] = useState<number | null>(
    DEFAULT_COOKING_PREFERENCE.maxCookingMinutes,
  )
  const [loaded, setLoaded] = useState(false)

  const [showMoreConditions, setShowMoreConditions] = useState(false)

  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<MealSuggestionResponse | null>(null)

  // 初回マウント時にのみlocalStorageから復元する（SSR中はstorage.ts側でwindowアクセスをスキップする）
  useEffect(() => {
    setHousehold(loadHousehold())
    setAllergyProfile(loadAllergyProfile())
    setPantry(loadPantry())
    setMaxCookingMinutes(loadCookingPreference().maxCookingMinutes)
    setLoaded(true)
  }, [])

  // 復元が終わってからのみ保存する（復元前にデフォルト値で上書きしてしまうのを防ぐ）
  useEffect(() => {
    if (loaded) saveHousehold(household)
  }, [household, loaded])

  useEffect(() => {
    if (loaded) saveAllergyProfile(allergyProfile)
  }, [allergyProfile, loaded])

  useEffect(() => {
    if (loaded) savePantry(pantry)
  }, [pantry, loaded])

  useEffect(() => {
    if (loaded) saveCookingPreference({ maxCookingMinutes })
  }, [maxCookingMinutes, loaded])

  const canSubmit = ingredients.length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    setStatus('loading')
    try {
      const request: MealSuggestionRequest = {
        ingredients,
        household,
        allergyProfile,
        pantry,
        dailyCondition,
        // Release 0.1では買い物条件UIを表示しない。ユーザーには選択させず固定値を渡す。
        cookingPreference: { maxCookingMinutes, shoppingMode: 'none' },
        season,
      }
      const response = await mockMealProvider.suggest(request)
      setResult(response)
      setStatus('result')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="pt-4 pb-2 space-y-5">
      <Link
        href="/"
        className="inline-block text-[10px] tracking-[0.15em] text-gray-400 dark:text-gray-600 hover:text-blue-600 uppercase transition-colors"
      >
        ← NUKITORUに戻る
      </Link>

      <div className="space-y-1">
        <h1 className="text-[11px] tracking-[0.3em] text-gray-400 dark:text-gray-600 uppercase">NUKITORU FOOD</h1>
        <p className="text-lg font-medium text-gray-900 dark:text-white">冷蔵庫にあるもので、今日の献立。</p>
        {now && (
          <p className="text-[10px] text-gray-400 dark:text-gray-600">
            {now} ｜ 季節：{SEASON_LABELS[season]}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href="/food/settings"
            className="inline-block text-[10px] tracking-[0.1em] text-gray-400 dark:text-gray-600 hover:text-blue-600 uppercase transition-colors"
          >
            家族・常備品・好みを設定 →
          </Link>
          <Link
            href="/food/stock"
            className="inline-block text-[10px] tracking-[0.1em] text-gray-400 dark:text-gray-600 hover:text-blue-600 uppercase transition-colors"
          >
            在庫を見る →
          </Link>
        </div>
      </div>

      {/* ① 今日の体調 */}
      <ConditionSelector value={dailyCondition} onChange={setDailyCondition} />

      {/* ② 食材 */}
      <IngredientInput ingredients={ingredients} onChange={setIngredients} />

      {/* ③ 調理時間 */}
      <CookingTimeSelector value={maxCookingMinutes} onChange={setMaxCookingMinutes} />

      {/* 補助条件（家族・アレルギー・苦手・常備調味料） */}
      <div className="space-y-3">
        <button
          onClick={() => setShowMoreConditions((v) => !v)}
          className="w-full h-10 border border-gray-200 dark:border-gray-800 text-[11px] tracking-[0.1em] text-gray-500 dark:text-gray-400 hover:border-blue-600 hover:text-blue-600 transition-colors"
        >
          {showMoreConditions ? '条件を閉じる' : '条件を追加する（家族・アレルギー・苦手・常備調味料）'}
        </button>

        {!showMoreConditions && allergyProfile.allergies.length > 0 && (
          <p className="text-[11px] text-red-600 dark:text-red-400">
            ⚠ アレルギー：{allergyProfile.allergies.join('、')}
          </p>
        )}

        {showMoreConditions && (
          <div className="space-y-4 border-t border-gray-100 dark:border-gray-800 pt-3">
            <HouseholdSettings value={household} onChange={setHousehold} />
            <AllergyDislikeInput value={allergyProfile} onChange={setAllergyProfile} />
            <PantrySelector value={pantry} onChange={setPantry} />
          </div>
        )}
      </div>

      {/* ④ 今日の献立を考える */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || status === 'loading'}
        className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[12px] tracking-[0.15em] uppercase font-medium transition-colors"
      >
        {status === 'loading' ? '考え中...' : '今日の献立を考える'}
      </button>

      <MealResultView result={status === 'result' ? result : null} hasIngredients={canSubmit} />

      {status === 'error' && (
        <p className="text-[12px] text-red-500 dark:text-red-400">
          献立の生成中にエラーが発生しました。入力内容はそのまま保持されています。もう一度お試しください。
        </p>
      )}
    </div>
  )
}
