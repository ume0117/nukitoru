'use client'

// ============================================================
// WorldFoodDecideApp.tsx
//
// MISSION 2.40 / 2.40A — 「今日どうする？」から始まる Food Decision 体験。
//
// 本筋（MISSION 2.40A）:
//   「NUKITORU を見れば家にある食材が分かる。その家にあるもので何が作れるか分かる。」
//   → 既存の永続 Stock を主データにする。登録済みユーザーは食材を再入力しない。
//
//   Home（家にあるもの N品 / 少ない M品 を表示）
//     ├─ PRIMARY: 🧊 家にあるもので作る  → 既存 Stock → そのまま Forward Matching
//     └─ SECONDARY: 🔎 料理名から探す    → Recipe 選択 → Reverse Matching
//        → Recipe Detail → 料理をはじめる → Cooking Mode → 完成
//
// - MISSION 2.35 の実 Recipe Knowledge（tori-teriyaki / buta-shogayaki）のみ表示。
// - MISSION 2.39 Matching Truth をそのまま presentation。
// - 既存 /food（FoodApp）・Stock schema・storage schema を一切変更しない（読むだけ）。
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type {
  FoodStockIngredientSnapshot,
  MealOccasion,
  NukitoruPresentation,
  SourceRecipeKnowledge,
  StockStatusEntry,
} from '@/features/food/types'
import {
  SOURCE_RECIPE_KNOWLEDGE_FIXTURES,
  NUKITORU_PRESENTATION_FIXTURES,
} from '@/features/food/lib/world-food-fixtures'
import { getWorldRecipeIdentityById } from '@/features/food/lib/world-food-knowledge'
import {
  matchRecipesFromStock,
  evaluateRecipeAgainstStock,
  projectStockToSnapshots,
  projectPersistedStockToFoodSnapshots,
  summarizeStockSnapshots,
  type RawStockItemInput,
} from '@/features/food/lib/food-matching'
import {
  toForwardMatchListPresentation,
  toRecipeMatchPresentation,
  toRecipeDetailPresentation,
  groupIngredientsByLabel,
  availabilityLabelJa,
  headlineJa,
  RANKING_MEANING_TEXT,
  AVAILABILITY_LABEL_ORDER,
} from '@/features/food/lib/food-match-presentation'
import { ALL_MEAL_OCCASIONS, MEAL_OCCASION_JA_LABELS } from '@/features/food/lib/meal-occasion'
import {
  loadPantry,
  loadRegularFoods,
  loadFrozenFoods,
  loadPantryFoods,
  loadStockStatus,
} from '@/features/food/lib/storage'
import { CookingModeView } from './CookingModeView'

type Screen = 'home' | 'forward' | 'reverse' | 'detail' | 'cook'

const REAL_RECIPES = SOURCE_RECIPE_KNOWLEDGE_FIXTURES
const presentationFor = (id: string): NukitoruPresentation | undefined =>
  NUKITORU_PRESENTATION_FIXTURES.find((p) => p.canonicalRecipeId === id)

