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
  evidencePackHoldReasons,
  evidencePackIsNotPresentation,
  evidencePackStateBreakdown,
  factHasValidShape,
  readPresentValue,
  runEvidencePackImport,
  toRawSourceRecord,
  validateEvidencePack,
} from '../recipe-evidence-pack'
import {
  EGG_BRANCH_BATCH1_EVIDENCE_PACKS,
  MAFF_CANDIDATE_EVIDENCE_PACKS,
  MAFF_CANDIDATE_IMONI_YAMAGATA,
  MAFF_CANDIDATE_KENCHINJIRU,
  MAFF_CANDIDATE_KURE_NIKUJAGA,
  MAFF_CANDIDATE_NIKUJAGA,
  OYAKODON_EVIDENCE_PACK,
  SYNTHETIC_COMPLETE_PACK,
  SYNTHETIC_IDENTITY_REVIEW_PACK,
  SYNTHETIC_INVALID_FACT_SHAPE_PACK,
  SYNTHETIC_PROCESS_REVIEW_PACK,
  SYNTHETIC_RIGHTS_BLOCKED_PACK,
  SYNTHETIC_SOURCE_SILENCE_PACK,
  SYNTHETIC_SUMMARY_ONLY_PACK,
  TAMAGOYAKI_EVIDENCE_PACK,
} from '../recipe-evidence-pack-fixtures'
import {
  SOURCE_RECIPE_KNOWLEDGE_FIXTURES,
  TORI_TERIYAKI_SOURCE_KNOWLEDGE,
  BUTA_SHOGAYAKI_SOURCE_KNOWLEDGE,
} from '../world-food-fixtures'
import { createCookedMealRecord, countCookedByRecipe } from '../cooked-meal-record'
import { buildFoodShareText, buildFoodShareHashtags } from '../food-share'
import { resolveWorldIngredientIdentity } from '../world-ingredient-canonicalization'
import { WORLD_RECIPE_IDENTITY_REGISTRY } from '../world-recipe-identity'
import { RECIPE_CATALOG } from '../recipe-catalog'

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

// ============================================================
// MISSION 2.41B — Batch #1 / EGG branch（親子丼・玉子焼き）実データ検証
// ============================================================

const oyako = OYAKODON_EVIDENCE_PACK
const tamago = TAMAGOYAKI_EVIDENCE_PACK
const soySauceEntries = oyako.recipe.ingredients.filter((i) => i.sourceIngredientName === '醤油')
const ing = (pack: RecipeEvidencePack, name: string) =>
  pack.recipe.ingredients.find((i) => i.sourceIngredientName === name)

