// ============================================================
// food-matching-fixtures.ts
//
// MISSION 2.39 — Food Matching Engine 検証用の最小 fixture。
//
// **SYNTHETIC**:
// - ここに含まれる SourceRecipeKnowledge / Stock snapshot の「料理事実」は
//   Matching Engine 検証専用のダミーであり、実在の情報源に基づかない。
// - Production Knowledge（MISSION 2.35 の SOURCE_RECIPE_KNOWLEDGE_FIXTURES）とは
//   別物として扱う（テストで固定）。
// - タコライスの料理事実を推測 fixture として追加しない。
// - MEAL_OCCASION_METADATA_FIXTURES は SYNTHETIC。実 Recipe（jp-tori-teriyaki 等）へは
//   occasion を付けない（§18 推測分類禁止）。
// ============================================================

import type {
  FoodStockIngredientSnapshot,
  MealOccasionMetadata,
  SourceIngredientKnowledge,
  SourceRecipeKnowledge,
} from '@/features/food/types'

const SYN = 'SYNTHETIC — MISSION 2.39 Matching 検証専用。実在の情報源に基づかない。'
const STRUCTURED_AT = '2026-09-03'

function synIng(
  sourceIngredientName: string,
  opts: Partial<SourceIngredientKnowledge> = {},
): SourceIngredientKnowledge {
  return {
    sourceIngredientName,
    role: 'required',
    originalLanguage: 'ja',
    ...opts,
  }
}

function synRecipe(
  canonicalRecipeId: string,
  sourceRecipeName: string,
  ingredients: SourceIngredientKnowledge[],
): SourceRecipeKnowledge {
  return {
    canonicalRecipeId,
    sourceRecipeName,
    evidenceSourceId: 'synthetic-matching-fixture',
    sourceLanguage: 'ja',
    ingredients,
    cookingSteps: [],
    structuredAt: STRUCTURED_AT,
    notes: [SYN],
  }
}

// ------------------------------------------------------------
// Synthetic recipes
// ------------------------------------------------------------

/** potato / onion / garlic の 3 食材（すべて registry 登録済み） */
export const SYN_RECIPE_3: SourceRecipeKnowledge = synRecipe('syn-recipe-3', 'synthetic 3-ingredient dish', [
  synIng('じゃがいも'),
  synIng('玉ねぎ'),
  synIng('にんにく'),
])

/** potato + 未登録食材（UNRESOLVED 検証用） */
export const SYN_RECIPE_UNRESOLVED: SourceRecipeKnowledge = synRecipe(
  'syn-recipe-unresolved',
  'synthetic dish with unknown ingredient',
  [synIng('じゃがいも'), synIng('mystery-root-x', { originalLanguage: 'en' })],
)

/** potato + "spring-onion-test"（AMBIGUOUS 検証用。ambiguous registry と併用） */
export const SYN_RECIPE_AMBIGUOUS: SourceRecipeKnowledge = synRecipe(
  'syn-recipe-ambiguous',
  'synthetic dish with ambiguous ingredient',
  [synIng('じゃがいも'), synIng('spring-onion-test', { originalLanguage: 'en' })],
)

/** chicken_thigh（recipe）— 在庫 chicken（generic）だけでは EXACT にならない */
export const SYN_RECIPE_PARENT_CHILD: SourceRecipeKnowledge = synRecipe(
  'syn-recipe-parent-child',
  'synthetic dish needing chicken thigh',
  [synIng('鶏もも肉')],
)

/** cherry_tomato（recipe）— 在庫 tomato だけでは EXACT にならない */
export const SYN_RECIPE_SIMILAR: SourceRecipeKnowledge = synRecipe(
  'syn-recipe-similar',
  'synthetic dish needing cherry tomato',
  [synIng('ミニトマト')],
)

/** rice_cooked（recipe）— 在庫 rice_raw だけでは EXACT にならない */
export const SYN_RECIPE_RAW_COOKED: SourceRecipeKnowledge = synRecipe(
  'syn-recipe-raw-cooked',
  'synthetic dish needing cooked rice',
  [synIng('ごはん')],
)

// ---- Meal Occasion 検証用（onion 1 食材だけの軽量 recipe）----
export const SYN_OCC_BREAKFAST_LUNCH: SourceRecipeKnowledge = synRecipe(
  'syn-occ-bl',
  'synthetic breakfast/lunch dish',
  [synIng('玉ねぎ')],
)
export const SYN_OCC_SNACK: SourceRecipeKnowledge = synRecipe('syn-occ-snack', 'synthetic snack', [synIng('玉ねぎ')])
export const SYN_OCC_DINNER: SourceRecipeKnowledge = synRecipe('syn-occ-dinner', 'synthetic dinner', [synIng('玉ねぎ')])
export const SYN_OCC_LATE_NIGHT: SourceRecipeKnowledge = synRecipe(
  'syn-occ-late',
  'synthetic late-night dish',
  [synIng('玉ねぎ')],
)
export const SYN_OCC_BENTO: SourceRecipeKnowledge = synRecipe('syn-occ-bento', 'synthetic bento dish', [synIng('玉ねぎ')])
export const SYN_OCC_UNKNOWN: SourceRecipeKnowledge = synRecipe(
  'syn-occ-unknown',
  'synthetic dish with no occasion metadata',
  [synIng('玉ねぎ')],
)

