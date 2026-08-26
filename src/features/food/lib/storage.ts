// ============================================================
// storage.ts
//
// NUKITORU FOOD専用のlocalStorage helper。
// すべてのkeyに "nukitoru_food_" 接頭辞を付け、既存NUKITORUのkeyとは
// 絶対に衝突させない。SSR中はwindow/localStorageへアクセスしない。
// 保存値が壊れている・古い形式の場合も例外を投げず、安全な初期値へ戻す。
// ============================================================

import type { Household, AllergyProfile, Pantry } from '@/features/food/types'

const KEY_HOUSEHOLD = 'nukitoru_food_household'
const KEY_ALLERGY_PROFILE = 'nukitoru_food_allergy_profile'
const KEY_PANTRY = 'nukitoru_food_pantry'
const KEY_COOKING_PREFERENCE = 'nukitoru_food_cooking_preference'

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

export const DEFAULT_HOUSEHOLD: Household = { adults: 2, children: 0, childrenAges: [] }
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
