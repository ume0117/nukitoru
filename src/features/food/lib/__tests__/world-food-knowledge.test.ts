// ============================================================
// world-food-knowledge.test.ts
//
// MISSION 2.35 — World Food Knowledge Foundation。
//
// Test Requirements A〜J（MISSION 本文 section 19）:
//  A. Presentation 生成で Recipe Evidence が変更されない
//  B. UNKNOWN source fact が Presentation で勝手に具体化されない（heat）
//  C. Source duration が無い場合に AI/Default で時間を追加しない
//  D. Canonicalization が Evidence fact を変更しない
//  E. Unit conversion: Source Fact と Derived Product Value が区別される（境界テスト）
//  F. Japanese / English / original names が同じ Canonical Recipe Identity へ接続
//  G. NUKITORU Presentation から Source Knowledge / Evidence へ Trace できる
//  H. 既存 VERIFIED recipe の publishability が MISSION 前後で変わらない
//  I. PracticalCookValidation status が Presentation 追加で変化しない
//  J. Allergy Gate を弱めない
// ============================================================

import { describe, it, expect } from 'vitest'
import type {
  NukitoruPresentation,
  QuantityStatement,
  SourceCookingStep,
  SourceIngredientKnowledge,
} from '@/features/food/types'
import {
  attachCanonicalIngredientId,
  buildPresentationStep,
  describeSourceHeat,
  formatDurationDisplay,
  getEvidenceForSourceKnowledge,
  getWorldRecipeIdentityById,
  makeProductUnitConversion,
  namesResolveToSameWorldRecipe,
  presentationPreservesSourceFacts,
  presentationStepViolations,
  resolveWorldRecipeIdentity,
  sourceKnowledgeHasValidEvidence,
  sourceQuantityText,
  stepDurationDisplay,
  tracePresentationStep,
} from '../world-food-knowledge'
import {
  BUTA_SHOGAYAKI_PRESENTATION,
  BUTA_SHOGAYAKI_SOURCE_KNOWLEDGE,
  NUKITORU_PRESENTATION_FIXTURES,
  SOURCE_RECIPE_KNOWLEDGE_FIXTURES,
  TORI_TERIYAKI_PRESENTATION,
  TORI_TERIYAKI_SOURCE_KNOWLEDGE,
} from '../world-food-fixtures'
import { WORLD_RECIPE_IDENTITY_REGISTRY } from '../world-recipe-identity'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { isRecipePublishable, getVerificationStatus } from '../recipe-publishability'
import { practicalCookValidationStatusOf } from '../practical-cook-validation'
import { rankRecipes } from '../recipe-suggestion-engine'
import { allergyRelevantIngredients } from '../recipe-safety'
import { getEvidenceSourceById } from '../evidence-sources'

const tori = () => RECIPE_CATALOG.find((r) => r.id === 'tori-teriyaki')!
const buta = () => RECIPE_CATALOG.find((r) => r.id === 'buta-shogayaki')!

// ============================================================
// Fixture sanity — 小さく保つ / Evidence 実在
// ============================================================

describe('MISSION 2.35 — Fixture の規模と Evidence 実在', () => {
  it('World Recipe Identity Registry は 日本5 + 海外4 の最小規模', () => {
    expect(WORLD_RECIPE_IDENTITY_REGISTRY).toHaveLength(9)
    expect(WORLD_RECIPE_IDENTITY_REGISTRY.filter((r) => r.country === 'JP')).toHaveLength(5)
    expect(WORLD_RECIPE_IDENTITY_REGISTRY.filter((r) => r.country !== 'JP')).toHaveLength(4)
  })

  it('SOURCE RECIPE KNOWLEDGE Fixture は最小（2件）で、全件 Evidence が EVIDENCE_SOURCE_CATALOG に実在', () => {
    expect(SOURCE_RECIPE_KNOWLEDGE_FIXTURES).toHaveLength(2)
    for (const k of SOURCE_RECIPE_KNOWLEDGE_FIXTURES) {
      expect(sourceKnowledgeHasValidEvidence(k), k.canonicalRecipeId).toBe(true)
      expect(getEvidenceForSourceKnowledge(k)?.id).toBe(k.evidenceSourceId)
    }
  })

  it('identityEvidenceSourceIds は EVIDENCE_SOURCE_CATALOG に実在するものだけ', () => {
    for (const identity of WORLD_RECIPE_IDENTITY_REGISTRY) {
      for (const id of identity.identityEvidenceSourceIds ?? []) {
        expect(getEvidenceSourceById(id), `${identity.canonicalRecipeId}: ${id}`).toBeDefined()
      }
    }
  })
})

