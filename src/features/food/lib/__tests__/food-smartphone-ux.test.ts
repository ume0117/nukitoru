// ============================================================
// food-smartphone-ux.test.ts
//
// MISSION 2.40 — Smartphone Food Decision & Swipe Cooking UX Foundation。
// §45（Domain/UI boundary）§46（Swipe）§47（Existing features）を固定する。
// ============================================================

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import type { CookingSession, NukitoruPresentation, PresentationStep } from '@/features/food/types'
import {
  availabilityLabel,
  availabilityLabelJa,
  headlineJa,
  groupIngredientsByLabel,
  toRecipeMatchPresentation,
  toForwardMatchListPresentation,
  toRecipeDetailPresentation,
  NO_CANDIDATES_TEXT,
  RANKING_MEANING_TEXT,
  AVAILABILITY_LABEL_ORDER,
} from '../food-match-presentation'
import {
  createCookingSession,
  currentStepView,
  progressText,
  advanceStep,
  retreatStep,
  classifySwipe,
  applySwipe,
  applySwipeInput,
  goToNextStep,
  goToPreviousStep,
  isCompleted,
  totalSteps,
  DEFAULT_SWIPE_CONFIG,
} from '../cooking-navigation'
import {
  buildFoodShareText,
  buildFoodShareHashtags,
  buildSnsShareUrls,
  factualTagsFrom,
  BRAND_HASHTAGS,
  FOOD_SHARE_URL,
} from '../food-share'
import { evaluateRecipeAgainstStock, matchRecipesFromStock } from '../food-matching'
import {
  SYN_RECIPE_3,
  SYN_RECIPE_UNRESOLVED,
  SYN_RECIPE_AMBIGUOUS,
  SYN_OCC_SNACK,
  SYN_OCC_BENTO,
  SYN_OCC_UNKNOWN,
  SYN_OCC_BREAKFAST_LUNCH,
  SYNTHETIC_MATCHING_RECIPES,
  STOCK_ALL_FOR_3,
  STOCK_GARLIC_MISSING,
  STOCK_2_MISSING,
  STOCK_POTATO_LOW,
  STOCK_ONION_ONLY,
} from '../food-matching-fixtures'
import { REGISTRY_WITH_SYNTHETIC_AMBIGUITY } from '../world-ingredient-fixtures'
import {
  TORI_TERIYAKI_PRESENTATION,
  TORI_TERIYAKI_SOURCE_KNOWLEDGE,
  SOURCE_RECIPE_KNOWLEDGE_FIXTURES,
} from '../world-food-fixtures'
import { WORLD_RECIPE_IDENTITY_REGISTRY } from '../world-recipe-identity'
import { getWorldRecipeIdentityById } from '../world-food-knowledge'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { isRecipePublishable, getVerificationStatus } from '../recipe-publishability'
import { practicalCookValidationStatusOf } from '../practical-cook-validation'
import { rankRecipes } from '../recipe-suggestion-engine'
import { buildCandidateShareText } from '../family-share'

const AMBIG = { ingredientRegistry: REGISTRY_WITH_SYNTHETIC_AMBIGUITY }
const p = (r: NukitoruPresentation) => createCookingSession(r)

// ============================================================
// §45 — Ingredient Match Presentation
// ============================================================

