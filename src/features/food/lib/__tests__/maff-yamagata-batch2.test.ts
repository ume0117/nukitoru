// ============================================================
// maff-yamagata-batch2.test.ts
//
// MISSION 2.41D — PUBLIC-SECTOR RECIPE SOURCE VALIDATION。
//
// 山形県提供の「うちの郷土料理」Record（芋煮 / 納豆汁 / 玉こんにゃく）について、
// Source Body Fact が正確に Evidence Pack へ入り、public-sector provider が private third-party
// とは別分類で扱われ、しかし record-level PDL applicability 未確認のため Rights Gate が正しく
// 止めることを固定する（§38 の 62 要件 + 追加）。
// ============================================================

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  MAFF_LINK_COPYRIGHT_EVIDENCE,
  MAFF_YAMAGATA_PUBLIC_SECTOR_RIGHTS_ANALYSIS,
  MAFF_YAMAGATA_CURRENT_DECISION,
  MAFF_YAMAGATA_SCORECARD,
  classifyRecipeProvider,
  thirdPartyReviewSignalFor,
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
  runEvidencePackImport,
  validateEvidencePack,
  readPresentValue,
} from '../recipe-evidence-pack'
import { resolveWorldIngredientIdentity } from '../world-ingredient-canonicalization'
import { WORLD_RECIPE_IDENTITY_REGISTRY } from '../world-recipe-identity'
import { RECIPE_CATALOG } from '../recipe-catalog'
import {
  TORI_TERIYAKI_SOURCE_KNOWLEDGE,
  BUTA_SHOGAYAKI_SOURCE_KNOWLEDGE,
  SOURCE_RECIPE_KNOWLEDGE_FIXTURES,
} from '../world-food-fixtures'
import { createCookedMealRecord, countCookedByRecipe } from '../cooked-meal-record'
import { buildFoodShareText } from '../food-share'
import type { RecipeEvidencePack } from '@/features/food/types'

const IMPORTED_AT = '2026-09-04T00:00:00.000Z'
const imoni = IMONI_YAMAGATA_EVIDENCE_PACK
const natto = NATTOJIRU_YAMAGATA_EVIDENCE_PACK
const tama = TAMAKONNYAKU_YAMAGATA_EVIDENCE_PACK
const ing = (p: RecipeEvidencePack, name: string) =>
  p.recipe.ingredients.find((i) => i.sourceIngredientName === name)
const analysisScope = (s: string) =>
  MAFF_YAMAGATA_PUBLIC_SECTOR_RIGHTS_ANALYSIS.find((r) => r.scope === s)!

// ------------------------------------------------------------
// RIGHTS §38.1–10
// ------------------------------------------------------------