describe('MISSION 2.41B — oyakodon ingredient / process facts', () => {
  it('1. oyakodon source URL preserved', () => {
    expect(oyako.source.sourceUrl).toBe(
      'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/menu/34_12_tokyo.html',
    )
  })
  it('2. oyakodon source organization preserved', () => {
    expect(oyako.source.sourceOrganization).toBe('農林水産省')
  })
  it('3. oyakodon servings preserved', () => {
    expect(oyako.recipe.servings.status).toBe('PRESENT')
    expect(oyako.recipe.servings.value?.displayText).toBe('2人分')
  })
  it('4. chicken 150g preserved', () => {
    const c = ing(oyako, '鶏もも肉')
    expect(c?.amount.value?.displayText).toBe('150g')
    expect(c?.amount.value?.semantics).toEqual({ kind: 'exact', value: 150, unit: 'g' })
    expect(c?.preparationState?.value).toBe('一口大のそぎ切り')
  })
  it('5. onion 1/2個(100g) preserved verbatim', () => {
    expect(ing(oyako, '玉ねぎ')?.amount.value?.displayText).toBe('1/2個（100g）')
    expect(ing(oyako, '玉ねぎ')?.preparationState?.value).toBe('縦半分に切ってから薄切り')
  })
  it('6. egg 2 preserved', () => {
    expect(ing(oyako, '卵')?.amount.value?.displayText).toBe('2個')
    expect(ing(oyako, '卵')?.preparationState?.value).toBe('軽くほぐすように溶く')
  })
  it('7. dashi 100ml preserved', () => {
    expect(ing(oyako, 'だし')?.amount.value?.semantics).toEqual({ kind: 'exact', value: 100, unit: 'ml' })
  })
  it('8. rice 2人分 preserved', () => {
    expect(ing(oyako, 'ご飯')?.amount.value?.displayText).toBe('2人分')
  })
  it('9. soy sauce seasoning roles remain separate (2 distinct entries)', () => {
    expect(soySauceEntries).toHaveLength(2)
    const texts = soySauceEntries.map((e) => e.amount.value?.displayText).sort()
    expect(texts).toEqual(['大さじ1', '小さじ1/2'].sort())
    expect(soySauceEntries.every((e) => (e.amount.notes ?? '').includes('別'))).toBe(true)
  })
  it('10. no soy sauce amount summing', () => {
    expect(JSON.stringify(oyako)).not.toContain('大さじ1と小さじ')
    expect(JSON.stringify(oyako)).not.toContain('小さじ1と1/2')
    for (const e of soySauceEntries) expect(e.amount.value?.semantics.kind).toBe('exact')
  })
  it('11. medium heat preserved', () => {
    const step2 = oyako.recipe.steps[1]
    expect(step2.heat).toEqual({ status: 'PRESENT', value: 'medium' })
    expect(step2.heatTransition?.value).toBe('turn-on')
  })
  it('12. 2–3 minute duration preserved (not midpoint)', () => {
    const step3 = oyako.recipe.steps[2]
    expect(step3.duration).toEqual({
      status: 'PRESENT',
      value: { kind: 'range', minMinutes: 2, maxMinutes: 3 },
    })
    expect(JSON.stringify(step3.duration)).not.toContain('2.5')
  })
  it('13. stop-heat transition preserved', () => {
    expect(oyako.recipe.steps[3].heatTransition?.value).toBe('turn-off')
  })
  it('14. 30-second rest preserved (verbatim, not converted)', () => {
    expect(oyako.recipe.steps[3].factSummary.value).toContain('30秒蒸らす')
  })
  it('15. chicken cooked-through cue preserved without temperature invention', () => {
    expect(oyako.recipe.steps[2].completionCue?.value).toBe('鶏肉に火が通るまで')
    expect(JSON.stringify(oyako)).not.toMatch(/\d+\s*(℃|°C|度)/)
  })
  it('16. no total cooking time invented', () => {
    expect(oyako.recipe.completionCues.status).toBe('SOURCE_NOT_STATED')
    expect(JSON.stringify(oyako)).not.toContain('sourceStatedTotalTime')
    expect(JSON.stringify(oyako)).not.toContain('総調理時間')
  })
  it('17. no equipment size invented', () => {
    expect(oyako.recipe.equipmentConditions.value).toEqual(['鍋', '蓋', '丼'])
    expect(JSON.stringify(oyako.recipe.equipmentConditions)).not.toMatch(/cm|センチ|ステンレス|鉄|アルミ|\d+\s*L/)
  })
})

