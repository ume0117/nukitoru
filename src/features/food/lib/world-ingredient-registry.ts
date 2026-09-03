// ============================================================
// world-ingredient-registry.ts
//
// MISSION 2.38 — World Ingredient Identity Registry（最小 fixture）。
//
// 「世界中の食材を登録する」ものではない。設計を検証できる最小の Identity 集合。
// 既存 canonical-food.ts の id 体系（chicken / onion / rice_raw / rice_cooked）と整合させ、
// 新しい id 体系を作らない。
//
// 絶対ルール:
// - ここに登録された名称・alias「だけ」を事実として扱う（翻訳を自動生成しない）。
// - 明示登録した alias のみ解決可能（似ている・文字列距離が近い は理由にしない）。
// - Ingredient variant を潰さない: chicken ≠ chicken_thigh、tomato ≠ cherry_tomato、
//   milk ≠ soy_milk、olive_oil ≠ sesame_oil、rice_raw ≠ rice_cooked、pork ≠ pork_shoulder。
// - Identity に state/preparation（raw / boiled / diced 等）を含めない。
// - Generic Ingredient Identity のみ。Specific Product Identity（「キッコーマン特選丸大豆しょうゆ」等）は含めない。
// - identityEvidence は Identity Evidence であって Recipe / Rights / Allergen Evidence ではない。
// ============================================================

import type { WorldIngredientIdentity } from '@/features/food/types'

const CHECKED_AT = '2026-09-03'

/** これらは NUKITORU 内製の一般的食材名称辞書（外部 dataset の import ではない） */
const INTERNAL_DICT = 'NUKITORU 内製の一般的食材名称辞書（MISSION 2.38 fixture）'
/** canonical-food.ts の CANONICAL_FOOD_SAMPLE と id を揃えたエントリ */
const ALIGNED_WITH_CANONICAL_FOOD = `${INTERNAL_DICT}。canonical-food.ts の CANONICAL_FOOD_SAMPLE と id を整合`

