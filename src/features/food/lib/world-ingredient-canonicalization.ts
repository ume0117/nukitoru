// ============================================================
// world-ingredient-canonicalization.ts
//
// MISSION 2.38 — World Ingredient Canonicalization Foundation。
//
// 明示登録された食材名 → 同一の Canonical Ingredient Identity へ、
// 安全・決定論的に解決する純粋関数群。
//
// 絶対ルール:
// - 正規化は「表記差を整える」だけ（trim + NFKC + ASCII lowercase + 空白畳み込み）。
//   fuzzy / typo correction / stemming / substring / AI synonym / 自動翻訳 は一切しない。
// - 曖昧なら AMBIGUOUS（1 つも選ばない）。知らなければ UNRESOLVED。推測で埋めない。
// - Canonicalization が変更してよいのは canonicalIngredientId リンクだけ。
//   sourceIngredientName / quantity / preparationState / language / role 等は不変。
// - Firewall: このモジュールは ingredient-normalization.ts / ingredient-taxonomy.ts /
//   ingredient-allergens.ts / recipe-safety.ts / recipe-publishability.ts /
//   practical-cook-validation.ts / recipe-catalog.ts / recipe-suggestion-engine.ts /
//   mock-meal-provider.ts / world-recipe-import.ts / ai-provider.ts を一切 import しない。
//   Allergy / Substitution / Unit conversion / Rights Gate / VERIFIED / Practical を
//   読み書きしない。
// ============================================================

import type {
  CanonicalFoodId,
  CanonicalizedSourceIngredient,
  IngredientIdentityMatchKind,
  LanguageCode,
  SourceIngredientKnowledge,
  WorldIngredientIdentity,
  WorldIngredientResolution,
} from '@/features/food/types'
import { WORLD_INGREDIENT_IDENTITY_REGISTRY } from './world-ingredient-registry'

// ------------------------------------------------------------
// Normalization（表記差を整えるだけ・意味を推測しない）
// ------------------------------------------------------------

/**
 * 食材名の決定論的な正規化。
 * - Unicode NFKC（全角→半角・互換文字の正準化。ひらがな↔カタカナは統合しない）
 * - trim
 * - ASCII 小文字化（toLowerCase）
 * - 連続空白を 1 個へ畳み込み
 *
 * これ以外のことは一切しない（stemming / 単複 / typo / 部分一致 / 翻訳は禁止）。
 * 同じ入力（正規化後）→ 常に同じ出力。
 */