describe('MISSION 2.41D — MAFF PDL rule / public-sector provider rights', () => {
  it('1. MAFF general PDL rule preserved', () => {
    expect(MAFF_LINK_COPYRIGHT_EVIDENCE.generalRule).toContain('PDL1.0')
    expect(MAFF_LINK_COPYRIGHT_EVIDENCE.evidenceUrl).toBe('https://www.maff.go.jp/j/use/link.html')
  })
  it('2. PDL applicable content can be commercial-use capable', () => {
    expect(MAFF_LINK_COPYRIGHT_EVIDENCE.pdlScope).toContain('商用利用も可能')
    expect(MAFF_LINK_COPYRIGHT_EVIDENCE.pdlScope).toContain('applicable content であることが前提')
  })
  it('3. attribution requirement preserved', () => {
    expect(MAFF_LINK_COPYRIGHT_EVIDENCE.attributionCondition).toContain('出典を記載')
  })
  it('4. modification disclosure requirement preserved', () => {
    expect(MAFF_LINK_COPYRIGHT_EVIDENCE.modificationCondition).toContain('編集・加工したこと')
    expect(MAFF_LINK_COPYRIGHT_EVIDENCE.modificationCondition).toContain('あたかも国・府省等が作成した情報であるかのように')
  })
  it('5. third-party private record still requires review (egg branch unchanged)', () => {
    expect(evidencePackStateBreakdown(OYAKODON_EVIDENCE_PACK).rights).toBe('REVIEW_REQUIRED')
    expect(evidencePackHoldReasons(OYAKODON_EVIDENCE_PACK)).toContain('HOLD_RECORD_RIGHTS_REVIEW')
  })
  it('6. public-sector provider not automatically treated as private provider', () => {
    expect(classifyRecipeProvider('山形県')).toBe('public-sector')
    expect(classifyRecipeProvider('近藤 惠津子（『食材選びからわかるおうちごはん』より）')).not.toBe('public-sector')
    expect(analysisScope('third-party').reasonCodes).toContain('PROVIDER_IS_PUBLIC_SECTOR')
    expect(analysisScope('third-party').decision).not.toBe('prohibited')
  })
  it('7. public-sector provider not automatically allowed', () => {
    expect(MAFF_YAMAGATA_CURRENT_DECISION.imoni).toBe('REVIEW_REQUIRED')
    expect(analysisScope('record').decision).toBe('unknown')
    expect(analysisScope('record').reasonCodes).toContain('PDL_APPLICABILITY_TO_RECORD_NOT_EXPLICIT')
    for (const p of YAMAGATA_BATCH2_EVIDENCE_PACKS) expect(canEnterRecipeImport(p)).toBe(false)
  })
  it('8. asset rights remain separate', () => {
    expect(analysisScope('asset').reasonCodes).toContain('ASSET_SEPARATE')
    expect(imoni.rights.imageAssetStatus).toBe('prohibited')
  })
  it('9. image provider does not change recipe record provider', () => {
    expect(natto.rights.rightsNotes).toContain('やまがたの広報写真ライブラリー')
    expect(natto.rights.rightsNotes).toContain('山形県')
    expect(analysisScope('asset').reasonCodes).toContain('IMAGE_PROVIDER_DIFFERS_FROM_RECIPE_PROVIDER')
  })
  it('10. absence of prohibited evidence ≠ automatic permission', () => {
    expect(MAFF_YAMAGATA_CURRENT_DECISION.isProhibited).toBe(false)
    expect(MAFF_YAMAGATA_PUBLIC_SECTOR_RIGHTS_ANALYSIS.every((r) => r.decision !== 'prohibited' || r.scope === 'asset')).toBe(true)
    // それでも import は不可
    expect(YAMAGATA_BATCH2_EVIDENCE_PACKS.every((p) => !canEnterRecipeImport(p))).toBe(true)
  })
})

// ------------------------------------------------------------
// IMONI §38.11–28
// ------------------------------------------------------------

