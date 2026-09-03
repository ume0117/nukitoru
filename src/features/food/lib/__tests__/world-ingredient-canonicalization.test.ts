// ============================================================
// world-ingredient-canonicalization.test.ts
//
// MISSION 2.38 — World Ingredient Canonicalization Foundation。
// §28 の 40 要件 + firewall + determinism を固定する。
// ============================================================

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import type { RawRecipeImportCandidate, SourceIngredientKnowledge } from '@/features/food/types'
import {
  normalizeIngredientName,
  resolveWorldIngredientIdentity,
  getWorldIngredientIdentityById,
  canonicalizeSourceIngredientKnowledge,
  ingredientIdentitiesMatch,
  classifyIngredientIdentityMatch,
} from '../world-ingredient-canonicalization'
import {
  WORLD_INGREDIENT_IDENTITY_REGISTRY,
  listWorldIngredientIds,
} from '../world-ingredient-registry'
import {
  SYNTHETIC_AMBIGUOUS_REGISTRY,
  REGISTRY_WITH_SYNTHETIC_AMBIGUITY,
  SI_RESOLVES_JA,
  SI_RESOLVES_EN,
  SI_UNRESOLVED,
  SI_PLURAL_UNRESOLVED,
  SI_PRE_LINKED,
  SI_PRODUCT_NAME,
} from '../world-ingredient-fixtures'
import { CANONICAL_FOOD_SAMPLE } from '../canonical-food'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { isRecipePublishable, getVerificationStatus } from '../recipe-publishability'
import { practicalCookValidationStatusOf } from '../practical-cook-validation'
import { rankRecipes } from '../recipe-suggestion-engine'
import { allergyRelevantIngredients } from '../recipe-safety'
import { importRecipeCandidate } from '../world-recipe-import'
import { FIXTURE_A_PASS } from '../world-recipe-import-fixtures'
import { TORI_TERIYAKI_SOURCE_KNOWLEDGE } from '../world-food-fixtures'

const r = (name: string, lang: 'ja' | 'en' | undefined) =>
  resolveWorldIngredientIdentity(name, lang)

// ============================================================
// §28.1–13 — Resolution 基本挙動
// ============================================================

