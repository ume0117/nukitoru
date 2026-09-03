// ============================================================
// recipe-evidence-pack.test.ts
//
// MISSION 2.41A — Real Recipe Evidence Pack Intake。
//
// External Research Layer が渡した Evidence Pack を、推測せず・Rights を弱めず・
// 既存 Import Pipeline へ安全に渡せることを固定する（§44 の要件 + 追加）。
// ============================================================

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import type { EvidenceFact, QuantityStatement, RecipeEvidencePack } from '@/features/food/types'
import {
  EVIDENCE_PACK_COMPLETE_MEANING,
  EVIDENCE_PACK_TRUST_MODEL,
  adapterOutputHasNoCanonicalIds,
  canEnterRecipeImport,
  describeEvidenceCompletenessReason,
  evidencePackCanEnterMatching,
  evidencePackIsNotPresentation,
  factHasValidShape,
  readPresentValue,
  runEvidencePackImport,
  toRawSourceRecord,
  validateEvidencePack,
} from '../recipe-evidence-pack'
import {
  MAFF_CANDIDATE_EVIDENCE_PACKS,
  MAFF_CANDIDATE_IMONI_YAMAGATA,
  MAFF_CANDIDATE_KENCHINJIRU,
  MAFF_CANDIDATE_KURE_NIKUJAGA,
  MAFF_CANDIDATE_NIKUJAGA,
  SYNTHETIC_COMPLETE_PACK,
  SYNTHETIC_IDENTITY_REVIEW_PACK,
  SYNTHETIC_INVALID_FACT_SHAPE_PACK,
  SYNTHETIC_PROCESS_REVIEW_PACK,
  SYNTHETIC_RIGHTS_BLOCKED_PACK,
  SYNTHETIC_SOURCE_SILENCE_PACK,
  SYNTHETIC_SUMMARY_ONLY_PACK,
} from '../recipe-evidence-pack-fixtures'
import {
  SOURCE_RECIPE_KNOWLEDGE_FIXTURES,
  TORI_TERIYAKI_SOURCE_KNOWLEDGE,
  BUTA_SHOGAYAKI_SOURCE_KNOWLEDGE,
} from '../world-food-fixtures'
import { createCookedMealRecord, countCookedByRecipe } from '../cooked-meal-record'
import { buildFoodShareText, buildFoodShareHashtags } from '../food-share'

const IMPORTED_AT = '2026-09-03T00:00:00.000Z'

// ------------------------------------------------------------
// 1. Schema — 必須フィールド保持（§44.1–6）
// ------------------------------------------------------------

describe('MISSION 2.41A — Evidence Pack schema 保持', () => {
  it('1. Evidence Pack ID を保持する', () => {
    expect(SYNTHETIC_COMPLETE_PACK.identity.id).toBe('evp-synthetic-complete')
  })
  it('2. Source ID を保持する', () => {
    expect(MAFF_CANDIDATE_IMONI_YAMAGATA.source.sourceId).toBe('jp-maff-kyodo-ryori')
  })
  it('3. Source Organization を保持する', () => {
    expect(MAFF_CANDIDATE_IMONI_YAMAGATA.source.sourceOrganization).toBe('農林水産省')
  })
  it('4. Source Title を保持する', () => {
    expect(MAFF_CANDIDATE_IMONI_YAMAGATA.source.sourceTitle).toContain('芋煮')
  })
  it('5. Source URL を保持する', () => {
    expect(MAFF_CANDIDATE_IMONI_YAMAGATA.source.sourceUrl).toBe(
      'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/menu/imoni_yamagata.html',
    )
  })
  it('6. accessedAt を保持する', () => {
    expect(MAFF_CANDIDATE_IMONI_YAMAGATA.source.accessedAt).toBe('2026-09-03')
  })
})

// ------------------------------------------------------------
// 2. Rights fields（§44.7–12 / §9 / §10）
// ------------------------------------------------------------