describe('MISSION 2.40 §45 — ingredient match presentation', () => {
  it('EXACT → 家にある / LOW → 少ない / MISSING → 足りない', () => {
    expect(availabilityLabel('EXACT')).toBe('at-home')
    expect(availabilityLabel('LOW')).toBe('low')
    expect(availabilityLabel('MISSING')).toBe('missing')
    expect(availabilityLabelJa('at-home')).toBe('家にある')
    expect(availabilityLabelJa('low')).toBe('少ない')
    expect(availabilityLabelJa('missing')).toBe('足りない')
  })

  it('UNRESOLVED → 確認が必要 / AMBIGUOUS → 確認が必要（表示は統合）', () => {
    expect(availabilityLabel('UNRESOLVED')).toBe('needs-check')
    expect(availabilityLabel('AMBIGUOUS')).toBe('needs-check')
    expect(availabilityLabelJa('needs-check')).toBe('確認が必要')
  })

  it('unresolved / ambiguous の内部区別は presentation でも保持される', () => {
    const resU = evaluateRecipeAgainstStock(SYN_RECIPE_UNRESOLVED, STOCK_2_MISSING)
    const presU = toRecipeMatchPresentation(resU)
    expect(presU.unresolvedCount).toBe(1)
    expect(presU.ambiguousCount).toBe(0)
    expect(presU.needsCheckCount).toBe(1)

    const resA = evaluateRecipeAgainstStock(SYN_RECIPE_AMBIGUOUS, STOCK_2_MISSING, AMBIG)
    const presA = toRecipeMatchPresentation(resA)
    expect(presA.unresolvedCount).toBe(0)
    expect(presA.ambiguousCount).toBe(1)
    expect(presA.needsCheckCount).toBe(1)

    // 内部 matchClass も別のまま
    const u = presU.ingredients.find((i) => i.internalMatchClass === 'UNRESOLVED')
    const a = presA.ingredients.find((i) => i.internalMatchClass === 'AMBIGUOUS')
    expect(u).toBeDefined()
    expect(a).toBeDefined()
  })

  it('Forward result presentation（全 EXACT）', () => {
    const res = evaluateRecipeAgainstStock(SYN_RECIPE_3, STOCK_ALL_FOR_3)
    const pres = toRecipeMatchPresentation(res)
    expect(pres.atHomeCount).toBe(3)
    expect(pres.missingCount).toBe(0)
    expect(pres.headline).toBe('ALL_LISTED_AT_HOME')
    expect(pres.ingredients.every((i) => i.label === 'at-home')).toBe(true)
  })

  it('Reverse result presentation（1 MISSING）', () => {
    const res = evaluateRecipeAgainstStock(SYN_RECIPE_3, STOCK_GARLIC_MISSING)
    const pres = toRecipeMatchPresentation(res)
    expect(pres.missingCount).toBe(1)
    expect(pres.headline).toBe('SOME_MISSING')
    const groups = groupIngredientsByLabel(pres)
    expect(groups.missing).toHaveLength(1)
    expect(groups['at-home']).toHaveLength(2)
  })

  it('§13 Quantity overclaim なし: 「十分」「これだけで作れる」を headline に出さない', () => {
    for (const h of ['ALL_LISTED_AT_HOME', 'SOME_MISSING', 'NEEDS_CHECK_ONLY'] as const) {
      const text = headlineJa(h)
      expect(text).not.toContain('十分')
      expect(text).not.toContain('これだけで')
      expect(text).not.toContain('作れます')
    }
    expect(headlineJa('ALL_LISTED_AT_HOME')).toContain('分量は未確認')
    // 各材料に quantityNote='not-evaluated'
    const pres = toRecipeMatchPresentation(evaluateRecipeAgainstStock(SYN_RECIPE_3, STOCK_ALL_FOR_3))
    expect(pres.ingredients.every((i) => i.quantityNote === 'not-evaluated')).toBe(true)
  })

  it('§13 LOW を「十分」扱いしない（headline は NEEDS_CHECK_ONLY にも SOME_MISSING にもならず ALL_LISTED_AT_HOME だが分量未確認明記）', () => {
    const pres = toRecipeMatchPresentation(evaluateRecipeAgainstStock(SYN_RECIPE_3, STOCK_POTATO_LOW))
    expect(pres.lowCount).toBe(1)
    expect(pres.headline).toBe('ALL_LISTED_AT_HOME')
    const low = pres.ingredients.find((i) => i.label === 'low')!
    expect(low.quantityNote).toBe('not-evaluated')
  })

  it('§38 「あと○個」は missingCount のみ（needs-check を混ぜない）', () => {
    // EXACT=1, MISSING=0, UNRESOLVED=1
    const pres = toRecipeMatchPresentation(evaluateRecipeAgainstStock(SYN_RECIPE_UNRESOLVED, STOCK_2_MISSING))
    expect(pres.shoppingHint.missingCount).toBe(0)
    expect(pres.needsCheckCount).toBe(1)
    // EXACT=2, MISSING=1
    const pres2 = toRecipeMatchPresentation(evaluateRecipeAgainstStock(SYN_RECIPE_3, STOCK_GARLIC_MISSING))
    expect(pres2.shoppingHint.missingCount).toBe(1)
    expect(pres2.shoppingHint.missingCanonicalIngredientIds).toEqual(['garlic'])
  })

  it('AVAILABILITY_LABEL_ORDER は at-home → low → missing → needs-check', () => {
    expect(AVAILABILITY_LABEL_ORDER).toEqual(['at-home', 'low', 'missing', 'needs-check'])
  })
})

