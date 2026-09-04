// ============================================================
// maff-record-rights.test.ts
//
// MISSION 2.41C — MAFF Record Rights Resolution。
//
// Rights Evidence / Decision / Conditions / Unresolved を分離して保持できること、
// そして 2.41B で入力した親子丼・玉子焼きの Rights / Fact / Import 状態が**弱まっていない**
// ことを固定する（§25 の 24 要件 + 追加）。
// ============================================================

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  MAFF_KYODO_RYORI_RIGHTS_ANALYSIS,
  MAFF_KYODO_RYORI_CURRENT_DECISION,
  SOURCE_SELECTION_SCORECARDS,
  thirdPartyReviewSignalFor,
  partitionByThirdPartyReview,
} from '../source-rights-scorecard'
import {
  OYAKODON_EVIDENCE_PACK,
  TAMAGOYAKI_EVIDENCE_PACK,
  EGG_BRANCH_BATCH1_EVIDENCE_PACKS,
} from '../recipe-evidence-pack-fixtures'
import {
  canEnterRecipeImport,
  evidencePackStateBreakdown,
  evidencePackHoldReasons,
  runEvidencePackImport,
  validateEvidencePack,
} from '../recipe-evidence-pack'
import { WORLD_RECIPE_IDENTITY_REGISTRY } from '../world-recipe-identity'
import { RECIPE_CATALOG } from '../recipe-catalog'
import {
  TORI_TERIYAKI_SOURCE_KNOWLEDGE,
  BUTA_SHOGAYAKI_SOURCE_KNOWLEDGE,
  SOURCE_RECIPE_KNOWLEDGE_FIXTURES,
} from '../world-food-fixtures'
import { createCookedMealRecord, countCookedByRecipe } from '../cooked-meal-record'
import { buildFoodShareText } from '../food-share'

const IMPORTED_AT = '2026-09-04T00:00:00.000Z'
const oyako = OYAKODON_EVIDENCE_PACK
const tamago = TAMAGOYAKI_EVIDENCE_PACK
const scope = (s: string) => MAFF_KYODO_RYORI_RIGHTS_ANALYSIS.find((r) => r.scope === s)!

// ------------------------------------------------------------
// §25.1–9 — Rights Evidence の分離（推測で cleared にしない）
// ------------------------------------------------------------

describe('MISSION 2.41C — MAFF rights evidence separation', () => {
  it('1. MAFF purpose evidence does not auto-clear record rights', () => {
    const sp = scope('source-purpose')
    expect(sp.decision).not.toBe('allowed')
    expect(sp.decision).toBe('conditional')
    expect(sp.evidenceMissing.length).toBeGreaterThan(0)
    // record scope は依然 unknown
    expect(scope('record').decision).toBe('unknown')
  })
  it('2. official database evidence does not auto-clear third-party rights', () => {
    expect(scope('record').reasonCodes).toContain('DATABASE_EXISTENCE_NOT_RECORD_CLEARANCE')
    expect(scope('third-party').decision).toBe('unknown')
  })
  it('3. commercial menu/product usage language does not mean structured record reuse cleared', () => {
    expect(scope('source-purpose').reasonCodes).toContain(
      'COMMERCIAL_STRUCTURED_FACT_REUSE_NOT_EXPLICIT_PER_RECORD',
    )
    expect(MAFF_KYODO_RYORI_CURRENT_DECISION.oyakodon).toBe('REVIEW_REQUIRED')
  })
  it('4. third-party credit does not mean prohibited', () => {
    expect(MAFF_KYODO_RYORI_CURRENT_DECISION.isProhibited).toBe(false)
    expect(scope('third-party').decision).not.toBe('prohibited')
    // どの分析 record も prohibited ではない（禁止 Evidence は無い）
    expect(MAFF_KYODO_RYORI_RIGHTS_ANALYSIS.every((r) => r.decision !== 'prohibited')).toBe(true)
  })
  it('5. third-party credit does mean review required', () => {
    const sig = thirdPartyReviewSignalFor(oyako.rights)
    expect(sig.needsThirdPartyReview).toBe(true)
    expect(evidencePackStateBreakdown(oyako).rights).toBe('REVIEW_REQUIRED')
    expect(evidencePackStateBreakdown(tamago).rights).toBe('REVIEW_REQUIRED')
  })
  it('6. image permission does not imply recipe record permission', () => {
    expect(scope('asset').scope).toBe('asset')
    // asset の evidence は record の decision を変えない
    expect(scope('record').decision).toBe('unknown')
    expect(oyako.rights.imageAssetStatus).toBe('prohibited')
  })
  it('7. recipe record permission does not imply image permission', () => {
    // record が仮に将来 allowed でも asset は別 scope
    expect(scope('asset').reasonCodes).toContain('ASSET_SEPARATE')
    expect(oyako.rights.recordRightsStatus).toBe('allowed')
    expect(oyako.rights.imageAssetStatus).toBe('prohibited')
  })
  it('8. source-level allowed does not imply third-party cleared', () => {
    expect(oyako.rights.sourceRightsStatus).toBe('allowed')
    expect(oyako.rights.thirdPartyRightsReview).toBe('not-reviewed')
    expect(canEnterRecipeImport(oyako)).toBe(false)
  })
  it('9. lack of permission evidence ≠ prohibition evidence', () => {
    // decision は unknown / conditional（＝許可 Evidence 不足）であって prohibited ではない
    const decisions = MAFF_KYODO_RYORI_RIGHTS_ANALYSIS.map((r) => r.decision)
    expect(decisions).toContain('unknown')
    expect(decisions).not.toContain('prohibited')
    expect(scope('third-party').evidenceMissing.length).toBeGreaterThan(0)
  })
})