describe('MISSION 2.41A — Rights fields と SOURCE ≠ RECORD ≠ ASSET', () => {
  it('7. source rights を保持する', () => {
    expect(MAFF_CANDIDATE_IMONI_YAMAGATA.rights.sourceRightsStatus).toBe('allowed')
  })
  it('8. record rights を保持する', () => {
    expect(MAFF_CANDIDATE_IMONI_YAMAGATA.rights.recordRightsStatus).toBe('allowed')
  })
  it('9. structured fact storage rights を保持する', () => {
    expect(MAFF_CANDIDATE_IMONI_YAMAGATA.rights.structuredFactStorageStatus).toBe('allowed')
  })
  it('10. verbatim text rights を保持する', () => {
    expect(MAFF_CANDIDATE_IMONI_YAMAGATA.rights.verbatimTextStatus).toBe('prohibited')
  })
  it('11. image asset rights を保持する', () => {
    expect(MAFF_CANDIDATE_IMONI_YAMAGATA.rights.imageAssetStatus).toBe('prohibited')
  })
  it('12. SOURCE / RECORD / ASSET は独立フィールドで、値が違っても保持される', () => {
    const r = MAFF_CANDIDATE_IMONI_YAMAGATA.rights
    // source=allowed だが image asset=prohibited（自動継承しない）
    expect(r.sourceRightsStatus).toBe('allowed')
    expect(r.imageAssetStatus).toBe('prohibited')
    expect(r.verbatimTextStatus).toBe('prohibited')
  })
})

// ------------------------------------------------------------
// 3. Fact Presence State（§44.13–17 / §6 / §7 / §8）
// ------------------------------------------------------------

describe('MISSION 2.41A — Fact Presence State', () => {
  it('13. PRESENT は value 必須（factHasValidShape）', () => {
    expect(factHasValidShape({ status: 'PRESENT', value: 1 })).toBe(true)
    expect(factHasValidShape({ status: 'PRESENT' })).toBe(false)
  })
  it('14. SOURCE_NOT_STATED は value を持たない（発明しない）', () => {
    expect(factHasValidShape({ status: 'SOURCE_NOT_STATED' })).toBe(true)
    expect(
      factHasValidShape({ status: 'SOURCE_NOT_STATED', value: 1 } as EvidenceFact<number>),
    ).toBe(false)
    // readPresentValue も SOURCE_NOT_STATED では undefined
    expect(readPresentValue({ status: 'SOURCE_NOT_STATED', value: 1 } as EvidenceFact<number>)).toBeUndefined()
  })
  it('15. NOT_CAPTURED は value を持たない（空文字でごまかさない）', () => {
    expect(factHasValidShape({ status: 'NOT_CAPTURED' })).toBe(true)
    expect(factHasValidShape({ status: 'NOT_CAPTURED', value: '' } as EvidenceFact<string>)).toBe(false)
    expect(readPresentValue({ status: 'NOT_CAPTURED' } as EvidenceFact<string>)).toBeUndefined()
  })
  it('16. CONFLICT は単一確定 value として扱わない', () => {
    const f: EvidenceFact<QuantityStatement> = SYNTHETIC_PROCESS_REVIEW_PACK.recipe.ingredients[1].amount
    expect(f.status).toBe('CONFLICT')
    expect(f.value).toBeUndefined()
    expect(f.conflictingValues).toHaveLength(2)
    expect(readPresentValue(f)).toBeUndefined()
  })
  it('17. conflict averaging をしない（400ml + 600ml を 500ml にしない）', () => {
    const f = SYNTHETIC_PROCESS_REVIEW_PACK.recipe.ingredients[1].amount
    const nums = (f.conflictingValues ?? []).map((q) =>
      q.semantics.kind === 'exact' ? q.semantics.value : NaN,
    )
    expect(nums).toEqual([400, 600])
    // 500 という統合値はどこにも存在しない
    expect(JSON.stringify(SYNTHETIC_PROCESS_REVIEW_PACK)).not.toContain('500')
  })
  it('FACT_PRESENCE_INVALID を validate が検出する', () => {
    const v = validateEvidencePack(SYNTHETIC_INVALID_FACT_SHAPE_PACK)
    expect(v.reasons).toContain('FACT_PRESENCE_INVALID')
    expect(v.result).toBe('INCOMPLETE')
  })
})

// ------------------------------------------------------------
// 4. Trust model（§44.18 / §4）
// ------------------------------------------------------------

describe('MISSION 2.41A — Commander/ERL provided ≠ trusted', () => {
  it('18. Commander 提供でも rights を弱く主張したら fail-closed（EXCEEDS_SOURCE）', () => {
    const pack: RecipeEvidencePack = {
      ...SYNTHETIC_COMPLETE_PACK,
      source: { ...SYNTHETIC_COMPLETE_PACK.source, sourceId: 'synthetic-scrape-dataset' },
      // scrape-dataset は structuredFactStorage=prohibited。pack が allowed を主張しても通さない
      rights: { ...SYNTHETIC_COMPLETE_PACK.rights, structuredFactStorageStatus: 'allowed' },
    }
    const v = validateEvidencePack(pack)
    expect(v.result).toBe('RIGHTS_BLOCKED')
    expect(v.reasons).toContain('RIGHTS_CLAIM_EXCEEDS_SOURCE')
  })
  it('trust model の固定文言がある', () => {
    expect(EVIDENCE_PACK_TRUST_MODEL).toContain('trusted')
    expect(EVIDENCE_PACK_TRUST_MODEL).toContain('validate')
  })
})