// ============================================================
// §45 — Meal Occasion presentation
// ============================================================

describe('MISSION 2.40 §45 — meal occasion presentation', () => {
  it('snack: 明示 metadata → mealOccasionLabels に「おやつ」', () => {
    const pres = toRecipeMatchPresentation(evaluateRecipeAgainstStock(SYN_OCC_SNACK, STOCK_ONION_ONLY))
    expect(pres.mealOccasions).toEqual(['snack'])
    expect(pres.mealOccasionLabels).toEqual(['おやつ'])
  })

  it('bento: → 「お弁当」（Food Safety 断定なし）', () => {
    const pres = toRecipeMatchPresentation(evaluateRecipeAgainstStock(SYN_OCC_BENTO, STOCK_ONION_ONLY))
    expect(pres.mealOccasionLabels).toEqual(['お弁当'])
    expect(pres).not.toHaveProperty('foodSafe')
    expect(pres).not.toHaveProperty('storageSafe')
  })

  it('breakfast + lunch: 複数 occasion ラベル', () => {
    const pres = toRecipeMatchPresentation(evaluateRecipeAgainstStock(SYN_OCC_BREAKFAST_LUNCH, STOCK_ONION_ONLY))
    expect(pres.mealOccasionLabels).toEqual(['朝食', '昼食'])
  })

  it('unknown occasion: metadata 無し → mealOccasionLabels は []（推測しない）', () => {
    const pres = toRecipeMatchPresentation(evaluateRecipeAgainstStock(SYN_OCC_UNKNOWN, STOCK_ONION_ONLY))
    expect(pres.mealOccasions).toEqual([])
    expect(pres.mealOccasionLabels).toEqual([])
  })

  it('Occasion filtering は MISSION 2.39 の STRICT policy をそのまま使う（presentation で変えない）', () => {
    const results = matchRecipesFromStock(STOCK_ONION_ONLY, [SYN_OCC_BREAKFAST_LUNCH, SYN_OCC_UNKNOWN], {
      occasionFilter: 'breakfast',
    })
    const list = toForwardMatchListPresentation(results)
    expect(list.items.map((i) => i.canonicalRecipeId)).toEqual(['syn-occ-bl'])
  })
})

// ============================================================
// §45 — Forward list / empty state / ranking meaning
// ============================================================