describe('MISSION 2.41D — imoni facts', () => {
  it('11. source URL preserved', () => {
    expect(imoni.source.sourceUrl).toBe(
      'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/menu/imoni_yamagata.html',
    )
  })
  it('12. provider 山形県 preserved', () => {
    expect(imoni.rights.rightsNotes).toContain('山形県')
    expect(classifyRecipeProvider('山形県')).toBe('public-sector')
  })
  it('13. 4–5 servings range preserved (not midpoint)', () => {
    expect(imoni.recipe.servings.value?.semantics).toEqual({ kind: 'range', min: 4, max: 5, unit: '人分' })
    expect(JSON.stringify(imoni.recipe.servings)).not.toContain('4.5')
  })
  it('14. taro 500g', () => {
    expect(ing(imoni, '里芋（皮つき）')?.amount.value?.semantics).toEqual({ kind: 'exact', value: 500, unit: 'g' })
  })
  it('15. konjac 1/2 sheet', () => {
    expect(ing(imoni, '板こんにゃく')?.amount.value?.displayText).toBe('1/2枚')
  })
  it('16. beef 150g', () => {
    expect(ing(imoni, '牛肉')?.amount.value?.semantics).toEqual({ kind: 'exact', value: 150, unit: 'g' })
    expect(ing(imoni, '牛肉')?.preparationState?.value).toContain('脂身の多い部位が好ましい')
  })
  it('17. green onion 1', () => {
    expect(ing(imoni, '長ねぎ')?.amount.value?.displayText).toBe('1本')
  })
  it('18. soy total tbsp4', () => {
    expect(ing(imoni, '醤油')?.amount.value?.semantics).toEqual({ kind: 'exact', value: 4, unit: '大さじ' })
  })
  it('19. sugar tbsp1.5', () => {
    expect(ing(imoni, '砂糖')?.amount.value?.semantics).toEqual({ kind: 'exact', value: 1.5, unit: '大さじ' })
    expect(ing(imoni, '砂糖')?.amount.value?.displayText).toBe('大さじ1・1/2')
  })
  it('20. sake tbsp3', () => {
    expect(ing(imoni, '清酒（日本酒）')?.amount.value?.semantics).toEqual({ kind: 'exact', value: 3, unit: '大さじ' })
  })
  it('21. water 800cc', () => {
    expect(ing(imoni, '水')?.amount.value?.semantics).toEqual({ kind: 'exact', value: 800, unit: 'cc' })
  })
  it('22. soy step tbsp1 (STEP4)', () => {
    expect(imoni.recipe.steps[3].factSummary.value).toContain('醤油大さじ1を加えて')
  })
  it('23. remaining soy tbsp3 (STEP5)', () => {
    expect(imoni.recipe.steps[4].factSummary.value).toContain('醤油大さじ3')
  })
  it('24. no double count — 醤油 は 1 エントリのみ (Source total)', () => {
    const soy = imoni.recipe.ingredients.filter((i) => i.sourceIngredientName === '醤油')
    expect(soy).toHaveLength(1)
    expect(soy[0].amount.value?.semantics).toEqual({ kind: 'exact', value: 4, unit: '大さじ' })
    expect(soy[0].amount.notes).toContain('二重計上しない')
    // 大さじ1 + 大さじ3 = 大さじ4 という合算値を別途作っていない（total は 4 のまま）
  })
  it('25. conditional konjac preparation preserved', () => {
    expect(imoni.recipe.steps[2].factSummary.value).toContain('精粉こんにゃく')
    expect(imoni.recipe.steps[2].factSummary.value).toContain('生芋こんにゃく')
    expect(imoni.recipe.steps[2].factSummary.value).toContain('ゆでこぼし')
  })
  it('26. no generic processing invention — heat level not stated for STEP4', () => {
    expect(imoni.recipe.steps[3].heat?.status).toBe('SOURCE_NOT_STATED')
    expect(imoni.recipe.steps[3].heatTransition?.value).toBe('turn-on')
  })
  it('27. arrangement not primary recipe (七味唐辛子 / 洗い里芋 は notes のみ)', () => {
    expect(imoni.provenance.notes).toContain('七味唐辛子')
    expect(imoni.provenance.notes).toContain('洗い里芋')
    // primary ingredients に七味唐辛子・洗い里芋は無い
    const names = imoni.recipe.ingredients.map((i) => i.sourceIngredientName)
    expect(names).not.toContain('七味唐辛子')
    expect(names).not.toContain('洗い里芋')
  })
  it('28. shichimi not primary ingredient', () => {
    expect(imoni.recipe.ingredients.some((i) => /七味/.test(i.sourceIngredientName))).toBe(false)
  })
})

// ------------------------------------------------------------
// NATTOJIRU §38.29–38
// ------------------------------------------------------------