// ------------------------------------------------------------
// 5. Completeness result（§44.19–26 / §12–19）
// ------------------------------------------------------------

describe('MISSION 2.41A — Evidence Completeness と COMPLETE の意味', () => {
  it('19. COMPLETE ≠ Verified（固定文言）', () => {
    expect(EVIDENCE_PACK_COMPLETE_MEANING).toContain('COMPLETE ≠ Verified')
  })
  it('20. COMPLETE ≠ Publishable（固定文言）', () => {
    expect(EVIDENCE_PACK_COMPLETE_MEANING).toContain('Publishable')
  })
  it('21. COMPLETE ≠ Practical Validation（固定文言）', () => {
    expect(EVIDENCE_PACK_COMPLETE_MEANING).toContain('Practical Validated')
  })
  it('22. INCOMPLETE は import できない', () => {
    const v = validateEvidencePack(SYNTHETIC_SUMMARY_ONLY_PACK)
    expect(v.result).toBe('INCOMPLETE')
    expect(v.reasons).toContain('EVIDENCE_METHOD_NOT_SOURCE_BODY')
    expect(canEnterRecipeImport(SYNTHETIC_SUMMARY_ONLY_PACK)).toBe(false)
    expect(toRawSourceRecord(SYNTHETIC_SUMMARY_ONLY_PACK).ok).toBe(false)
  })
  it('23. RIGHTS_BLOCKED は import できない', () => {
    const v = validateEvidencePack(SYNTHETIC_RIGHTS_BLOCKED_PACK)
    expect(v.result).toBe('RIGHTS_BLOCKED')
    expect(canEnterRecipeImport(SYNTHETIC_RIGHTS_BLOCKED_PACK)).toBe(false)
    expect(toRawSourceRecord(SYNTHETIC_RIGHTS_BLOCKED_PACK).ok).toBe(false)
  })
  it('24. IDENTITY_REVIEW は import できない', () => {
    const v = validateEvidencePack(SYNTHETIC_IDENTITY_REVIEW_PACK)
    expect(v.result).toBe('IDENTITY_REVIEW')
    expect(v.reasons).toContain('IDENTITY_CANDIDATE_MISSING')
    expect(canEnterRecipeImport(SYNTHETIC_IDENTITY_REVIEW_PACK)).toBe(false)
  })
  it('25. PROCESS_REVIEW は import できない', () => {
    const v = validateEvidencePack(SYNTHETIC_PROCESS_REVIEW_PACK)
    expect(v.result).toBe('PROCESS_REVIEW')
    expect(v.reasons).toContain('INGREDIENT_AMOUNT_CONFLICT')
    expect(canEnterRecipeImport(SYNTHETIC_PROCESS_REVIEW_PACK)).toBe(false)
    expect(toRawSourceRecord(SYNTHETIC_PROCESS_REVIEW_PACK).ok).toBe(false)
  })
  it('26. COMPLETE + Rights PASS のときだけ import 可能', () => {
    const v = validateEvidencePack(SYNTHETIC_COMPLETE_PACK)
    expect(v.result).toBe('COMPLETE')
    expect(v.importEligible).toBe(true)
    expect(canEnterRecipeImport(SYNTHETIC_COMPLETE_PACK)).toBe(true)
  })
  it('27. canEnterRecipeImport は pure（同じ入力で同じ結果・入力を変えない）', () => {
    const snapshot = JSON.stringify(SYNTHETIC_COMPLETE_PACK)
    expect(canEnterRecipeImport(SYNTHETIC_COMPLETE_PACK)).toBe(
      canEnterRecipeImport(SYNTHETIC_COMPLETE_PACK),
    )
    expect(JSON.stringify(SYNTHETIC_COMPLETE_PACK)).toBe(snapshot)
  })
  it('SOURCE_NOT_STATED は INCOMPLETE にしない（§18・source silence）', () => {
    const v = validateEvidencePack(SYNTHETIC_SOURCE_SILENCE_PACK)
    expect(v.result).toBe('COMPLETE')
  })
})