describe('MISSION 2.40 §45 — forward list', () => {
  it('候補ゼロ → emptyStateText は中立文言（「作れる料理はありません」と断定しない）', () => {
    const list = toForwardMatchListPresentation([])
    expect(list.items).toHaveLength(0)
    expect(list.emptyStateText).toBe(NO_CANDIDATES_TEXT)
    expect(list.emptyStateText).not.toContain('作れる料理はありません')
    expect(list.emptyStateText).toContain('現在登録されている料理の中では')
  })

  it('ranking meaning は availability-fit（「おすすめ順」ではない）', () => {
    const list = toForwardMatchListPresentation(
      matchRecipesFromStock(STOCK_ALL_FOR_3, SYNTHETIC_MATCHING_RECIPES),
    )
    expect(list.rankingMeaning).toBe('availability-fit')
    expect(RANKING_MEANING_TEXT).toContain('おすすめ順ではありません')
    expect(RANKING_MEANING_TEXT).not.toContain('AI')
  })

  it('§43 synthetic recipe は production 実データに混ざらない（fixture 側の id は syn-）', () => {
    const realIds = new Set(SOURCE_RECIPE_KNOWLEDGE_FIXTURES.map((f) => f.canonicalRecipeId))
    for (const r of SYNTHETIC_MATCHING_RECIPES) {
      expect(r.canonicalRecipeId.startsWith('syn-')).toBe(true)
      expect(realIds.has(r.canonicalRecipeId)).toBe(false)
    }
  })

  it('§34 fake count を出さない: item 数は入力 result 数と一致', () => {
    const results = matchRecipesFromStock(STOCK_GARLIC_MISSING, [SYN_RECIPE_3, SYN_OCC_SNACK])
    const list = toForwardMatchListPresentation(results)
    expect(list.items).toHaveLength(2)
  })
})

// ============================================================
// §45 §14 — Recipe Detail Presentation（Source Fact 不変）
// ============================================================

describe('MISSION 2.40 §14 — recipe detail presentation', () => {
  it('実 fixture（tori-teriyaki）: 名前・人数・材料・準備・工程を Source からそのまま', () => {
    const detail = toRecipeDetailPresentation({
      knowledge: TORI_TERIYAKI_SOURCE_KNOWLEDGE,
      presentation: TORI_TERIYAKI_PRESENTATION,
    })
    expect(detail.recipeName).toBe('鶏の照り焼き')
    expect(detail.servingsDisplayText).toBe('2人分')
    const chicken = detail.ingredients.find((i) => i.sourceIngredientName === '鶏もも肉')!
    expect(chicken.quantityDisplayText).toBe('（大）1枚 300g') // 単位換算しない
    expect(detail.preCookPreparation.length).toBeGreaterThan(0)
    expect(detail.preparation.length).toBeGreaterThan(0)
    expect(detail.steps.length).toBe(TORI_TERIYAKI_PRESENTATION.steps.length)
    // Source の合計時間
    expect(detail.sourceStatedTotalTimeDisplay).toBe('15分')
  })

  it('§21/§44 Source にない heat / time を生成しない（step3 は heat/time なし）', () => {
    const detail = toRecipeDetailPresentation({
      knowledge: TORI_TERIYAKI_SOURCE_KNOWLEDGE,
      presentation: TORI_TERIYAKI_PRESENTATION,
    })
    const step3 = detail.steps.find((s) => s.sourceStepReference === 3)!
    expect(step3.heatAction).toBeUndefined()
    expect(step3.durationDisplay).toBeUndefined()
    const step1 = detail.steps.find((s) => s.sourceStepReference === 1)!
    expect(step1.heatAction).toBe('中火') // Source が示すものは出す
    expect(step1.durationDisplay).toBe('2〜3分')
  })

  it('国/地域は identityEvidenceSourceIds がある場合のみ', () => {
    const withEv = getWorldRecipeIdentityById('jp-tori-teriyaki')! // identityEvidenceSourceIds あり
    const detailWith = toRecipeDetailPresentation({
      knowledge: TORI_TERIYAKI_SOURCE_KNOWLEDGE,
      identity: withEv,
    })
    expect(detailWith.originCountry).toBe('JP')

    const noEv = WORLD_RECIPE_IDENTITY_REGISTRY.find((i) => i.canonicalRecipeId === 'es-tortilla-espanola')!
    expect(noEv.identityEvidenceSourceIds).toBeUndefined()
    const detailNo = toRecipeDetailPresentation({
      knowledge: { ...TORI_TERIYAKI_SOURCE_KNOWLEDGE, canonicalRecipeId: 'es-tortilla-espanola' },
      identity: noEv,
    })
    expect(detailNo.originCountry).toBeUndefined()
  })

  it('Evidence / Source への導線: evidenceSourceId + imported フラグ（Matching と混同しない）', () => {
    const detail = toRecipeDetailPresentation({ knowledge: TORI_TERIYAKI_SOURCE_KNOWLEDGE })
    expect(detail.evidence.evidenceSourceId).toBe('kyounoryouri-toriteriyaki-kawano-2026')
    expect(detail.evidence.imported).toBe(false)
    expect(detail).not.toHaveProperty('verified')
    expect(detail).not.toHaveProperty('atHome') // Matching state を detail 直下に混ぜない
  })

  it('§44 detail 生成で Source Knowledge を mutate しない', () => {
    const before = JSON.stringify(TORI_TERIYAKI_SOURCE_KNOWLEDGE)
    toRecipeDetailPresentation({ knowledge: TORI_TERIYAKI_SOURCE_KNOWLEDGE, presentation: TORI_TERIYAKI_PRESENTATION })
    expect(JSON.stringify(TORI_TERIYAKI_SOURCE_KNOWLEDGE)).toBe(before)
  })
})