/** 補助入力（「今だけ追加」）用。Primary flow ではない */
function parseExtra(raw: string): RawStockItemInput[] {
  return raw
    .split(/[\n,、]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((name, i) => ({
      stockItemKey: `extra-${i}`,
      sourceName: name,
      availabilityStatus: 'available' as const,
      language: 'ja' as const,
    }))
}

export function WorldFoodDecideApp() {
  const [screen, setScreen] = useState<Screen>('home')
  const [occasion, setOccasion] = useState<MealOccasion | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [extraText, setExtraText] = useState('')
  const [showExtra, setShowExtra] = useState(false)

  // 既存の永続 Stock を読む（read-only。localStorage への書き込みなし）
  const [persistedItemNames, setPersistedItemNames] = useState<string[]>([])
  const [statusMap, setStatusMap] = useState<Record<string, StockStatusEntry>>({})
  const [stockLoaded, setStockLoaded] = useState(false)

  useEffect(() => {
    const staples = loadPantry().staples
    const names = [
      ...staples,
      ...loadRegularFoods(),
      ...loadFrozenFoods(),
      ...loadPantryFoods(),
    ]
    const map = loadStockStatus()
    setPersistedItemNames([...names, ...Object.keys(map)])
    setStatusMap(map)
    setStockLoaded(true)
  }, [])

  const persistedSnapshots = useMemo(
    () => projectPersistedStockToFoodSnapshots({ itemNames: persistedItemNames, statusMap }),
    [persistedItemNames, statusMap],
  )
  const hasPersistedStock = persistedSnapshots.length > 0
  const stockSummary = useMemo(() => summarizeStockSnapshots(persistedSnapshots), [persistedSnapshots])

  // Forward で使う在庫 = 既存 Stock（主）+ 「今だけ追加」（補助・任意）
  const stockSnapshots: FoodStockIngredientSnapshot[] = useMemo(
    () => [...persistedSnapshots, ...projectStockToSnapshots(parseExtra(extraText))],
    [persistedSnapshots, extraText],
  )

  const forwardList = useMemo(() => {
    const results = matchRecipesFromStock(stockSnapshots, REAL_RECIPES, {
      ...(occasion ? { occasionFilter: occasion } : {}),
    })
    return toForwardMatchListPresentation(results)
  }, [stockSnapshots, occasion])

  const selectedKnowledge = REAL_RECIPES.find((r) => r.canonicalRecipeId === selectedId)
  const detail = selectedKnowledge
    ? toRecipeDetailPresentation({
        knowledge: selectedKnowledge,
        presentation: presentationFor(selectedKnowledge.canonicalRecipeId),
        matchResult: evaluateRecipeAgainstStock(selectedKnowledge, stockSnapshots),
        identity: getWorldRecipeIdentityById(selectedKnowledge.canonicalRecipeId),
      })
    : null
  const cookPresentation = selectedKnowledge
    ? presentationFor(selectedKnowledge.canonicalRecipeId)
    : undefined

  if (screen === 'cook' && detail && cookPresentation) {
    return (
      <CookingModeView
        presentation={cookPresentation}
        recipeName={detail.recipeName}
        onExit={() => setScreen('detail')}
      />
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      {screen === 'home' && (
        <>
          <h1 className="text-xl font-bold">今日、どうする？</h1>

          {/* NUKITORU が把握している家の食材（実データからのみ） */}
          {stockLoaded && hasPersistedStock && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              家にあるもの <strong>{stockSummary.availableCount}</strong> 品
              {stockSummary.lowCount > 0 && (
                <> ・ 少ないもの <strong>{stockSummary.lowCount}</strong> 品</>
              )}
              {stockSummary.unavailableCount > 0 && (
                <> ・ 切らしているもの <strong>{stockSummary.unavailableCount}</strong> 品</>
              )}
            </p>
          )}

          {/* PRIMARY */}
          {stockLoaded && !hasPersistedStock ? (
            <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-5 space-y-3">
              <p className="text-base font-semibold">まず、家にある食材を登録しましょう</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                登録すると、次からは食材を入力せずに「家にあるもので作る」が使えます。
              </p>
              <Link
                href="/food/stock"
                className="block w-full min-h-[56px] rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-black text-center leading-[56px] font-bold"
              >
                家の食材を登録する
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setScreen('forward')}
              disabled={!stockLoaded}
              className="w-full min-h-[88px] rounded-xl bg-gray-900 text-white dark:bg-gray-100 dark:text-black text-left px-6 text-xl font-bold disabled:opacity-40"
            >
              🧊 家にあるもので作る
              <span className="block text-sm font-normal mt-1 opacity-80">
                いま家にあるものから、作れる料理を見る
              </span>
            </button>
          )}

          {/* SECONDARY */}
          <div className="pt-1">
            <p className="text-xs text-gray-400 dark:text-gray-600 mb-1.5">作りたい料理が決まっていますか？</p>
            <button
              type="button"
              onClick={() => setScreen('reverse')}
              className="w-full min-h-[52px] rounded-lg border border-gray-300 dark:border-gray-700 text-left px-4 text-sm font-medium"
            >
              🔎 料理名から探す
            </button>
          </div>

          {/* Occasion filter（Primary flow の filter） */}
          <div>
            <p className="text-[10px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase mb-2">いつの食事？（任意）</p>
            <div className="grid grid-cols-3 gap-1.5">
              {ALL_MEAL_OCCASIONS.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOccasion(occasion === o ? null : o)}
                  className={`min-h-[48px] rounded border text-sm ${
                    occasion === o
                      ? 'border-gray-900 dark:border-gray-100 font-semibold'
                      : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {MEAL_OCCASION_JA_LABELS[o]}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-600">
            <Link href="/food/stock" className="underline">家の食材を見る・在庫を更新する</Link> ・{' '}
            <Link href="/food/settings" className="underline">設定</Link>
          </p>
        </>
      )}

      {screen === 'forward' && (
        <>
          <BackBar label="今日、どうする？" onBack={() => setScreen('home')} />
          <h2 className="text-lg font-bold">家にあるもので作る</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            家にあるもの {stockSummary.availableCount} 品
            {stockSummary.lowCount > 0 && <> ・ 少ないもの {stockSummary.lowCount} 品</>}
            から見ています。
          </p>
          {occasion && (
            <p className="text-xs text-gray-400 dark:text-gray-600">
              {MEAL_OCCASION_JA_LABELS[occasion]}向けの明示情報がある料理だけを表示中
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-600">{RANKING_MEANING_TEXT}</p>

          {forwardList.items.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{forwardList.emptyStateText}</p>
          ) : (
            <ul className="space-y-2">
              {forwardList.items.map((item) => (
                <li key={item.canonicalRecipeId}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(item.canonicalRecipeId)
                      setScreen('detail')
                    }}
                    className="w-full text-left rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-3"
                  >
                    <span className="font-semibold">{item.recipeName}</span>
                    <span className="block text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {headlineJa(item.headline)}
                    </span>
                    <span className="block text-xs text-gray-400 dark:text-gray-600 mt-1">
                      家にある {item.atHomeCount} ・ 少ない {item.lowCount} ・ 足りない {item.missingCount}
                      {item.needsCheckCount > 0 ? ` ・ 確認が必要 ${item.needsCheckCount}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* 補助: 今だけ追加（Primary ではない） */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-900">
            {showExtra ? (
              <textarea
                value={extraText}
                onChange={(e) => setExtraText(e.target.value)}
                placeholder="今日だけ使う、まだ登録していない食材（例: バジル）"
                rows={2}
                className="w-full rounded border border-gray-200 dark:border-gray-800 bg-transparent p-2 text-sm"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowExtra(true)}
                className="min-h-[44px] text-xs text-gray-400 dark:text-gray-600 underline"
              >
                ＋ まだ登録していない食材を今だけ追加
              </button>
            )}
          </div>
        </>
      )}

      {screen === 'reverse' && (
        <>
          <BackBar label="今日、どうする？" onBack={() => setScreen('home')} />
          <h2 className="text-lg font-bold">料理名から探す</h2>
          <p className="text-xs text-gray-400 dark:text-gray-600">
            現在登録されている料理（{REAL_RECIPES.length} 品）から選びます。
          </p>
          <ul className="space-y-2">
            {REAL_RECIPES.map((r) => (
              <li key={r.canonicalRecipeId}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(r.canonicalRecipeId)
                    setScreen('detail')
                  }}
                  className="w-full text-left rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-3 font-semibold"
                >
                  {r.sourceRecipeName}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {screen === 'detail' && detail && selectedKnowledge && (
        <>
          <BackBar label="戻る" onBack={() => setScreen('forward')} />
          <h2 className="text-xl font-bold">{detail.recipeName}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {detail.originCountry ? `${detail.originCountry} ・ ` : ''}
            {detail.mealOccasionLabels.join(' / ')}
            {detail.servingsDisplayText ? ` ・ ${detail.servingsDisplayText}` : ''}
          </p>

          <MatchSection knowledge={selectedKnowledge} stock={stockSnapshots} />

          {detail.preCookPreparation.length > 0 && (
            <Section title="事前準備">
              <ol className="list-decimal list-inside space-y-1 text-sm">
                {detail.preCookPreparation.map((t, i) => <li key={i}>{t}</li>)}
              </ol>
            </Section>
          )}
          {detail.preparation.length > 0 && (
            <Section title="下準備">
              <ol className="list-decimal list-inside space-y-1 text-sm">
                {detail.preparation.map((t, i) => <li key={i}>{t}</li>)}
              </ol>
            </Section>
          )}
          <Section title="作り方">
            <ol className="space-y-2 text-sm">
              {detail.steps.map((s) => (
                <li key={s.displayNumber}>
                  <span className="font-semibold">{s.displayNumber}. </span>
                  {s.heatAction ? `🔥${s.heatAction} ` : ''}
                  {s.shortInstruction || s.title}
                  {s.durationDisplay ? `（${s.durationDisplay}）` : ''}
                </li>
              ))}
            </ol>
          </Section>

          <p className="text-xs text-gray-400 dark:text-gray-600">
            出典: {detail.evidence.evidenceSourceId}
            {detail.evidence.imported ? '（Import）' : ''}
          </p>

          {cookPresentation && (
            <button
              type="button"
              onClick={() => setScreen('cook')}
              className="w-full min-h-[64px] rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-black text-lg font-bold"
            >
              料理をはじめる
            </button>
          )}
        </>
      )}
    </div>
  )
}

function BackBar({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="min-h-[44px] text-sm text-gray-500 dark:text-gray-400">
      ← {label}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">{title}</p>
      {children}
    </div>
  )
}

function MatchSection({
  knowledge,
  stock,
}: {
  knowledge: SourceRecipeKnowledge
  stock: FoodStockIngredientSnapshot[]
}) {
  const pres = toRecipeMatchPresentation(evaluateRecipeAgainstStock(knowledge, stock))
  const groups = groupIngredientsByLabel(pres)
  return (
    <Section title="材料と在庫">
      <p className="text-sm">{headlineJa(pres.headline)}</p>
      {AVAILABILITY_LABEL_ORDER.map((label) =>
        groups[label].length > 0 ? (
          <div key={label} className="text-sm">
            <span className="text-gray-500 dark:text-gray-400">{availabilityLabelJa(label)}：</span>
            {groups[label]
              .map((g) => `${g.sourceIngredientName}${g.quantityDisplayText ? ` ${g.quantityDisplayText}` : ''}`)
              .join(' / ')}
          </div>
        ) : null,
      )}
      <p className="text-[10px] text-gray-400 dark:text-gray-600">
        「家にある」は必要な分量が足りることまでは確認していません。
      </p>
    </Section>
  )
}