// ------------------------------------------------------------
// 6. Import adapter — Fact を生成しない（§44.27–32 / §20 / §21）
// ------------------------------------------------------------

describe('MISSION 2.41A — Import adapter は Fact を生成しない', () => {
  const adapted = toRawSourceRecord(SYNTHETIC_COMPLETE_PACK)
  if (!adapted.ok) throw new Error('fixture must be COMPLETE')
  const candidate = adapted.candidate

  it('28. Source Ingredient Name を保持する', () => {
    expect(candidate.ingredients.map((i) => i.sourceIngredientName)).toEqual([
      'potato',
      'olive oil',
      'salt',
    ])
  })
  it('29. Source Amount（PRESENT）を保持する', () => {
    const potato = candidate.ingredients[0]
    expect(potato.quantity?.displayText).toBe('2 potatoes')
  })
  it('30. Step order を保持し、示されていない heat を発明しない', () => {
    expect(candidate.cookingSteps.map((s) => s.order)).toEqual([1, 2])
    // step 2 は heat が SOURCE_NOT_STATED → adapter は heat を付けない
    expect(candidate.cookingSteps[1].heat).toBeUndefined()
    // step 1 は PRESENT
    expect(candidate.cookingSteps[0].heat).toBe('medium')
  })
  it('31. 示されていない time を発明しない', () => {
    expect(candidate.cookingSteps[1].duration).toBeUndefined()
  })
  it('32. 示されていない equipment を発明しない（PRESENT のみ通す）', () => {
    // COMPLETE fixture は equipment PRESENT なので通る
    expect(candidate.equipment).toEqual(['frying pan'])
    // SOURCE_NOT_STATED の salt amount は quantity を付けない
    expect(candidate.ingredients[2].quantity).toBeUndefined()
  })
  it('SOURCE_NOT_STATED を default 値に変換しない（salt に "適量" 等を入れない）', () => {
    expect(JSON.stringify(candidate.ingredients[2])).not.toContain('適量')
    expect(candidate.ingredients[2].quantity).toBeUndefined()
  })
})

// ------------------------------------------------------------
// 7. Canonicalization / Matching / Presentation boundary（§44.30–34 / §22–24）
// ------------------------------------------------------------

describe('MISSION 2.41A — boundary', () => {
  it('adapter 出力は canonical ingredient id を持たない（§22）', () => {
    const adapted = toRawSourceRecord(SYNTHETIC_COMPLETE_PACK)
    expect(adapted.ok).toBe(true)
    if (adapted.ok) expect(adapterOutputHasNoCanonicalIds(adapted.candidate)).toBe(true)
  })
  it('33. Evidence Pack は直接 Matching へ入れない（COMPLETE 以外は false）', () => {
    expect(evidencePackCanEnterMatching(SYNTHETIC_PROCESS_REVIEW_PACK)).toBe(false)
    expect(evidencePackCanEnterMatching(MAFF_CANDIDATE_IMONI_YAMAGATA)).toBe(false)
    expect(evidencePackCanEnterMatching(SYNTHETIC_COMPLETE_PACK)).toBe(true)
  })
  it('34. Evidence Pack は直接 Presentation へ入れない（boundary marker）', () => {
    expect(evidencePackIsNotPresentation()).toBe(true)
  })
})

// ------------------------------------------------------------
// 8. MAFF candidates — まだ import しない（§44.35–38 / §28–31 / §43）
// ------------------------------------------------------------