describe('MISSION 2.38 — resolution basics', () => {
  it('1. Japanese exact name → RESOLVED', () => {
    const res = r('じゃがいも', 'ja')
    expect(res.status).toBe('RESOLVED')
    expect(res.canonicalIngredientId).toBe('potato')
  })

  it('2. English exact name → RESOLVED', () => {
    expect(r('potato', 'en').canonicalIngredientId).toBe('potato')
    expect(r('soy sauce', 'en').canonicalIngredientId).toBe('soy_sauce')
  })

  it('3. explicit Japanese alias → RESOLVED', () => {
    expect(r('ジャガイモ', 'ja').canonicalIngredientId).toBe('potato')
    expect(r('馬鈴薯', 'ja').canonicalIngredientId).toBe('potato')
    expect(r('醤油', 'ja').canonicalIngredientId).toBe('soy_sauce')
    expect(r('たまご', 'ja').canonicalIngredientId).toBe('egg')
  })

  it('4. case normalization（POTATO / Potato → potato）', () => {
    expect(r('POTATO', 'en').canonicalIngredientId).toBe('potato')
    expect(r('Potato', 'en').canonicalIngredientId).toBe('potato')
    expect(r('SoY SaUcE', 'en').canonicalIngredientId).toBe('soy_sauce')
  })

  it('5. whitespace normalization（前後空白・連続空白）', () => {
    expect(r('  potato  ', 'en').canonicalIngredientId).toBe('potato')
    expect(r('chicken   thigh', 'en').canonicalIngredientId).toBe('chicken_thigh')
    expect(r('\tsoy sauce\n', 'en').canonicalIngredientId).toBe('soy_sauce')
  })

  it('6. Unicode normalization（全角英字 → 半角）', () => {
    expect(r('ｐｏｔａｔｏ', 'en').canonicalIngredientId).toBe('potato')
    expect(r('ＰＯＴＡＴＯ', 'en').canonicalIngredientId).toBe('potato')
  })

  it('6b. NFKC はひらがな↔カタカナを統合しない（明示 alias が必要）', () => {
    // 「じゃがいも」は canonical、「ジャガイモ」は明示 alias。両方登録されているから解決する。
    // 登録されていないカタカナ表記は解決しない（下記 7 で確認）。
    expect(normalizeIngredientName('じゃがいも')).not.toBe(normalizeIngredientName('ジャガイモ'))
  })

  it('7. unknown ingredient → UNRESOLVED', () => {
    expect(r('quokka berry', 'en').status).toBe('UNRESOLVED')
    expect(r('未知の野菜', 'ja').status).toBe('UNRESOLVED')
    expect(r('', 'en').status).toBe('UNRESOLVED')
  })

  it('8. ambiguous alias → AMBIGUOUS', () => {
    const res = resolveWorldIngredientIdentity('spring-onion-test', 'en', REGISTRY_WITH_SYNTHETIC_AMBIGUITY)
    expect(res.status).toBe('AMBIGUOUS')
  })

  it('9. AMBIGUOUS で勝手に 1 件選ばない（candidateIds に複数・canonicalIngredientId なし）', () => {
    const res = resolveWorldIngredientIdentity('spring-onion-test', 'en', REGISTRY_WITH_SYNTHETIC_AMBIGUITY)
    expect(res.canonicalIngredientId).toBeUndefined()
    expect(res.identity).toBeUndefined()
    expect(res.candidateIds).toEqual(['synthetic_leek', 'synthetic_scallion'])
  })

  it('10. fuzzy typo → UNRESOLVED（potate / tomatoo）', () => {
    expect(r('potate', 'en').status).toBe('UNRESOLVED')
    expect(r('tomatoo', 'en').status).toBe('UNRESOLVED')
    expect(r('しょゆ', 'ja').status).toBe('UNRESOLVED')
  })

  it('11. partial substring → UNRESOLVED（"pot" / "chicken t" / "オリーブ"）', () => {
    expect(r('pot', 'en').status).toBe('UNRESOLVED')
    expect(r('chicken t', 'en').status).toBe('UNRESOLVED')
    expect(r('オリーブ', 'ja').status).toBe('UNRESOLVED')
    // "soy" は "soy sauce" / "soy milk" の部分文字列だが解決しない
    expect(r('soy', 'en').status).toBe('UNRESOLVED')
  })

  it('12. automatic translation しない（en 名で ja 検索しても解決しない・逆も）', () => {
    expect(r('potato', 'ja').status).toBe('UNRESOLVED')
    expect(r('じゃがいも', 'en').status).toBe('UNRESOLVED')
  })

  it('13. singular/plural を勝手に推測しない（potatoes は未登録 → UNRESOLVED）', () => {
    expect(r('potatoes', 'en').status).toBe('UNRESOLVED')
    expect(r('eggs', 'en').status).toBe('UNRESOLVED')
    expect(r('onions', 'en').status).toBe('UNRESOLVED')
  })

  it('language を省略すると全言語照合（ただし exact のみ）', () => {
    expect(resolveWorldIngredientIdentity('potato', undefined).canonicalIngredientId).toBe('potato')
    expect(resolveWorldIngredientIdentity('じゃがいも', undefined).canonicalIngredientId).toBe('potato')
  })
})

// ============================================================
// §28.14 — canonicalIngredientId の安定性
// ============================================================

