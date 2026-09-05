// ============================================================
// recipe-source-discovery.test.ts
//
// MISSION 2.41F — Rights-Clear Recipe Source Discovery & Rights Gate Foundation。
//
// Rights Gate が「License 存在」と「対象 Recipe への適用」を混同せず、third-party signal を
// 自動 PASS せず、CC BY-NC 系を確実に REJECT し、Discovery ≠ Import を維持することを固定する
// （§13 の 13 要件 + 実候補 3 件 + 追加）。
// ============================================================

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  RIGHTS_CLEAR_CANDIDATE_MEANING,
  buildRecipeSourceCandidate,
  classifyRecipeSourceCandidate,
  describeApplicability,
  describeAssetApplicability,
  describeBlockingReason,
  detectThirdPartyRightsSignal,
  isEligibleForImportPipeline,
} from '../recipe-source-discovery'
import {
  REAL_RECIPE_SOURCE_CANDIDATES,
  SYNTHETIC_APPLICABILITY_UNCLEAR,
  SYNTHETIC_MISSING_ATTRIBUTION,
  SYNTHETIC_NONCOMMERCIAL,
  SYNTHETIC_PDL_THIRD_PARTY_UNRESOLVED,
  SYNTHETIC_RECIPE_FACTS_ALSO_UNKNOWN,
  SYNTHETIC_RIGHTS_CLEAR_CANDIDATE,
  SYNTHETIC_UNKNOWN_LICENSE,
  THEMEALDB_CANDIDATE,
  USDA_MYPLATE_CANDIDATE,
  WIKIBOOKS_COOKBOOK_CANDIDATE,
} from '../recipe-source-candidates'
import { WORLD_FOOD_SOURCE_REGISTRY } from '../world-food-sources'
import { SOURCE_RECIPE_KNOWLEDGE_FIXTURES } from '../world-food-fixtures'
import type { RecipeSourceCandidateInput } from '@/features/food/types'

// ------------------------------------------------------------
// §13 — 13 要件
// ------------------------------------------------------------

