// ============================================================
// global-foundation.test.ts
//
// MISSION 2.11 PHASE E.1 — Global Foundation Gate (CB〜CN)。
// Locale/Country/Units/Canonical Food Identityの最小基盤が、
// 既存のJapan向け挙動（ingredient matching / Allergy HARD EXCLUSION /
// Evidence Resolution Protocol / 44 Recipeの内容・検証状態）を
// 一切破壊していないことを確認する回帰ゲート。
// ============================================================

import { describe, it, expect } from 'vitest'
import type {
  CountryCode,
  LanguageCode,
  Locale,
  Quantity,
  RecipeCuisine,
  RecipeEvidenceSource,
  RecipeProductDecision,
} from '@/features/food/types'
import {
  CANONICAL_FOOD_SAMPLE,
  getLabelsForCanonicalFood,
  labelsResolveToSameCanonicalFood,
  resolveCanonicalFoodId,
} from '../canonical-food'
import {
  SUPPORTED_COUNTRIES,
  SUPPORTED_LANGUAGES,
  isSupportedCountry,
  isSupportedLanguage,
  isSupportedLocale,
} from '../global-codes'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { hasUnresolvedRangeEvidence, isRecipePublishable } from '../recipe-publishability'
import { allergyRelevantIngredients } from '../recipe-safety'

const jaJP: Locale = { language: 'ja', country: 'JP' }
const enUS: Locale = { language: 'en', country: 'US' }