// ============================================================
// §46 — Swipe Cooking Mode navigation
// ============================================================

const mkPres = (n: number): NukitoruPresentation => ({
  canonicalRecipeId: 'test-recipe',
  sourceEvidenceSourceId: 'x',
  displayName: 'test',
  displayLocale: { language: 'ja', country: 'JP' },
  steps: Array.from({ length: n }, (_, i): PresentationStep => ({
    title: `step ${i + 1}`,
    shortInstruction: `do ${i + 1}`,
    ingredientActions: [],
    sourceStepReference: i + 1,
  })),
  generatedAt: '2026-09-03',
})

describe('MISSION 2.40 §46 — swipe cooking navigation', () => {
  it('first step: currentStepView は index 0 / STEP 1 / N', () => {
    const s = p(mkPres(7))
    const v = currentStepView(s)!
    expect(v.index).toBe(0)
    expect(v.displayNumber).toBe(1)
    expect(v.totalSteps).toBe(7)
    expect(v.isFirst).toBe(true)
    expect(v.isLast).toBe(false)
    expect(progressText(s)).toBe('STEP 1 / 7')
  })

  it('next swipe（左）→ 次工程 / previous swipe（右）→ 前工程', () => {
    let s = p(mkPres(3))
    expect(classifySwipe({ deltaX: -100, deltaY: 5 })).toBe('next')
    s = applySwipe(s, 'next')
    expect(s.currentIndex).toBe(1)
    expect(classifySwipe({ deltaX: 120, deltaY: -10 })).toBe('previous')
    s = applySwipe(s, 'previous')
    expect(s.currentIndex).toBe(0)
  })

  it('first step で previous → 負数にならない（index 0 のまま）', () => {
    const s = retreatStep(p(mkPres(3)))
    expect(s.currentIndex).toBe(0)
    expect(s.status).toBe('cooking')
    // applySwipeInput 経由でも
    const s2 = applySwipeInput(p(mkPres(3)), { deltaX: 200, deltaY: 0 })
    expect(s2.currentIndex).toBe(0)
  })

  it('final step で next → completion boundary（status completed / progressText 完成）', () => {
    let s = p(mkPres(2))
    s = advanceStep(s) // → step 2 (index 1)
    expect(s.currentIndex).toBe(1)
    s = advanceStep(s) // → completed
    expect(s.status).toBe('completed')
    expect(s.currentIndex).toBe(2)
    expect(currentStepView(s)).toBeNull()
    expect(progressText(s)).toBe('完成')
    expect(isCompleted(s)).toBe(true)
    // completed で更に next → completed のまま（boundary overrun なし）
    const s2 = advanceStep(s)
    expect(s2).toBe(s)
  })

  it('completed で previous → 最終工程へ戻れる（レビュー可能）', () => {
    let s = p(mkPres(3))
    s = advanceStep(advanceStep(advanceStep(s)))
    expect(s.status).toBe('completed')
    s = retreatStep(s)
    expect(s.status).toBe('cooking')
    expect(s.currentIndex).toBe(2)
  })

  it('short movement は swipe 扱いしない（< minHorizontalDistance → none）', () => {
    expect(classifySwipe({ deltaX: -20, deltaY: 3 })).toBe('none')
    expect(classifySwipe({ deltaX: 30, deltaY: 0 })).toBe('none')
    const s = applySwipeInput(p(mkPres(3)), { deltaX: -20, deltaY: 3 })
    expect(s.currentIndex).toBe(0)
  })

  it('predominantly vertical movement は誤 navigation しない（縦優位 → none）', () => {
    expect(classifySwipe({ deltaX: -60, deltaY: 200 })).toBe('none')
    expect(classifySwipe({ deltaX: 80, deltaY: -120 })).toBe('none')
    // ちょうど比率境界より小さい縦なら通る
    expect(classifySwipe({ deltaX: -100, deltaY: 30 })).toBe('next')
  })

  it('deltaX = 0（縦のみ）→ none', () => {
    expect(classifySwipe({ deltaX: 0, deltaY: 200 })).toBe('none')
  })

  it('alternate button navigation（goToNextStep / goToPreviousStep）は swipe と同じ結果', () => {
    let s = p(mkPres(3))
    s = goToNextStep(s)
    expect(s.currentIndex).toBe(1)
    s = goToPreviousStep(s)
    expect(s.currentIndex).toBe(0)
  })

  it('step index deterministic（同じ操作列 → 同じ index）', () => {
    const run = () => {
      let s = p(mkPres(5))
      for (const dx of [-100, -100, 120, -100]) s = applySwipeInput(s, { deltaX: dx, deltaY: 5 })
      return s.currentIndex
    }
    expect(run()).toBe(run())
    expect(run()).toBe(2)
  })

  it('recipe step mutation なし（session.steps は presentation.steps のコピー・元不変）', () => {
    const pres = mkPres(3)
    const before = JSON.stringify(pres)
    let s = p(pres)
    s = advanceStep(s)
    currentStepView(s)
    expect(JSON.stringify(pres)).toBe(before)
  })

  it('0 step の presentation → 即 completed', () => {
    const s = p(mkPres(0))
    expect(s.status).toBe('completed')
    expect(totalSteps(s)).toBe(0)
    expect(currentStepView(s)).toBeNull()
  })

  it('CookingStepView は Source の heat/time をそのまま通す（生成しない）', () => {
    const s = createCookingSession(TORI_TERIYAKI_PRESENTATION)
    const v1 = currentStepView(s)!
    expect(v1.heatAction).toBe('中火')
    expect(v1.durationDisplay).toBe('2〜3分')
    // step3 へ
    const s3 = advanceStep(advanceStep(s))
    const v3 = currentStepView(s3)!
    expect(v3.sourceStepReference).toBe(3)
    expect(v3.heatAction).toBeUndefined()
    expect(v3.durationDisplay).toBeUndefined()
  })

  it('DEFAULT_SWIPE_CONFIG は妥当な値（minHorizontalDistance > 0 / maxVerticalRatio 0-1）', () => {
    expect(DEFAULT_SWIPE_CONFIG.minHorizontalDistance).toBeGreaterThan(0)
    expect(DEFAULT_SWIPE_CONFIG.maxVerticalRatio).toBeGreaterThan(0)
    expect(DEFAULT_SWIPE_CONFIG.maxVerticalRatio).toBeLessThanOrEqual(1)
  })
})

