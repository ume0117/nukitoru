// ============================================================
// maff-yamagata-rights-gap.test.ts
//
// MISSION 2.41E — PUBLIC-SECTOR RECORD RIGHTS FINAL GAP。
//
// License が存在すること ≠ 目的の Record へその License が適用されること。
// PDL1.0 / CC BY 4.0 を Recipe へ自動継承しない。芋煮 / 納豆汁 / 玉こんにゃく /
// 親子丼 / 玉子焼き が引き続き BLOCKED であることを固定する（§26 の 30 要件 + 追加）。
// ============================================================

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  MAFF_LINK_COPYRIGHT_EVIDENCE,
  MAFF_APPENDIX_THIRD_PARTY_EVIDENCE,
  YAMAGATA_OPEN_DATA_EVIDENCE,
  CONTENT_CATEGORY_SEPARATION,
  MAFF_YAMAGATA_RIGHTS_MATRIX,
  LICENSE_INHERITANCE_RULE,
  MAFF_YAMAGATA_REMAINING_RIGHTS_GAP,
  MAFF_YAMAGATA_CURRENT_DECISION,
  RIGHTS_INQUIRY_DRAFTS,
  classifyRecipeProvider,
} from '../source-rights-scorecard'
import {
  IMONI_YAMAGATA_EVIDENCE_PACK,
  NATTOJIRU_YAMAGATA_EVIDENCE_PACK,
  TAMAKONNYAKU_YAMAGATA_EVIDENCE_PACK,
  YAMAGATA_BATCH2_EVIDENCE_PACKS,
  OYAKODON_EVIDENCE_PACK,
  TAMAGOYAKI_EVIDENCE_PACK,
} from '../recipe-evidence-pack-fixtures'
import {
  canEnterRecipeImport,
  evidencePackStateBreakdown,
  evidencePackHoldReasons,
} from '../recipe-evidence-pack'
import { WORLD_RECIPE_IDENTITY_REGISTRY } from '../world-recipe-identity'
import { WORLD_INGREDIENT_IDENTITY_REGISTRY } from '../world-ingredient-registry'
import { RECIPE_CATALOG } from '../recipe-catalog'
import {
  TORI_TERIYAKI_SOURCE_KNOWLEDGE,
  BUTA_SHOGAYAKI_SOURCE_KNOWLEDGE,
  SOURCE_RECIPE_KNOWLEDGE_FIXTURES,
} from '../world-food-fixtures'
import { createCookedMealRecord } from '../cooked-meal-record'
import { buildFoodShareText } from '../food-share'

const matrixRow = (subjectFragment: string) =>
  MAFF_YAMAGATA_RIGHTS_MATRIX.find((r) => r.subject.includes(subjectFragment))!

// ------------------------------------------------------------
// §26.1–13 — License evidence separation
// ------------------------------------------------------------

describe('MISSION 2.41E — license evidence separation', () => {
  it('1. MAFF general PDL rule preserved', () => {
    expect(MAFF_LINK_COPYRIGHT_EVIDENCE.generalRule).toContain('PDL1.0')
  })
  it('2. MAFF third-party rule preserved', () => {
    expect(MAFF_LINK_COPYRIGHT_EVIDENCE.thirdPartyCondition).toContain('利用者側で確認')
  })
  it('3. MAFF separate appendix evidence preserved', () => {
    expect(MAFF_APPENDIX_THIRD_PARTY_EVIDENCE.evidenceUrl).toBe('https://www.maff.go.jp/j/use/bessi.html')
    expect(MAFF_APPENDIX_THIRD_PARTY_EVIDENCE.indicatedExamples).toContain('写真提供：○○')
    // 「レシピ提供元名」は例示に直接列挙されていない
    expect(MAFF_APPENDIX_THIRD_PARTY_EVIDENCE.recipeProviderNameListed).toBe(false)
  })
  it('4. recipe provider indication triggers review', () => {
    expect(IMONI_YAMAGATA_EVIDENCE_PACK.rights.thirdPartyIndication).toBe(true)
    expect(evidencePackStateBreakdown(IMONI_YAMAGATA_EVIDENCE_PACK).rights).toBe('REVIEW_REQUIRED')
  })
  it('5. provider indication does not automatically mean prohibited', () => {
    expect(MAFF_YAMAGATA_CURRENT_DECISION.isProhibited).toBe(false)
    expect(MAFF_APPENDIX_THIRD_PARTY_EVIDENCE.nukitoruTreatment).toContain('「必ず第三者著作権」とも')
  })
  it('6. Yamagata Open Data CC BY evidence preserved', () => {
    expect(YAMAGATA_OPEN_DATA_EVIDENCE.catalogLicense).toBe('CC BY 4.0')
    expect(YAMAGATA_OPEN_DATA_EVIDENCE.evidenceUrl).toContain('pref.yamagata.jp')
  })
  it('7. Yamagata Open Data license does not automatically propagate to MAFF recipe', () => {
    expect(YAMAGATA_OPEN_DATA_EVIDENCE.externalLinkBoundary).toContain('CC BY 4.0 と推論しない')
    expect(matrixRow('Yamagata-provided MAFF Recipe').licenseEvidence).toContain('NOT ESTABLISHED')
  })
  it('8. PDL1.0 does not automatically propagate to provider content', () => {
    expect(matrixRow('provider indication').appliesToTargetRecord).toBe('unknown')
    // record scope の分析 decision も unknown のまま
  })
  it('9. license inheritance prohibited', () => {
    expect(LICENSE_INHERITANCE_RULE.prohibited).toBe(true)
    expect(LICENSE_INHERITANCE_RULE.statement).toContain('統合しない')
  })
  it('10. source license and record license remain separate', () => {
    const cats = CONTENT_CATEGORY_SEPARATION.map((c) => c.key)
    expect(cats).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(CONTENT_CATEGORY_SEPARATION.find((c) => c.key === 'C')!.license).toContain('NOT ESTABLISHED')
    expect(CONTENT_CATEGORY_SEPARATION.find((c) => c.key === 'D')!.license).toContain('PDL1.0')
  })
  it('11. record license and asset license remain separate', () => {
    expect(IMONI_YAMAGATA_EVIDENCE_PACK.rights.recordRightsStatus).toBe('allowed')
    expect(IMONI_YAMAGATA_EVIDENCE_PACK.rights.imageAssetStatus).toBe('prohibited')
    expect(NATTOJIRU_YAMAGATA_EVIDENCE_PACK.rights.rightsNotes).toContain('やまがたの広報写真ライブラリー')
  })
  it('12. private provider and public provider remain distinct', () => {
    expect(classifyRecipeProvider('山形県')).toBe('public-sector')
    expect(classifyRecipeProvider('近藤 惠津子（『食材選びからわかるおうちごはん』より）')).not.toBe('public-sector')
  })
  it('13. public provider still requires applicability evidence', () => {
    expect(MAFF_YAMAGATA_REMAINING_RIGHTS_GAP.questionA).toContain('PDL1.0')
    expect(MAFF_YAMAGATA_REMAINING_RIGHTS_GAP.questionB).toContain('再利用を認めているか')
    for (const p of YAMAGATA_BATCH2_EVIDENCE_PACKS) expect(canEnterRecipeImport(p)).toBe(false)
  })
})