describe('MISSION 2.41B — tamagoyaki ingredient / process facts', () => {
  it('18. tamagoyaki source URL preserved', () => {
    expect(tamago.source.sourceUrl).toBe(
      'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/menu/34_11_tokyo.html',
    )
  })
  it('19. tamagoyaki source organization preserved', () => {
    expect(tamago.source.sourceOrganization).toBe('農林水産省')
  })
  it('20. 1本分 preserved', () => {
    expect(tamago.recipe.servings.value?.displayText).toBe('1本分')
  })
  it('21. egg 2 preserved', () => {
    expect(ing(tamago, '卵')?.amount.value?.semantics).toEqual({ kind: 'exact', value: 2, unit: '個' })
  })
  it('22. dashi 大さじ1 preserved', () => {
    expect(ing(tamago, 'だし')?.amount.value?.displayText).toBe('大さじ1')
  })
  it('23. sugar 大さじ1/2 preserved', () => {
    expect(ing(tamago, '砂糖')?.amount.value?.semantics).toEqual({ kind: 'exact', value: 0.5, unit: '大さじ' })
  })
  it('24. salt 少々 preserved', () => {
    expect(ing(tamago, '塩')?.amount.value?.displayText).toBe('少々')
  })
  it('25. soy 少々 preserved', () => {
    expect(ing(tamago, '醤油')?.amount.value?.displayText).toBe('少々')
  })
  it('26. oil 適宜 preserved', () => {
    expect(ing(tamago, '油')?.amount.value?.displayText).toBe('適宜')
  })
  it('27. no numeric conversion of 少々', () => {
    const salt = ing(tamago, '塩')?.amount.value
    expect(salt?.semantics).toEqual({ kind: 'culinary-term', term: '少々' })
  })
  it('28. no numeric conversion of 適宜', () => {
    const oil = ing(tamago, '油')?.amount.value
    expect(oil?.semantics).toEqual({ kind: 'culinary-term', term: '適宜' })
    expect(JSON.stringify(ing(tamago, '油'))).not.toMatch(/\d+\s*(g|ml|cc)/)
  })
  it('29. 1/4 egg-liquid step preserved', () => {
    expect(tamago.recipe.steps[1].factSummary.value).toContain('卵液の1/4')
  })
  it('30. semi-set cue preserved', () => {
    expect(tamago.recipe.steps[1].completionCue?.value).toBe('周囲がかわいて半熟状になったら')
  })
  it('31. no heat level invented (SOURCE_NOT_STATED)', () => {
    expect(tamago.recipe.steps[1].heat).toEqual({ status: 'SOURCE_NOT_STATED' })
    expect(readPresentValue(tamago.recipe.steps[1].heat)).toBeUndefined()
  })
  it('32. no duration invented (SOURCE_NOT_STATED)', () => {
    expect(tamago.recipe.steps[1].duration?.status).toBe('SOURCE_NOT_STATED')
    expect(tamago.recipe.steps[2].duration?.status).toBe('SOURCE_NOT_STATED')
  })
})

describe('MISSION 2.41B — third-party / MAFF / asset rights handling', () => {
  it('33. thirdPartyIndication true for oyakodon', () => {
    expect(oyako.rights.thirdPartyIndication).toBe(true)
    expect(oyako.rights.rightsNotes).toContain('近藤 惠津子')
  })
  it('34. thirdPartyIndication true for tamagoyaki', () => {
    expect(tamago.rights.thirdPartyIndication).toBe(true)
  })
  it('35. third-party credit does not auto-clear rights', () => {
    expect(oyako.rights.thirdPartyRightsReview).toBe('not-reviewed')
    expect(tamago.rights.thirdPartyRightsReview).toBe('not-reviewed')
    expect(evidencePackStateBreakdown(oyako).rights).toBe('REVIEW_REQUIRED')
    expect(evidencePackStateBreakdown(tamago).rights).toBe('REVIEW_REQUIRED')
  })
  it('36. MAFF hosting does not auto-clear record rights (import blocked)', () => {
    expect(canEnterRecipeImport(oyako)).toBe(false)
    expect(canEnterRecipeImport(tamago)).toBe(false)
    expect(runEvidencePackImport(oyako, { importedAt: IMPORTED_AT }).ok).toBe(false)
  })
  it('37. image rights do not imply record rights', () => {
    expect(oyako.rights.imageAssetStatus).toBe('prohibited')
    expect(oyako.rights.recordRightsStatus).toBe('allowed')
  })
  it('38. record rights do not imply image rights', () => {
    expect(oyako.rights.recordRightsStatus).toBe('allowed')
    expect(oyako.rights.imageAssetStatus).toBe('prohibited')
    expect(JSON.stringify(EGG_BRANCH_BATCH1_EVIDENCE_PACKS)).not.toMatch(/\.jpg|\.png|\.webp|imageUrl/)
  })
})

describe('MISSION 2.41B — Evidence ≠ Verified / Practical / Allergy（firewall）', () => {
  it('39. Evidence COMPLETE does not imply VERIFIED', () => {
    expect(evidencePackStateBreakdown(oyako).evidence).toBe('COMPLETE')
    expect(JSON.stringify(oyako)).not.toMatch(/"verified"|VERIFIED/)
  })
  it('40. Import does not imply VERIFIED（held なので import されない）', () => {
    const r = runEvidencePackImport(oyako, { importedAt: IMPORTED_AT })
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).not.toContain('VERIFIED')
  })
  it('41. Evidence does not imply Practical Validation', () => {
    expect(JSON.stringify(EGG_BRANCH_BATCH1_EVIDENCE_PACKS)).not.toMatch(/practical|PracticalCook/i)
  })
  it('42. Evidence does not imply Allergy Safe', () => {
    expect(JSON.stringify(EGG_BRANCH_BATCH1_EVIDENCE_PACKS)).not.toMatch(/allergy|allergen|アレル/i)
  })
})

