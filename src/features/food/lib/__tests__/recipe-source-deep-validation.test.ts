// ============================================================
// recipe-source-deep-validation.test.ts
//
// MISSION 2.41F-2 — Rights-Clear Source Deep Validation。
//
// Health Canada（HEFI 2019 / FSCT）と UK National Archives（MAF 102/15）の Deep Validation が
// LICENSE → LICENSE APPLICABILITY → ACTUAL DATA → THIRD-PARTY RIGHTS → ATTRIBUTION →
// RECIPE USABILITY を 1 本の Evidence Chain として正しくつなぎ、1 件も無理に PASS していない
// ことを固定する（§13 の 12 要件 + 実候補 3 件 + Capability model + 追加）。
// ============================================================

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  RIGHTS_CLEAR_CANDIDATE_MEANING,
  buildAttributionPreview,
  classifyRecipeSourceCandidate,
  describeCapability,
  evidenceChainMissingLinks,
  gapSeparationFor,
  hasUnresolvedRightsGap,
  isEligibleForImportPipeline,
  isFullRecipeCapable,
} from '../recipe-source-discovery'
import {
  DEEP_VALIDATION_CANDIDATES,
  DEEP_VALIDATION_SYNTHETIC_FIXTURES,
  HEALTH_CANADA_FSCT_CANDIDATE,
  HEALTH_CANADA_HEFI2019_CANDIDATE,
  UK_NATIONAL_ARCHIVES_MAF10215_CANDIDATE,
} from '../recipe-source-deep-candidates'
import { REAL_RECIPE_SOURCE_CANDIDATES } from '../recipe-source-candidates'
import { WORLD_FOOD_SOURCE_REGISTRY } from '../world-food-sources'
import { SOURCE_RECIPE_KNOWLEDGE_FIXTURES } from '../world-food-fixtures'

const {
  CLEAR_INGREDIENT_GRAPH,
  CLEAR_HISTORICAL_RECIPE,
  THIRD_PARTY_CLEARED,
  ARTICLE_LICENSE,
  REFERENCED_DATASET_UNKNOWN,
  RIGHTS_GAP_DATA_COMPLETE,
  RIGHTS_COMPLETE_NO_STEPS,
  FULL_RECIPE_NO_RIGHTS,
} = DEEP_VALIDATION_SYNTHETIC_FIXTURES

// ------------------------------------------------------------
// §13 — 12 要件
// ------------------------------------------------------------

