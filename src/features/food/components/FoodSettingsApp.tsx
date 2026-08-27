'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { HouseholdSettings } from './HouseholdSettings'
import { AllergyDislikeInput } from './AllergyDislikeInput'
import { PantrySelector } from './PantrySelector'
import { StockCategorySelector } from './StockCategorySelector'
import { FoodPreferencesEditor, CUISINE_LABELS, SPICE_LEVELS } from './FoodPreferencesEditor'
import { REGULAR_FOODS_MASTER, FROZEN_FOODS_MASTER, PANTRY_FOODS_MASTER } from '@/features/food/lib/stock-master-data'
import {
  DEFAULT_ALLERGY_PROFILE,
  DEFAULT_FOOD_PREFERENCES,
  DEFAULT_FROZEN_FOODS,
  DEFAULT_HOUSEHOLD,
  DEFAULT_PANTRY,
  DEFAULT_PANTRY_FOODS,
  DEFAULT_REGULAR_FOODS,
  loadAllergyProfile,
  loadFoodPreferences,
  loadFrozenFoods,
  loadHousehold,
  loadPantry,
  loadPantryFoods,
  loadRegularFoods,
  saveAllergyProfile,
  saveFoodPreferences,
  saveFrozenFoods,
  saveHousehold,
  savePantry,
  savePantryFoods,
  saveRegularFoods,
} from '@/features/food/lib/storage'
import type { AllergyProfile, FoodPreferences, Household, Pantry } from '@/features/food/types'