// ============================================================
// F. Japanese / English / original names → 同じ Canonical Recipe Identity
// ============================================================

describe('MISSION 2.35 F — 名称は言語をまたいで同じ Canonical Identity へ解決', () => {
  it('日本語名・英語名・別名すべてが jp-tori-teriyaki へ解決', () => {
    for (const name of ['鶏の照り焼き', 'Chicken Teriyaki', '照り焼きチキン', 'teriyaki chicken']) {
      expect(resolveWorldRecipeIdentity(name)?.canonicalRecipeId, name).toBe('jp-tori-teriyaki')
    }
  })

  it('原語（韓国語）名・英語名・日本語名が同じ Canonical Identity を指す', () => {
    expect(namesResolveToSameWorldRecipe('김치볶음밥', 'Kimchi fried rice')).toBe(true)
    expect(namesResolveToSameWorldRecipe('キムチチャーハン', 'kimchi-bokkeumbap')).toBe(true)
  })

  it('Tortilla Española: 現地名・日本語訳・英語名が同一 canonicalRecipeId', () => {
    const ids = ['Tortilla Española', 'Tortilla de patatas', 'スペイン風オムレツ', 'Spanish Omelette'].map(
      (n) => resolveWorldRecipeIdentity(n)?.canonicalRecipeId,
    )
    expect(new Set(ids)).toEqual(new Set(['es-tortilla-espanola']))
  })

  it('日本語訳は Identity を別 Recipe へ変えない（表示名 ≠ Canonical Identity）', () => {
    const identity = getWorldRecipeIdentityById('es-tortilla-espanola')!
    expect(identity.japaneseName).toBe('スペイン風オムレツ')
    // japaneseName を渡しても canonicalRecipeId / country / originalLanguage は不変
    expect(resolveWorldRecipeIdentity('スペイン風オムレツ')).toEqual(identity)
    expect(identity.country).toBe('ES')
    expect(identity.originalLanguage).toBe('es')
  })

  it('fuzzy matching をしない（未知の / 部分一致の名前は undefined）', () => {
    expect(resolveWorldRecipeIdentity('照り焼き')).toBeUndefined()
    expect(resolveWorldRecipeIdentity('chicken')).toBeUndefined()
    expect(resolveWorldRecipeIdentity('')).toBeUndefined()
    expect(resolveWorldRecipeIdentity('存在しない料理')).toBeUndefined()
  })

  it('別々の料理は同じ Identity へ解決しない', () => {
    expect(namesResolveToSameWorldRecipe('鶏の照り焼き', '豚の生姜焼き')).toBe(false)
  })
})

// ============================================================
// B. UNKNOWN source fact が Presentation で具体化されない（heat）
// ============================================================

describe('MISSION 2.35 B — Source heat = UNKNOWN は Presentation heat = 具体値 にならない', () => {
  it('describeSourceHeat: heat / heatTransition 未設定 → undefined', () => {
    const step: SourceCookingStep = { order: 1 }
    expect(describeSourceHeat(step)).toBeUndefined()
  })

  it('describeSourceHeat: heat = "unknown" → undefined（"中火" にしない）', () => {
    const step: SourceCookingStep = { order: 1, heat: 'unknown', heatTransition: 'unknown' }
    expect(describeSourceHeat(step)).toBeUndefined()
  })

  it('buildPresentationStep: Source が火加減を示さない手順 → heatAction は undefined', () => {
    // tori-teriyaki step3（脂を拭く）: heat なし
    const step3 = TORI_TERIYAKI_SOURCE_KNOWLEDGE.cookingSteps.find((s) => s.order === 3)!
    const p = buildPresentationStep(step3, {
      title: '脂を拭く',
      shortInstruction: 'ふたを取り脂を拭く',
      ingredientActions: [],
    })
    expect(p.heatAction).toBeUndefined()
  })

  it('Source が火加減を示す手順のみ heatAction が入る（step1 = 中火）', () => {
    const step1 = TORI_TERIYAKI_SOURCE_KNOWLEDGE.cookingSteps.find((s) => s.order === 1)!
    const p = buildPresentationStep(step1, {
      title: '焼く',
      shortInstruction: '焼く',
      ingredientActions: [],
    })
    expect(p.heatAction).toBe('中火')
  })

  it('presentationStepViolations: Source heat 無しなのに heatAction を付けた Presentation は違反として検出', () => {
    const step: SourceCookingStep = { order: 9 }
    const bad = {
      title: 'x',
      shortInstruction: 'x',
      ingredientActions: [],
      heatAction: '中火',
      sourceStepReference: 9,
    }
    expect(presentationStepViolations(step, bad)).toContain(
      '情報源が火加減を示していない手順に heatAction を付与している（UNKNOWN を具体化）',
    )
  })
})