describe('MISSION 2.41D — nattojiru facts', () => {
  it('29. provider 山形県', () => {
    expect(natto.rights.rightsNotes).toContain('山形県')
  })
  it('30. image provider separately preserved', () => {
    expect(natto.rights.rightsNotes).toContain('やまがたの広報写真ライブラリー')
  })
  it('31. 5 servings', () => {
    expect(natto.recipe.servings.value?.semantics).toEqual({ kind: 'exact', value: 5, unit: '人分' })
  })
  it('32. natto 200g', () => {
    expect(ing(natto, '納豆')?.amount.value?.semantics).toEqual({ kind: 'exact', value: 200, unit: 'g' })
  })
  it('33. tofu 80g / 1/5丁 preserved', () => {
    expect(ing(natto, '豆腐')?.amount.value?.displayText).toBe('1/5丁（80g）')
  })
  it('34. optional ingredient distinction — ゴボウ/人参/里芋 は role optional', () => {
    for (const n of ['ゴボウ', '人参', '里芋']) {
      expect(ing(natto, n)?.role).toBe('optional')
      expect(ing(natto, n)?.amount.status).toBe('SOURCE_NOT_STATED')
    }
    // 基本食材は required
    expect(ing(natto, '納豆')?.role).toBe('required')
  })
  it('35. 適宜 preserved (きのこ / 山菜)', () => {
    expect(ing(natto, 'きのこ')?.amount.value?.semantics).toEqual({ kind: 'culinary-term', term: '適宜' })
    expect(ing(natto, '山菜')?.amount.value?.semantics).toEqual({ kind: 'culinary-term', term: '適宜' })
  })
  it('36. 少々 preserved (せり)', () => {
    expect(ing(natto, 'せり')?.amount.value?.semantics).toEqual({ kind: 'culinary-term', term: '少々' })
    expect(JSON.stringify(ing(natto, 'せり'))).not.toMatch(/\d+\s*(g|ml|cc)/)
  })
  it('37. boiling-before-stop cue preserved', () => {
    expect(natto.recipe.steps[6].factSummary.value).toContain('沸騰直前に火を止める')
    expect(natto.recipe.steps[6].completionCue?.value).toBe('沸騰直前')
  })
  it('38. no safety temperature invented', () => {
    expect(natto.provenance.notes).toContain('客観的 Safety Fact へ変換しない')
    expect(JSON.stringify(natto)).not.toMatch(/\d+\s*(℃|°C)/)
  })
})

// ------------------------------------------------------------
// TAMAKONNYAKU §38.39–47
// ------------------------------------------------------------

describe('MISSION 2.41D — tamakonnyaku facts', () => {
  it('39. provider 山形県', () => {
    expect(tama.rights.rightsNotes).toContain('山形県')
  })
  it('40. 4-skewer serving unit preserved', () => {
    expect(tama.recipe.servings.value?.displayText).toBe('4本分')
    expect(tama.recipe.servings.value?.semantics).toEqual({ kind: 'exact', value: 4, unit: '本' })
  })
  it('41. 20 tama-konnyaku', () => {
    expect(ing(tama, '玉こんにゃく')?.amount.value?.semantics).toEqual({ kind: 'exact', value: 20, unit: '個' })
  })
  it('42. soy tbsp3', () => {
    expect(ing(tama, '醤油')?.amount.value?.semantics).toEqual({ kind: 'exact', value: 3, unit: '大さじ' })
  })
  it('43. surume optional / 適量 semantics preserved', () => {
    expect(ing(tama, 'スルメイカ')?.role).toBe('optional')
    expect(ing(tama, 'スルメイカ')?.amount.value?.semantics).toEqual({ kind: 'culinary-term', term: '適量' })
  })
  it('44. mustard optional / 適量 semantics preserved', () => {
    expect(ing(tama, '練り辛子')?.role).toBe('optional')
    expect(ing(tama, '練り辛子')?.amount.value?.semantics).toEqual({ kind: 'culinary-term', term: '適量' })
  })
  it('45. skewers are equipment not ingredient', () => {
    expect(tama.recipe.equipmentConditions.value).toContain('串')
    expect(tama.recipe.ingredients.some((i) => i.sourceIngredientName === '串')).toBe(false)
  })
  it('46. no heat invented', () => {
    expect(tama.recipe.steps[0].heat?.status).toBe('SOURCE_NOT_STATED')
    expect(tama.recipe.steps[1].heat?.status).toBe('SOURCE_NOT_STATED')
  })
  it('47. no duration invented', () => {
    for (const s of tama.recipe.steps) {
      if (s.duration) expect(s.duration.status).toBe('SOURCE_NOT_STATED')
    }
  })
})

// ------------------------------------------------------------
// PIPELINE §38.48–62
// ------------------------------------------------------------