export const SYNTHETIC_MATCHING_RECIPES: SourceRecipeKnowledge[] = [
  SYN_RECIPE_3,
  SYN_RECIPE_UNRESOLVED,
  SYN_RECIPE_AMBIGUOUS,
  SYN_RECIPE_PARENT_CHILD,
  SYN_RECIPE_SIMILAR,
  SYN_RECIPE_RAW_COOKED,
  SYN_OCC_BREAKFAST_LUNCH,
  SYN_OCC_SNACK,
  SYN_OCC_DINNER,
  SYN_OCC_LATE_NIGHT,
  SYN_OCC_BENTO,
  SYN_OCC_UNKNOWN,
]

// ------------------------------------------------------------
// Meal Occasion metadata（SYNTHETIC。実 Recipe には付けない）
// ------------------------------------------------------------

export const MEAL_OCCASION_METADATA_FIXTURES: Record<string, MealOccasionMetadata> = {
  'syn-occ-bl': { occasions: ['breakfast', 'lunch'], source: 'nukitoru-reviewed', notes: SYN },
  'syn-occ-snack': { occasions: ['snack'], source: 'nukitoru-reviewed', notes: SYN },
  'syn-occ-dinner': { occasions: ['dinner'], source: 'nukitoru-reviewed', notes: SYN },
  'syn-occ-late': { occasions: ['late-night'], source: 'nukitoru-reviewed', notes: SYN },
  'syn-occ-bento': { occasions: ['bento'], source: 'nukitoru-reviewed', notes: SYN },
  // syn-occ-unknown は意図的に未登録（unknown policy 検証用）
}

// ------------------------------------------------------------
// Stock snapshot fixtures
// ------------------------------------------------------------

function stock(
  stockItemKey: string,
  sourceName: string,
  canonicalIngredientId: string | undefined,
  availabilityStatus: 'available' | 'low' | 'unavailable',
  extra: Partial<FoodStockIngredientSnapshot> = {},
): FoodStockIngredientSnapshot {
  return {
    stockItemKey,
    sourceName,
    ...(canonicalIngredientId !== undefined ? { canonicalIngredientId } : {}),
    identityStatus: canonicalIngredientId !== undefined ? 'RESOLVED' : 'UNRESOLVED',
    availabilityStatus,
    ...extra,
  }
}

/** potato / onion / garlic すべて available */
export const STOCK_ALL_FOR_3: FoodStockIngredientSnapshot[] = [
  stock('s1', 'じゃがいも', 'potato', 'available'),
  stock('s2', '玉ねぎ', 'onion', 'available'),
  stock('s3', 'にんにく', 'garlic', 'available'),
]

/** garlic だけ無い（1 MISSING） */
export const STOCK_GARLIC_MISSING: FoodStockIngredientSnapshot[] = [
  stock('s1', 'じゃがいも', 'potato', 'available'),
  stock('s2', '玉ねぎ', 'onion', 'available'),
]

/** potato だけ（onion / garlic の 2 MISSING） */
export const STOCK_2_MISSING: FoodStockIngredientSnapshot[] = [stock('s1', 'じゃがいも', 'potato', 'available')]

/** potato が low、他は available（1 LOW） */
export const STOCK_POTATO_LOW: FoodStockIngredientSnapshot[] = [
  stock('s1', 'じゃがいも', 'potato', 'low'),
  stock('s2', '玉ねぎ', 'onion', 'available'),
  stock('s3', 'にんにく', 'garlic', 'available'),
]

/** potato available + 未解決 stock（"mystery-root-x"）。SYN_RECIPE_UNRESOLVED と同名で使う */
export const STOCK_WITH_UNRESOLVED_SAME_NAME: FoodStockIngredientSnapshot[] = [
  stock('s1', 'じゃがいも', 'potato', 'available'),
  stock('s2', 'mystery-root-x', undefined, 'available'),
]

/** potato available + 無関係な未解決 stock */
export const STOCK_WITH_UNRELATED_UNRESOLVED: FoodStockIngredientSnapshot[] = [
  stock('s1', 'じゃがいも', 'potato', 'available'),
  stock('s2', 'quokka berry', undefined, 'available'),
]

/** potato available + AMBIGUOUS stock（"spring-onion-test"。ambiguous registry で解決） */
export const STOCK_WITH_AMBIGUOUS: FoodStockIngredientSnapshot[] = [
  stock('s1', 'じゃがいも', 'potato', 'available'),
  {
    stockItemKey: 's2',
    sourceName: 'spring-onion-test',
    identityStatus: 'AMBIGUOUS',
    candidateIds: ['synthetic_leek', 'synthetic_scallion'],
    availabilityStatus: 'available',
  },
]

/** generic chicken だけ（recipe が chicken_thigh を要求 → MISSING） */
export const STOCK_CHICKEN_GENERIC: FoodStockIngredientSnapshot[] = [
  stock('s1', '鶏肉', 'chicken', 'available'),
]

/** tomato だけ（recipe が cherry_tomato を要求 → MISSING） */
export const STOCK_TOMATO: FoodStockIngredientSnapshot[] = [stock('s1', 'トマト', 'tomato', 'available')]

/** rice_raw だけ（recipe が rice_cooked を要求 → MISSING） */
export const STOCK_RICE_RAW: FoodStockIngredientSnapshot[] = [stock('s1', '米', 'rice_raw', 'available')]

/** potato が明示 out、onion は available */
export const STOCK_POTATO_OUT: FoodStockIngredientSnapshot[] = [
  stock('s1', 'じゃがいも', 'potato', 'unavailable'),
  stock('s2', '玉ねぎ', 'onion', 'available'),
]

/** onion だけ available（occasion recipe 用） */
export const STOCK_ONION_ONLY: FoodStockIngredientSnapshot[] = [stock('s1', '玉ねぎ', 'onion', 'available')]

/** 空の在庫 */
export const STOCK_EMPTY: FoodStockIngredientSnapshot[] = []