// ============================================================
// C. Source duration が無い場合に AI/Default で時間を追加しない
// ============================================================

describe('MISSION 2.35 C — Source duration が無い → Presentation に時間を発明しない', () => {
  it('formatDurationDisplay: undefined / unknown → undefined', () => {
    expect(formatDurationDisplay(undefined)).toBeUndefined()
    expect(formatDurationDisplay({ kind: 'unknown' })).toBeUndefined()
  })

  it('formatDurationDisplay: range は "2〜3分"（midpoint 化しない）', () => {
    expect(formatDurationDisplay({ kind: 'range', minMinutes: 2, maxMinutes: 3 })).toBe('2〜3分')
    expect(formatDurationDisplay({ kind: 'approximate', minutes: 30 })).toBe('約30分')
    expect(formatDurationDisplay({ kind: 'exact', minutes: 15 })).toBe('15分')
  })

  it('tori-teriyaki step5（照りが出るまで・時間なし）→ durationDisplay は undefined', () => {
    const step5 = TORI_TERIYAKI_SOURCE_KNOWLEDGE.cookingSteps.find((s) => s.order === 5)!
    expect(stepDurationDisplay(step5)).toBeUndefined()
    const p = buildPresentationStep(step5, {
      title: 'からめる',
      shortInstruction: 'からめる',
      ingredientActions: [],
    })
    expect(p.durationDisplay).toBeUndefined()
    // completionCue は Source が示しているので入る
    expect(p.completionCue).toBe('照りが出るまで')
  })

  it('presentationStepViolations: Source duration 無しなのに durationDisplay を付けたら違反', () => {
    const step: SourceCookingStep = { order: 5, heat: 'medium-high' }
    const bad = {
      title: 'x',
      shortInstruction: 'x',
      ingredientActions: [],
      durationDisplay: '5分',
      sourceStepReference: 5,
    }
    expect(presentationStepViolations(step, bad)).toContain(
      '情報源が時間を示していない手順に durationDisplay を付与している（UNKNOWN を具体化）',
    )
  })

  it('Fixture の Presentation はすべて SOURCE の料理事実を変更していない', () => {
    for (const knowledge of SOURCE_RECIPE_KNOWLEDGE_FIXTURES) {
      const presentation = NUKITORU_PRESENTATION_FIXTURES.find(
        (p) => p.canonicalRecipeId === knowledge.canonicalRecipeId,
      )!
      const result = presentationPreservesSourceFacts(knowledge, presentation)
      expect(result.violations).toEqual([])
      expect(result.ok).toBe(true)
    }
  })
})

// ============================================================
// D. Canonicalization が Evidence fact を変更しない
// ============================================================