// ============================================================
// §29/§30/§52 — Share（fact のみ・個人情報を漏らさない）
// ============================================================

describe('MISSION 2.40 §30/§52 — share text / hashtags', () => {
  it('brand hashtags は #NUKITORU #NUKITORUFOOD', () => {
    expect(BRAND_HASHTAGS).toEqual(['#NUKITORU', '#NUKITORUFOOD'])
  })

  it('factualTagsFrom: 明示 occasion のみタグ化（推測しない）', () => {
    expect(factualTagsFrom({ mealOccasions: ['snack'] })).toEqual(['おやつ'])
    expect(factualTagsFrom({ mealOccasions: [] })).toEqual([])
    expect(factualTagsFrom({})).toEqual([])
    expect(factualTagsFrom({ mealOccasions: ['breakfast'], cuisineLabelWithEvidence: '日本料理' })).toEqual([
      '日本料理',
      '朝食',
    ])
  })

  it('buildFoodShareHashtags: brand 先頭 + factual・dedup・# 付与', () => {
    expect(buildFoodShareHashtags(['おやつ', 'おやつ'])).toEqual(['#NUKITORU', '#NUKITORUFOOD', '#おやつ'])
    expect(buildFoodShareHashtags([])).toEqual(['#NUKITORU', '#NUKITORUFOOD'])
  })

  it('buildFoodShareText: recipeName + URL + hashtags のみ。在庫・個人情報を含まない', () => {
    const text = buildFoodShareText({ recipeName: '鶏の照り焼き', factualTags: ['日本料理'] })
    expect(text).toContain('鶏の照り焼き')
    expect(text).toContain(FOOD_SHARE_URL)
    expect(text).toContain('#NUKITORU')
    expect(text).toContain('#日本料理')
    // 在庫・allergy・household を含まない
    expect(text).not.toMatch(/在庫|アレル|家族|じゃがいも|玉ねぎ/)
    // Evidence 未確認を「検証済み」等と断定しない
    expect(text).not.toMatch(/検証済み|安全です|根拠あり/)
  })

  it('§30 国/occasion/ジャンルを推測してタグ付与しない（factualTags を渡さなければ brand のみ）', () => {
    const text = buildFoodShareText({ recipeName: 'synthetic dish' })
    const hashLine = text.split('\n').pop()!
    expect(hashLine).toBe('#NUKITORU #NUKITORUFOOD')
  })

  it('buildSnsShareUrls: X/Bluesky/Facebook/LINE の URL パターンは既存 layout.tsx と同型', () => {
    const urls = buildSnsShareUrls({ recipeName: 'test' })
    expect(urls.x.startsWith('https://twitter.com/intent/tweet?text=')).toBe(true)
    expect(urls.bluesky.startsWith('https://bsky.app/intent/compose?text=')).toBe(true)
    expect(urls.facebook.startsWith('https://www.facebook.com/sharer/sharer.php?u=')).toBe(true)
    expect(urls.line.startsWith('https://social-plugins.line.me/lineit/share?url=')).toBe(true)
    // URL に在庫・個人情報が入らない
    for (const u of Object.values(urls)) {
      expect(decodeURIComponent(u)).not.toMatch(/在庫|アレル|家族/)
    }
  })

  it('§47 既存 family-share.ts の buildCandidateShareText は不変（regression）', () => {
    const t = buildCandidateShareText({ title: 'テスト料理', estimatedMinutes: 15 })
    expect(t).toContain('今日これどう？')
    expect(t).toContain('テスト料理')
    expect(t).toContain('約15分')
    expect(t).toContain('https://nukitoru.pages.dev/food')
  })
})