export const WORLD_INGREDIENT_IDENTITY_REGISTRY: WorldIngredientIdentity[] = [
  // ---- 野菜・香味 ----
  {
    canonicalIngredientId: 'onion',
    canonicalName: 'onion',
    category: 'vegetable',
    names: [
      { language: 'en', name: 'onion', kind: 'canonical' },
      { language: 'ja', name: '玉ねぎ', kind: 'canonical' },
      { language: 'ja', name: 'たまねぎ', kind: 'alias' },
      { language: 'ja', name: 'タマネギ', kind: 'alias' },
      { language: 'ja', name: '玉葱', kind: 'alias' },
    ],
    identityEvidence: { reference: ALIGNED_WITH_CANONICAL_FOOD, checkedAt: CHECKED_AT },
  },
  {
    canonicalIngredientId: 'potato',
    canonicalName: 'potato',
    category: 'vegetable',
    names: [
      { language: 'en', name: 'potato', kind: 'canonical' },
      { language: 'ja', name: 'じゃがいも', kind: 'canonical' },
      { language: 'ja', name: 'ジャガイモ', kind: 'alias' },
      { language: 'ja', name: '馬鈴薯', kind: 'alias' },
    ],
    notes: [
      'potatoes（複数形）は明示 alias にしていない。自動 stemming で解決しない（UNRESOLVED のまま）。',
    ],
    identityEvidence: { reference: INTERNAL_DICT, checkedAt: CHECKED_AT },
  },
  {
    canonicalIngredientId: 'tomato',
    canonicalName: 'tomato',
    category: 'vegetable',
    names: [
      { language: 'en', name: 'tomato', kind: 'canonical' },
      { language: 'ja', name: 'トマト', kind: 'canonical' },
    ],
    identityEvidence: { reference: INTERNAL_DICT, checkedAt: CHECKED_AT },
  },
  {
    canonicalIngredientId: 'cherry_tomato',
    canonicalName: 'cherry tomato',
    category: 'vegetable',
    // tomato とは別 Identity。似ているが同一にしない。将来の親子関係の境界のみ保持。
    parentCanonicalIngredientId: 'tomato',
    names: [
      { language: 'en', name: 'cherry tomato', kind: 'canonical' },
      { language: 'ja', name: 'ミニトマト', kind: 'canonical' },
      { language: 'ja', name: 'プチトマト', kind: 'alias' },
    ],
    notes: ['tomato とは別 Identity（cherry tomato ≠ tomato）。自動親子推論はしない。'],
    identityEvidence: { reference: INTERNAL_DICT, checkedAt: CHECKED_AT },
  },
  {
    canonicalIngredientId: 'garlic',
    canonicalName: 'garlic',
    category: 'aromatic',
    names: [
      { language: 'en', name: 'garlic', kind: 'canonical' },
      { language: 'ja', name: 'にんにく', kind: 'canonical' },
      { language: 'ja', name: 'ニンニク', kind: 'alias' },
      { language: 'ja', name: '大蒜', kind: 'alias' },
    ],
    identityEvidence: { reference: INTERNAL_DICT, checkedAt: CHECKED_AT },
  },
  {
    canonicalIngredientId: 'ginger',
    canonicalName: 'ginger',
    category: 'aromatic',
    names: [
      { language: 'en', name: 'ginger', kind: 'canonical' },
      { language: 'ja', name: 'しょうが', kind: 'canonical' },
      { language: 'ja', name: 'ショウガ', kind: 'alias' },
      { language: 'ja', name: '生姜', kind: 'alias' },
    ],
    identityEvidence: { reference: INTERNAL_DICT, checkedAt: CHECKED_AT },
  },

  // ---- 卵・乳 ----
  {
    canonicalIngredientId: 'egg',
    canonicalName: 'egg',
    category: 'egg',
    names: [
      { language: 'en', name: 'egg', kind: 'canonical' },
      { language: 'ja', name: '卵', kind: 'canonical' },
      { language: 'ja', name: 'たまご', kind: 'alias' },
      { language: 'ja', name: '玉子', kind: 'alias' },
      { language: 'ja', name: '鶏卵', kind: 'alias' },
    ],
    identityEvidence: { reference: INTERNAL_DICT, checkedAt: CHECKED_AT },
  },
  {
    canonicalIngredientId: 'milk',
    canonicalName: 'milk',
    category: 'dairy',
    names: [
      { language: 'en', name: 'milk', kind: 'canonical' },
      { language: 'ja', name: '牛乳', kind: 'canonical' },
    ],
    notes: ['soy_milk（豆乳）とは別 Identity。親子関係も設定しない（milk ⊅ soy milk）。'],
    identityEvidence: { reference: INTERNAL_DICT, checkedAt: CHECKED_AT },
  },
  {
    canonicalIngredientId: 'soy_milk',
    canonicalName: 'soy milk',
    category: 'plant-based-drink',
    names: [
      { language: 'en', name: 'soy milk', kind: 'canonical' },
      { language: 'ja', name: '豆乳', kind: 'canonical' },
    ],
    notes: ['milk（牛乳）とは別 Identity。名前に "milk" を含むが同一にしない。'],
    identityEvidence: { reference: INTERNAL_DICT, checkedAt: CHECKED_AT },
  },

  // ---- 肉（generic と部位は別 Identity）----
  {
    canonicalIngredientId: 'chicken',
    canonicalName: 'chicken',
    category: 'meat',
    names: [
      { language: 'en', name: 'chicken', kind: 'canonical' },
      { language: 'ja', name: '鶏肉', kind: 'canonical' },
      { language: 'ja', name: 'とり肉', kind: 'alias' },
      { language: 'ja', name: '鳥肉', kind: 'alias' },
    ],
    identityEvidence: { reference: ALIGNED_WITH_CANONICAL_FOOD, checkedAt: CHECKED_AT },
  },
  {
    canonicalIngredientId: 'chicken_thigh',
    canonicalName: 'chicken thigh',
    category: 'meat',
    parentCanonicalIngredientId: 'chicken',
    names: [
      { language: 'en', name: 'chicken thigh', kind: 'canonical' },
      { language: 'ja', name: '鶏もも肉', kind: 'canonical' },
      { language: 'ja', name: '鶏もも', kind: 'alias' },
      { language: 'ja', name: 'とりもも肉', kind: 'alias' },
    ],
    notes: ['chicken（鶏肉）とは別 Identity。部位。Matching では親子で自動一致しない。'],
    identityEvidence: { reference: INTERNAL_DICT, checkedAt: CHECKED_AT },
  },
  {
    canonicalIngredientId: 'pork',
    canonicalName: 'pork',
    category: 'meat',
    names: [
      { language: 'en', name: 'pork', kind: 'canonical' },
      { language: 'ja', name: '豚肉', kind: 'canonical' },
    ],
    identityEvidence: { reference: INTERNAL_DICT, checkedAt: CHECKED_AT },
  },
  {
    canonicalIngredientId: 'pork_shoulder',
    canonicalName: 'pork shoulder',
    category: 'meat',
    parentCanonicalIngredientId: 'pork',
    names: [
      { language: 'en', name: 'pork shoulder', kind: 'canonical' },
      { language: 'ja', name: '豚肩ロース肉', kind: 'canonical' },
      { language: 'ja', name: '豚肩ロース', kind: 'alias' },
    ],
    notes: ['pork（豚肉）とは別 Identity。部位。'],
    identityEvidence: { reference: INTERNAL_DICT, checkedAt: CHECKED_AT },
  },

  // ---- 穀物（生米と炊飯済みは別 Identity。canonical-food.ts と整合）----
  {
    canonicalIngredientId: 'rice_raw',
    canonicalName: 'rice (raw)',
    category: 'grain',
    names: [
      { language: 'en', name: 'rice', kind: 'canonical' },
      { language: 'ja', name: '米', kind: 'canonical' },
      { language: 'ja', name: '生米', kind: 'alias' },
    ],
    notes: ['rice_cooked（炊飯済み）とは別 Identity（MISSION 2.11 PHASE D.2 と一致）。'],
    identityEvidence: { reference: ALIGNED_WITH_CANONICAL_FOOD, checkedAt: CHECKED_AT },
  },
  {
    canonicalIngredientId: 'rice_cooked',
    canonicalName: 'cooked rice',
    category: 'grain',
    names: [
      { language: 'en', name: 'cooked rice', kind: 'canonical' },
      { language: 'ja', name: 'ごはん', kind: 'canonical' },
      { language: 'ja', name: 'ご飯', kind: 'alias' },
    ],
    notes: [
      'rice_raw（生米）とは別 Identity。State（炊く前/炊いた後）は Identity と別だが、',
      'ここでは MISSION 2.11 の既存判断に合わせ別 canonical id として扱う。',
    ],
    identityEvidence: { reference: ALIGNED_WITH_CANONICAL_FOOD, checkedAt: CHECKED_AT },
  },

  // ---- 調味料（generic のみ）----
  {
    canonicalIngredientId: 'soy_sauce',
    canonicalName: 'soy sauce',
    category: 'seasoning',
    names: [
      { language: 'en', name: 'soy sauce', kind: 'canonical' },
      { language: 'ja', name: 'しょうゆ', kind: 'canonical' },
      { language: 'ja', name: '醤油', kind: 'alias' },
      { language: 'ja', name: 'しょう油', kind: 'alias' },
    ],
    notes: [
      'generic「しょうゆ」の Identity。特定商品（キッコーマン特選丸大豆しょうゆ 等）は別概念で登録しない。',
      'Identity 解決は allergen（小麦・大豆）を自動確定しない（Allergy Evidence は別レイヤー）。',
    ],
    identityEvidence: { reference: INTERNAL_DICT, checkedAt: CHECKED_AT },
  },
  {
    canonicalIngredientId: 'mirin',
    canonicalName: 'mirin',
    category: 'seasoning',
    names: [
      { language: 'en', name: 'mirin', kind: 'canonical' },
      { language: 'ja', name: 'みりん', kind: 'canonical' },
      { language: 'ja', name: '味醂', kind: 'alias' },
    ],
    identityEvidence: { reference: INTERNAL_DICT, checkedAt: CHECKED_AT },
  },
  {
    canonicalIngredientId: 'cooking_sake',
    canonicalName: 'cooking sake',
    category: 'seasoning',
    names: [
      { language: 'en', name: 'cooking sake', kind: 'canonical' },
      { language: 'ja', name: '料理酒', kind: 'canonical' },
      { language: 'ja', name: '酒', kind: 'alias' },
    ],
    identityEvidence: { reference: INTERNAL_DICT, checkedAt: CHECKED_AT },
  },
  {
    canonicalIngredientId: 'sugar',
    canonicalName: 'sugar',
    category: 'seasoning',
    names: [
      { language: 'en', name: 'sugar', kind: 'canonical' },
      { language: 'ja', name: '砂糖', kind: 'canonical' },
    ],
    identityEvidence: { reference: INTERNAL_DICT, checkedAt: CHECKED_AT },
  },
  {
    canonicalIngredientId: 'salt',
    canonicalName: 'salt',
    category: 'seasoning',
    names: [
      { language: 'en', name: 'salt', kind: 'canonical' },
      { language: 'ja', name: '塩', kind: 'canonical' },
    ],
    identityEvidence: { reference: INTERNAL_DICT, checkedAt: CHECKED_AT },
  },

  // ---- 油（種類ごとに別 Identity）----
  {
    canonicalIngredientId: 'olive_oil',
    canonicalName: 'olive oil',
    category: 'oil',
    names: [
      { language: 'en', name: 'olive oil', kind: 'canonical' },
      { language: 'ja', name: 'オリーブオイル', kind: 'canonical' },
      { language: 'ja', name: 'オリーブ油', kind: 'alias' },
    ],
    notes: ['sesame_oil（ごま油）とは別 Identity。両方 "oil" を含むが同一にしない。'],
    identityEvidence: { reference: INTERNAL_DICT, checkedAt: CHECKED_AT },
  },
  {
    canonicalIngredientId: 'sesame_oil',
    canonicalName: 'sesame oil',
    category: 'oil',
    names: [
      { language: 'en', name: 'sesame oil', kind: 'canonical' },
      { language: 'ja', name: 'ごま油', kind: 'canonical' },
      { language: 'ja', name: 'ゴマ油', kind: 'alias' },
    ],
    notes: ['olive_oil（オリーブオイル）とは別 Identity。'],
    identityEvidence: { reference: INTERNAL_DICT, checkedAt: CHECKED_AT },
  },
]

/** Registry に登録済みの全 canonicalIngredientId */
export function listWorldIngredientIds(
  registry: WorldIngredientIdentity[] = WORLD_INGREDIENT_IDENTITY_REGISTRY,
): string[] {
  return registry.map((i) => i.canonicalIngredientId)
}