describe('Global Foundation Gate (CB〜CN)', () => {
  it('CB: locale.languageとlocale.countryは独立に設定できる（混同しない）', () => {
    // 同じcountry(US)でもlanguageが異なる組み合わせを表現できる（将来のen-GB等の布石）
    const enUSLocale: Locale = { language: 'en', country: 'US' }
    const hypotheticalJaUS: Locale = { language: 'ja', country: 'US' }
    expect(enUSLocale.country).toBe(hypotheticalJaUS.country)
    expect(enUSLocale.language).not.toBe(hypotheticalJaUS.language)
  })

  it('CC: cuisine（RecipeCuisine）とcountry（CountryCode）は別の型であり、一方から他方を導出しない', () => {
    const cuisine: RecipeCuisine = 'italian'
    const country: CountryCode = 'JP'
    // イタリア料理(cuisine)であることと、前提国(country)がJPであることは矛盾なく両立する
    expect(cuisine).toBe('italian')
    expect(country).toBe('JP')
  })

  it('CD: canonicalFoodIdの解決は表示ラベルに依存しない（ja labelでもen labelでも同じidに解決する）', () => {
    expect(resolveCanonicalFoodId('鶏肉', jaJP)).toBe('chicken')
    expect(resolveCanonicalFoodId('chicken', enUS)).toBe('chicken')
  })

  it('CE: rice_raw（米）とrice_cooked（ごはん）は別のcanonicalFoodIdのまま（D.2の区別を継承）', () => {
    expect(resolveCanonicalFoodId('米', jaJP)).toBe('rice_raw')
    expect(resolveCanonicalFoodId('ごはん', jaJP)).toBe('rice_cooked')
    expect(resolveCanonicalFoodId('米', jaJP)).not.toBe(resolveCanonicalFoodId('ごはん', jaJP))
  })

  it('CF: ja/enのlabelは同一のcanonicalFoodIdへ解決される', () => {
    expect(labelsResolveToSameCanonicalFood('鶏肉', jaJP, 'chicken', enUS)).toBe(true)
    expect(labelsResolveToSameCanonicalFood('玉ねぎ', jaJP, 'onion', enUS)).toBe(true)
    expect(labelsResolveToSameCanonicalFood('米', jaJP, 'cooked rice', enUS)).toBe(false)
  })

  it('CG: resolveCanonicalFoodIdはfuzzy matchingを行わない（近似文字列は解決しない）', () => {
    expect(resolveCanonicalFoodId('とりにく', jaJP)).toBeUndefined()
    expect(resolveCanonicalFoodId('chiken', enUS)).toBeUndefined()
  })

  it('CH: 辞書にない食材labelはundefined（unknownはunknownのまま、勝手に割り当てない）', () => {
    expect(resolveCanonicalFoodId('未知の食材xyz', jaJP)).toBeUndefined()
    expect(getLabelsForCanonicalFood('unknown_food_id')).toEqual([])
  })

  it('CI: Quantity.rawTextはEvidence Sourceの原文単位表記をそのまま保持できる（無言換算・丸め禁止）', () => {
    const qty: Quantity = { value: 1, unit: 'cup-jp', rawText: '1カップ(200ml)' }
    expect(qty.rawText).toBe('1カップ(200ml)')
    // US cup / metric cup / Japanese cupは意図的に別値のまま
    const usCup: Quantity = { value: 1, unit: 'cup-us' }
    const metricCup: Quantity = { value: 1, unit: 'cup-metric' }
    expect(usCup.unit).not.toBe(metricCup.unit)
    expect(usCup.unit).not.toBe(qty.unit)
  })

  it('CJ: range Evidenceは引き続きVERIFIED解決済みとしてカウントされない（Gate CAの回帰再確認）', () => {
    const recipeWithRange = RECIPE_CATALOG.find((r) =>
      r.verification?.fieldVerifications?.some((fv) => fv.supportType === 'range'),
    )
    expect(recipeWithRange).toBeDefined()
    expect(hasUnresolvedRangeEvidence(recipeWithRange!)).toBe(true)
    expect(isRecipePublishable(recipeWithRange!)).toBe(false)
  })

  it('CK: RecipeProductDecisionの値はisRecipePublishableのEvidence解決判定に一切使われない', () => {
    const recipeWithDecision = RECIPE_CATALOG.find(
      (r) => (r.verification?.productDecisions ?? []).length > 0,
    )
    expect(recipeWithDecision).toBeDefined()
    const decisions = recipeWithDecision!.verification!.productDecisions as RecipeProductDecision[]
    expect(decisions.length).toBeGreaterThan(0)
    // productDecisionsが存在していても、range fieldVerificationが解決済みにはならない
    expect(hasUnresolvedRangeEvidence(recipeWithDecision!)).toBe(true)
  })

  it('CL: 既存44 Recipeの件数は本PHASEで変化していない', () => {
    expect(RECIPE_CATALOG.length).toBe(44)
  })

  it('CM: verified状態のRecipe件数はGlobal Foundation自体によっては変化しない（MISSION 2.14B Recipe Coherence Correctionによりmedama-yakiもREVIEWへ差し戻され現在0件。本Gateの対象はGlobal Foundation側の変更とは無関係であることの確認）', () => {
    const verifiedIds = RECIPE_CATALOG.filter((r) => r.verification?.status === 'verified').map((r) => r.id)
    expect(verifiedIds).toEqual(['tori-teriyaki', 'buta-shogayaki']) /* MISSION 2.26: 初の VERIFIED。この Gate は当該 Foundation が件数を動かさないことの確認 */
  })

  it('CN: Allergy HARD EXCLUSIONはGlobal Foundation追加後も無傷（requiredIngredients+seasoningsのみ対象）', () => {
    const maguroDon = RECIPE_CATALOG.find((r) => r.id === 'maguro-don')
    expect(maguroDon).toBeDefined()
    const relevant = allergyRelevantIngredients(maguroDon!)
    expect(relevant).toContain('マグロ')
    // cookingLiquids（水・湯等）はアレルギー判定対象に含めない、という既存原則が
    // Global Foundation追加後も維持されていることを確認する
    const cookingLiquidNames = (maguroDon!.cookingLiquids ?? []).map((c) => c.name)
    for (const name of cookingLiquidNames) {
      expect(relevant).not.toContain(name)
    }
  })

  it('補足: CANONICAL_FOOD_SAMPLEは最小限（4 canonical food × ja-JP/en-USの8件）のまま', () => {
    const ids = new Set(CANONICAL_FOOD_SAMPLE.map((e) => e.canonicalFoodId))
    expect(ids).toEqual(new Set(['chicken', 'onion', 'rice_raw', 'rice_cooked']))
    expect(CANONICAL_FOOD_SAMPLE.length).toBe(8)
  })
})

// ============================================================
// MISSION 2.11 PHASE E.1.1 — Global Code Extensibility Gate (CO〜CZ)
// 「現在サポートしている値」と「世界で将来扱える基盤」の混同を是正したことを確認する。
// ============================================================