// ------------------------------------------------------------
// §25.10–15 — 親子丼 / 玉子焼き が弱まっていない
// ------------------------------------------------------------

describe('MISSION 2.41C — oyakodon / tamagoyaki unchanged & still blocked', () => {
  it('10. oyakodon remains blocked', () => {
    expect(canEnterRecipeImport(oyako)).toBe(false)
    expect(runEvidencePackImport(oyako, { importedAt: IMPORTED_AT }).ok).toBe(false)
    expect(evidencePackHoldReasons(oyako)).toEqual(['HOLD_RECORD_RIGHTS_REVIEW'])
  })
  it('11. tamagoyaki remains blocked', () => {
    expect(canEnterRecipeImport(tamago)).toBe(false)
    expect(evidencePackHoldReasons(tamago)).toEqual([
      'HOLD_RECORD_RIGHTS_REVIEW',
      'HOLD_IDENTITY_REVIEW',
    ])
  })
  it('12. oyakodon facts unchanged (§18)', () => {
    expect(oyako.recipe.servings.value?.displayText).toBe('2人分')
    const soy = oyako.recipe.ingredients.filter((i) => i.sourceIngredientName === '醤油')
    expect(soy).toHaveLength(2)
    expect(soy.map((s) => s.amount.value?.displayText).sort()).toEqual(['大さじ1', '小さじ1/2'].sort())
    expect(oyako.recipe.ingredients.find((i) => i.sourceIngredientName === '鶏もも肉')?.amount.value?.displayText).toBe('150g')
    expect(oyako.recipe.steps).toHaveLength(5)
    expect(oyako.recipe.steps[2].duration?.value).toEqual({ kind: 'range', minMinutes: 2, maxMinutes: 3 })
  })
  it('13. tamagoyaki facts unchanged (§18)', () => {
    expect(tamago.recipe.servings.value?.displayText).toBe('1本分')
    expect(tamago.recipe.ingredients.find((i) => i.sourceIngredientName === '塩')?.amount.value?.semantics).toEqual({
      kind: 'culinary-term',
      term: '少々',
    })
    expect(tamago.recipe.steps[1].heat?.status).toBe('SOURCE_NOT_STATED')
    expect(tamago.recipe.steps).toHaveLength(3)
  })
  it('14. jp-oyakodon WorldRecipeIdentity unchanged', () => {
    const id = WORLD_RECIPE_IDENTITY_REGISTRY.find((i) => i.canonicalRecipeId === 'jp-oyakodon')
    expect(id?.canonicalName).toBe('親子丼')
    expect(oyako.identity.candidateCanonicalRecipeId).toBe('jp-oyakodon')
  })
  it('15. no tamagoyaki identity added (§16)', () => {
    expect(WORLD_RECIPE_IDENTITY_REGISTRY.some((i) => /玉子焼|卵焼/.test(i.canonicalName))).toBe(false)
    expect(tamago.identity.candidateCanonicalRecipeId).toBeUndefined()
    expect(validateEvidencePack(tamago).reasons).toContain('IDENTITY_CANDIDATE_MISSING')
  })
})

// ------------------------------------------------------------
// §25.16–21 — 既存機能 regression
// ------------------------------------------------------------

describe('MISSION 2.41C — existing systems unchanged', () => {
  it('16. Matching unchanged — held packs cannot enter matching', () => {
    // recipe-evidence-pack の Matching boundary は COMPLETE 以外 false のまま
    for (const p of EGG_BRANCH_BATCH1_EVIDENCE_PACKS) {
      expect(canEnterRecipeImport(p)).toBe(false)
    }
  })
  it('17. Verification unchanged', () => {
    expect(TORI_TERIYAKI_SOURCE_KNOWLEDGE.importProvenance).toBeUndefined()
    expect(SOURCE_RECIPE_KNOWLEDGE_FIXTURES).toHaveLength(2)
    expect(JSON.stringify(MAFF_KYODO_RYORI_RIGHTS_ANALYSIS)).not.toMatch(/"verified"|VERIFIED/)
  })
  it('18. Practical Validation unchanged', () => {
    expect(JSON.stringify(SOURCE_SELECTION_SCORECARDS)).not.toMatch(/practical|PracticalCook/i)
  })
  it('19. Allergy unchanged', () => {
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '..', 'source-rights-scorecard.ts'),
      'utf8',
    )
    expect(/allergen|allergy/i.test(src)).toBe(false)
  })
  it('20. CookedMealRecord unchanged', () => {
    const rec = createCookedMealRecord(
      { canonicalRecipeId: 'jp-oyakodon', recipeDisplayName: '親子丼' },
      { now: IMPORTED_AT },
    )
    expect(countCookedByRecipe([rec], 'jp-oyakodon')).toBe(1)
  })
  it('21. Share unchanged', () => {
    expect(buildFoodShareText({ recipeName: '親子丼' })).toContain('親子丼')
  })
  it('existing tori / buta unchanged', () => {
    expect(TORI_TERIYAKI_SOURCE_KNOWLEDGE.canonicalRecipeId).toBe('jp-tori-teriyaki')
    expect(BUTA_SHOGAYAKI_SOURCE_KNOWLEDGE.canonicalRecipeId).toBe('jp-buta-shogayaki')
  })
  it('既存 review repo Recipe(oyako-don) unchanged', () => {
    const repo = RECIPE_CATALOG.find((r) => r.id === 'oyako-don')
    expect(repo?.verification?.status).toBe('review')
    expect(JSON.stringify(repo)).not.toContain('近藤')
  })
})

