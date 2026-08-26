import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  DEFAULT_FOOD_PREFERENCES,
  DEFAULT_REGULAR_FOODS,
  DEFAULT_FROZEN_FOODS,
  DEFAULT_PANTRY_FOODS,
  DEFAULT_HOUSEHOLD,
  DEFAULT_ALLERGY_PROFILE,
  DEFAULT_STOCK_STATUS,
  loadFoodPreferences,
  saveFoodPreferences,
  loadRegularFoods,
  saveRegularFoods,
  loadFrozenFoods,
  saveFrozenFoods,
  loadPantryFoods,
  savePantryFoods,
  loadHousehold,
  saveHousehold,
  loadAllergyProfile,
  saveAllergyProfile,
  loadPantry,
  savePantry,
  loadStockStatus,
  saveStockStatus,
} from '../storage'
import type { StockStatusEntry } from '@/features/food/types'

/** vitestは environment: 'node' のため、既定では window が存在しない（＝SSR相当）。 */
function installFakeLocalStorage() {
  const store = new Map<string, string>()
  ;(globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    },
  }
  return store
}

function removeFakeWindow() {
  delete (globalThis as unknown as { window?: unknown }).window
}

describe('storage.ts — SSR安全性（window未定義時）', () => {
  it('window が存在しなくても新規キーはデフォルト値を返し例外を投げない', () => {
    expect(loadFoodPreferences()).toEqual(DEFAULT_FOOD_PREFERENCES)
    expect(loadRegularFoods()).toEqual(DEFAULT_REGULAR_FOODS)
    expect(loadFrozenFoods()).toEqual(DEFAULT_FROZEN_FOODS)
    expect(loadPantryFoods()).toEqual(DEFAULT_PANTRY_FOODS)
  })

  it('window が存在しなくても save系は例外を投げない', () => {
    expect(() => saveRegularFoods(['米'])).not.toThrow()
    expect(() => saveFoodPreferences(DEFAULT_FOOD_PREFERENCES)).not.toThrow()
  })
})

describe('storage.ts — round-trip（localStorageあり）', () => {
  beforeEach(() => {
    installFakeLocalStorage()
  })
  afterEach(() => {
    removeFakeWindow()
  })

  it('regularFoods を保存して読み込むと同じ値が返る', () => {
    saveRegularFoods(['米', '卵'])
    expect(loadRegularFoods()).toEqual(['米', '卵'])
  })

  it('frozenFoods を保存して読み込むと同じ値が返る', () => {
    saveFrozenFoods(['冷凍うどん'])
    expect(loadFrozenFoods()).toEqual(['冷凍うどん'])
  })

  it('pantryFoods を保存して読み込むと同じ値が返る', () => {
    savePantryFoods(['ツナ缶', 'カレールー'])
    expect(loadPantryFoods()).toEqual(['ツナ缶', 'カレールー'])
  })

  it('FoodPreferences を保存して読み込むと同じ値が返る', () => {
    const prefs = { favoriteIngredients: ['トマト'], favoriteCuisines: ['japanese' as const], spiceLevel: 'mild' as const }
    saveFoodPreferences(prefs)
    expect(loadFoodPreferences()).toEqual(prefs)
  })

  it('壊れたJSONが保存されていてもデフォルト値へ安全に復帰する', () => {
    const store = installFakeLocalStorage()
    store.set('nukitoru_food_regular_foods', '{not valid json')
    expect(loadRegularFoods()).toEqual(DEFAULT_REGULAR_FOODS)
  })

  it('既存の household / allergyProfile の保存・読み込みは新規キー追加後も無変更で動作する', () => {
    saveHousehold({ adults: 3, children: 1, childrenAges: [5] })
    saveAllergyProfile({ allergies: ['卵'], dislikes: ['パクチー'] })

    expect(loadHousehold()).toEqual({ adults: 3, children: 1, childrenAges: [5] })
    expect(loadAllergyProfile()).toEqual({ allergies: ['卵'], dislikes: ['パクチー'] })
  })

  it('household がデフォルトのままでも他カテゴリの保存に影響しない（キーの独立性）', () => {
    saveRegularFoods(['卵'])
    expect(loadHousehold()).toEqual(DEFAULT_HOUSEHOLD)
    expect(loadAllergyProfile()).toEqual(DEFAULT_ALLERGY_PROFILE)
  })

  it('stock status を保存して読み込むと同じ値が返る', () => {
    const value: Record<string, StockStatusEntry> = {
      卵: { status: 'low', updatedAt: '2026-08-26T00:00:00.000Z' },
    }
    saveStockStatus(value)
    expect(loadStockStatus()).toEqual(value)
  })

  it('壊れたstock status JSONが保存されていてもデフォルト値（空オブジェクト）へ安全に復帰する', () => {
    const store = installFakeLocalStorage()
    store.set('nukitoru_food_stock_status', '{not valid json')
    expect(loadStockStatus()).toEqual(DEFAULT_STOCK_STATUS)
  })

  it('stock status の変更は Pantry / regularFoods / frozenFoods / pantryFoods に影響しない（常備品ON/OFFとは独立）', () => {
    saveRegularFoods(['卵'])
    savePantry({ staples: ['しょうゆ'] })
    saveStockStatus({ 卵: { status: 'out' } })

    expect(loadRegularFoods()).toEqual(['卵'])
    expect(loadPantry()).toEqual({ staples: ['しょうゆ'] })
  })
})
