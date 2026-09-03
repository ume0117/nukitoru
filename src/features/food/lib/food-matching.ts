// ============================================================
// food-matching.ts
//
// MISSION 2.39 — Bidirectional Food Matching Engine (deterministic, explainable)。
//
//   Forward:  matchRecipesFromStock(stock, recipes, options?) → RecipeFoodMatchResult[]
//   Reverse:  evaluateRecipeAgainstStock(recipe, stock, options?) → RecipeFoodMatchResult
//
// 絶対ルール:
// - EXACT は canonicalIngredientId の完全一致のみ（親子・類似・代用・preparation state を使わない）。
// - EXACT ≠ Quantity Sufficient（quantityStatus は常に NOT_EVALUATED）。単位変換・個→g 換算をしない。
// - UNRESOLVED / AMBIGUOUS を missingCount に混ぜない。
// - Meal Occasion は明示 metadata のみ。未設定 = unknown（推測分類しない）。
// - SourceRecipeKnowledge / Stock を mutate しない。Derived Result のみを返す。
// - deterministic: 乱数・現在時刻・ネットワーク・AI を使わない。
//   sort は stable、tie-break は canonicalRecipeId。
// - Firewall: recipe-publishability / recipe-safety / practical-cook-validation / recipe-catalog /
//   recipe-suggestion-engine / mock-meal-provider / ingredient-normalization / ingredient-taxonomy /
//   ingredient-allergens / ai-provider / from-now-to-table / recipe-time / world-recipe-import を
//   import しない。Matching は Rights / VERIFIED / Allergy / Practical を決めない。
// ============================================================

import type {
  CanonicalFoodId,
  FoodMatchReasonCode,
  FoodStockIngredientSnapshot,
  IngredientFoodMatch,
  IngredientMatchClass,
  MealOccasion,
  MealOccasionMetadata,
  RecipeFoodMatchFlag,
  RecipeFoodMatchResult,
  RecipeIngredientRequirement,
  SourceIngredientKnowledge,
  SourceRecipeKnowledge,
  StockAvailabilityStatus,
  StockStatus,
  StockStatusEntry,
  StockSummary,
} from '@/features/food/types'
import {
  canonicalizeSourceIngredientKnowledge,
  normalizeIngredientName,
  resolveWorldIngredientIdentity,
} from './world-ingredient-canonicalization'
import { WORLD_INGREDIENT_IDENTITY_REGISTRY } from './world-ingredient-registry'
import {
  isMealOccasionKnown,
  mealOccasionsOf,
  matchesStrictOccasionFilter,
} from './meal-occasion'
import { MEAL_OCCASION_METADATA_FIXTURES } from './food-matching-fixtures'
import type { WorldIngredientIdentity, LanguageCode } from '@/features/food/types'

// ------------------------------------------------------------
// 既存 Stock からの写像（pure adapter。Stock schema は変更しない）
// ------------------------------------------------------------

/** 既存 StockStatus（available/low/out）→ Matching 用 StockAvailabilityStatus */
export function mapStockStatusToAvailability(status: StockStatus): StockAvailabilityStatus {
  switch (status) {
    case 'available':
      return 'available'
    case 'low':
      return 'low'
    case 'out':
      return 'unavailable'
  }
}

export interface RawStockItemInput {
  /** provenance 用の識別子（既存 stock の item 名等） */
  stockItemKey: string
  /** 在庫アイテムの元の名前 */
  sourceName: string
  availabilityStatus: StockAvailabilityStatus
  /** 名前解決に使う言語（任意） */
  language?: LanguageCode
  notes?: string[]
}

/** 1 件の生 stock 入力 → FoodStockIngredientSnapshot（MISSION 2.38 で名前解決） */
export function toStockIngredientSnapshot(
  item: RawStockItemInput,
  registry: WorldIngredientIdentity[] = WORLD_INGREDIENT_IDENTITY_REGISTRY,
): FoodStockIngredientSnapshot {
  const res = resolveWorldIngredientIdentity(item.sourceName, item.language, registry)
  return {
    stockItemKey: item.stockItemKey,
    sourceName: item.sourceName,
    ...(res.status === 'RESOLVED' && res.canonicalIngredientId !== undefined
      ? { canonicalIngredientId: res.canonicalIngredientId }
      : {}),
    identityStatus: res.status,
    ...(res.status === 'AMBIGUOUS' && res.candidateIds ? { candidateIds: res.candidateIds } : {}),
    availabilityStatus: item.availabilityStatus,
    ...(item.notes ? { notes: item.notes } : {}),
  }
}