// ============================================================
// §47 — Existing features regression
// ============================================================

describe('MISSION 2.40 §47 — existing behavior regression', () => {
  it('tori-teriyaki / buta-shogayaki VERIFIED / publishable 不変', () => {
    for (const id of ['tori-teriyaki', 'buta-shogayaki']) {
      const r = RECIPE_CATALOG.find((x) => x.id === id)!
      expect(getVerificationStatus(r)).toBe('verified')
      expect(isRecipePublishable(r)).toBe(true)
    }
    // presentation を走らせても不変
    toRecipeMatchPresentation(evaluateRecipeAgainstStock(SYN_RECIPE_3, STOCK_ALL_FOR_3))
    expect(isRecipePublishable(RECIPE_CATALOG.find((x) => x.id === 'tori-teriyaki')!)).toBe(true)
  })

  it('Allergy Gate 不変', () => {
    const base = { availableIngredientNames: ['鶏もも肉'], dislikeNames: [] as string[], maxCookingMinutes: null }
    for (const allergen of ['小麦', '大豆', '鶏肉']) {
      expect(rankRecipes(RECIPE_CATALOG, { ...base, allergyNames: [allergen] }).some((c) => c.recipe.id === 'tori-teriyaki')).toBe(false)
    }
  })

  it('Practical Validation status 不変', () => {
    for (const id of ['tori-teriyaki', 'buta-shogayaki']) {
      expect(practicalCookValidationStatusOf(RECIPE_CATALOG.find((x) => x.id === id)!)).toBe('not-tested')
    }
  })
})