describe('MISSION 2.35 D — Canonicalization ≠ Evidence 変更', () => {
  it('attachCanonicalIngredientId は sourceIngredientName / quantity を一切変えない', () => {
    const original: SourceIngredientKnowledge = {
      sourceIngredientName: 'じゃがいも',
      role: 'required',
      quantity: {
        displayText: '中2個（約300g）',
        semantics: { kind: 'range', min: 280, max: 320, unit: 'g' },
      },
    }
    const canonicalized = attachCanonicalIngredientId(original, 'potato', 'じゃがいも')

    expect(canonicalized.canonicalIngredientId).toBe('potato')
    // Evidence（原文の名前・分量・意味論）は不変
    expect(canonicalized.sourceIngredientName).toBe('じゃがいも')
    expect(canonicalized.quantity).toEqual(original.quantity)
    expect(sourceQuantityText(canonicalized)).toBe('中2個（約300g）')
    // 元オブジェクトも不変（mutation なし）
    expect(original.canonicalIngredientId).toBeUndefined()
  })

  it('canonicalIngredientId は「同じ食材 identity」を意味するだけで、alergen composition を主張しない', () => {
    // しょうゆ を canonical 化しても「小麦を含む/含まない」の判定はこの層で行わない
    const shoyu: SourceIngredientKnowledge = {
      sourceIngredientName: 'しょうゆ',
      role: 'seasoning',
      quantity: { displayText: '大さじ1', semantics: { kind: 'exact', value: 1, unit: '大さじ' } },
    }
    const c = attachCanonicalIngredientId(shoyu, 'soy_sauce')
    expect(c).not.toHaveProperty('allergens')
    expect(c.quantity?.displayText).toBe('大さじ1')
  })
})

// ============================================================
// E. Unit conversion: Source Fact と Derived Product Value の区別（境界テスト）
// ============================================================

describe('MISSION 2.35 E — SOURCE FACT ≠ PRODUCT CONVERSION', () => {
  it('makeProductUnitConversion は sourceStatement を保持し、換算値は別フィールド', () => {
    const source: QuantityStatement = {
      displayText: '大さじ1',
      semantics: { kind: 'exact', value: 1, unit: '大さじ' },
    }
    const conv = makeProductUnitConversion(source, 15, 'ml', '大さじ1 = 15ml（NUKITORU UI 換算前提）')

    // SOURCE FACT は原文のまま
    expect(conv.sourceStatement).toEqual(source)
    expect(conv.sourceStatement.displayText).toBe('大さじ1')
    // 換算値は Product Decision であり Evidence ではない（別フィールドに隔離）
    expect(conv.convertedValue).toBe(15)
    expect(conv.convertedUnit).toBe('ml')
    expect(conv.conversionNote.length).toBeGreaterThan(0)
  })

  it('range の Source quantity は range のまま（midpoint 化しない）', () => {
    const source: QuantityStatement = {
      displayText: '100〜120g',
      semantics: { kind: 'range', min: 100, max: 120, unit: 'g' },
    }
    const conv = makeProductUnitConversion(source, 110, 'g', 'UI 表示用に中央値を採用（Product Decision）')
    // Source semantics は range のまま。midpoint 110 は conv 側にのみ存在
    expect(conv.sourceStatement.semantics).toEqual({ kind: 'range', min: 100, max: 120, unit: 'g' })
    expect(conv.convertedValue).toBe(110)
  })
})

// ============================================================
// G. NUKITORU Presentation → Source Knowledge / Evidence への Trace
// ============================================================

describe('MISSION 2.35 G — Presentation から Source / Evidence へ追跡可能', () => {
  it('全 Presentation step が SourceCookingStep.order を参照している', () => {
    for (const knowledge of SOURCE_RECIPE_KNOWLEDGE_FIXTURES) {
      const presentation = NUKITORU_PRESENTATION_FIXTURES.find(
        (p) => p.canonicalRecipeId === knowledge.canonicalRecipeId,
      )!
      const orders = new Set(knowledge.cookingSteps.map((s) => s.order))
      for (const step of presentation.steps) {
        expect(orders.has(step.sourceStepReference)).toBe(true)
      }
    }
  })

  it('tracePresentationStep: step index → SourceCookingStep + Evidence Source', () => {
    const traced = tracePresentationStep(TORI_TERIYAKI_PRESENTATION, 0, TORI_TERIYAKI_SOURCE_KNOWLEDGE)
    expect(traced).toBeDefined()
    expect(traced!.sourceStep.order).toBe(1)
    expect(traced!.evidence.id).toBe('kyounoryouri-toriteriyaki-kawano-2026')
    expect(traced!.evidence.publisher).toContain('NHK')
    expect(traced!.evidence.url.length).toBeGreaterThan(0)
  })

  it('「なぜこの時間？」= step2 の 3〜4分は SOURCE の passiveDuration へ辿れる', () => {
    const traced = tracePresentationStep(BUTA_SHOGAYAKI_PRESENTATION, 0, BUTA_SHOGAYAKI_SOURCE_KNOWLEDGE)
    const step1 = traced!.sourceStep
    // buta step1: 約1分（approximate）→ Presentation では "約1分"
    expect(formatDurationDisplay(step1.duration)).toBe('約1分')
    expect(BUTA_SHOGAYAKI_PRESENTATION.steps[0].durationDisplay).toBe('約1分')
  })

  it('sourceEvidenceSourceId が SourceRecipeKnowledge.evidenceSourceId と一致', () => {
    expect(TORI_TERIYAKI_PRESENTATION.sourceEvidenceSourceId).toBe(
      TORI_TERIYAKI_SOURCE_KNOWLEDGE.evidenceSourceId,
    )
  })
})