export function projectStockToSnapshots(
  items: RawStockItemInput[],
  registry: WorldIngredientIdentity[] = WORLD_INGREDIENT_IDENTITY_REGISTRY,
): FoodStockIngredientSnapshot[] {
  return items.map((i) => toStockIngredientSnapshot(i, registry))
}

// ------------------------------------------------------------
// MISSION 2.40A — 既存の永続 Stock を Matching の主データにする pure adapter
//   （既存 StockStatus / StockStatusEntry / storage schema は読むだけ・変更しない）
// ------------------------------------------------------------

/**
 * 永続 stock status map（item 名 → StockStatusEntry）から、ある item の
 * availabilityStatus を返す。エントリが無い / 不正なら既存 getStockStatus と同じ
 * 安全側の既定 'available' として扱う。
 */
export function persistedStockAvailability(
  statusMap: Record<string, StockStatusEntry>,
  itemName: string,
): StockAvailabilityStatus {
  const raw = statusMap[itemName]?.status
  const status: StockStatus =
    raw === 'available' || raw === 'low' || raw === 'out' ? raw : 'available'
  return mapStockStatusToAvailability(status)
}

/**
 * 既存の「家の在庫」（登録済み食品名 + 現在庫 status map）を FoodStockIngredientSnapshot[] へ
 * pure projection する。ユーザーに食材を再入力させないための本筋 adapter。
 * - Ingredient identity は MISSION 2.38 canonicalization（resolved は id 保持 /
 *   unresolved は UNRESOLVED / ambiguous は AMBIGUOUS。推測しない）。
 * - 元の itemNames / statusMap を mutate しない。
 */
export function projectPersistedStockToFoodSnapshots(
  input: { itemNames: string[]; statusMap: Record<string, StockStatusEntry> },
  registry: WorldIngredientIdentity[] = WORLD_INGREDIENT_IDENTITY_REGISTRY,
): FoodStockIngredientSnapshot[] {
  // 同一名の重複を除去（複数カテゴリに登録されている場合）
  const uniqueNames = [...new Set(input.itemNames.map((n) => n.trim()).filter((n) => n.length > 0))]
  return uniqueNames.map((name) =>
    toStockIngredientSnapshot(
      {
        stockItemKey: name,
        sourceName: name,
        availabilityStatus: persistedStockAvailability(input.statusMap, name),
        language: 'ja',
      },
      registry,
    ),
  )
}

/** stock スナップショット群の概要（実データからのみ。fake count なし） */
export function summarizeStockSnapshots(
  snapshots: FoodStockIngredientSnapshot[],
): StockSummary {
  return {
    availableCount: snapshots.filter((s) => s.availabilityStatus === 'available').length,
    lowCount: snapshots.filter((s) => s.availabilityStatus === 'low').length,
    unavailableCount: snapshots.filter((s) => s.availabilityStatus === 'unavailable').length,
    resolvedCount: snapshots.filter((s) => s.identityStatus === 'RESOLVED').length,
    unresolvedCount: snapshots.filter((s) => s.identityStatus === 'UNRESOLVED').length,
    ambiguousCount: snapshots.filter((s) => s.identityStatus === 'AMBIGUOUS').length,
    totalCount: snapshots.length,
  }
}

// ------------------------------------------------------------
// SourceRecipeKnowledge からの写像（SourceRecipeKnowledge は変更しない）
// ------------------------------------------------------------