// ============================================================
// §42/§45 — firewall（AI / network / recipe fact mutation）
// ============================================================

describe('MISSION 2.40 — module firewall', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const read = (rel: string) => readFileSync(resolve(here, '..', rel), 'utf8')
  const FILES = ['food-match-presentation.ts', 'cooking-navigation.ts', 'food-share.ts']
  const FORBIDDEN = [
    './recipe-publishability',
    './recipe-safety',
    './practical-cook-validation',
    './recipe-catalog',
    './recipe-suggestion-engine',
    './mock-meal-provider',
    './ai-provider',
    './world-recipe-import',
    './ingredient-normalization',
    './ingredient-taxonomy',
    './ingredient-allergens',
  ]

  for (const f of FILES) {
    it(`${f} が Verification / Allergy / AI / Import モジュールを import しない`, () => {
      const src = read(f)
      for (const mod of FORBIDDEN) {
        expect(src.includes(`from '${mod}'`), `${f} imports ${mod}`).toBe(false)
      }
    })
  }

  it('§42 no AI / no network', () => {
    for (const f of FILES) {
      const src = read(f)
      expect(/openai|anthropic|embedding|vector search|semantic search|\bLLM\b/i.test(src)).toBe(false)
    }
  })

  it('§31 cooking-navigation は決定論的（乱数・現在時刻を使わない）', () => {
    const src = read('cooking-navigation.ts')
    expect(src.includes('Math.random')).toBe(false)
    expect(src.includes('Date.now')).toBe(false)
    expect(src.includes('new Date')).toBe(false)
  })

  it('food-match-presentation / food-share も乱数・現在時刻を使わない', () => {
    for (const f of ['food-match-presentation.ts', 'food-share.ts']) {
      const src = read(f)
      expect(src.includes('Math.random')).toBe(false)
      expect(src.includes('Date.now')).toBe(false)
    }
  })
})

// ============================================================
// determinism
// ============================================================

describe('MISSION 2.40 — determinism', () => {
  it('toRecipeMatchPresentation は deterministic', () => {
    const res = evaluateRecipeAgainstStock(SYN_RECIPE_3, STOCK_GARLIC_MISSING)
    expect(JSON.stringify(toRecipeMatchPresentation(res))).toBe(JSON.stringify(toRecipeMatchPresentation(res)))
  })

  it('toRecipeDetailPresentation は deterministic', () => {
    const a = toRecipeDetailPresentation({ knowledge: TORI_TERIYAKI_SOURCE_KNOWLEDGE, presentation: TORI_TERIYAKI_PRESENTATION })
    const b = toRecipeDetailPresentation({ knowledge: TORI_TERIYAKI_SOURCE_KNOWLEDGE, presentation: TORI_TERIYAKI_PRESENTATION })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('classifySwipe は deterministic', () => {
    for (const input of [{ deltaX: -100, deltaY: 5 }, { deltaX: 20, deltaY: 3 }, { deltaX: -60, deltaY: 200 }]) {
      expect(classifySwipe(input)).toBe(classifySwipe(input))
    }
  })
})