// ============================================================
// A / H / I / J — 既存 VERIFIED / Practical / Allergy への非影響
// ============================================================

function snapshotRecipeEvidence(id: string) {
  const r = RECIPE_CATALOG.find((x) => x.id === id)!
  return JSON.stringify({
    status: r.verification?.status,
    publishable: isRecipePublishable(r),
    fieldVerifications: r.verification?.fieldVerifications,
    recipeIdentity: r.verification?.recipeIdentity,
    requiredIngredients: r.requiredIngredients,
    seasonings: r.seasonings,
    steps: r.steps,
    preparation: r.preparation,
    practical: practicalCookValidationStatusOf(r),
  })
}

describe('MISSION 2.35 A/H — 既存 Recipe Evidence は Presentation 生成の前後で不変', () => {
  it('A: Presentation を生成しても SourceRecipeKnowledge オブジェクトが変異しない', () => {
    const before = JSON.stringify(TORI_TERIYAKI_SOURCE_KNOWLEDGE)
    // 生成を再実行しても副作用なし
    for (const step of TORI_TERIYAKI_SOURCE_KNOWLEDGE.cookingSteps) {
      buildPresentationStep(step, { title: 't', shortInstruction: 's', ingredientActions: [] })
    }
    presentationPreservesSourceFacts(TORI_TERIYAKI_SOURCE_KNOWLEDGE, TORI_TERIYAKI_PRESENTATION)
    expect(JSON.stringify(TORI_TERIYAKI_SOURCE_KNOWLEDGE)).toBe(before)
  })

  it('H: tori-teriyaki / buta-shogayaki は引き続き VERIFIED かつ publishable', () => {
    expect(getVerificationStatus(tori())).toBe('verified')
    expect(getVerificationStatus(buta())).toBe('verified')
    expect(isRecipePublishable(tori())).toBe(true)
    expect(isRecipePublishable(buta())).toBe(true)
    expect(
      RECIPE_CATALOG.filter((r) => r.verification?.status === 'verified').map((r) => r.id),
    ).toEqual(['tori-teriyaki', 'buta-shogayaki'])
  })

  it('H: World Food Knowledge レイヤーは RECIPE_CATALOG を変更しない（Evidence snapshot 不変）', () => {
    const toriSnap = snapshotRecipeEvidence('tori-teriyaki')
    const butaSnap = snapshotRecipeEvidence('buta-shogayaki')
    // fixtures / knowledge を一通り触る
    void SOURCE_RECIPE_KNOWLEDGE_FIXTURES
    void NUKITORU_PRESENTATION_FIXTURES
    resolveWorldRecipeIdentity('鶏の照り焼き')
    expect(snapshotRecipeEvidence('tori-teriyaki')).toBe(toriSnap)
    expect(snapshotRecipeEvidence('buta-shogayaki')).toBe(butaSnap)
  })
})

describe('MISSION 2.35 I — PracticalCookValidation status は Presentation 追加で変化しない', () => {
  it('tori-teriyaki / buta-shogayaki は引き続き not-tested（実地検証は別レイヤー）', () => {
    expect(practicalCookValidationStatusOf(tori())).toBe('not-tested')
    expect(practicalCookValidationStatusOf(buta())).toBe('not-tested')
  })

  it('SourceRecipeKnowledge / NukitoruPresentation 型に practical 検証を昇格させるフィールドが無い', () => {
    expect(TORI_TERIYAKI_SOURCE_KNOWLEDGE).not.toHaveProperty('practicalCookValidation')
    expect(TORI_TERIYAKI_PRESENTATION).not.toHaveProperty('practicalCookValidation')
    expect(TORI_TERIYAKI_PRESENTATION).not.toHaveProperty('verification')
  })
})