describe('Global Code Extensibility Gate (CO〜CZ)', () => {
  it('CO: CountryCodeはJP/USのみに構造的に限定されない（将来の国コードを型として保持できる）', () => {
    const futureCountry: CountryCode = 'GB'
    expect(futureCountry).toBe('GB')
    expect(isSupportedCountry(futureCountry)).toBe(false)
  })

  it('CP: LanguageCodeはja/enのみに構造的に限定されない（将来の言語コードを型として保持できる）', () => {
    const futureLanguage: LanguageCode = 'ko'
    expect(futureLanguage).toBe('ko')
    expect(isSupportedLanguage(futureLanguage)).toBe(false)
  })

  it('CQ: SUPPORTED_COUNTRIESは現在の正式サポート国のみを明示的に保持する（closed）', () => {
    expect(SUPPORTED_COUNTRIES).toEqual(['JP', 'US'])
  })

  it('CR: SUPPORTED_LANGUAGESは現在の正式サポート言語のみを明示的に保持する（closed）', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['ja', 'en'])
  })

  it('CS: ja-JP / en-USは引き続きサポート済みとして判定される', () => {
    expect(isSupportedLocale(jaJP)).toBe(true)
    expect(isSupportedLocale(enUS)).toBe(true)
    expect(isSupportedLanguage('ja')).toBe(true)
    expect(isSupportedLanguage('en')).toBe(true)
    expect(isSupportedCountry('JP')).toBe(true)
    expect(isSupportedCountry('US')).toBe(true)
  })

  it('CT: 未サポート/将来のlocaleは自動的にProduct-supportedにならない', () => {
    const koKR: Locale = { language: 'ko', country: 'KR' }
    expect(isSupportedLocale(koKR)).toBe(false)
  })

  it('CU: Evidence schemaは再設計なしに将来の国/localeを保持できる（RecipeEvidenceSourceの型のみ検証）', () => {
    const futureSource: RecipeEvidenceSource = {
      id: 'future-source-test',
      publisher: 'テスト用未来の情報源',
      title: 'テスト',
      url: 'https://example-trusted-source.example/test',
      sourceType: 'other-trusted',
      checkedAt: '2026-08-28',
      sourceCountry: 'GB',
      sourceLocale: { language: 'en', country: 'GB' },
    }
    expect(futureSource.sourceCountry).toBe('GB')
    expect(isSupportedCountry(futureSource.sourceCountry!)).toBe(false)
  })

  it('CV: Cuisine（RecipeCuisine）はCountry supportと無関係のまま（一方から他方を導出しない）', () => {
    const cuisine: RecipeCuisine = 'italian'
    const country: CountryCode = 'JP'
    expect(cuisine).toBe('italian')
    expect(isSupportedCountry(country)).toBe(true)
    // イタリア料理であることと、countryのサポート状況は独立している
  })

  it('CW: Allergy HARD EXCLUSIONは本FIX後も無傷（regression再確認）', () => {
    const maguroDon = RECIPE_CATALOG.find((r) => r.id === 'maguro-don')
    expect(maguroDon).toBeDefined()
    expect(allergyRelevantIngredients(maguroDon!)).toContain('マグロ')
  })

  it('CX: 既存44 Recipeの件数は本FIXで変化していない', () => {
    expect(RECIPE_CATALOG.length).toBe(44)
  })

  it('CY: verified状態のRecipe件数はGlobal Code Extensibility Fix自体によっては変化しない（sake-shioyaki・medama-yakiともにMISSION 2.14/2.14BのCORRECTIONによりREVIEWへ差し戻され現在0件）', () => {
    const verifiedIds = RECIPE_CATALOG.filter((r) => r.verification?.status === 'verified').map((r) => r.id)
    expect(verifiedIds).toEqual(['tori-teriyaki', 'buta-shogayaki']) /* MISSION 2.26: 初の VERIFIED。この Gate は当該 Foundation が件数を動かさないことの確認 */
  })

  it('CZ: CANONICAL_FOOD_SAMPLE（Gate CB〜CNのfixture）は本FIXで変化していない', () => {
    expect(CANONICAL_FOOD_SAMPLE.length).toBe(8)
    const recipeWithRange = RECIPE_CATALOG.find((r) =>
      r.verification?.fieldVerifications?.some((fv) => fv.supportType === 'range'),
    )
    expect(hasUnresolvedRangeEvidence(recipeWithRange!)).toBe(true)
    expect(isRecipePublishable(recipeWithRange!)).toBe(false)
  })
})