describe('MISSION 2.41D — pipeline gates & regression', () => {
  it('48. Rights blocked candidate cannot import', () => {
    for (const p of YAMAGATA_BATCH2_EVIDENCE_PACKS) {
      expect(evidencePackStateBreakdown(p).rights).toBe('REVIEW_REQUIRED')
      expect(runEvidencePackImport(p, { importedAt: IMPORTED_AT }).ok).toBe(false)
    }
  })
  it('49. Identity review candidate cannot import', () => {
    for (const p of YAMAGATA_BATCH2_EVIDENCE_PACKS) {
      expect(evidencePackStateBreakdown(p).identity).toBe('REVIEW_REQUIRED')
      expect(validateEvidencePack(p).reasons).toContain('IDENTITY_CANDIDATE_MISSING')
    }
  })
  it('50. COMPLETE ≠ VERIFIED', () => {
    expect(evidencePackStateBreakdown(imoni).evidence).toBe('COMPLETE')
    expect(JSON.stringify(YAMAGATA_BATCH2_EVIDENCE_PACKS)).not.toMatch(/"verified"|VERIFIED/)
  })
  it('51. Import ≠ VERIFIED (no import happens anyway)', () => {
    const r = runEvidencePackImport(imoni, { importedAt: IMPORTED_AT })
    expect(r.ok).toBe(false)
  })
  it('52. Import ≠ Allergy Safe', () => {
    expect(JSON.stringify(YAMAGATA_BATCH2_EVIDENCE_PACKS)).not.toMatch(/allergy|allergen|アレル/i)
  })
  it('53. Import ≠ Practical Validation', () => {
    expect(JSON.stringify(YAMAGATA_BATCH2_EVIDENCE_PACKS)).not.toMatch(/practical|PracticalCook/i)
  })
  it('54. Canonicalization only after import — packs carry no canonicalIngredientId', () => {
    for (const p of YAMAGATA_BATCH2_EVIDENCE_PACKS) {
      expect(JSON.stringify(p)).not.toContain('canonicalIngredientId')
    }
  })
  it('55. Matching only after import — held packs not matchable', () => {
    for (const p of YAMAGATA_BATCH2_EVIDENCE_PACKS) expect(canEnterRecipeImport(p)).toBe(false)
  })
  it('56. quantity sufficiency NOT_EVALUATED — packs do not assert sufficiency', () => {
    expect(JSON.stringify(YAMAGATA_BATCH2_EVIDENCE_PACKS)).not.toMatch(/sufficien|足りる|作れる/i)
  })
  it('57. existing tori unchanged', () => {
    expect(TORI_TERIYAKI_SOURCE_KNOWLEDGE.canonicalRecipeId).toBe('jp-tori-teriyaki')
    expect(TORI_TERIYAKI_SOURCE_KNOWLEDGE.importProvenance).toBeUndefined()
  })
  it('58. existing buta unchanged', () => {
    expect(BUTA_SHOGAYAKI_SOURCE_KNOWLEDGE.canonicalRecipeId).toBe('jp-buta-shogayaki')
    expect(SOURCE_RECIPE_KNOWLEDGE_FIXTURES).toHaveLength(2)
  })
  it('59. existing oyakodon unchanged', () => {
    const repo = RECIPE_CATALOG.find((r) => r.id === 'oyako-don')
    expect(repo?.verification?.status).toBe('review')
    expect(OYAKODON_EVIDENCE_PACK.identity.candidateCanonicalRecipeId).toBe('jp-oyakodon')
  })
  it('60. existing tamagoyaki hold unchanged', () => {
    expect(evidencePackHoldReasons(TAMAGOYAKI_EVIDENCE_PACK)).toEqual([
      'HOLD_RECORD_RIGHTS_REVIEW',
      'HOLD_IDENTITY_REVIEW',
    ])
    expect(WORLD_RECIPE_IDENTITY_REGISTRY.some((i) => /玉子焼|卵焼/.test(i.canonicalName))).toBe(false)
  })
  it('61. CookedMealRecord unchanged', () => {
    const rec = createCookedMealRecord(
      { canonicalRecipeId: 'jp-oyakodon', recipeDisplayName: '親子丼' },
      { now: IMPORTED_AT },
    )
    expect(countCookedByRecipe([rec], 'jp-oyakodon')).toBe(1)
  })
  it('62. Share unchanged', () => {
    expect(buildFoodShareText({ recipeName: '芋煮' })).toContain('芋煮')
  })
})

// ------------------------------------------------------------
// 追加 — Identity / Ingredient audit / Equipment / Scorecard / firewall
// ------------------------------------------------------------