describe('MISSION 2.41B — existing data regression', () => {
  it('43. existing tori unchanged', () => {
    expect(TORI_TERIYAKI_SOURCE_KNOWLEDGE.canonicalRecipeId).toBe('jp-tori-teriyaki')
    expect(TORI_TERIYAKI_SOURCE_KNOWLEDGE.importProvenance).toBeUndefined()
  })
  it('44. existing buta unchanged', () => {
    expect(BUTA_SHOGAYAKI_SOURCE_KNOWLEDGE.canonicalRecipeId).toBe('jp-buta-shogayaki')
    expect(SOURCE_RECIPE_KNOWLEDGE_FIXTURES).toHaveLength(2)
  })
  it('45. existing review oyako-don (repo Recipe) unchanged & isolated', () => {
    const repoOyako = RECIPE_CATALOG.find((r) => r.id === 'oyako-don')
    expect(repoOyako).toBeDefined()
    expect(repoOyako?.verification?.status).toBe('review')
    expect(oyako.identity.id).toBe('evp-maff-oyakodon-tokyo')
    expect(oyako.identity.id).not.toBe('oyako-don')
    expect(JSON.stringify(repoOyako)).not.toContain('近藤')
  })
  it('46. Matching Truth unchanged — held pack は Matching へ入れない', () => {
    expect(evidencePackCanEnterMatching(oyako)).toBe(false)
    expect(evidencePackCanEnterMatching(tamago)).toBe(false)
  })
  it('47. CookedMealRecord unchanged', () => {
    const rec = createCookedMealRecord(
      { canonicalRecipeId: 'jp-oyakodon', recipeDisplayName: '親子丼' },
      { now: IMPORTED_AT },
    )
    expect(countCookedByRecipe([rec], 'jp-oyakodon')).toBe(1)
  })
  it('48. Share unchanged', () => {
    expect(buildFoodShareText({ recipeName: '親子丼' })).toContain('親子丼')
    expect(buildFoodShareHashtags()).toContain('#NUKITORU')
  })
})

describe('MISSION 2.41B — Identity audit（§17）', () => {
  it('oyakodon は既存 WorldRecipeIdentity jp-oyakodon へ exact 一致する', () => {
    expect(oyako.identity.candidateCanonicalRecipeId).toBe('jp-oyakodon')
    const id = WORLD_RECIPE_IDENTITY_REGISTRY.find((i) => i.canonicalRecipeId === 'jp-oyakodon')
    expect(id?.canonicalName).toBe('親子丼')
    expect(oyako.recipe.sourceRecipeName).toBe(id?.canonicalName)
    expect(evidencePackStateBreakdown(oyako).identity).toBe('RESOLVED')
  })
  it('玉子焼き の WorldRecipeIdentity は無く、推論で作らない → IDENTITY_REVIEW', () => {
    expect(tamago.identity.candidateCanonicalRecipeId).toBeUndefined()
    expect(WORLD_RECIPE_IDENTITY_REGISTRY.some((i) => /玉子焼|卵焼/.test(i.canonicalName))).toBe(false)
    expect(evidencePackStateBreakdown(tamago).identity).toBe('REVIEW_REQUIRED')
    expect(validateEvidencePack(tamago).reasons).toContain('IDENTITY_CANDIDATE_MISSING')
  })
})