describe('MISSION 2.38 — id stability', () => {
  it('14. canonicalIngredientId が安定（複数回呼んでも同じ）', () => {
    for (let i = 0; i < 5; i++) {
      expect(r('じゃがいも', 'ja').canonicalIngredientId).toBe('potato')
      expect(r('鶏もも肉', 'ja').canonicalIngredientId).toBe('chicken_thigh')
    }
  })

  it('registry の id は既存 canonical-food.ts（chicken / onion / rice_raw / rice_cooked）と整合', () => {
    const sampleIds = new Set(CANONICAL_FOOD_SAMPLE.map((s) => s.canonicalFoodId))
    const ids = new Set(listWorldIngredientIds())
    for (const shared of ['chicken', 'onion', 'rice_raw', 'rice_cooked']) {
      expect(sampleIds.has(shared), `canonical-food.ts に ${shared}`).toBe(true)
      expect(ids.has(shared), `registry に ${shared}`).toBe(true)
    }
  })

  it('registry の全 id が一意', () => {
    const ids = listWorldIngredientIds()
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('parentCanonicalIngredientId は registry 内の別 id を指す（自動親子推論なし・明示のみ）', () => {
    for (const identity of WORLD_INGREDIENT_IDENTITY_REGISTRY) {
      if (identity.parentCanonicalIngredientId) {
        expect(listWorldIngredientIds()).toContain(identity.parentCanonicalIngredientId)
        expect(identity.parentCanonicalIngredientId).not.toBe(identity.canonicalIngredientId)
      }
    }
  })
})

// ============================================================
// §28.15–20 — Source Fact preservation / connection
// ============================================================

describe('MISSION 2.38 — SourceIngredientKnowledge connection', () => {
  it('15/16/17/18. sourceName / quantity / unit / preparation は canonicalize で不変', () => {
    const out = canonicalizeSourceIngredientKnowledge(SI_RESOLVES_JA)
    expect(out.resolution.status).toBe('RESOLVED')
    // original 不変
    expect(SI_RESOLVES_JA.canonicalIngredientId).toBeUndefined()
    // linked は id リンクだけ追加、他は同一
    expect(out.linked.canonicalIngredientId).toBe('potato')
    expect(out.linked.sourceIngredientName).toBe('じゃがいも')
    expect(out.linked.quantity).toEqual(SI_RESOLVES_JA.quantity)
    expect(out.linked.quantity?.semantics).toEqual({ kind: 'range', min: 280, max: 320, unit: 'g' })
    expect(out.linked.preparationState).toBe('皮をむいて4等分')
    expect(out.linked.role).toBe('required')
    expect(out.linked.originalLanguage).toBe('ja')
  })

  it('12b. canonicalize は sourceName を翻訳しない（"potatoes" のまま）', () => {
    const out = canonicalizeSourceIngredientKnowledge(SI_PLURAL_UNRESOLVED)
    expect(out.resolution.status).toBe('UNRESOLVED')
    expect(out.linked.sourceIngredientName).toBe('potatoes')
    expect(out.linked.canonicalIngredientId).toBeUndefined()
  })

  it('19. unknown ingredient でも SourceIngredientKnowledge は保持（Import 失敗にしない）', () => {
    const out = canonicalizeSourceIngredientKnowledge(SI_UNRESOLVED)
    expect(out.resolution.status).toBe('UNRESOLVED')
    expect(out.linked.sourceIngredientName).toBe('quokka berry')
    expect(out.linked.quantity).toEqual(SI_UNRESOLVED.quantity)
  })

  it('20. resolved のとき canonicalIngredientId "だけ" が追加される', () => {
    const out = canonicalizeSourceIngredientKnowledge(SI_RESOLVES_EN)
    const { canonicalIngredientId: _omit, ...restLinked } = out.linked
    const { canonicalIngredientId: _omit2, ...restOriginal } = SI_RESOLVES_EN
    expect(restLinked).toEqual(restOriginal)
    expect(out.linked.canonicalIngredientId).toBe('potato')
  })

  it('既存 canonicalIngredientId は保持・再解決しない', () => {
    const out = canonicalizeSourceIngredientKnowledge(SI_PRE_LINKED)
    expect(out.resolution.status).toBe('RESOLVED')
    expect(out.resolution.reason).toContain('既に設定済み')
    expect(out.linked.canonicalIngredientId).toBe('onion')
  })

  it('39. original input object を mutate しない', () => {
    const before = JSON.stringify(SI_RESOLVES_JA)
    canonicalizeSourceIngredientKnowledge(SI_RESOLVES_JA)
    canonicalizeSourceIngredientKnowledge(SI_RESOLVES_JA)
    expect(JSON.stringify(SI_RESOLVES_JA)).toBe(before)
    expect(SI_RESOLVES_JA.canonicalIngredientId).toBeUndefined()
  })

  it('38. imported SourceRecipeKnowledge の ingredient を canonicalize できる（接続点）', () => {
    const res = importRecipeCandidate(FIXTURE_A_PASS, { importedAt: '2026-09-03' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const egg = res.knowledge.ingredients.find((i) => i.sourceIngredientName === 'egg')!
    const out = canonicalizeSourceIngredientKnowledge(egg, WORLD_INGREDIENT_IDENTITY_REGISTRY, res.knowledge.sourceLanguage)
    expect(out.resolution.status).toBe('RESOLVED')
    expect(out.linked.canonicalIngredientId).toBe('egg')
    // 元の import 済み knowledge は変わっていない
    expect(egg.canonicalIngredientId).toBeUndefined()
  })

  it('MISSION 2.35 の実 fixture（TORI_TERIYAKI）の食材も canonicalize できる', () => {
    const shoyu = TORI_TERIYAKI_SOURCE_KNOWLEDGE.ingredients.find((i) => i.sourceIngredientName === 'しょうゆ')!
    const out = canonicalizeSourceIngredientKnowledge(shoyu, WORLD_INGREDIENT_IDENTITY_REGISTRY, 'ja')
    expect(out.linked.canonicalIngredientId).toBe('soy_sauce')
    // 実 fixture は不変
    expect(shoyu.canonicalIngredientId).toBeUndefined()
  })
})

// ============================================================
// §28.21–26 — Variant / State / Product を潰さない
// ============================================================

describe('MISSION 2.38 — variant / state / product boundaries', () => {
  it('21. chicken ≠ chicken thigh', () => {
    expect(r('chicken', 'en').canonicalIngredientId).toBe('chicken')
    expect(r('chicken thigh', 'en').canonicalIngredientId).toBe('chicken_thigh')
    expect(ingredientIdentitiesMatch('chicken', 'chicken_thigh')).toBe(false)
    expect(r('鶏肉', 'ja').canonicalIngredientId).toBe('chicken')
    expect(r('鶏もも肉', 'ja').canonicalIngredientId).toBe('chicken_thigh')
  })

  it('22. tomato ≠ cherry tomato', () => {
    expect(r('tomato', 'en').canonicalIngredientId).toBe('tomato')
    expect(r('cherry tomato', 'en').canonicalIngredientId).toBe('cherry_tomato')
    expect(ingredientIdentitiesMatch('tomato', 'cherry_tomato')).toBe(false)
  })

  it('23. milk ≠ soy milk（名前に "milk" を含むが別 Identity・親子関係も無い）', () => {
    expect(r('milk', 'en').canonicalIngredientId).toBe('milk')
    expect(r('soy milk', 'en').canonicalIngredientId).toBe('soy_milk')
    expect(ingredientIdentitiesMatch('milk', 'soy_milk')).toBe(false)
    expect(getWorldIngredientIdentityById('soy_milk')?.parentCanonicalIngredientId).toBeUndefined()
  })

  it('24. olive oil ≠ sesame oil', () => {
    expect(r('olive oil', 'en').canonicalIngredientId).toBe('olive_oil')
    expect(r('sesame oil', 'en').canonicalIngredientId).toBe('sesame_oil')
    expect(r('ごま油', 'ja').canonicalIngredientId).toBe('sesame_oil')
    expect(ingredientIdentitiesMatch('olive_oil', 'sesame_oil')).toBe(false)
  })

  it('25. raw / prepared state を Identity と混ぜない（rice_raw ≠ rice_cooked。"boiled potato" は解決しない）', () => {
    expect(r('米', 'ja').canonicalIngredientId).toBe('rice_raw')
    expect(r('ごはん', 'ja').canonicalIngredientId).toBe('rice_cooked')
    expect(ingredientIdentitiesMatch('rice_raw', 'rice_cooked')).toBe(false)
    // 状態つきの名前は登録されていない → 勝手に potato へ寄せない
    expect(r('boiled potato', 'en').status).toBe('UNRESOLVED')
    expect(r('ゆでじゃがいも', 'ja').status).toBe('UNRESOLVED')
    // Identity 型に state/preparation フィールドが無い
    for (const identity of WORLD_INGREDIENT_IDENTITY_REGISTRY) {
      expect(identity).not.toHaveProperty('state')
      expect(identity).not.toHaveProperty('preparation')
    }
  })

  it('26. Product Identity と Generic Ingredient を混ぜない（商品名は UNRESOLVED）', () => {
    expect(r('キッコーマン特選丸大豆しょうゆ', 'ja').status).toBe('UNRESOLVED')
    const out = canonicalizeSourceIngredientKnowledge(SI_PRODUCT_NAME)
    expect(out.resolution.status).toBe('UNRESOLVED')
    expect(out.linked.canonicalIngredientId).toBeUndefined()
  })
})

// ============================================================
// §28.27–33 — Firewalls（Allergen / Substitution / Unit / Rights / VERIFIED / Practical / AI）
// ============================================================

describe('MISSION 2.38 — firewalls', () => {
  it('27. canonicalization から allergen を生成しない（soy_sauce 解決 → allergen フィールド無し）', () => {
    const res = r('しょうゆ', 'ja')
    expect(res.canonicalIngredientId).toBe('soy_sauce')
    expect(res.identity).not.toHaveProperty('allergens')
    expect(res.identity).not.toHaveProperty('allergenRelations')
    expect(res).not.toHaveProperty('allergens')
    const out = canonicalizeSourceIngredientKnowledge({
      sourceIngredientName: 'しょうゆ',
      originalLanguage: 'ja',
      role: 'seasoning',
    })
    expect(out.linked).not.toHaveProperty('allergens')
  })

  it('28. substitution を生成しない（resolution / identity に substitution 概念が無い）', () => {
    const res = r('オリーブオイル', 'ja')
    expect(res.identity).not.toHaveProperty('substitutes')
    expect(res.identity).not.toHaveProperty('substitutions')
    expect(res).not.toHaveProperty('substitutes')
  })

  it('29. unit conversion をしない（quantity semantics が range のまま）', () => {
    const out = canonicalizeSourceIngredientKnowledge(SI_RESOLVES_JA)
    expect(out.linked.quantity?.semantics).toEqual({ kind: 'range', min: 280, max: 320, unit: 'g' })
    expect(out.linked.quantity?.displayText).toBe('中2個（約300g）')
  })

  it('30. Rights Gate を迂回しない（world-recipe-import の BLOCK は canonicalize しても BLOCK のまま）', () => {
    // Rights BLOCK される candidate は importRecipeCandidate で ok:false のまま
    const blocked: RawRecipeImportCandidate = {
      ...FIXTURE_A_PASS,
      recordRights: { ...FIXTURE_A_PASS.recordRights, rightsStatus: 'unknown' },
    }
    const res = importRecipeCandidate(blocked, { importedAt: '2026-09-03' })
    expect(res.ok).toBe(false)
    // canonicalization モジュールは world-recipe-import を import していない（下の firewall テストで固定）
  })

  it('31. Import ≠ VERIFIED（canonicalize は verification を設定しない）', () => {
    const out = canonicalizeSourceIngredientKnowledge(SI_RESOLVES_JA)
    expect(out.linked).not.toHaveProperty('verification')
    expect(out).not.toHaveProperty('verification')
  })

  it('32. Import ≠ Practical Validated', () => {
    const out = canonicalizeSourceIngredientKnowledge(SI_RESOLVES_JA)
    expect(out.linked).not.toHaveProperty('practicalCookValidation')
  })
})

// ============================================================
// §28.34–37 — 既存機能 Regression
// ============================================================

describe('MISSION 2.38 — existing behavior unchanged', () => {
  const tori = () => RECIPE_CATALOG.find((x) => x.id === 'tori-teriyaki')!
  const buta = () => RECIPE_CATALOG.find((x) => x.id === 'buta-shogayaki')!

  it('34. tori-teriyaki VERIFIED / publishable 不変', () => {
    expect(getVerificationStatus(tori())).toBe('verified')
    expect(isRecipePublishable(tori())).toBe(true)
    r('じゃがいも', 'ja') // canonicalization を走らせても
    expect(isRecipePublishable(tori())).toBe(true)
  })

  it('35. buta-shogayaki VERIFIED / publishable 不変', () => {
    expect(getVerificationStatus(buta())).toBe('verified')
    expect(isRecipePublishable(buta())).toBe(true)
  })

  it('36. Allergy Gate 不変（小麦 / 大豆 / 鶏肉 で tori-teriyaki は HARD EXCLUDE）', () => {
    const base = { availableIngredientNames: ['鶏もも肉'], dislikeNames: [] as string[], maxCookingMinutes: null }
    for (const allergen of ['小麦', '大豆', '鶏肉']) {
      expect(
        rankRecipes(RECIPE_CATALOG, { ...base, allergyNames: [allergen] }).some((c) => c.recipe.id === 'tori-teriyaki'),
      ).toBe(false)
    }
    expect(allergyRelevantIngredients(tori())).toContain('しょうゆ')
  })

  it('37. MISSION 2.37 Import Pipeline regression（FIXTURE_A_PASS は引き続き PASS）', () => {
    const res = importRecipeCandidate(FIXTURE_A_PASS, { importedAt: '2026-09-03' })
    expect(res.ok).toBe(true)
  })

  it('Practical Validation status 不変', () => {
    for (const id of ['tori-teriyaki', 'buta-shogayaki']) {
      expect(practicalCookValidationStatusOf(RECIPE_CATALOG.find((x) => x.id === id)!)).toBe('not-tested')
    }
  })
})

// ============================================================
// §28.40 — Determinism + match interface
// ============================================================

describe('MISSION 2.38 — determinism & match interface', () => {
  it('40. deterministic output（同じ入力 → 完全に同じ結果オブジェクト）', () => {
    const a = JSON.stringify(r('鶏もも肉', 'ja'))
    const b = JSON.stringify(r('鶏もも肉', 'ja'))
    expect(a).toBe(b)
    const c = JSON.stringify(canonicalizeSourceIngredientKnowledge(SI_RESOLVES_JA))
    const d = JSON.stringify(canonicalizeSourceIngredientKnowledge(SI_RESOLVES_JA))
    expect(c).toBe(d)
  })

  it('ingredientIdentitiesMatch は exact のみ（undefined は false・parent で match しない）', () => {
    expect(ingredientIdentitiesMatch('potato', 'potato')).toBe(true)
    expect(ingredientIdentitiesMatch('potato', undefined)).toBe(false)
    expect(ingredientIdentitiesMatch(undefined, undefined)).toBe(false)
    expect(ingredientIdentitiesMatch('chicken_thigh', 'chicken')).toBe(false)
  })

  it('classifyIngredientIdentityMatch は EXACT / MISSING / UNRESOLVED / AMBIGUOUS を返す', () => {
    expect(classifyIngredientIdentityMatch('potato', 'potato')).toBe('EXACT')
    expect(classifyIngredientIdentityMatch('potato', 'onion')).toBe('MISSING')
    expect(classifyIngredientIdentityMatch('potato', undefined)).toBe('MISSING')
    expect(classifyIngredientIdentityMatch(undefined, 'potato')).toBe('UNRESOLVED')
    expect(classifyIngredientIdentityMatch('potato', 'potato', { recipeResolutionAmbiguous: true })).toBe('AMBIGUOUS')
  })

  it('normalizeIngredientName は determinism（idempotent）', () => {
    const once = normalizeIngredientName('  Ｐｏｔａｔｏ  ')
    expect(normalizeIngredientName(once)).toBe(once)
    expect(once).toBe('potato')
  })
})

// ============================================================
// §28.33 + firewall — module import graph（AI / Allergy / Rights / Verification なし）
// ============================================================

describe('MISSION 2.38 — module firewall', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const read = (rel: string) => readFileSync(resolve(here, '..', rel), 'utf8')

  const FORBIDDEN = [
    './ingredient-normalization',
    './ingredient-taxonomy',
    './ingredient-allergens',
    './recipe-safety',
    './recipe-publishability',
    './practical-cook-validation',
    './recipe-catalog',
    './recipe-suggestion-engine',
    './mock-meal-provider',
    './world-recipe-import',
    './ai-provider',
    './from-now-to-table',
    './recipe-time',
  ]

  for (const file of [
    'world-ingredient-canonicalization.ts',
    'world-ingredient-registry.ts',
    'world-ingredient-fixtures.ts',
  ]) {
    it(`${file} が Allergy / Rights / Verification / AI モジュールを import しない`, () => {
      const src = read(file)
      for (const mod of FORBIDDEN) {
        expect(src.includes(`from '${mod}'`), `${file} imports ${mod}`).toBe(false)
      }
      // 33. AI 処理なし
      expect(/\bfetch\s*\(/.test(src)).toBe(false)
      expect(/openai|anthropic|embedding|\bLLM\b/i.test(src.replace(/AI 処理|AI synonym|AI ingredient/g, ''))).toBe(false)
    })
  }

  it('33b. canonicalization は純粋関数のみ（Math.random / Date.now を使わない）', () => {
    const src = read('world-ingredient-canonicalization.ts')
    expect(src.includes('Math.random')).toBe(false)
    expect(src.includes('Date.now')).toBe(false)
    expect(src.includes('new Date')).toBe(false)
  })
})

// ============================================================
// SYNTHETIC fixture discipline
// ============================================================

describe('MISSION 2.38 — SYNTHETIC fixture discipline', () => {
  it('SYNTHETIC_AMBIGUOUS_REGISTRY は本番 registry に混ざっていない', () => {
    const realIds = new Set(listWorldIngredientIds())
    for (const s of SYNTHETIC_AMBIGUOUS_REGISTRY) {
      expect(realIds.has(s.canonicalIngredientId)).toBe(false)
      expect(s.canonicalIngredientId.startsWith('synthetic_')).toBe(true)
      expect(s.category).toBe('SYNTHETIC')
    }
  })

  it('本番 registry に SYNTHETIC カテゴリの Identity は無い', () => {
    for (const i of WORLD_INGREDIENT_IDENTITY_REGISTRY) {
      expect(i.category).not.toBe('SYNTHETIC')
    }
  })

  it('本番 registry は 10〜25 Identity（巨大辞書ではない）', () => {
    expect(WORLD_INGREDIENT_IDENTITY_REGISTRY.length).toBeGreaterThanOrEqual(10)
    expect(WORLD_INGREDIENT_IDENTITY_REGISTRY.length).toBeLessThanOrEqual(25)
  })
})