describe('MISSION 2.41F — Rights Gate §13 required tests', () => {
  it('1. PDL1.0 + applicability confirmed + commercial allowed + no unresolved third-party signal → eligible', () => {
    expect(SYNTHETIC_RIGHTS_CLEAR_CANDIDATE.classification).toBe('RIGHTS_CLEAR_CANDIDATE')
    expect(SYNTHETIC_RIGHTS_CLEAR_CANDIDATE.blockingReasons).toHaveLength(0)
  })
  it('2. PDL1.0 + third-party recipe provider unresolved → REVIEW_REQUIRED', () => {
    expect(SYNTHETIC_PDL_THIRD_PARTY_UNRESOLVED.licenseType).toBe('PDL1.0')
    expect(SYNTHETIC_PDL_THIRD_PARTY_UNRESOLVED.classification).toBe('REVIEW_REQUIRED')
    expect(SYNTHETIC_PDL_THIRD_PARTY_UNRESOLVED.blockingReasons).toContain('THIRD_PARTY_RIGHTS_UNRESOLVED')
  })
  it('3. CC BY 4.0 + applicability confirmed + attribution complete → eligible', () => {
    const input: RecipeSourceCandidateInput = {
      id: 'ccby-complete',
      name: 'CC BY complete test',
      organization: 'SYNTHETIC',
      country: 'INTL',
      sourceType: 'open-dataset',
      homepageUrl: 'https://example.invalid',
      licenseType: 'CC-BY-4.0',
      commercialUse: 'allowed',
      modification: 'allowed',
      attribution: 'required',
      thirdPartyRights: 'none',
      recipeApplicability: 'confirmed',
      photoApplicability: 'unknown',
      externalContentApplicability: 'unknown',
      evidence: [],
      reviewNotes: [],
      reviewedAt: '2026-09-05',
    }
    expect(classifyRecipeSourceCandidate(input).classification).toBe('RIGHTS_CLEAR_CANDIDATE')
  })
  it('4. CC BY 4.0 + missing attribution metadata → blocked/review', () => {
    expect(SYNTHETIC_MISSING_ATTRIBUTION.licenseType).toBe('CC-BY-4.0')
    expect(SYNTHETIC_MISSING_ATTRIBUTION.attribution).toBe('unknown')
    expect(SYNTHETIC_MISSING_ATTRIBUTION.classification).toBe('REVIEW_REQUIRED')
  })
  it('5. CC BY-NC → REJECTED', () => {
    expect(SYNTHETIC_NONCOMMERCIAL.classification).toBe('REJECTED')
    expect(SYNTHETIC_NONCOMMERCIAL.blockingReasons).toContain('LICENSE_NONCOMMERCIAL')
  })
  it('6. Unknown license → blocked (not RIGHTS_CLEAR)', () => {
    expect(SYNTHETIC_UNKNOWN_LICENSE.classification).not.toBe('RIGHTS_CLEAR_CANDIDATE')
    expect(SYNTHETIC_UNKNOWN_LICENSE.classification).toBe('RESEARCH_ONLY')
  })
  it('7. License URL exists but recipe applicability unclear → REVIEW_REQUIRED', () => {
    expect(SYNTHETIC_APPLICABILITY_UNCLEAR.licenseUrl).toBeTruthy()
    expect(SYNTHETIC_APPLICABILITY_UNCLEAR.recipeApplicability).toBe('unclear')
    expect(SYNTHETIC_APPLICABILITY_UNCLEAR.classification).toBe('REVIEW_REQUIRED')
  })
  it('8a. Photo rights unknown does not automatically block separately-confirmed Recipe Facts', () => {
    expect(SYNTHETIC_RIGHTS_CLEAR_CANDIDATE.photoApplicability).toBe('unknown')
    expect(SYNTHETIC_RIGHTS_CLEAR_CANDIDATE.classification).toBe('RIGHTS_CLEAR_CANDIDATE')
  })
  it('8b. But if Recipe Facts rights are also unknown, it blocks', () => {
    expect(SYNTHETIC_RECIPE_FACTS_ALSO_UNKNOWN.commercialUse).toBe('unknown')
    expect(SYNTHETIC_RECIPE_FACTS_ALSO_UNKNOWN.classification).not.toBe('RIGHTS_CLEAR_CANDIDATE')
    expect(SYNTHETIC_RECIPE_FACTS_ALSO_UNKNOWN.classification).toBe('REVIEW_REQUIRED')
  })
  it('9. External linked Recipe must not inherit parent site license automatically', () => {
    // externalContentApplicability は独立フィールド。gate 判定にもクラス分類にも使わない
    expect(WIKIBOOKS_COOKBOOK_CANDIDATE.externalContentApplicability).toBe('unknown')
    expect(WIKIBOOKS_COOKBOOK_CANDIDATE.licenseType).toBe('CC-BY-SA-4.0')
    // 外部 Content の unknown が親サイトの CC-BY-SA を継承した扱いにならない（別フィールドのまま）
    expect(WIKIBOOKS_COOKBOOK_CANDIDATE.externalContentApplicability).not.toBe('confirmed')
  })
  it('10. ThirdPartyRightsSignal must never auto-convert to PASS', () => {
    expect(detectThirdPartyRightsSignal('レシピ提供元名：山形県')).toBe(true)
    expect(detectThirdPartyRightsSignal('写真提供：やまがたの広報写真ライブラリー')).toBe(true)
    // signal 検出だけでは classification を変えない（thirdPartyRights を明示的に設定しない限り）
    const input: RecipeSourceCandidateInput = {
      id: 'signal-test',
      name: 'signal test',
      organization: 'SYNTHETIC',
      country: 'INTL',
      sourceType: 'open-dataset',
      homepageUrl: 'https://example.invalid',
      licenseType: 'CC-BY-4.0',
      commercialUse: 'allowed',
      modification: 'allowed',
      attribution: 'required',
      thirdPartyRights: 'unresolved', // signal 検出 → 呼び出し側が unresolved を選んだ結果（自動 allowed にしない）
      recipeApplicability: 'confirmed',
      photoApplicability: 'unknown',
      externalContentApplicability: 'unknown',
      evidence: [],
      reviewNotes: [],
      reviewedAt: '2026-09-05',
    }
    expect(classifyRecipeSourceCandidate(input).classification).not.toBe('RIGHTS_CLEAR_CANDIDATE')
  })
  it('11. Rights PASS must not imply Recipe VERIFIED', () => {
    expect(RIGHTS_CLEAR_CANDIDATE_MEANING).toContain('Recipe VERIFIED')
    expect(JSON.stringify(SYNTHETIC_RIGHTS_CLEAR_CANDIDATE)).not.toMatch(/"verified"|VERIFIED/)
  })
  it('12. Rights PASS must not imply allergy VERIFIED', () => {
    expect(RIGHTS_CLEAR_CANDIDATE_MEANING).toContain('Allergy Safe')
    expect(JSON.stringify(REAL_RECIPE_SOURCE_CANDIDATES)).not.toMatch(/allergy|allergen|アレル/i)
  })
  it('13. Rights PASS must not imply taste VERIFIED', () => {
    expect(RIGHTS_CLEAR_CANDIDATE_MEANING).toContain('Taste Verified')
    expect(JSON.stringify(REAL_RECIPE_SOURCE_CANDIDATES)).not.toMatch(/taste.?verified|美味しさ確認/i)
  })
})