describe('MISSION 2.41F-2 — §13 required tests', () => {
  it('1. Government Open Data licence + resource applicability confirmed + commercial/modification allowed + attribution known + third-party cleared → RIGHTS_CLEAR_CANDIDATE', () => {
    expect(THIRD_PARTY_CLEARED.classification).toBe('RIGHTS_CLEAR_CANDIDATE')
    expect(THIRD_PARTY_CLEARED.thirdPartyRights).toBe('cleared')
  })
  it('2. Government portal says open licence but resource applicability unknown → REVIEW_REQUIRED', () => {
    // 実例: FSCT は licence 明確・third-party none だが実データ未確認（partial）
    expect(HEALTH_CANADA_FSCT_CANDIDATE.recipeApplicability).toBe('partial')
    expect(HEALTH_CANADA_FSCT_CANDIDATE.classification).toBe('REVIEW_REQUIRED')
  })
  it('3. Government dataset contains third-party data with unresolved rights → REVIEW_REQUIRED', () => {
    // 実例: HEFI 2019 は ASA24（米国 NCI/NIH）由来の third-party signal が確認された
    expect(HEALTH_CANADA_HEFI2019_CANDIDATE.thirdPartyRights).toBe('unresolved')
    expect(HEALTH_CANADA_HEFI2019_CANDIDATE.classification).toBe('REVIEW_REQUIRED')
    expect(HEALTH_CANADA_HEFI2019_CANDIDATE.evidence.some((e) => /NCI|NIH/.test(e.ruleSummary))).toBe(true)
  })
  it('4. Rights-clear ingredient graph without cooking steps → Rights PASS possible + capability RECIPE_INGREDIENT_GRAPH + NOT FULL_RECIPE', () => {
    expect(CLEAR_INGREDIENT_GRAPH.classification).toBe('RIGHTS_CLEAR_CANDIDATE')
    expect(CLEAR_INGREDIENT_GRAPH.capabilities).toEqual(['RECIPE_INGREDIENT_GRAPH'])
    expect(isFullRecipeCapable(CLEAR_INGREDIENT_GRAPH)).toBe(false)
  })
  it('5. Rights-clear historical recipe → Rights classification independent from Product Value', () => {
    expect(CLEAR_HISTORICAL_RECIPE.classification).toBe('RIGHTS_CLEAR_CANDIDATE')
    expect(CLEAR_HISTORICAL_RECIPE.capabilities).toContain('HISTORICAL_RECIPE')
    // 実例: UK MAF は同じ HISTORICAL_RECIPE capability だが Rights 側の理由で REVIEW_REQUIRED
    // → capability が同じでも classification は Rights fields のみで決まる（相関しない）
    expect(UK_NATIONAL_ARCHIVES_MAF10215_CANDIDATE.capabilities).toContain('HISTORICAL_RECIPE')
    expect(UK_NATIONAL_ARCHIVES_MAF10215_CANDIDATE.classification).toBe('REVIEW_REQUIRED')
  })
  it('6. CC BY article with third-party Recipe dataset → article licence must not propagate automatically', () => {
    expect(ARTICLE_LICENSE.licenseType).toBe('CC-BY-4.0')
    expect(ARTICLE_LICENSE.classification).toBe('RIGHTS_CLEAR_CANDIDATE')
    // 参照される dataset は完全に独立した評価（article の classification を継承しない）
    expect(REFERENCED_DATASET_UNKNOWN.licenseType).toBe('unknown')
    expect(REFERENCED_DATASET_UNKNOWN.classification).not.toBe('RIGHTS_CLEAR_CANDIDATE')
    expect(REFERENCED_DATASET_UNKNOWN.classification).toBe('RESEARCH_ONLY')
  })
  it('7. Source/resource name containing "Recipe" does not imply FULL_RECIPE', () => {
    // "ASA24 Recipes HEFI" / "Recipe Breakdown" という resource 名だが、実データは食材構成のみ
    expect(HEALTH_CANADA_HEFI2019_CANDIDATE.name).toContain('Recipe')
    expect(isFullRecipeCapable(HEALTH_CANADA_HEFI2019_CANDIDATE)).toBe(false)
    expect(HEALTH_CANADA_HEFI2019_CANDIDATE.capabilities).toEqual(['RECIPE_INGREDIENT_GRAPH'])
  })
  it('8. Rights clear does not imply Recipe VERIFIED', () => {
    expect(RIGHTS_CLEAR_CANDIDATE_MEANING).toContain('Recipe VERIFIED')
    expect(JSON.stringify(THIRD_PARTY_CLEARED)).not.toMatch(/"verified"|VERIFIED/)
  })
  it('9. Rights clear does not imply Allergy VERIFIED', () => {
    expect(RIGHTS_CLEAR_CANDIDATE_MEANING).toContain('Allergy Safe')
    expect(JSON.stringify(DEEP_VALIDATION_CANDIDATES)).not.toMatch(/allergy|allergen|アレル/i)
  })
  it('10. Rights clear does not imply safety completeness', () => {
    // capabilities に FOOD_SAFETY_REFERENCE を含む候補は無い（推測で安全性情報ありと記録していない）
    for (const c of DEEP_VALIDATION_CANDIDATES) {
      expect(c.capabilities ?? []).not.toContain('FOOD_SAFETY_REFERENCE')
    }
    expect(JSON.stringify(DEEP_VALIDATION_CANDIDATES)).not.toMatch(/food.?safety.?verified|安全性確認済み/i)
  })
  it('11. Attribution missing when required → no Rights-Clear', () => {
    const missingAttribution = {
      ...CLEAR_INGREDIENT_GRAPH,
      attribution: 'unknown' as const,
    }
    // classify を直接確認（gate は attribution unknown を弾く）
    expect(missingAttribution.attribution).toBe('unknown')
    // 実際に gate を再計算しても RIGHTS_CLEAR にならないことを確認
    expect(classifyRecipeSourceCandidate(missingAttribution).classification).not.toBe('RIGHTS_CLEAR_CANDIDATE')
  })
  it('12. Third-party cleared explicitly → gate may proceed', () => {
    expect(THIRD_PARTY_CLEARED.classification).toBe('RIGHTS_CLEAR_CANDIDATE')
  })
})