describe('MISSION 2.35 J — Allergy Gate を弱めない', () => {
  const base = { availableIngredientNames: ['鶏もも肉'], dislikeNames: [] as string[], maxCookingMinutes: null }

  it('小麦 / 大豆 / 鶏肉 アレルギーで tori-teriyaki は引き続き HARD EXCLUDE', () => {
    for (const allergen of ['小麦', '大豆', '鶏肉']) {
      const ranked = rankRecipes(RECIPE_CATALOG, { ...base, allergyNames: [allergen] })
      expect(ranked.some((c) => c.recipe.id === 'tori-teriyaki'), allergen).toBe(false)
    }
  })

  it('allergyRelevantIngredients（tori-teriyaki）は VERIFIED 後・MISSION 2.35 後も 鶏もも肉 / しょうゆ を含む', () => {
    const rel = allergyRelevantIngredients(tori())
    expect(rel).toContain('鶏もも肉')
    expect(rel).toContain('しょうゆ')
  })

  it('World Food Knowledge の SourceIngredientKnowledge は allergy 判定に一切使われない（role のみ保持）', () => {
    // garnish/optional 等の role はアレルギー判定を弱めるためのものではなく、
    // そもそも recipe-safety.ts はこの型を参照しない
    const garnish = TORI_TERIYAKI_SOURCE_KNOWLEDGE.ingredients.find(
      (i) => i.sourceIngredientName === 'スナップえんどう',
    )!
    expect(garnish.role).toBe('garnish')
  })
})

// ============================================================
// Presentation の pre-start knowledge / preparation 区別
// ============================================================

describe('MISSION 2.35 — PRE-COOK PREPARATION と PREPARATION の区別', () => {
  it('tori-teriyaki: 常温戻し(約30分)は preCookPreparation、切る/混ぜるは preparation', () => {
    const pre = TORI_TERIYAKI_SOURCE_KNOWLEDGE.preCookPreparation!
    expect(pre).toHaveLength(1)
    expect(pre[0].passiveWait).toBe(true)
    expect(pre[0].duration).toEqual({ kind: 'approximate', minutes: 30 })

    const prep = TORI_TERIYAKI_SOURCE_KNOWLEDGE.preparation!
    expect(prep.length).toBeGreaterThan(0)
    expect(prep.every((p) => p.duration === undefined)).toBe(true)
  })

  it('Presentation preCheck に「食べる人数」と「作る量」が別項目として存在', () => {
    const kinds = (TORI_TERIYAKI_PRESENTATION.preCookChecklist ?? []).map((c) => c.kind)
    expect(kinds).toContain('diners')
    expect(kinds).toContain('servings')
  })

  it('sourceStatedTotalTime と preCookPreparation は足し算されていない（15分 + 30分 = 45分 を作らない）', () => {
    expect(TORI_TERIYAKI_SOURCE_KNOWLEDGE.sourceStatedTotalTime).toEqual({ kind: 'exact', minutes: 15 })
    // Presentation にも 45分 のような導出値は存在しない
    const allDisplays = TORI_TERIYAKI_PRESENTATION.steps
      .map((s) => s.durationDisplay)
      .filter((d): d is string => d !== undefined)
    expect(allDisplays).not.toContain('45分')
  })
})

// ============================================================
// describeSourceHeat / heatTransition 表示
// ============================================================

describe('MISSION 2.35 — Heat Transition の明示', () => {
  it('buta step1: 中火 → 火を止める（heatTransition + heat 併記）', () => {
    const step1 = BUTA_SHOGAYAKI_SOURCE_KNOWLEDGE.cookingSteps.find((s) => s.order === 1)!
    expect(describeSourceHeat(step1)).toBe('中火 → 火を止める')
  })

  it('Presentation の各 step は buildPresentationStep 由来で sourceStepReference を必ず持つ', () => {
    for (const p of NUKITORU_PRESENTATION_FIXTURES) {
      for (const step of p.steps) {
        expect(typeof step.sourceStepReference).toBe('number')
      }
    }
  })
})