export function normalizeIngredientName(raw: string): string {
  return raw
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

// ------------------------------------------------------------
// Exact Resolution（RESOLVED / UNRESOLVED / AMBIGUOUS）
// ------------------------------------------------------------

interface RegistryNameIndexEntry {
  normalizedName: string
  language: LanguageCode
  identity: WorldIngredientIdentity
}

function buildNameIndex(registry: WorldIngredientIdentity[]): RegistryNameIndexEntry[] {
  const index: RegistryNameIndexEntry[] = []
  for (const identity of registry) {
    for (const entry of identity.names) {
      index.push({
        normalizedName: normalizeIngredientName(entry.name),
        language: entry.language,
        identity,
      })
    }
  }
  return index
}

/**
 * 食材名 → Canonical Ingredient Identity の解決。
 *
 * @param sourceName 情報源に書かれた食材名（正規化前でよい）
 * @param language   検索対象言語。指定するとその言語で登録された名前だけを照合する。
 *                   undefined を渡すと全言語を照合する（AMBIGUOUS になりやすい）。
 * @param registry   照合する Identity Registry（既定は WORLD_INGREDIENT_IDENTITY_REGISTRY）
 *
 * - 完全一致（正規化後）した Identity が 1 件 → RESOLVED
 * - 一致した Identity が 0 件 → UNRESOLVED（近い食材へ寄せない）
 * - 一致した **異なる** Identity が 2 件以上 → AMBIGUOUS（1 つも選ばない）
 *   （同一 Identity 内で複数の名前が一致するのは RESOLVED）
 */
export function resolveWorldIngredientIdentity(
  sourceName: string,
  language: LanguageCode | undefined,
  registry: WorldIngredientIdentity[] = WORLD_INGREDIENT_IDENTITY_REGISTRY,
): WorldIngredientResolution {
  const normalizedQuery = normalizeIngredientName(sourceName)
  const query = { sourceName, ...(language !== undefined ? { language } : {}) }

  if (normalizedQuery.length === 0) {
    return { status: 'UNRESOLVED', query, normalizedQuery, reason: '空の食材名' }
  }

  const index = buildNameIndex(registry)
  const hits = index.filter((e) => {
    if (e.normalizedName !== normalizedQuery) return false
    if (language !== undefined && e.language !== language) return false
    return true
  })

  const matchedIds = [...new Set(hits.map((h) => h.identity.canonicalIngredientId))]

  if (matchedIds.length === 0) {
    return {
      status: 'UNRESOLVED',
      query,
      normalizedQuery,
      reason: `"${normalizedQuery}"（${language ?? 'any'}）に完全一致する登録名が無い`,
    }
  }

  if (matchedIds.length > 1) {
    return {
      status: 'AMBIGUOUS',
      query,
      normalizedQuery,
      candidateIds: matchedIds.sort(),
      reason: `"${normalizedQuery}" が複数の Identity（${matchedIds.sort().join(', ')}）へ解決する`,
    }
  }

  const identity = hits[0].identity
  return {
    status: 'RESOLVED',
    query,
    normalizedQuery,
    canonicalIngredientId: identity.canonicalIngredientId,
    identity,
    reason: `"${normalizedQuery}" が ${identity.canonicalIngredientId} の登録名と完全一致`,
  }
}

export function getWorldIngredientIdentityById(
  id: CanonicalFoodId,
  registry: WorldIngredientIdentity[] = WORLD_INGREDIENT_IDENTITY_REGISTRY,
): WorldIngredientIdentity | undefined {
  return registry.find((i) => i.canonicalIngredientId === id)
}

// ------------------------------------------------------------
// Recipe Ingredient との接続（Source Fact を破壊しない）
// ------------------------------------------------------------

/**
 * SourceIngredientKnowledge を Canonical Ingredient Identity へ「安全に link」する。
 *
 * - `original` は一切変更しない（新しいオブジェクトも作らずそのまま参照を返す）。
 * - `original.canonicalIngredientId` が既に設定済み → その値を保持（再解決しない）。
 * - 未設定 → registry で解決。RESOLVED なら `linked` に canonicalIngredientId を足す。
 * - `linked` は常に sourceIngredientName / quantity / preparationState / normalizedName /
 *   japaneseName / englishName / originalLanguage / role を original と同一に保つ。
 *   canonicalIngredientId 以外は書き換えない（Translation ≠ Canonicalization）。
 *
 * @param sourceLanguageFallback ingredient.originalLanguage が無いとき使う言語（任意）
 */
export function canonicalizeSourceIngredientKnowledge(
  ingredient: SourceIngredientKnowledge,
  registry: WorldIngredientIdentity[] = WORLD_INGREDIENT_IDENTITY_REGISTRY,
  sourceLanguageFallback?: LanguageCode,
): CanonicalizedSourceIngredient {
  // 既に link 済み: 保持（§12「既に存在する場合は保持」）
  if (ingredient.canonicalIngredientId !== undefined) {
    return {
      original: ingredient,
      resolution: {
        status: 'RESOLVED',
        query: { sourceName: ingredient.sourceIngredientName },
        normalizedQuery: normalizeIngredientName(ingredient.sourceIngredientName),
        canonicalIngredientId: ingredient.canonicalIngredientId,
        identity: getWorldIngredientIdentityById(ingredient.canonicalIngredientId, registry),
        reason: 'canonicalIngredientId が既に設定済み（保持・再解決しない）',
      },
      linked: { ...ingredient },
    }
  }

  const language = ingredient.originalLanguage ?? sourceLanguageFallback
  const resolution = resolveWorldIngredientIdentity(
    ingredient.sourceIngredientName,
    language,
    registry,
  )

  if (resolution.status === 'RESOLVED' && resolution.canonicalIngredientId !== undefined) {
    return {
      original: ingredient,
      resolution,
      // canonicalIngredientId "だけ" を足す。他フィールドは元のまま。
      linked: { ...ingredient, canonicalIngredientId: resolution.canonicalIngredientId },
    }
  }

  // UNRESOLVED / AMBIGUOUS: link しない（推測で埋めない）。Source Knowledge はそのまま保持可能。
  return {
    original: ingredient,
    resolution,
    linked: { ...ingredient },
  }
}

// ------------------------------------------------------------
// MISSION 2.39 向けの最小 match interface（Recipe Matching は実装しない）
// ------------------------------------------------------------

/**
 * 2 つの canonicalIngredientId が同一食材かを判定する。
 * **exact canonical id 一致のみ true**。alias 曖昧一致・parent category による match はしない。
 * どちらかが undefined なら false。
 */
export function ingredientIdentitiesMatch(
  a: CanonicalFoodId | undefined,
  b: CanonicalFoodId | undefined,
): boolean {
  if (a === undefined || b === undefined) return false
  return a === b
}

/**
 * MISSION 2.39 が使う match 分類の primitive。Recipe Matching 自体はしない。
 * @param recipeSideId  レシピ食材の canonicalIngredientId（未解決なら undefined）
 * @param stockSideId   在庫食材の canonicalIngredientId（無い/未解決なら undefined）
 * @param recipeResolutionAmbiguous / stockResolutionAmbiguous 解決が AMBIGUOUS だったか
 */
export function classifyIngredientIdentityMatch(
  recipeSideId: CanonicalFoodId | undefined,
  stockSideId: CanonicalFoodId | undefined,
  flags: { recipeResolutionAmbiguous?: boolean; stockResolutionAmbiguous?: boolean } = {},
): IngredientIdentityMatchKind {
  if (flags.recipeResolutionAmbiguous || flags.stockResolutionAmbiguous) return 'AMBIGUOUS'
  if (recipeSideId === undefined) return 'UNRESOLVED'
  if (stockSideId === undefined) return 'MISSING'
  return recipeSideId === stockSideId ? 'EXACT' : 'MISSING'
}