describe('MISSION 2.41B — Canonical Ingredient audit（§21・Rights とは独立）', () => {
  const resolvedExpect: Record<string, string> = {
    鶏もも肉: 'chicken_thigh',
    醤油: 'soy_sauce',
    酒: 'cooking_sake',
    玉ねぎ: 'onion',
    卵: 'egg',
    ご飯: 'rice_cooked',
    砂糖: 'sugar',
    みりん: 'mirin',
    塩: 'salt',
  }
  for (const [name, id] of Object.entries(resolvedExpect)) {
    it(`${name} → RESOLVED ${id}（explicit alias のみ）`, () => {
      const r = resolveWorldIngredientIdentity(name, 'ja')
      expect(r.status).toBe('RESOLVED')
      expect(r.canonicalIngredientId).toBe(id)
    })
  }
  for (const name of ['三つ葉', 'だし', '油']) {
    it(`${name} → UNRESOLVED（無理に RESOLVE しない）`, () => {
      expect(resolveWorldIngredientIdentity(name, 'ja').status).toBe('UNRESOLVED')
    })
  }
  it('鶏もも肉 は generic chicken へ格下げしない / ご飯 は生米ではない / 油 は特定油ではない', () => {
    expect(resolveWorldIngredientIdentity('鶏もも肉', 'ja').canonicalIngredientId).not.toBe('chicken')
    expect(resolveWorldIngredientIdentity('ご飯', 'ja').canonicalIngredientId).not.toBe('rice_raw')
    expect(resolveWorldIngredientIdentity('油', 'ja').status).not.toBe('RESOLVED')
  })
  it('AMBIGUOUS な食材は無い（今回の 12 食材）', () => {
    const names = ['鶏もも肉', '醤油', '酒', '玉ねぎ', '卵', '三つ葉', 'だし', 'ご飯', '砂糖', 'みりん', '塩', '油']
    for (const n of names) expect(resolveWorldIngredientIdentity(n, 'ja').status).not.toBe('AMBIGUOUS')
  })
})

describe('MISSION 2.41B — State breakdown / Hold log（§30 / §31）', () => {
  it('oyakodon: Evidence COMPLETE / Rights REVIEW_REQUIRED / Identity RESOLVED / Import BLOCKED', () => {
    expect(evidencePackStateBreakdown(oyako)).toMatchObject({
      evidence: 'COMPLETE',
      rights: 'REVIEW_REQUIRED',
      identity: 'RESOLVED',
      process: 'OK',
      importEligible: false,
    })
    expect(evidencePackHoldReasons(oyako)).toEqual(['HOLD_RECORD_RIGHTS_REVIEW'])
  })
  it('tamagoyaki: Evidence COMPLETE / Rights REVIEW_REQUIRED / Identity REVIEW_REQUIRED / Import BLOCKED', () => {
    expect(evidencePackStateBreakdown(tamago)).toMatchObject({
      evidence: 'COMPLETE',
      rights: 'REVIEW_REQUIRED',
      identity: 'REVIEW_REQUIRED',
      importEligible: false,
    })
    expect(evidencePackHoldReasons(tamago)).toEqual([
      'HOLD_RECORD_RIGHTS_REVIEW',
      'HOLD_IDENTITY_REVIEW',
    ])
  })
  it('EGG branch の 2 件はどちらも import-eligible ではない（§20 success condition）', () => {
    for (const p of EGG_BRANCH_BATCH1_EVIDENCE_PACKS) {
      expect(canEnterRecipeImport(p)).toBe(false)
      expect(evidencePackHoldReasons(p).length).toBeGreaterThan(0)
    }
  })
  it('held packs は削除されず fixture として保持されている（§31）', () => {
    expect(EGG_BRANCH_BATCH1_EVIDENCE_PACKS).toHaveLength(2)
  })
})

describe('MISSION 2.41B — SOURCE_NOT_STATED audit（§11 / §16）', () => {
  it('oyakodon: preparation / completionCues / classification は SOURCE_NOT_STATED', () => {
    expect(oyako.recipe.preparation.status).toBe('SOURCE_NOT_STATED')
    expect(oyako.recipe.completionCues.status).toBe('SOURCE_NOT_STATED')
    expect(oyako.classification.country.status).toBe('SOURCE_NOT_STATED')
    expect(oyako.classification.mealOccasions.status).toBe('SOURCE_NOT_STATED')
  })
  it('tamagoyaki: NOT_CAPTURED は 1 つも無い（本文確認済み）', () => {
    expect(JSON.stringify(tamago)).not.toContain('NOT_CAPTURED')
    expect(tamago.provenance.evidenceMethod).toBe('official-source-body-review')
  })
  it('両 pack とも全 EvidenceFact が §7 形状ルールを満たす', () => {
    for (const p of EGG_BRANCH_BATCH1_EVIDENCE_PACKS) {
      expect(validateEvidencePack(p).reasons).not.toContain('FACT_PRESENCE_INVALID')
    }
  })
})