/** 1 件の SourceIngredientKnowledge → RecipeIngredientRequirement */
export function toRecipeIngredientRequirement(
  ingredient: SourceIngredientKnowledge,
  registry: WorldIngredientIdentity[] = WORLD_INGREDIENT_IDENTITY_REGISTRY,
  sourceLanguageFallback?: LanguageCode,
): RecipeIngredientRequirement {
  const canon = canonicalizeSourceIngredientKnowledge(ingredient, registry, sourceLanguageFallback)
  const res = canon.resolution
  return {
    sourceIngredientName: ingredient.sourceIngredientName,
    ...(res.status === 'RESOLVED' && res.canonicalIngredientId !== undefined
      ? { canonicalIngredientId: res.canonicalIngredientId }
      : {}),
    identityStatus: res.status,
    ...(res.status === 'AMBIGUOUS' && res.candidateIds ? { candidateIds: res.candidateIds } : {}),
    ...(ingredient.role !== undefined ? { role: ingredient.role } : {}),
    ...(ingredient.quantity?.displayText !== undefined
      ? { quantityDisplayText: ingredient.quantity.displayText }
      : {}),
    ...(ingredient.preparationState !== undefined
      ? { preparationState: ingredient.preparationState }
      : {}),
    requirementKind: 'SOURCE_LISTED',
  }
}

/** SourceRecipeKnowledge → RecipeIngredientRequirement[]（元 object は不変） */
export function toRecipeRequirementSnapshot(
  knowledge: SourceRecipeKnowledge,
  registry: WorldIngredientIdentity[] = WORLD_INGREDIENT_IDENTITY_REGISTRY,
): RecipeIngredientRequirement[] {
  return knowledge.ingredients.map((ing) =>
    toRecipeIngredientRequirement(ing, registry, knowledge.sourceLanguage),
  )
}

// ------------------------------------------------------------
// Ingredient Match Classification（決定論的・§9/§10 truth table）
// ------------------------------------------------------------

function sortedUnique<T>(values: T[]): T[] {
  return [...new Set(values)].sort()
}

/** stock を「決定論的に 1 件」選ぶための安定キー */
function stockSortKey(s: FoodStockIngredientSnapshot): string {
  return `${s.stockItemKey} ${s.sourceName}`
}

/**
 * 1 つの RecipeIngredientRequirement を stock snapshot 群と突き合わせて分類する。
 *
 * 優先順位:
 *  1. requirement.identityStatus === 'AMBIGUOUS' → AMBIGUOUS
 *  2. requirement.identityStatus === 'UNRESOLVED' → UNRESOLVED
 *  3. RESOLVED (canonical id = R):
 *     - RESOLVED stock で id === R && available → EXACT
 *     - RESOLVED stock で id === R && low → LOW
 *     - RESOLVED stock で id === R && unavailable のみ → MISSING (EXPLICITLY_UNAVAILABLE)
 *     - AMBIGUOUS stock の candidateIds に R を含む → AMBIGUOUS
 *     - UNRESOLVED stock で正規化名が requirement 名と一致 → UNRESOLVED
 *     - それ以外 → MISSING (STOCK_ABSENT)
 */