// ------------------------------------------------------------
// §26.14–17 — recipes remain blocked
// ------------------------------------------------------------

describe('MISSION 2.41E — all recipes remain blocked', () => {
  it('14. imoni remains blocked', () => {
    expect(canEnterRecipeImport(IMONI_YAMAGATA_EVIDENCE_PACK)).toBe(false)
    expect(evidencePackHoldReasons(IMONI_YAMAGATA_EVIDENCE_PACK)).toEqual([
      'HOLD_RECORD_RIGHTS_REVIEW',
      'HOLD_IDENTITY_REVIEW',
    ])
  })
  it('15. nattojiru remains blocked', () => {
    expect(canEnterRecipeImport(NATTOJIRU_YAMAGATA_EVIDENCE_PACK)).toBe(false)
  })
  it('16. tamakonnyaku remains blocked', () => {
    expect(canEnterRecipeImport(TAMAKONNYAKU_YAMAGATA_EVIDENCE_PACK)).toBe(false)
  })
  it('17. egg branch remains blocked', () => {
    expect(canEnterRecipeImport(OYAKODON_EVIDENCE_PACK)).toBe(false)
    expect(canEnterRecipeImport(TAMAGOYAKI_EVIDENCE_PACK)).toBe(false)
    expect(evidencePackStateBreakdown(OYAKODON_EVIDENCE_PACK).rights).toBe('REVIEW_REQUIRED')
  })
})

// ------------------------------------------------------------
// §26.18–30 — no work done
// ------------------------------------------------------------