// ------------------------------------------------------------
// §25.22–24 — Claude Code は法的結論を生成しない / network / dependency
// ------------------------------------------------------------

describe('MISSION 2.41C — no AI legal decision / no network / no dependency', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const read = (rel: string) => readFileSync(resolve(here, '..', rel), 'utf8')

  it('22. no AI legal decision — 分析 record は Evidence/Missing/Reason/NextResearch を分離保持するだけ', () => {
    for (const r of MAFF_KYODO_RYORI_RIGHTS_ANALYSIS) {
      expect(Array.isArray(r.evidenceFound)).toBe(true)
      expect(Array.isArray(r.evidenceMissing)).toBe(true)
      expect(Array.isArray(r.nextResearch)).toBe(true)
      // decision は RightsFlag のみ（新 enum なし）
      expect(['allowed', 'conditional', 'prohibited', 'unknown']).toContain(r.decision)
    }
    // legal conclusion 語を生成していない
    expect(JSON.stringify(MAFF_KYODO_RYORI_RIGHTS_ANALYSIS)).not.toMatch(/合法|違法|著作権侵害では?ない|問題ない/)
  })
  it('23. no network code in source-rights-scorecard.ts', () => {
    const src = read('source-rights-scorecard.ts')
    expect(/\bfetch\s*\(/.test(src)).toBe(false)
    expect(/\b(axios|XMLHttpRequest|puppeteer|playwright|crawler|scraper)\b/i.test(src)).toBe(false)
    expect(/from '\.\/(recipe-catalog|ai-provider|food-matching|world-food-knowledge)'/.test(src)).toBe(false)
  })
  it('24. no new dependency — module は types のみ import', () => {
    const src = read('source-rights-scorecard.ts')
    const imports = [...src.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1])
    expect(imports).toEqual(['@/features/food/types'])
  })
})

// ------------------------------------------------------------
// 追加 — Source Scorecard は Rights を自動決定しない（§14）/ third-party-free 識別（§15）
// ------------------------------------------------------------

describe('MISSION 2.41C — scorecard is research-prioritization only', () => {
  it('Scorecard は aggregate 数値スコアを持たない', () => {
    const card = SOURCE_SELECTION_SCORECARDS[0]
    expect(card).not.toHaveProperty('score')
    expect(card).not.toHaveProperty('total')
    for (const v of Object.values(card.axes)) {
      expect(['strong', 'moderate', 'weak', 'unknown']).toContain(v)
    }
  })
  it('MAFF card: recordRightsClarity=weak / thirdPartyRightsComplexity=weak / officiality=strong', () => {
    const a = SOURCE_SELECTION_SCORECARDS[0].axes
    expect(a.officiality).toBe('strong')
    expect(a.recordRightsClarity).toBe('weak')
    expect(a.thirdPartyRightsComplexity).toBe('weak')
    expect(a.assetSeparation).toBe('strong')
  })
  it('§15 — third-party-free 識別: egg branch は 2 件とも needsReview', () => {
    const { thirdPartyFree, needsReview } = partitionByThirdPartyReview(EGG_BRANCH_BATCH1_EVIDENCE_PACKS)
    expect(thirdPartyFree).toHaveLength(0)
    expect(needsReview).toHaveLength(2)
  })
  it('§15 — thirdPartyReviewSignalFor: cleared なら review 不要 / not-reviewed なら必要', () => {
    expect(thirdPartyReviewSignalFor({ thirdPartyIndication: false }).needsThirdPartyReview).toBe(false)
    expect(
      thirdPartyReviewSignalFor({ thirdPartyIndication: true, thirdPartyRightsReview: 'cleared' })
        .needsThirdPartyReview,
    ).toBe(false)
    expect(
      thirdPartyReviewSignalFor({ thirdPartyIndication: true, thirdPartyRightsReview: 'not-reviewed' })
        .needsThirdPartyReview,
    ).toBe(true)
  })
})