export function classifyIngredientMatch(
  requirement: RecipeIngredientRequirement,
  stockSnapshots: FoodStockIngredientSnapshot[],
): IngredientFoodMatch {
  const reasonCodes: FoodMatchReasonCode[] = ['QUANTITY_NOT_EVALUATED']
  const base = { requirement, quantityStatus: 'NOT_EVALUATED' as const }

  if (requirement.identityStatus === 'AMBIGUOUS') {
    return {
      ...base,
      matchClass: 'AMBIGUOUS',
      reasonCodes: sortedUnique([...reasonCodes, 'IDENTITY_AMBIGUOUS']),
    }
  }

  if (requirement.identityStatus === 'UNRESOLVED') {
    const sameNameStock = stockSnapshots.filter(
      (s) => normalizeIngredientName(s.sourceName) === normalizeIngredientName(requirement.sourceIngredientName),
    )
    const codes: FoodMatchReasonCode[] = [...reasonCodes, 'RECIPE_IDENTITY_UNRESOLVED']
    if (sameNameStock.some((s) => s.identityStatus === 'UNRESOLVED')) {
      codes.push('STOCK_IDENTITY_UNRESOLVED')
    }
    return { ...base, matchClass: 'UNRESOLVED', reasonCodes: sortedUnique(codes) }
  }

  // RESOLVED
  const R = requirement.canonicalIngredientId as CanonicalFoodId
  const resolvedForR = stockSnapshots
    .filter((s) => s.identityStatus === 'RESOLVED' && s.canonicalIngredientId === R)
    .sort((a, b) => stockSortKey(a).localeCompare(stockSortKey(b)))

  const available = resolvedForR.find((s) => s.availabilityStatus === 'available')
  if (available) {
    return {
      ...base,
      matchClass: 'EXACT',
      matchedStock: available,
      reasonCodes: sortedUnique([...reasonCodes, 'CANONICAL_ID_EXACT']),
    }
  }

  const low = resolvedForR.find((s) => s.availabilityStatus === 'low')
  if (low) {
    return {
      ...base,
      matchClass: 'LOW',
      matchedStock: low,
      reasonCodes: sortedUnique([...reasonCodes, 'STOCK_LOW']),
    }
  }

  const explicitlyUnavailable = resolvedForR.find((s) => s.availabilityStatus === 'unavailable')

  // 一致する available/low stock が無い。missing を主張してよいか慎重に確認する。
  const ambiguousStockForR = stockSnapshots.find(
    (s) => s.identityStatus === 'AMBIGUOUS' && (s.candidateIds ?? []).includes(R),
  )
  if (ambiguousStockForR) {
    return {
      ...base,
      matchClass: 'AMBIGUOUS',
      reasonCodes: sortedUnique([...reasonCodes, 'IDENTITY_AMBIGUOUS', 'STOCK_IDENTITY_UNRESOLVED']),
    }
  }

  const unresolvedSameName = stockSnapshots.find(
    (s) =>
      s.identityStatus === 'UNRESOLVED' &&
      normalizeIngredientName(s.sourceName) === normalizeIngredientName(requirement.sourceIngredientName),
  )
  if (unresolvedSameName) {
    return {
      ...base,
      matchClass: 'UNRESOLVED',
      reasonCodes: sortedUnique([...reasonCodes, 'STOCK_IDENTITY_UNRESOLVED']),
    }
  }

  // ここまで来たら MISSING。理由コードを付ける。
  const codes: FoodMatchReasonCode[] = [...reasonCodes]
  if (explicitlyUnavailable) {
    codes.push('STOCK_EXPLICITLY_UNAVAILABLE')
  } else {
    codes.push('STOCK_ABSENT')
  }
  // 説明のため: 別 canonical id の resolved stock が存在する（≠ 持っている）
  const hasOtherResolvedStock = stockSnapshots.some(
    (s) => s.identityStatus === 'RESOLVED' && s.canonicalIngredientId !== R,
  )
  if (hasOtherResolvedStock) codes.push('NON_EXACT_CANONICAL_ID')

  return { ...base, matchClass: 'MISSING', reasonCodes: sortedUnique(codes) }
}

// ------------------------------------------------------------
// Recipe Match Result（Reverse Matching の中核）
// ------------------------------------------------------------

export interface RecipeMatchOptions {
  ingredientRegistry?: WorldIngredientIdentity[]
  occasionRegistry?: Record<string, MealOccasionMetadata>
}

/**
 * 1 つの Recipe（SourceRecipeKnowledge）を Stock と突き合わせた Derived Result。
 * これが Reverse Matching（作りたい料理 → 家にある/少ない/足りない/不明/曖昧）の中核。
 * §33 の evaluateRecipeFoodMatch と同義。
 */
