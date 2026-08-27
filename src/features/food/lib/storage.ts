// ============================================================
// storage.ts
//
// NUKITORU FOOD専用のlocalStorage helper。
// すべてのkeyに "nukitoru_food_" 接頭辞を付け、既存NUKITORUのkeyとは
// 絶対に衝突させない。SSR中はwindow/localStorageへアクセスしない。
// 保存値が壊れている・古い形式の場合も例外を投げず、安全な初期値へ戻す。
// ============================================================

import type { Household, AllergyProfile, Pantry, FoodPreferences, StockStatusEntry, Member } from '@/features/food/types'

const KEY_HOUSEHOLD = 'nukitoru_food_household'
const KEY_ALLERGY_PROFILE = 'nukitoru_food_allergy_profile'
const KEY_PANTRY = 'nukitoru_food_pantry'
const KEY_COOKING_PREFERENCE = 'nukitoru_food_cooking_preference'
const KEY_PREFERENCES = 'nukitoru_food_preferences'
const KEY_REGULAR_FOODS = 'nukitoru_food_regular_foods'
const KEY_FROZEN_FOODS = 'nukitoru_food_frozen_foods'
const KEY_PANTRY_FOODS = 'nukitoru_food_pantry_foods'
const KEY_STOCK_STATUS = 'nukitoru_food_stock_status'
const KEY_MEMBERS = 'nukitoru_food_members'
const KEY_SELECTED_MEMBERS = 'nukitoru_food_selected_members'

/** 「自分」は常にこの固定IDを使う。reloadやmigrationのたびに変わってはいけない。 */
export const SELF_MEMBER_ID = 'self'

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function safeSet<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 保存に失敗しても画面は継続動作させる
  }
}

export const DEFAULT_HOUSEHOLD: Household = { adults: 0, children: 0, childrenAges: [] }
export const DEFAULT_ALLERGY_PROFILE: AllergyProfile = { allergies: [], dislikes: [] }
export const DEFAULT_PANTRY: Pantry = { staples: [] }

export interface StoredCookingPreference {
  maxCookingMinutes: number | null
}

export const DEFAULT_COOKING_PREFERENCE: StoredCookingPreference = { maxCookingMinutes: null }

export function loadHousehold(): Household {
  return safeGet(KEY_HOUSEHOLD, DEFAULT_HOUSEHOLD)
}

export function saveHousehold(value: Household): void {
  safeSet(KEY_HOUSEHOLD, value)
}

export function loadAllergyProfile(): AllergyProfile {
  return safeGet(KEY_ALLERGY_PROFILE, DEFAULT_ALLERGY_PROFILE)
}

export function saveAllergyProfile(value: AllergyProfile): void {
  safeSet(KEY_ALLERGY_PROFILE, value)
}

export function loadPantry(): Pantry {
  return safeGet(KEY_PANTRY, DEFAULT_PANTRY)
}

export function savePantry(value: Pantry): void {
  safeSet(KEY_PANTRY, value)
}

export function loadCookingPreference(): StoredCookingPreference {
  return safeGet(KEY_COOKING_PREFERENCE, DEFAULT_COOKING_PREFERENCE)
}

export function saveCookingPreference(value: StoredCookingPreference): void {
  safeSet(KEY_COOKING_PREFERENCE, value)
}

// ------------------------------------------------------------
// MISSION 2.2 — Household Profile & Stock Master
// ------------------------------------------------------------

export const DEFAULT_FOOD_PREFERENCES: FoodPreferences = {
  favoriteIngredients: [],
  favoriteCuisines: [],
  spiceLevel: null,
}

export const DEFAULT_REGULAR_FOODS: string[] = []
export const DEFAULT_FROZEN_FOODS: string[] = []
export const DEFAULT_PANTRY_FOODS: string[] = []

export function loadFoodPreferences(): FoodPreferences {
  return safeGet(KEY_PREFERENCES, DEFAULT_FOOD_PREFERENCES)
}

export function saveFoodPreferences(value: FoodPreferences): void {
  safeSet(KEY_PREFERENCES, value)
}

export function loadRegularFoods(): string[] {
  return safeGet(KEY_REGULAR_FOODS, DEFAULT_REGULAR_FOODS)
}

export function saveRegularFoods(value: string[]): void {
  safeSet(KEY_REGULAR_FOODS, value)
}

export function loadFrozenFoods(): string[] {
  return safeGet(KEY_FROZEN_FOODS, DEFAULT_FROZEN_FOODS)
}

export function saveFrozenFoods(value: string[]): void {
  safeSet(KEY_FROZEN_FOODS, value)
}

export function loadPantryFoods(): string[] {
  return safeGet(KEY_PANTRY_FOODS, DEFAULT_PANTRY_FOODS)
}

export function savePantryFoods(value: string[]): void {
  safeSet(KEY_PANTRY_FOODS, value)
}

// ------------------------------------------------------------
// MISSION 2.3 — Current Stock Status
//
// Pantry.staples / regularFoods / frozenFoods / pantryFoods（常備品ON/OFF）
// とは完全に別のキーで保存する。
// ------------------------------------------------------------

export const DEFAULT_STOCK_STATUS: Record<string, StockStatusEntry> = {}

export function loadStockStatus(): Record<string, StockStatusEntry> {
  return safeGet(KEY_STOCK_STATUS, DEFAULT_STOCK_STATUS)
}

export function saveStockStatus(value: Record<string, StockStatusEntry>): void {
  safeSet(KEY_STOCK_STATUS, value)
}

// ------------------------------------------------------------
// MISSION 2.10 — Member Storage Foundation
//
// 既存の nukitoru_food_allergy_profile（世帯全体でフラットなallergies）から
// 「自分」という1名のMemberへ安全に移行する。
// 既存のアレルギー情報は必ず引き継ぎ、allergyConfirmedは常にfalseから始める
// （旧allergiesが空配列だったとしても「アレルギーなし確認済み」とはみなさない）。
// migrateToMembersはmembers keyが未作成/破損している場合にのみ使う導出ロジックで、
// それ自体はlocalStorageへ書き込まない（副作用を持たない）。
// ------------------------------------------------------------

function migrateToMembers(): Member[] {
  const old = loadAllergyProfile()
  return [
    {
      id: SELF_MEMBER_ID,
      label: '自分',
      allergies: old.allergies,
      allergyConfirmed: false,
    },
  ]
}

export function loadMembers(): Member[] {
  const raw = safeGet<Member[] | null>(KEY_MEMBERS, null)
  if (raw === null) return migrateToMembers()
  return raw
}

export function saveMembers(value: Member[]): void {
  safeSet(KEY_MEMBERS, value)
}

/**
 * 未保存時は「現在存在する全メンバー」をデフォルトの選択状態とする
 * （新規メンバー追加時も原則selectedへ含める、という仕様に合わせる）。
 */
export function loadSelectedMemberIds(): string[] {
  const raw = safeGet<string[] | null>(KEY_SELECTED_MEMBERS, null)
  if (raw === null) return loadMembers().map((m) => m.id)
  return raw
}

export function saveSelectedMemberIds(value: string[]): void {
  safeSet(KEY_SELECTED_MEMBERS, value)
}