describe('MISSION 2.41D — identity / ingredient / equipment audit', () => {
  it('芋煮 / 納豆汁 / 玉こんにゃく の WorldRecipeIdentity は未登録・今回追加していない（§24 / §16）', () => {
    for (const name of ['芋煮', '納豆汁', '玉こんにゃく']) {
      expect(WORLD_RECIPE_IDENTITY_REGISTRY.some((i) => i.canonicalName === name)).toBe(false)
    }
    for (const p of YAMAGATA_BATCH2_EVIDENCE_PACKS) {
      expect(p.identity.candidateCanonicalRecipeId).toBeUndefined()
    }
  })
  it('canonical ingredient audit — RESOLVED は 醤油 / 砂糖 のみ・explicit alias（§25）', () => {
    expect(resolveWorldIngredientIdentity('醤油', 'ja').canonicalIngredientId).toBe('soy_sauce')
    expect(resolveWorldIngredientIdentity('砂糖', 'ja').canonicalIngredientId).toBe('sugar')
  })
  it('里芋≠rice / 牛肉 未登録 / 清酒≠料理酒 / 玉こんにゃく≠generic konjac → UNRESOLVED', () => {
    for (const n of ['里芋', '里芋（皮つき）', '牛肉', '長ねぎ', '清酒（日本酒）', 'こんにゃく', '玉こんにゃく', 'だし汁', '味噌', 'きのこ']) {
      expect(resolveWorldIngredientIdentity(n, 'ja').status).toBe('UNRESOLVED')
    }
  })
  it('今回登場食材に AMBIGUOUS は無い', () => {
    const names = new Set<string>()
    for (const p of YAMAGATA_BATCH2_EVIDENCE_PACKS)
      for (const i of p.recipe.ingredients) names.add(i.sourceIngredientName)
    for (const n of names) expect(resolveWorldIngredientIdentity(n, 'ja').status).not.toBe('AMBIGUOUS')
  })
  it('equipment（鍋 / すり鉢 / 串）は Ingredient に混ざっていない（§27）', () => {
    for (const p of YAMAGATA_BATCH2_EVIDENCE_PACKS) {
      const names = p.recipe.ingredients.map((i) => i.sourceIngredientName)
      for (const eq of ['鍋', 'すり鉢', '串']) expect(names).not.toContain(eq)
    }
  })
  it('SOURCE_NOT_STATED audit — NOT_CAPTURED は 1 つも無い（本文確認済み）', () => {
    for (const p of YAMAGATA_BATCH2_EVIDENCE_PACKS) {
      expect(JSON.stringify(p)).not.toContain('NOT_CAPTURED')
      expect(p.provenance.evidenceMethod).toBe('official-source-body-review')
    }
  })
})

describe('MISSION 2.41D — scorecard & firewall', () => {
  it('Scorecard は Research Prioritization のみ（数値総合スコアなし）', () => {
    expect(MAFF_YAMAGATA_SCORECARD).not.toHaveProperty('score')
    expect(MAFF_YAMAGATA_SCORECARD).not.toHaveProperty('total')
    expect(MAFF_YAMAGATA_SCORECARD.axes.officiality).toBe('strong')
    expect(MAFF_YAMAGATA_SCORECARD.axes.recordRightsClarity).toBe('moderate') // private より明確に近い
  })
  it('thirdPartyReviewSignalFor: 山形県 pack は needsThirdPartyReview true', () => {
    for (const p of YAMAGATA_BATCH2_EVIDENCE_PACKS) {
      expect(thirdPartyReviewSignalFor(p.rights).needsThirdPartyReview).toBe(true)
    }
  })
  it('source-rights-scorecard.ts は network / ai-provider / recipe-catalog を import しない', () => {
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '..', 'source-rights-scorecard.ts'),
      'utf8',
    )
    expect(/\bfetch\s*\(/.test(src)).toBe(false)
    expect(/from '\.\/(ai-provider|recipe-catalog|food-matching)'/.test(src)).toBe(false)
    // 法的結論語を生成していない
    expect(/合法|違法|著作権侵害では?ない/.test(src)).toBe(false)
  })
  it('§38.24 helper — readPresentValue は SOURCE_NOT_STATED で undefined（adapter が heat を発明しない前提）', () => {
    expect(readPresentValue(tama.recipe.steps[0].heat)).toBeUndefined()
  })
})