export function evaluateRecipeAgainstStock(
  knowledge: SourceRecipeKnowledge,
  stockSnapshots: FoodStockIngredientSnapshot[],
  options: RecipeMatchOptions = {},
): RecipeFoodMatchResult {
  const ingredientRegistry = options.ingredientRegistry ?? WORLD_INGREDIENT_IDENTITY_REGISTRY
  const occasionRegistry = options.occasionRegistry ?? MEAL_OCCASION_METADATA_FIXTURES

  const requirements = toRecipeRequirementSnapshot(knowledge, ingredientRegistry)
  const ingredientMatches = requirements.map((req) => classifyIngredientMatch(req, stockSnapshots))

  const exactCount = ingredientMatches.filter((m) => m.matchClass === 'EXACT').length
  const lowCount = ingredientMatches.filter((m) => m.matchClass === 'LOW').length
  const missingCount = ingredientMatches.filter((m) => m.matchClass === 'MISSING').length
  const unresolvedCount = ingredientMatches.filter((m) => m.matchClass === 'UNRESOLVED').length
  const ambiguousCount = ingredientMatches.filter((m) => m.matchClass === 'AMBIGUOUS').length
  const listedIngredientCount = ingredientMatches.length

  const matchFlags: RecipeFoodMatchFlag[] = []
  if (missingCount === 0 && unresolvedCount === 0 && ambiguousCount === 0) {
    matchFlags.push('ALL_LISTED_IDENTITIES_PRESENT')
  }
  if (lowCount > 0) matchFlags.push('HAS_LOW_STOCK')
  if (missingCount > 0) matchFlags.push('HAS_MISSING_INGREDIENTS')
  if (unresolvedCount > 0) matchFlags.push('HAS_UNRESOLVED_INGREDIENTS')
  if (ambiguousCount > 0) matchFlags.push('HAS_AMBIGUOUS_INGREDIENTS')

  const occasions = mealOccasionsOf(knowledge.canonicalRecipeId, occasionRegistry)
  const occasionKnown = isMealOccasionKnown(knowledge.canonicalRecipeId, occasionRegistry)

  const reasonCodes = sortedUnique(ingredientMatches.flatMap((m) => m.reasonCodes))
  if (occasionKnown && occasions.length > 0) reasonCodes.push('MEAL_OCCASION_EXPLICIT_MATCH')
  if (!occasionKnown) reasonCodes.push('MEAL_OCCASION_UNKNOWN')

  const missingCanonicalIngredientIds = sortedUnique(
    ingredientMatches
      .filter((m) => m.matchClass === 'MISSING' && m.requirement.canonicalIngredientId !== undefined)
      .map((m) => m.requirement.canonicalIngredientId as CanonicalFoodId),
  )

  return {
    canonicalRecipeId: knowledge.canonicalRecipeId,
    recipeName: knowledge.sourceRecipeName,
    mealOccasions: occasions,
    mealOccasionKnown: occasionKnown,
    ingredientMatches,
    exactCount,
    lowCount,
    missingCount,
    unresolvedCount,
    ambiguousCount,
    listedIngredientCount,
    matchFlags,
    reasonCodes: sortedUnique(reasonCodes),
    missingCanonicalIngredientIds,
  }
}

/** §33 の別名。evaluateRecipeAgainstStock と同一。 */
export const evaluateRecipeFoodMatch = evaluateRecipeAgainstStock

// ------------------------------------------------------------
// Forward Matching + Availability Ranking（§13 / §14）
// ------------------------------------------------------------

export interface ForwardMatchOptions extends RecipeMatchOptions {
  /** STRICT occasion filter（§19）。指定すると INCLUDED の Recipe だけを返す */
  occasionFilter?: MealOccasion
}

/**
 * Availability Fit 順の決定論的 comparator（§14）。
 * 1. ambiguousCount asc / 2. unresolvedCount asc / 3. missingCount asc /
 * 4. lowCount asc / 5. exactCount desc / 6. canonicalRecipeId asc（安定 tie-break）
 *
 * この順序は「人気・美味しさ・健康・おすすめ度・品質」ではなく
 * 「家にある Ingredient との availability fit だけ」を表す。
 */
export function compareByAvailabilityFit(
  a: RecipeFoodMatchResult,
  b: RecipeFoodMatchResult,
): number {
  if (a.ambiguousCount !== b.ambiguousCount) return a.ambiguousCount - b.ambiguousCount
  if (a.unresolvedCount !== b.unresolvedCount) return a.unresolvedCount - b.unresolvedCount
  if (a.missingCount !== b.missingCount) return a.missingCount - b.missingCount
  if (a.lowCount !== b.lowCount) return a.lowCount - b.lowCount
  if (a.exactCount !== b.exactCount) return b.exactCount - a.exactCount
  return a.canonicalRecipeId.localeCompare(b.canonicalRecipeId)
}