interface AccordionSectionProps {
  number: number
  title: string
  summary?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

/**
 * 開閉はCSSの表示切り替え（hidden）のみで行い、子要素は常にマウントし続ける。
 * こうすることで、折りたたんでも入力途中の文字列やコンポーネント内stateが消えない。
 */
function AccordionSection({ number, title, summary, open, onToggle, children }: AccordionSectionProps) {
  return (
    <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <span className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">
          {number}. {title}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {!open && summary && (
            <span className="text-[10px] normal-case tracking-normal text-gray-500 dark:text-gray-400">{summary}</span>
          )}
          <span className="text-gray-400 dark:text-gray-600">{open ? '−' : '+'}</span>
        </span>
      </button>
      <div className={open ? 'mt-3 space-y-4' : 'hidden'}>{children}</div>
    </div>
  )
}

export function FoodSettingsApp() {
  const [household, setHousehold] = useState<Household>(DEFAULT_HOUSEHOLD)
  const [allergyProfile, setAllergyProfile] = useState<AllergyProfile>(DEFAULT_ALLERGY_PROFILE)
  const [pantry, setPantry] = useState<Pantry>(DEFAULT_PANTRY)
  const [regularFoods, setRegularFoods] = useState<string[]>(DEFAULT_REGULAR_FOODS)
  const [frozenFoods, setFrozenFoods] = useState<string[]>(DEFAULT_FROZEN_FOODS)
  const [pantryFoods, setPantryFoods] = useState<string[]>(DEFAULT_PANTRY_FOODS)
  const [preferences, setPreferences] = useState<FoodPreferences>(DEFAULT_FOOD_PREFERENCES)
  const [loaded, setLoaded] = useState(false)

  const [openSections, setOpenSections] = useState<Record<number, boolean>>({
    1: true,
    2: false,
    3: false,
    4: false,
    5: false,
    6: false,
  })
  const toggleSection = (n: number) => setOpenSections((prev) => ({ ...prev, [n]: !prev[n] }))

  // 初回マウント時にのみlocalStorageから復元する（SSR中はstorage.ts側でwindowアクセスをスキップする）
  useEffect(() => {
    setHousehold(loadHousehold())
    setAllergyProfile(loadAllergyProfile())
    setPantry(loadPantry())
    setRegularFoods(loadRegularFoods())
    setFrozenFoods(loadFrozenFoods())
    setPantryFoods(loadPantryFoods())
    setPreferences(loadFoodPreferences())
    setLoaded(true)
  }, [])

  // タップ・入力したその場でFOOD専用localStorageへ保存する（復元前にデフォルト値で上書きしない）
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
    if (loaded) saveRegularFoods(regularFoods)
  }, [regularFoods, loaded])

  useEffect(() => {
    if (loaded) saveFrozenFoods(frozenFoods)
  }, [frozenFoods, loaded])

  useEffect(() => {
    if (loaded) savePantryFoods(pantryFoods)
  }, [pantryFoods, loaded])

  useEffect(() => {
    if (loaded) saveFoodPreferences(preferences)
  }, [preferences, loaded])

  const countSummary = (count: number) => (count > 0 ? `${count}件設定済み` : undefined)

  const preferencesSummary = (() => {
    const cuisines = preferences.favoriteCuisines.map((c) => CUISINE_LABELS[c]).join('・')
    const spice = preferences.spiceLevel
      ? SPICE_LEVELS.find((s) => s.value === preferences.spiceLevel)?.label
      : undefined
    const parts = [cuisines, spice].filter((s): s is string => !!s)
    return parts.length > 0 ? parts.join(' / ') : undefined
  })()

  return (
    <div className="pt-4 pb-2 space-y-6">
      <Link
        href="/food"
        className="inline-block text-[10px] tracking-[0.15em] text-gray-400 dark:text-gray-600 hover:text-blue-600 uppercase transition-colors"
      >
        ← NUKITORU FOODに戻る
      </Link>

      <div className="space-y-1">
        <h1 className="text-[11px] tracking-[0.3em] text-gray-400 dark:text-gray-600 uppercase">家の設定</h1>
        <p className="text-lg font-medium text-gray-900 dark:text-white">あなたの家の基本設定</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">すべて任意です。あとから変更できます。</p>
      </div>

      <AccordionSection number={1} title="家族・安全" open={openSections[1]} onToggle={() => toggleSection(1)}>
        <HouseholdSettings value={household} onChange={setHousehold} />
        <AllergyDislikeInput value={allergyProfile} onChange={setAllergyProfile} />
      </AccordionSection>

      <AccordionSection
        number={2}
        title="常備調味料"
        summary={countSummary(pantry.staples.length)}
        open={openSections[2]}
        onToggle={() => toggleSection(2)}
      >
        <PantrySelector value={pantry} onChange={setPantry} />
      </AccordionSection>

      <AccordionSection
        number={3}
        title="常備食材"
        summary={countSummary(regularFoods.length)}
        open={openSections[3]}
        onToggle={() => toggleSection(3)}
      >
        <StockCategorySelector
          title="常備食材"
          description="いつも家にある食材を登録しておけます。現在のバージョンでは献立の内容には反映されません。"
          groups={REGULAR_FOODS_MASTER}
          selectedItems={regularFoods}
          onChange={setRegularFoods}
        />
      </AccordionSection>

      <AccordionSection
        number={4}
        title="冷凍庫"
        summary={countSummary(frozenFoods.length)}
        open={openSections[4]}
        onToggle={() => toggleSection(4)}
      >
        <StockCategorySelector
          title="冷凍庫"
          groups={FROZEN_FOODS_MASTER}
          selectedItems={frozenFoods}
          onChange={setFrozenFoods}
        />
      </AccordionSection>

      <AccordionSection
        number={5}
        title="保存食品"
        summary={countSummary(pantryFoods.length)}
        open={openSections[5]}
        onToggle={() => toggleSection(5)}
      >
        <StockCategorySelector
          title="保存食品"
          groups={PANTRY_FOODS_MASTER}
          selectedItems={pantryFoods}
          onChange={setPantryFoods}
        />
      </AccordionSection>

      <AccordionSection
        number={6}
        title="食の好み"
        summary={preferencesSummary}
        open={openSections[6]}
        onToggle={() => toggleSection(6)}
      >
        <FoodPreferencesEditor value={preferences} onChange={setPreferences} />
      </AccordionSection>

      <div className="pt-2">
        <Link
          href="/food"
          className="inline-flex items-center justify-center w-full h-11 border border-gray-200 dark:border-gray-800 text-[11px] tracking-[0.15em] uppercase text-gray-500 dark:text-gray-400 hover:border-blue-600 hover:text-blue-600 transition-colors"
        >
          NUKITORU FOODに戻る
        </Link>
      </div>
    </div>
  )
}
