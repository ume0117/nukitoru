// ============================================================
// recipe-evidence-summary.test.ts
//
// PUBLIC BETA RELEASE SPRINT 1 — Evidence UI用データ導出のテスト。
// 実際のコンポーネントrenderはこのリポジトリに前例が無い（jsdom/testing-library未導入）ため、
// UIが実際に表示する内容を決める唯一のデータ源であるrecipeEvidenceSummaryFor()を
// 直接検証する。
// ============================================================

import { describe, it, expect } from 'vitest'
import { recipeEvidenceSummaryFor } from '../recipe-evidence-summary'
import { applicableFieldsFor } from '../recipe-publishability'
import { RECIPE_CATALOG } from '../recipe-catalog'
import type { Recipe } from '@/features/food/types'

const toriTeriyaki = RECIPE_CATALOG.find((r) => r.id === 'tori-teriyaki')!
const butaShogayaki = RECIPE_CATALOG.find((r) => r.id === 'buta-shogayaki')!
// status='review' のRecipe（14件のうちの1つ）
const reviewRecipe = RECIPE_CATALOG.find((r) => r.verification?.status === 'review')!
// verification未設定のRecipe（28件のうちの1つ）
const unverifiedRecipe = RECIPE_CATALOG.find((r) => !r.verification)!

describe('recipeEvidenceSummaryFor — verified以外には絶対にnullを返す', () => {
  it('status=review の Recipe には null を返す（"確認済み"表現を review に出さない）', () => {
    expect(reviewRecipe.verification?.status).toBe('review')
    expect(recipeEvidenceSummaryFor(reviewRecipe)).toBeNull()
  })

  it('verification未設定（実効的unverified）の Recipe には null を返す', () => {
    expect(unverifiedRecipe.verification).toBeUndefined()
    expect(recipeEvidenceSummaryFor(unverifiedRecipe)).toBeNull()
  })

  it('verification.status="blocked" 相当の合成Recipeにも null を返す', () => {
    const blocked: Recipe = {
      ...toriTeriyaki,
      id: 'synthetic-blocked',
      verification: { ...toriTeriyaki.verification!, status: 'blocked' },
    }
    expect(recipeEvidenceSummaryFor(blocked)).toBeNull()
  })
})

describe('recipeEvidenceSummaryFor — status=verified の実データ（tori-teriyaki / buta-shogayaki）', () => {
  it.each([
    ['tori-teriyaki', toriTeriyaki],
    ['buta-shogayaki', butaShogayaki],
  ] as const)('%s: null ではない要約を返し、sourcesとverifiedFieldLabelsが空でない', (_id, recipe) => {
    const summary = recipeEvidenceSummaryFor(recipe)
    expect(summary).not.toBeNull()
    expect(summary!.sources.length).toBeGreaterThan(0)
    expect(summary!.verifiedFieldLabels.length).toBeGreaterThan(0)
  })

  it.each([
    ['tori-teriyaki', toriTeriyaki],
    ['buta-shogayaki', butaShogayaki],
  ] as const)('%s: sourcesは実在するEVIDENCE_SOURCE_CATALOG entryのpublisher/title/urlのみを持つ（本文コピーなし）', (_id, recipe) => {
    const summary = recipeEvidenceSummaryFor(recipe)!
    for (const source of summary.sources) {
      expect(source.publisher.length).toBeGreaterThan(0)
      expect(source.title.length).toBeGreaterThan(0)
      expect(source.url).toMatch(/^https?:\/\//)
    }
  })

  it.each([
    ['tori-teriyaki', toriTeriyaki],
    ['buta-shogayaki', butaShogayaki],
  ] as const)('%s: verifiedFieldLabelsはapplicableFieldsForと同じ件数（推測で水増ししない）', (_id, recipe) => {
    const summary = recipeEvidenceSummaryFor(recipe)!
    expect(summary.verifiedFieldLabels.length).toBe(applicableFieldsFor(recipe).length)
  })

  it('sourcesは重複しない（同じpublisher/title/urlの組を2回出さない）', () => {
    const summary = recipeEvidenceSummaryFor(butaShogayaki)!
    const keys = summary.sources.map((s) => `${s.publisher}|${s.title}|${s.url}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('存在しないsourceIdは静かに無視する（クラッシュしない）', () => {
    const withGhostSource: Recipe = {
      ...toriTeriyaki,
      verification: { ...toriTeriyaki.verification!, sourceIds: [...toriTeriyaki.verification!.sourceIds, 'ghost-source-id-not-in-catalog'] },
    }
    const summary = recipeEvidenceSummaryFor(withGhostSource)!
    expect(summary.sources.every((s) => s.url !== undefined)).toBe(true)
  })
})