/**
 * Forward Matching（家にあるもの → 渡された Recipe collection の availability fit）。
 * 外部 Recipe 検索はしない。渡された knowledge list だけを評価する。
 * occasionFilter 指定時は §19 STRICT policy（INCLUDED のみ）。
 * 戻り値は compareByAvailabilityFit で決定論的にソート済み。
 */
export function matchRecipesFromStock(
  stockSnapshots: FoodStockIngredientSnapshot[],
  recipes: SourceRecipeKnowledge[],
  options: ForwardMatchOptions = {},
): RecipeFoodMatchResult[] {
  const occasionRegistry = options.occasionRegistry ?? MEAL_OCCASION_METADATA_FIXTURES

  const filtered =
    options.occasionFilter === undefined
      ? recipes
      : recipes.filter((r) =>
          matchesStrictOccasionFilter(r.canonicalRecipeId, options.occasionFilter as MealOccasion, occasionRegistry),
        )

  const results = filtered.map((r) =>
    evaluateRecipeAgainstStock(r, stockSnapshots, {
      ingredientRegistry: options.ingredientRegistry,
      occasionRegistry,
    }),
  )
  return [...results].sort(compareByAvailabilityFit)
}

// ------------------------------------------------------------
// Explainability
// ------------------------------------------------------------

const REASON_LABELS: Record<FoodMatchReasonCode, string> = {
  CANONICAL_ID_EXACT: 'canonical ingredient id が完全一致し、在庫が available',
  STOCK_LOW: 'canonical id は一致するが在庫が low（十分量は保証しない）',
  STOCK_ABSENT: '一致する canonical id の在庫が無い',
  STOCK_EXPLICITLY_UNAVAILABLE: '一致する canonical id の在庫が明示的に無い（out）',
  RECIPE_IDENTITY_UNRESOLVED: 'レシピ側の食材 Identity を確定できない',
  STOCK_IDENTITY_UNRESOLVED: '関連しうる在庫の Identity を確定できず、不足と断定できない',
  IDENTITY_AMBIGUOUS: 'Identity 候補が複数で 1 つに確定できない',
  NON_EXACT_CANONICAL_ID: '別の canonical id の在庫は存在する（それは「持っている」ではない）',
  QUANTITY_NOT_EVALUATED: '数量充足は評価していない（EXACT ≠ 必要量を満たす）',
  MEAL_OCCASION_EXPLICIT_MATCH: 'Meal Occasion が明示 metadata として設定されている',
  MEAL_OCCASION_UNKNOWN: 'Meal Occasion の明示 metadata が無い（推測分類しない）',
}

/** Reason Code の人間可読ラベル（事実のみ。ユーザー向け誇張を入れない） */
export function describeFoodMatchReason(code: FoodMatchReasonCode): string {
  return REASON_LABELS[code]
}

// ------------------------------------------------------------
// MISSION 2.40 向け output boundary（§39）
// ------------------------------------------------------------

/** 2.40 のスマホ UI が必要とする最小サマリ（Cooking Steps は含めない） */
export interface RecipeFoodMatchSummary {
  canonicalRecipeId: string
  recipeName: string
  mealOccasions: MealOccasion[]
  mealOccasionKnown: boolean
  exactCount: number
  lowCount: number
  missingCount: number
  unresolvedCount: number
  ambiguousCount: number
  listedIngredientCount: number
  matchFlags: RecipeFoodMatchFlag[]
  missingCanonicalIngredientIds: string[]
}

export function toRecipeFoodMatchSummary(result: RecipeFoodMatchResult): RecipeFoodMatchSummary {
  return {
    canonicalRecipeId: result.canonicalRecipeId,
    recipeName: result.recipeName,
    mealOccasions: result.mealOccasions,
    mealOccasionKnown: result.mealOccasionKnown,
    exactCount: result.exactCount,
    lowCount: result.lowCount,
    missingCount: result.missingCount,
    unresolvedCount: result.unresolvedCount,
    ambiguousCount: result.ambiguousCount,
    listedIngredientCount: result.listedIngredientCount,
    matchFlags: result.matchFlags,
    missingCanonicalIngredientIds: result.missingCanonicalIngredientIds,
  }
}