describe('MISSION 2.41A — MAFF candidates は import-ready ではない', () => {
  it('35. MAFF 肉じゃが candidate は import-ready でない', () => {
    const v = validateEvidencePack(MAFF_CANDIDATE_NIKUJAGA)
    expect(v.result).toBe('INCOMPLETE')
    expect(canEnterRecipeImport(MAFF_CANDIDATE_NIKUJAGA)).toBe(false)
    expect(v.reasons).toContain('SOURCE_NOT_REGISTERED')
    expect(v.reasons).toContain('PRIMARY_PROCESS_ANCHOR_MISSING')
  })
  it('36. MAFF 芋煮 candidate は import-ready でない', () => {
    const v = validateEvidencePack(MAFF_CANDIDATE_IMONI_YAMAGATA)
    expect(v.result).toBe('INCOMPLETE')
    expect(canEnterRecipeImport(MAFF_CANDIDATE_IMONI_YAMAGATA)).toBe(false)
    expect(v.reasons).toContain('INGREDIENT_AMOUNT_NOT_CAPTURED')
    // third-party（山形県）は自動 SKIP ではなく review pending
    expect(v.reasons).toContain('THIRD_PARTY_RIGHTS_REVIEW_PENDING')
  })
  it('37. MAFF 呉の肉じゃが candidate は import-ready でない', () => {
    const v = validateEvidencePack(MAFF_CANDIDATE_KURE_NIKUJAGA)
    expect(v.result).toBe('INCOMPLETE')
    expect(canEnterRecipeImport(MAFF_CANDIDATE_KURE_NIKUJAGA)).toBe(false)
    // 名前が似ていても identity を確定しない
    expect(MAFF_CANDIDATE_KURE_NIKUJAGA.identity.candidateCanonicalRecipeId).toBeUndefined()
  })
  it('38. けんちん汁 candidate は import-ready でない', () => {
    const v = validateEvidencePack(MAFF_CANDIDATE_KENCHINJIRU)
    expect(v.result).toBe('INCOMPLETE')
    expect(canEnterRecipeImport(MAFF_CANDIDATE_KENCHINJIRU)).toBe(false)
    expect(v.reasons).toContain('SOURCE_URL_MISSING')
    expect(v.reasons).toContain('INGREDIENTS_NOT_CAPTURED')
  })
  it('43. §28–31 の 4 候補すべて canEnterRecipeImport === false', () => {
    for (const pack of MAFF_CANDIDATE_EVIDENCE_PACKS) {
      expect(canEnterRecipeImport(pack), pack.identity.id).toBe(false)
      expect(toRawSourceRecord(pack).ok, pack.identity.id).toBe(false)
    }
  })
  it('呉の肉じゃが は分量 PRESENT でも steps 未 capture なら import-ready でない', () => {
    const beef = MAFF_CANDIDATE_KURE_NIKUJAGA.recipe.ingredients.find(
      (i) => i.sourceIngredientName === '牛肉',
    )
    expect(beef?.amount.status).toBe('PRESENT')
    expect(beef?.amount.value?.displayText).toBe('牛肉 160g')
    expect(canEnterRecipeImport(MAFF_CANDIDATE_KURE_NIKUJAGA)).toBe(false)
  })
})

// ------------------------------------------------------------
// 9. Identity（§44.39 / §16）
// ------------------------------------------------------------

describe('MISSION 2.41A — Identity は料理名の類似で決めない', () => {
  it('39. 料理名が似ていても candidateCanonicalRecipeId を勝手に解決しない', () => {
    // 呉の肉じゃが / 肉じゃが / いずれも candidate id は undefined のまま
    expect(MAFF_CANDIDATE_NIKUJAGA.identity.candidateCanonicalRecipeId).toBeUndefined()
    expect(MAFF_CANDIDATE_KURE_NIKUJAGA.identity.candidateCanonicalRecipeId).toBeUndefined()
    const v = validateEvidencePack(MAFF_CANDIDATE_KURE_NIKUJAGA)
    expect(v.reasons).toContain('IDENTITY_CANDIDATE_MISSING')
  })
  it('登録簿に無い candidate id は IDENTITY_NOT_IN_REGISTRY', () => {
    const pack: RecipeEvidencePack = {
      ...SYNTHETIC_COMPLETE_PACK,
      identity: { id: 'x', candidateCanonicalRecipeId: 'not-a-real-recipe-id' },
    }
    const v = validateEvidencePack(pack)
    expect(v.reasons).toContain('IDENTITY_NOT_IN_REGISTRY')
    expect(v.result).toBe('IDENTITY_REVIEW')
  })
})

// ------------------------------------------------------------
// 10. 既存 Import Pipeline への接続（§20）
// ------------------------------------------------------------

describe('MISSION 2.41A — 既存 MISSION 2.37 Import Pipeline への接続', () => {
  it('COMPLETE pack は adapter → importRecipeCandidate まで通る', () => {
    const result = runEvidencePackImport(SYNTHETIC_COMPLETE_PACK, { importedAt: IMPORTED_AT })
    expect(result.ok).toBe(true)
    if ('knowledge' in result && result.ok) {
      expect(result.knowledge.canonicalRecipeId).toBe('es-tortilla-espanola')
      expect(result.knowledge.importProvenance).toBeDefined()
      // notes に「COMPLETE ≠ VERIFIED」が入る
      expect(result.knowledge.notes?.join(' ')).toContain('VERIFIED')
    }
  })
  it('INCOMPLETE pack は importRecipeCandidate へ渡さず reasons を返す', () => {
    const result = runEvidencePackImport(MAFF_CANDIDATE_IMONI_YAMAGATA, { importedAt: IMPORTED_AT })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reasons.length).toBeGreaterThan(0)
  })
  it('importProvenance の rights は Evidence Pack 由来（record-override）', () => {
    const result = runEvidencePackImport(SYNTHETIC_COMPLETE_PACK, { importedAt: IMPORTED_AT })
    if ('knowledge' in result && result.ok) {
      expect(result.knowledge.importProvenance?.structuredFactStorageBasis).toBe('record-override')
    }
  })
})