// ------------------------------------------------------------
// Real Source Candidates（最低3件・件数稼ぎでない・A/B/C or D の違いを実証）
// ------------------------------------------------------------

describe('MISSION 2.41F — real recipe source candidates', () => {
  it('3 件以上の実 Candidate を調査した', () => {
    expect(REAL_RECIPE_SOURCE_CANDIDATES.length).toBeGreaterThanOrEqual(3)
  })
  it('Wikibooks Cookbook: CC BY-SA 4.0 → REVIEW_REQUIRED（share-alike 条件レビュー・§4 policy）', () => {
    expect(WIKIBOOKS_COOKBOOK_CANDIDATE.licenseType).toBe('CC-BY-SA-4.0')
    expect(WIKIBOOKS_COOKBOOK_CANDIDATE.classification).toBe('REVIEW_REQUIRED')
    expect(WIKIBOOKS_COOKBOOK_CANDIDATE.evidence[0].sourceUrl).toBe(
      'https://en.wikibooks.org/wiki/Wikibooks:Copyrights',
    )
    expect(WIKIBOOKS_COOKBOOK_CANDIDATE.evidence[0].evidenceType).toBe('terms-of-use')
  })
  it('TheMealDB: 無料枠は商用/公開利用禁止 → REJECTED', () => {
    expect(THEMEALDB_CANDIDATE.classification).toBe('REJECTED')
    expect(THEMEALDB_CANDIDATE.commercialUse).toBe('prohibited')
    expect(THEMEALDB_CANDIDATE.blockingReasons).toContain('COMMERCIAL_USE_PROHIBITED')
  })
  it('USDA MyPlate: 一次資料未確認（403 / 証明書エラー）→ RESEARCH_ONLY、検索 snippet を Evidence にしていない', () => {
    expect(USDA_MYPLATE_CANDIDATE.classification).toBe('RESEARCH_ONLY')
    expect(USDA_MYPLATE_CANDIDATE.licenseType).toBe('unknown')
    expect(USDA_MYPLATE_CANDIDATE.reviewNotes.join(' ')).toContain('myplate.food')
    expect(USDA_MYPLATE_CANDIDATE.reviewNotes.join(' ')).toContain('採用しない')
  })
  it('A / B(or C) / D の分類差が実際にテスト可能である', () => {
    const classes = new Set(REAL_RECIPE_SOURCE_CANDIDATES.map((c) => c.classification))
    expect(classes.has('REVIEW_REQUIRED')).toBe(true)
    expect(classes.has('REJECTED')).toBe(true)
    expect(classes.has('RESEARCH_ONLY')).toBe(true)
  })
  it('実候補に RIGHTS_CLEAR_CANDIDATE が 0 件でもよい（安全に 0 件は失敗ではない）', () => {
    const clear = REAL_RECIPE_SOURCE_CANDIDATES.filter((c) => c.classification === 'RIGHTS_CLEAR_CANDIDATE')
    // 0 件を許容する。Aを作るために推測していないことを確認する（無理な PASS がない）
    for (const c of REAL_RECIPE_SOURCE_CANDIDATES) {
      if (c.classification === 'RIGHTS_CLEAR_CANDIDATE') {
        expect(c.recipeApplicability).toBe('confirmed')
        expect(c.commercialUse).toBe('allowed')
      }
    }
    expect(clear.length).toBeGreaterThanOrEqual(0)
  })
  it('各候補は Evidence を最低 1 件保持し、URL・publisher・retrievedAt・summary を持つ', () => {
    for (const c of REAL_RECIPE_SOURCE_CANDIDATES) {
      expect(c.evidence.length).toBeGreaterThan(0)
      for (const e of c.evidence) {
        expect(e.sourceUrl).toMatch(/^https?:\/\//)
        expect(e.publisher.length).toBeGreaterThan(0)
        expect(e.retrievedAt).toBe('2026-09-05')
        expect(e.ruleSummary.length).toBeGreaterThan(10)
      }
    }
  })
  it('外部規約本文を大量コピーしていない（Evidence summary は短い要約のみ）', () => {
    for (const c of REAL_RECIPE_SOURCE_CANDIDATES) {
      for (const e of c.evidence) {
        expect(e.ruleSummary.length).toBeLessThan(1200)
      }
    }
  })
})

// ------------------------------------------------------------
// Discovery ≠ Import boundary（§8）
// ------------------------------------------------------------

describe('MISSION 2.41F — Discovery ≠ Import boundary', () => {
  it('RIGHTS_CLEAR_CANDIDATE でも import pipeline eligibility は false（別 MISSION の判断）', () => {
    expect(isEligibleForImportPipeline()).toBe(false)
  })
  it('WorldFoodSource 登録簿へ自動登録していない', () => {
    const ids = WORLD_FOOD_SOURCE_REGISTRY.map((s) => s.sourceId)
    expect(ids).not.toContain('wikibooks-cookbook')
    expect(ids).not.toContain('themealdb')
    // us-usda-myplate は既存 registry のものと同一 id を再利用しているが、内容を変更していない
    const usda = WORLD_FOOD_SOURCE_REGISTRY.find((s) => s.sourceId === 'us-usda-myplate')
    expect(usda?.classification).toBe('unknown')
  })
  it('SourceRecipeKnowledge へ実 Recipe を追加していない（tori/buta の 2 件のまま）', () => {
    expect(SOURCE_RECIPE_KNOWLEDGE_FIXTURES).toHaveLength(2)
  })
  it('大量 Recipe Import をしていない（recipe candidate に ingredients/steps を持たせていない）', () => {
    for (const c of REAL_RECIPE_SOURCE_CANDIDATES) {
      expect(c).not.toHaveProperty('ingredients')
      expect(c).not.toHaveProperty('steps')
      expect(c).not.toHaveProperty('cookingSteps')
    }
  })
})

// ------------------------------------------------------------
// Third-Party Rights Signal 検出（§10）
// ------------------------------------------------------------

describe('MISSION 2.41F — third-party rights signal detection', () => {
  const positives = ['提供', '提供元', '写真提供', '資料提供', '出典', '監修', '著者', 'レシピ提供', '外部サイト', '転載', '© 2026', 'Copyright 2026']
  for (const text of positives) {
    it(`"${text}" は third-party signal として検出される`, () => {
      expect(detectThirdPartyRightsSignal(text)).toBe(true)
    })
  }
  it('signal 無しのテキストは検出されない', () => {
    expect(detectThirdPartyRightsSignal('材料: じゃがいも 2個、玉ねぎ 1個')).toBe(false)
  })
  it('signal 検出は allowed / prohibited のどちらにも自動変換しない（boolean のみ返す）', () => {
    const result = detectThirdPartyRightsSignal('レシピ提供元名：山形県')
    expect(typeof result).toBe('boolean')
  })
})

// ------------------------------------------------------------
// 監査ラベル
// ------------------------------------------------------------

describe('MISSION 2.41F — audit labels', () => {
  it('describeApplicability / describeAssetApplicability / describeBlockingReason が全パターンをカバー', () => {
    for (const s of ['confirmed', 'partial', 'unclear', 'notApplicable'] as const) {
      expect(describeApplicability(s).length).toBeGreaterThan(1)
    }
    for (const s of ['confirmed', 'separate', 'prohibited', 'unknown'] as const) {
      expect(describeAssetApplicability(s).length).toBeGreaterThan(1)
    }
    for (const c of [...REAL_RECIPE_SOURCE_CANDIDATES, SYNTHETIC_PDL_THIRD_PARTY_UNRESOLVED]) {
      for (const r of c.blockingReasons) {
        expect(describeBlockingReason(r as never).length).toBeGreaterThan(3)
      }
    }
  })
})

// ------------------------------------------------------------
// Module firewall（import graph 静的解析）
// ------------------------------------------------------------

describe('MISSION 2.41F — module firewall', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const read = (rel: string) => readFileSync(resolve(here, '..', rel), 'utf8')

  const FORBIDDEN = [
    './recipe-publishability',
    './recipe-safety',
    './practical-cook-validation',
    './recipe-catalog',
    './mock-meal-provider',
    './recipe-suggestion-engine',
    './from-now-to-table',
    './ai-provider',
    './food-matching',
    './world-food-knowledge',
    './world-recipe-import',
    './cooked-meal-record',
  ]

  for (const file of ['recipe-source-discovery.ts', 'recipe-source-candidates.ts']) {
    it(`${file} が Verification / Allergy / Matching / AI / Import Pipeline を import しない`, () => {
      const src = read(file)
      for (const mod of FORBIDDEN) {
        expect(src.includes(`from '${mod}'`), `${file} imports ${mod}`).toBe(false)
      }
      expect(/\bfetch\s*\(/.test(src)).toBe(false)
      expect(/\b(puppeteer|playwright|selenium|webdriver|cheerio)\b/i.test(src)).toBe(false)
      expect(/\bverifyRecipe\s*\(/.test(src)).toBe(false)
      expect(/\bnew\s+Date\s*\(/.test(src)).toBe(false)
      expect(/\bMath\.random\s*\(/.test(src)).toBe(false)
    })
  }
})