// ------------------------------------------------------------
// Primary Target A/B/C — 実 Deep Validation 候補
// ------------------------------------------------------------

describe('MISSION 2.41F-2 — Primary Target deep validation', () => {
  it('Target A: Health Canada HEFI 2019 は third-party（ASA24=NCI/NIH）signal により REVIEW_REQUIRED', () => {
    const c = HEALTH_CANADA_HEFI2019_CANDIDATE
    expect(c.classification).toBe('REVIEW_REQUIRED')
    expect(c.blockingReasons).toContain('THIRD_PARTY_RIGHTS_UNRESOLVED')
    expect(c.blockingReasons).toContain('RECIPE_APPLICABILITY_NOT_CONFIRMED')
    expect(c.capabilities).toEqual(['RECIPE_INGREDIENT_GRAPH'])
    // Evidence Chain: ASA24 が NCI/NIH 起源であることを一次資料で確認した記録がある
    expect(c.evidence.some((e) => e.sourceUrl === 'https://epi.grants.cancer.gov/asa24/')).toBe(true)
  })
  it('Target B: Health Canada FSCT は third-party signal なし・4候補中もっとも Rights-Clear に近い', () => {
    const c = HEALTH_CANADA_FSCT_CANDIDATE
    expect(c.thirdPartyRights).toBe('none')
    expect(c.commercialUse).toBe('allowed')
    expect(c.modification).toBe('allowed')
    expect(c.attribution).toBe('required')
    expect(c.classification).toBe('REVIEW_REQUIRED')
    expect(c.blockingReasons).toEqual(['RECIPE_APPLICABILITY_NOT_CONFIRMED'])
    expect(c.capabilities).toContain('RECIPE_INGREDIENT_GRAPH')
  })
  it('Target C: UK National Archives MAF 102/15 は Rights は比較的明確だが実データ未抽出', () => {
    const c = UK_NATIONAL_ARCHIVES_MAF10215_CANDIDATE
    expect(c.thirdPartyRights).toBe('none')
    expect(c.commercialUse).toBe('allowed')
    expect(c.recipeApplicability).toBe('partial')
    expect(c.classification).toBe('REVIEW_REQUIRED')
    expect(c.capabilities).toEqual(['HISTORICAL_RECIPE', 'DISCOVERY_ONLY'])
  })
  it('3 Primary Target すべてに Evidence Chain（一次資料 URL）が複数保持されている', () => {
    for (const c of DEEP_VALIDATION_CANDIDATES) {
      expect(c.evidence.length).toBeGreaterThanOrEqual(2)
      for (const e of c.evidence) {
        expect(e.sourceUrl).toMatch(/^https?:\/\//)
        expect(e.retrievedAt).toBe('2026-09-05')
      }
    }
  })
  it('RIGHTS_CLEAR_CANDIDATE 数 = 0（無理に PASS させていない）。REVIEW_REQUIRED = 3', () => {
    const counts: Record<string, number> = { RIGHTS_CLEAR_CANDIDATE: 0, REVIEW_REQUIRED: 0, RESEARCH_ONLY: 0, REJECTED: 0 }
    for (const c of DEEP_VALIDATION_CANDIDATES) counts[c.classification]++
    expect(counts.RIGHTS_CLEAR_CANDIDATE).toBe(0)
    expect(counts.REVIEW_REQUIRED).toBe(3)
  })
})

// ------------------------------------------------------------
// Evidence Chain（§9）
// ------------------------------------------------------------

describe('MISSION 2.41F-2 — Rights Evidence Chain', () => {
  it('evidenceChainMissingLinks: HEFI2019 は THIRD_PARTY_RIGHTS と LICENSE_APPLICABILITY が欠落', () => {
    const missing = evidenceChainMissingLinks(HEALTH_CANADA_HEFI2019_CANDIDATE)
    expect(missing).toContain('THIRD_PARTY_RIGHTS')
    expect(missing).toContain('LICENSE_APPLICABILITY')
  })
  it('evidenceChainMissingLinks: FSCT は third-party 以外の欠落のみ（LICENSE_APPLICABILITY / CONTENT_SCOPE）', () => {
    const missing = evidenceChainMissingLinks(HEALTH_CANADA_FSCT_CANDIDATE)
    expect(missing).toEqual(['LICENSE_APPLICABILITY', 'CONTENT_SCOPE'])
    expect(missing).not.toContain('THIRD_PARTY_RIGHTS')
  })
  it('途中 1 つでも欠落があれば RIGHTS_CLEAR_CANDIDATE にしない（3 候補とも欠落あり）', () => {
    for (const c of DEEP_VALIDATION_CANDIDATES) {
      expect(evidenceChainMissingLinks(c).length).toBeGreaterThan(0)
      expect(c.classification).not.toBe('RIGHTS_CLEAR_CANDIDATE')
    }
  })
  it('欠落が無い SYNTHETIC candidate は Evidence Chain が完全', () => {
    expect(evidenceChainMissingLinks(THIRD_PARTY_CLEARED)).toHaveLength(0)
  })
})

// ------------------------------------------------------------
// Attribution Preview（§10）
// ------------------------------------------------------------

describe('MISSION 2.41F-2 — Attribution Preview', () => {
  it('Evidence から導出できる範囲だけで preview を構築する（正式文言を推測で確定しない）', () => {
    const preview = buildAttributionPreview(HEALTH_CANADA_FSCT_CANDIDATE)
    expect(preview.source).toBe('Health Canada')
    expect(preview.dataset).toContain('Food Source Contribution Table')
    expect(preview.licence).toBe('custom-government-license')
    expect(preview.licenceUrl).toBe('https://open.canada.ca/en/open-government-licence-canada')
    expect(preview.modifiedNote.length).toBeGreaterThan(0)
  })
  it('3 候補すべてに preview を構築できる', () => {
    for (const c of DEEP_VALIDATION_CANDIDATES) {
      const preview = buildAttributionPreview(c)
      expect(preview.source.length).toBeGreaterThan(0)
      expect(preview.dataset.length).toBeGreaterThan(0)
    }
  })
})

// ------------------------------------------------------------
// Discovery ≠ Import boundary（§12・MISSION 2.41F から継続）
// ------------------------------------------------------------

describe('MISSION 2.41F-2 — Discovery ≠ Import boundary maintained', () => {
  it('isEligibleForImportPipeline は常に false', () => {
    expect(isEligibleForImportPipeline()).toBe(false)
  })
  it('WorldFoodSource 登録簿へ自動登録していない', () => {
    const ids = WORLD_FOOD_SOURCE_REGISTRY.map((s) => s.sourceId)
    expect(ids).not.toContain('health-canada-hefi2019-recipe-breakdown')
    expect(ids).not.toContain('health-canada-fsct-2015-cchs')
    expect(ids).not.toContain('uk-national-archives-maf-102-15')
  })
  it('real Recipe import = 0（SourceRecipeKnowledge は tori/buta の 2 件のまま）', () => {
    expect(SOURCE_RECIPE_KNOWLEDGE_FIXTURES).toHaveLength(2)
  })
  it('MISSION 2.41F の 3 実候補は本 MISSION で変更していない', () => {
    expect(REAL_RECIPE_SOURCE_CANDIDATES).toHaveLength(3)
    const ids = REAL_RECIPE_SOURCE_CANDIDATES.map((c) => c.id)
    expect(ids).toEqual(['wikibooks-cookbook', 'themealdb', 'us-usda-myplate'])
  })
  it('Deep Validation candidate に ingredients/steps を持たせていない（大量 Import 禁止）', () => {
    for (const c of DEEP_VALIDATION_CANDIDATES) {
      expect(c).not.toHaveProperty('ingredients')
      expect(c).not.toHaveProperty('steps')
    }
  })
})

// ------------------------------------------------------------
// Capability 監査ラベル
// ------------------------------------------------------------

describe('MISSION 2.41F-2 — capability labels', () => {
  it('describeCapability が全 7 種をカバー', () => {
    const all = [
      'FULL_RECIPE',
      'RECIPE_INGREDIENT_GRAPH',
      'NUTRITION_REFERENCE',
      'FOOD_SAFETY_REFERENCE',
      'CULINARY_IDENTITY_REFERENCE',
      'HISTORICAL_RECIPE',
      'DISCOVERY_ONLY',
    ] as const
    for (const c of all) expect(describeCapability(c).length).toBeGreaterThan(1)
  })
})

// ------------------------------------------------------------
// Module firewall
// ------------------------------------------------------------

describe('MISSION 2.41F-2 — module firewall', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const read = (rel: string) => readFileSync(resolve(here, '..', rel), 'utf8')

  const FORBIDDEN = [
    './recipe-publishability',
    './recipe-safety',
    './practical-cook-validation',
    './recipe-catalog',
    './ai-provider',
    './food-matching',
    './world-food-knowledge',
    './world-recipe-import',
    './cooked-meal-record',
  ]

  it('recipe-source-deep-candidates.ts が Verification / Allergy / Matching / AI / Import Pipeline を import しない', () => {
    const src = read('recipe-source-deep-candidates.ts')
    for (const mod of FORBIDDEN) {
      expect(src.includes(`from '${mod}'`), `imports ${mod}`).toBe(false)
    }
    expect(/\bfetch\s*\(/.test(src)).toBe(false)
    expect(/\bnew\s+Date\s*\(/.test(src)).toBe(false)
  })
})

// ============================================================
// MISSION 2.41F-2A — Rights ≠ Completeness ≠ Product Value 分離監査（§8）
// ============================================================

describe('MISSION 2.41F-2A — Rights / Completeness / Product Value separation', () => {
  it('1. Rights Evidence missing + Data schema confirmed → still REVIEW_REQUIRED', () => {
    expect(RIGHTS_GAP_DATA_COMPLETE.dataCompletenessGaps).toEqual([])
    expect(RIGHTS_GAP_DATA_COMPLETE.recipeApplicability).toBe('unclear')
    expect(RIGHTS_GAP_DATA_COMPLETE.classification).toBe('REVIEW_REQUIRED')
    expect(hasUnresolvedRightsGap(RIGHTS_GAP_DATA_COMPLETE)).toBe(true)
  })
  it('2. Rights Evidence complete + cooking steps missing → Rights classification independent from FULL_RECIPE capability', () => {
    expect(RIGHTS_COMPLETE_NO_STEPS.classification).toBe('RIGHTS_CLEAR_CANDIDATE')
    expect(RIGHTS_COMPLETE_NO_STEPS.dataCompletenessGaps).toContain('cooking steps / servings なし')
    expect(isFullRecipeCapable(RIGHTS_COMPLETE_NO_STEPS)).toBe(false)
  })
  it('3. scan untranscribed → completeness gap, not automatically Rights failure', () => {
    const c = UK_NATIONAL_ARCHIVES_MAF10215_CANDIDATE
    const gaps = gapSeparationFor(c)
    // transcription は dataCompletenessGaps 側にのみ現れる
    expect(gaps.dataCompletenessGaps.join(' ')).toMatch(/文字起こし|transcription/)
    expect(gaps.rightsGaps.join(' ')).not.toMatch(/文字起こし|transcription/)
    // classification の blockingReasons に「transcription」由来の理由は無い
    expect(c.blockingReasons.join(' ')).not.toMatch(/transcript/i)
  })
  it('4. LICENSE_APPLICABILITY unknown → schema completeness must not clear it', () => {
    // dataCompletenessGaps を空にしても recipeApplicability unclear のままなら REVIEW_REQUIRED
    const forced = classifyRecipeSourceCandidate({ ...RIGHTS_GAP_DATA_COMPLETE, dataCompletenessGaps: [] })
    expect(forced.classification).not.toBe('RIGHTS_CLEAR_CANDIDATE')
    expect(evidenceChainMissingLinks(RIGHTS_GAP_DATA_COMPLETE)).toContain('LICENSE_APPLICABILITY')
  })
  it('5. CONTENT_SCOPE unknown → recipe data presence must not clear it', () => {
    // recipe データが完全に把握できていても content scope が未確認なら Evidence Chain に残る
    expect(HEALTH_CANADA_FSCT_CANDIDATE.recipeApplicability).toBe('partial')
    expect(evidenceChainMissingLinks(HEALTH_CANADA_FSCT_CANDIDATE)).toContain('CONTENT_SCOPE')
    expect(HEALTH_CANADA_FSCT_CANDIDATE.classification).toBe('REVIEW_REQUIRED')
  })
  it('6. HEFI third-party unresolved → remains REVIEW_REQUIRED', () => {
    expect(HEALTH_CANADA_HEFI2019_CANDIDATE.thirdPartyRights).toBe('unresolved')
    expect(HEALTH_CANADA_HEFI2019_CANDIDATE.classification).toBe('REVIEW_REQUIRED')
    expect(gapSeparationFor(HEALTH_CANADA_HEFI2019_CANDIDATE).rightsGaps).toContain('THIRD_PARTY_RIGHTS_UNRESOLVED')
  })
  it('7. FSCT reported rights gaps and data gaps are distinct（重複しない）', () => {
    const g = gapSeparationFor(HEALTH_CANADA_FSCT_CANDIDATE)
    expect(g.rightsGaps.length).toBeGreaterThan(0)
    expect(g.dataCompletenessGaps.length).toBeGreaterThan(0)
    // rightsGaps は識別子（大文字 + EVIDENCE_CHAIN:）のみ。散文の data gap は混ざらない
    for (const r of g.rightsGaps) expect(r).toMatch(/^[A-Z_]+$|^EVIDENCE_CHAIN:[A-Z_]+$/)
    // FSCT は third-party none なので rightsGaps に third-party 系は無い
    expect(g.rightsGaps.join(' ')).not.toMatch(/THIRD_PARTY/)
    // data gap 側に「CSV / Data Dictionary」が入り、rights gap 側には入らない
    expect(g.dataCompletenessGaps.join(' ')).toMatch(/CSV|Data Dictionary/)
    expect(g.rightsGaps.join(' ')).not.toMatch(/CSV|Data Dictionary/)
  })
  it('8. UK rights gaps and transcription gap are distinct', () => {
    const g = gapSeparationFor(UK_NATIONAL_ARCHIVES_MAF10215_CANDIDATE)
    expect(g.rightsGaps).toContain('EVIDENCE_CHAIN:LICENSE_APPLICABILITY')
    expect(g.dataCompletenessGaps.join(' ')).toMatch(/文字起こし/)
    // 交差なし
    const overlap = g.rightsGaps.filter((r) => g.dataCompletenessGaps.includes(r))
    expect(overlap).toHaveLength(0)
  })
  it('9. Rights PASS never implies FULL_RECIPE', () => {
    for (const c of Object.values(DEEP_VALIDATION_SYNTHETIC_FIXTURES)) {
      if (c.classification === 'RIGHTS_CLEAR_CANDIDATE') {
        expect(isFullRecipeCapable(c)).toBe(false)
      }
    }
  })
  it('10. FULL_RECIPE never implies Rights PASS', () => {
    expect(FULL_RECIPE_NO_RIGHTS.capabilities).toContain('FULL_RECIPE')
    expect(FULL_RECIPE_NO_RIGHTS.classification).not.toBe('RIGHTS_CLEAR_CANDIDATE')
    expect(hasUnresolvedRightsGap(FULL_RECIPE_NO_RIGHTS)).toBe(true)
  })
  it('3 実候補すべて: classification 不変（REVIEW_REQUIRED）・RIGHTS_CLEAR へ昇格していない', () => {
    for (const c of DEEP_VALIDATION_CANDIDATES) {
      expect(c.classification).toBe('REVIEW_REQUIRED')
      expect(hasUnresolvedRightsGap(c)).toBe(true)
    }
  })
  it('gapSeparationFor: 3 系統が絶対に混ざらない（productValueNotes は rights/data と別）', () => {
    for (const c of DEEP_VALIDATION_CANDIDATES) {
      const g = gapSeparationFor(c)
      for (const pv of g.productValueNotes) {
        expect(g.rightsGaps).not.toContain(pv)
        expect(g.dataCompletenessGaps).not.toContain(pv)
      }
    }
  })
})