// ------------------------------------------------------------
// 11. Firewall — Verification / Allergy / Matching / AI（§25–27 / §39）
// ------------------------------------------------------------

describe('MISSION 2.41A — Verification / Practical / Allergy firewall（§44.40–43）', () => {
  it('40. 既存 tori-teriyaki の Fact は変わらない', () => {
    expect(TORI_TERIYAKI_SOURCE_KNOWLEDGE.canonicalRecipeId).toBe('jp-tori-teriyaki')
    expect(TORI_TERIYAKI_SOURCE_KNOWLEDGE.evidenceSourceId).toBe(
      'kyounoryouri-toriteriyaki-kawano-2026',
    )
    expect(TORI_TERIYAKI_SOURCE_KNOWLEDGE.importProvenance).toBeUndefined()
  })
  it('41. 既存 buta-shogayaki の Fact は変わらない', () => {
    expect(BUTA_SHOGAYAKI_SOURCE_KNOWLEDGE.canonicalRecipeId).toBe('jp-buta-shogayaki')
    expect(BUTA_SHOGAYAKI_SOURCE_KNOWLEDGE.importProvenance).toBeUndefined()
  })
  it('SOURCE_RECIPE_KNOWLEDGE_FIXTURES に Evidence Pack を混ぜていない（2 件のまま）', () => {
    expect(SOURCE_RECIPE_KNOWLEDGE_FIXTURES).toHaveLength(2)
    const ids = SOURCE_RECIPE_KNOWLEDGE_FIXTURES.map((k) => k.canonicalRecipeId)
    expect(ids).toEqual(['jp-tori-teriyaki', 'jp-buta-shogayaki'])
  })
  it('42. CookedMealRecord は変わらず動く（Evidence Pack と無関係）', () => {
    const rec = createCookedMealRecord(
      { canonicalRecipeId: 'jp-tori-teriyaki', recipeDisplayName: '照り焼きチキン' },
      { now: IMPORTED_AT },
    )
    expect(rec.canonicalRecipeId).toBe('jp-tori-teriyaki')
    expect(countCookedByRecipe([rec], 'jp-tori-teriyaki')).toBe(1)
  })
  it('47. Share は変わらず動く（Evidence Pack と無関係）', () => {
    const text = buildFoodShareText({ recipeName: '照り焼きチキン' })
    expect(text).toContain('照り焼きチキン')
    expect(buildFoodShareHashtags()).toContain('#NUKITORU')
  })
})

// ------------------------------------------------------------
// 12. Module firewall — import graph 静的解析（§38）
// ------------------------------------------------------------

describe('MISSION 2.41A — module firewall', () => {
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
    './cooked-meal-record',
  ]

  for (const file of ['recipe-evidence-pack.ts', 'recipe-evidence-pack-fixtures.ts']) {
    it(`${file} が Verification / Allergy / Matching / AI / Presentation を import しない`, () => {
      const src = read(file)
      for (const mod of FORBIDDEN) {
        expect(src.includes(`from '${mod}'`), `${file} imports ${mod}`).toBe(false)
      }
      expect(/\bfetch\s*\(/.test(src)).toBe(false)
      expect(/\bnew\s+Date\s*\(/.test(src)).toBe(false)
      expect(/\bMath\.random\s*\(/.test(src)).toBe(false)
      expect(/\b(puppeteer|playwright|selenium|webdriver|cheerio)\b/i.test(src)).toBe(false)
      expect(/\bverifyRecipe\s*\(/.test(src)).toBe(false)
    })
  }
})

// ------------------------------------------------------------
// 13. 監査ラベル
// ------------------------------------------------------------

describe('MISSION 2.41A — describeEvidenceCompletenessReason', () => {
  it('全 reason に人間可読ラベルがある', () => {
    const v = validateEvidencePack(MAFF_CANDIDATE_KENCHINJIRU)
    for (const r of v.reasons) {
      expect(describeEvidenceCompletenessReason(r).length).toBeGreaterThan(3)
    }
  })
})