describe('MISSION 2.41E — no import / identity / pipeline / regression', () => {
  it('18. no Identity additions', () => {
    for (const name of ['芋煮', '納豆汁', '玉こんにゃく', '玉子焼き', '卵焼き']) {
      expect(WORLD_RECIPE_IDENTITY_REGISTRY.some((i) => i.canonicalName === name)).toBe(false)
    }
    expect(WORLD_RECIPE_IDENTITY_REGISTRY).toHaveLength(9)
    for (const p of YAMAGATA_BATCH2_EVIDENCE_PACKS) {
      expect(p.identity.candidateCanonicalRecipeId).toBeUndefined()
    }
  })
  it('19. no Import', () => {
    expect(SOURCE_RECIPE_KNOWLEDGE_FIXTURES).toHaveLength(2)
    for (const p of YAMAGATA_BATCH2_EVIDENCE_PACKS) expect(canEnterRecipeImport(p)).toBe(false)
  })
  it('20. no Canonicalization — ingredient registry unchanged (22 ids)', () => {
    expect(WORLD_INGREDIENT_IDENTITY_REGISTRY).toHaveLength(22)
  })
  it('21. no Matching — held packs not matchable', () => {
    for (const p of [...YAMAGATA_BATCH2_EVIDENCE_PACKS, OYAKODON_EVIDENCE_PACK]) {
      expect(canEnterRecipeImport(p)).toBe(false)
    }
  })
  it('22. no Cooking Mode — evidence pack is not presentation (fixtures carry no presentation)', () => {
    expect(JSON.stringify(YAMAGATA_BATCH2_EVIDENCE_PACKS)).not.toContain('NukitoruPresentation')
    expect(JSON.stringify(YAMAGATA_BATCH2_EVIDENCE_PACKS)).not.toContain('presentationStep')
  })
  it('23. no Verification change', () => {
    expect(TORI_TERIYAKI_SOURCE_KNOWLEDGE.importProvenance).toBeUndefined()
    expect(JSON.stringify(MAFF_YAMAGATA_RIGHTS_MATRIX)).not.toMatch(/"verified"|VERIFIED/)
  })
  it('24. no Practical Validation change', () => {
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '..', 'source-rights-scorecard.ts'),
      'utf8',
    )
    // firewall コメントで名前を列挙してよいが、実 import / 呼び出しはしない
    expect(/from '\.\/practical-cook-validation'/.test(src)).toBe(false)
    expect(/\b(validatePracticalCook|PracticalCookValidation)\s*[({]/.test(src)).toBe(false)
  })
  it('25. no Allergy change', () => {
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '..', 'source-rights-scorecard.ts'),
      'utf8',
    )
    expect(/allergen|allergy/i.test(src)).toBe(false)
  })
  it('26. no CookedMealRecord change', () => {
    const rec = createCookedMealRecord(
      { canonicalRecipeId: 'jp-oyakodon', recipeDisplayName: '親子丼' },
      { now: '2026-09-04T00:00:00Z' },
    )
    expect(rec.canonicalRecipeId).toBe('jp-oyakodon')
  })
  it('27. no Share change', () => {
    expect(buildFoodShareText({ recipeName: '芋煮' })).toContain('芋煮')
  })
  it('28. no network/contact implementation', () => {
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '..', 'source-rights-scorecard.ts'),
      'utf8',
    )
    expect(/\bfetch\s*\(/.test(src)).toBe(false)
    expect(/nodemailer|sendMail|smtp|mailto:|XMLHttpRequest/i.test(src)).toBe(false)
    expect(RIGHTS_INQUIRY_DRAFTS.contactNotSent).toBe(true)
  })
  it('29. no AI legal decision', () => {
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '..', 'source-rights-scorecard.ts'),
      'utf8',
    )
    expect(/合法(です|である)|違法(です|である)|著作権侵害では?ない/.test(src)).toBe(false)
    // Draft は確認形式（断定を求めない）
    expect(RIGHTS_INQUIRY_DRAFTS.maff).toContain('利用可能でしょうか')
    expect(RIGHTS_INQUIRY_DRAFTS.yamagata).toContain('可能でしょうか')
  })
  it('30. no new dependency — module imports types only', () => {
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '..', 'source-rights-scorecard.ts'),
      'utf8',
    )
    const imports = [...src.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1])
    expect(imports).toEqual(['@/features/food/types'])
  })
})

// ------------------------------------------------------------
// 追加 — Rights Matrix / Gap の一貫性
// ------------------------------------------------------------

describe('MISSION 2.41E — rights matrix consistency', () => {
  it('Rights Matrix に「Yamagata-provided MAFF Recipe = license NOT ESTABLISHED」行がある', () => {
    const row = matrixRow('Yamagata-provided MAFF Recipe')
    expect(row.appliesToTargetRecord).toBe('unknown')
    expect(row.licenseEvidence).toContain('NOT ESTABLISHED')
  })
  it('Matrix のどの行も target record へ allowed を主張しない', () => {
    expect(MAFF_YAMAGATA_RIGHTS_MATRIX.every((r) => r.appliesToTargetRecord !== 'allowed')).toBe(true)
  })
  it('芋煮/納豆汁/玉こんにゃく の Recipe Facts は 2.41D から変更していない', () => {
    // servings 抜き取りチェック（Fact freeze §6/§8/§9）
    expect(IMONI_YAMAGATA_EVIDENCE_PACK.recipe.servings.value?.semantics).toEqual({ kind: 'range', min: 4, max: 5, unit: '人分' })
    expect(IMONI_YAMAGATA_EVIDENCE_PACK.recipe.ingredients.filter((i) => i.sourceIngredientName === '醤油')).toHaveLength(1)
    expect(NATTOJIRU_YAMAGATA_EVIDENCE_PACK.recipe.ingredients.find((i) => i.sourceIngredientName === 'ゴボウ')?.role).toBe('optional')
    expect(TAMAKONNYAKU_YAMAGATA_EVIDENCE_PACK.recipe.equipmentConditions.value).toContain('串')
  })
  it('MAFF / Yamagata inquiry draft は送信されていない・確認形式', () => {
    expect(RIGHTS_INQUIRY_DRAFTS.contactNotSent).toBe(true)
    expect(RIGHTS_INQUIRY_DRAFTS.maff.length).toBeGreaterThan(50)
    expect(RIGHTS_INQUIRY_DRAFTS.yamagata).toContain('写真・動画は利用しません')
  })
})
