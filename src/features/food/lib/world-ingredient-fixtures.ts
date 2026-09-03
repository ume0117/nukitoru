// ============================================================
// world-ingredient-fixtures.ts
//
// MISSION 2.38 — Ingredient Canonicalization 検証用の最小 fixture。
//
// **SYNTHETIC**:
// - SYNTHETIC_AMBIGUOUS_REGISTRY は「同一 normalized 名が複数 Identity に登録された」
//   状態を意図的に作った検証専用データ。実在の食材関係ではない。
//   WORLD_INGREDIENT_IDENTITY_REGISTRY（本番 fixture）には決して混ぜない。
// - SYNTHETIC_SOURCE_INGREDIENTS は canonicalize 接続テスト用の SourceIngredientKnowledge。
//   料理事実（分量等）はダミー。
// ============================================================

import type {
  SourceIngredientKnowledge,
  WorldIngredientIdentity,
} from '@/features/food/types'
import { WORLD_INGREDIENT_IDENTITY_REGISTRY } from './world-ingredient-registry'

const SYNTHETIC_CHECKED_AT = '2026-09-03'
const SYNTHETIC_REF = 'SYNTHETIC — MISSION 2.38 AMBIGUOUS 検証専用。実在の食材関係ではない。'

/**
 * 意図的に曖昧な registry。英語名 "spring-onion-test" が 2 つの別 Identity に登録されている。
 * resolveWorldIngredientIdentity("spring-onion-test", 'en', this) は AMBIGUOUS を返すべき
 * （どちらか一方を勝手に選んではいけない）。
 */
export const SYNTHETIC_AMBIGUOUS_REGISTRY: WorldIngredientIdentity[] = [
  {
    canonicalIngredientId: 'synthetic_scallion',
    canonicalName: 'synthetic scallion (TEST)',
    category: 'SYNTHETIC',
    names: [
      { language: 'en', name: 'spring-onion-test', kind: 'canonical' },
      { language: 'ja', name: '万能ねぎテスト', kind: 'canonical' },
    ],
    identityEvidence: { reference: SYNTHETIC_REF, checkedAt: SYNTHETIC_CHECKED_AT },
  },
  {
    canonicalIngredientId: 'synthetic_leek',
    canonicalName: 'synthetic leek (TEST)',
    category: 'SYNTHETIC',
    names: [
      { language: 'en', name: 'spring-onion-test', kind: 'alias' },
      { language: 'ja', name: '長ねぎテスト', kind: 'canonical' },
    ],
    identityEvidence: { reference: SYNTHETIC_REF, checkedAt: SYNTHETIC_CHECKED_AT },
  },
]

/** 本番 registry + 曖昧エントリ（曖昧解決のテストで使う。本番には混ぜない） */
export const REGISTRY_WITH_SYNTHETIC_AMBIGUITY: WorldIngredientIdentity[] = [
  ...WORLD_INGREDIENT_IDENTITY_REGISTRY,
  ...SYNTHETIC_AMBIGUOUS_REGISTRY,
]

// ------------------------------------------------------------
// canonicalize 接続テスト用の SourceIngredientKnowledge
// ------------------------------------------------------------

/** ja 名で RESOLVED するはずの食材（分量は SOURCE FACT。canonicalize で変えない） */
export const SI_RESOLVES_JA: SourceIngredientKnowledge = {
  sourceIngredientName: 'じゃがいも',
  originalLanguage: 'ja',
  role: 'required',
  quantity: {
    displayText: '中2個（約300g）',
    semantics: { kind: 'range', min: 280, max: 320, unit: 'g' },
  },
  preparationState: '皮をむいて4等分',
}

/** en 名で RESOLVED するはずの食材 */
export const SI_RESOLVES_EN: SourceIngredientKnowledge = {
  sourceIngredientName: 'potato',
  originalLanguage: 'en',
  role: 'required',
  quantity: { displayText: '2 potatoes', semantics: { kind: 'exact', value: 2, unit: 'piece' } },
}

/** registry に無い食材（UNRESOLVED。Import 失敗にしない） */
export const SI_UNRESOLVED: SourceIngredientKnowledge = {
  sourceIngredientName: 'quokka berry',
  originalLanguage: 'en',
  role: 'garnish',
  quantity: { displayText: 'to taste', semantics: { kind: 'to-taste' } },
}

/** 複数形（自動 stemming しない → UNRESOLVED のまま） */
export const SI_PLURAL_UNRESOLVED: SourceIngredientKnowledge = {
  sourceIngredientName: 'potatoes',
  originalLanguage: 'en',
  role: 'required',
  quantity: { displayText: '3 potatoes', semantics: { kind: 'exact', value: 3, unit: 'piece' } },
}

/** 既に canonicalIngredientId が設定済み（保持・再解決しない） */
export const SI_PRE_LINKED: SourceIngredientKnowledge = {
  sourceIngredientName: 'たまねぎ',
  originalLanguage: 'ja',
  role: 'required',
  canonicalIngredientId: 'onion',
  quantity: { displayText: '1個', semantics: { kind: 'exact', value: 1, unit: 'piece' } },
}

/** 商品名（generic ingredient identity へ寄せない → UNRESOLVED） */
export const SI_PRODUCT_NAME: SourceIngredientKnowledge = {
  sourceIngredientName: 'キッコーマン特選丸大豆しょうゆ',
  originalLanguage: 'ja',
  role: 'seasoning',
  quantity: { displayText: '大さじ1', semantics: { kind: 'exact', value: 1, unit: '大さじ' } },
}

export const SYNTHETIC_SOURCE_INGREDIENTS = {
  SI_RESOLVES_JA,
  SI_RESOLVES_EN,
  SI_UNRESOLVED,
  SI_PLURAL_UNRESOLVED,
  SI_PRE_LINKED,
  SI_PRODUCT_NAME,
}
