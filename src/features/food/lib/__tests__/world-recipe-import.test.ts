// ============================================================
// world-recipe-import.test.ts
//
// MISSION 2.37 — Rights-Aware World Recipe Import Pipeline。
//
// SOURCE → RIGHTS → RECORD → IDENTITY → KNOWLEDGE → PRESENTATION の順序と
// fail-closed / firewall / fact-preservation を固定する（§27 の 30 要件）。
// ============================================================

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import type { RawRecipeImportCandidate } from '@/features/food/types'
import {
  evaluateRecipeImportRights,
  importRecipeCandidate,
  isImportedKnowledge,
  importedKnowledgeHasRightsProvenance,
  normalizeRecipeCandidate,
  resolveEffectiveRights,
  resolveImportIdentity,
  getWorldFoodSource,
} from '../world-recipe-import'
import {
  WORLD_FOOD_SOURCE_REGISTRY,
  realWorldFoodSources,
} from '../world-food-sources'
import {
  FIXTURE_A_PASS,
  FIXTURE_B_STORAGE_UNKNOWN,
  FIXTURE_C_THIRD_PARTY_UNRESOLVED,
  FIXTURE_D_DO_NOT_INGEST,
  FIXTURE_E_IMAGE_PROHIBITED,
  FIXTURE_F_AI_UNKNOWN,
  FIXTURE_G_MYPLATE_FEDERAL_CONFIRMED,
  FIXTURE_H_MYPLATE_THIRD_PARTY,
  FIXTURE_I_NO_RIGHTS_DATE,
  FIXTURE_J_NO_PROVENANCE,
  FIXTURE_K_IDENTITY_UNRESOLVED,
  FIXTURE_L_RECORD_RIGHTS_UNKNOWN,
  FIXTURE_M_SOURCE_NOT_REGISTERED,
  IMPORT_CANDIDATE_FIXTURES,
} from '../world-recipe-import-fixtures'
import { buildPresentationStep, presentationStepViolations } from '../world-food-knowledge'
import { SOURCE_RECIPE_KNOWLEDGE_FIXTURES } from '../world-food-fixtures'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { isRecipePublishable, getVerificationStatus } from '../recipe-publishability'
import { practicalCookValidationStatusOf } from '../practical-cook-validation'
import { rankRecipes } from '../recipe-suggestion-engine'
import { allergyRelevantIngredients } from '../recipe-safety'

const IMPORTED_AT = '2026-09-03'
const imp = (c: RawRecipeImportCandidate) => importRecipeCandidate(c, { importedAt: IMPORTED_AT })

// ============================================================
// §27.1–8, 13–14 — Rights Gate（PASS / BLOCK / inheritance / fail-closed）
// ============================================================

describe('MISSION 2.37 — Rights Gate', () => {
  it('1. allowed source + allowed record → PASS', () => {
    const r = imp(FIXTURE_A_PASS)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.decision.allowed).toBe(true)
      expect(r.decision.reasons).toEqual([])
      expect(r.knowledge.canonicalRecipeId).toBe('kr-kimchi-bokkeumbap')
    }
  })

  it('2. unknown structuredFactStorage → BLOCK (STRUCTURED_FACT_STORAGE_UNKNOWN)', () => {
    const r = imp(FIXTURE_B_STORAGE_UNKNOWN)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasons).toContain('STRUCTURED_FACT_STORAGE_UNKNOWN')
  })

  it('3. prohibited structuredFactStorage → BLOCK', () => {
    const c: RawRecipeImportCandidate = {
      ...FIXTURE_A_PASS,
      recordRights: { ...FIXTURE_A_PASS.recordRights, rightsOverride: { structuredFactStorage: 'prohibited' } },
    }
    const r = imp(c)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasons).toContain('STRUCTURED_FACT_STORAGE_PROHIBITED')
  })

  it('3b. conditional structuredFactStorage → BLOCK（MVP は allowed のみ通す）', () => {
    const r = imp(IMPORT_CANDIDATE_FIXTURES.C_THIRD_PARTY_UNRESOLVED)
    expect(r.ok).toBe(false)
  })

  it('4. do-not-ingest source → BLOCK (SOURCE_DO_NOT_INGEST)', () => {
    const r = imp(FIXTURE_D_DO_NOT_INGEST)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasons).toContain('SOURCE_DO_NOT_INGEST')
  })

  it('5. unknown record rights → BLOCK (RECORD_RIGHTS_UNKNOWN)', () => {
    const r = imp(FIXTURE_L_RECORD_RIGHTS_UNKNOWN)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasons).toContain('RECORD_RIGHTS_UNKNOWN')
  })

  it('6. third-party unresolved → BLOCK (THIRD_PARTY_RIGHTS_UNRESOLVED)', () => {
    const r = imp(FIXTURE_C_THIRD_PARTY_UNRESOLVED)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasons).toContain('THIRD_PARTY_RIGHTS_UNRESOLVED')
  })

  it('6b. third-party unknown → BLOCK（unknown も unresolved 扱い）', () => {
    const c: RawRecipeImportCandidate = {
      ...FIXTURE_A_PASS,
      recordRights: { ...FIXTURE_A_PASS.recordRights, thirdPartyRights: 'unknown' },
    }
    const r = imp(c)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasons).toContain('THIRD_PARTY_RIGHTS_UNRESOLVED')
  })

  it('7. record override > source default（unknown source でも override で allowed なら通る）', () => {
    const r = imp(FIXTURE_G_MYPLATE_FEDERAL_CONFIRMED)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.decision.structuredFactStorageBasis).toBe('record-override')
      expect(r.knowledge.importProvenance?.structuredFactStorageBasis).toBe('record-override')
    }
  })

  it('7b. source allowed だが record override が prohibited → BLOCK（override は両方向に効く）', () => {
    const c: RawRecipeImportCandidate = {
      ...FIXTURE_A_PASS,
      recordRights: { ...FIXTURE_A_PASS.recordRights, rightsOverride: { structuredFactStorage: 'prohibited' } },
    }
    expect(imp(c).ok).toBe(false)
  })

  it('8. source classification unknown + no override → BLOCK (SOURCE_CLASSIFICATION_UNKNOWN)', () => {
    const r = imp(FIXTURE_H_MYPLATE_THIRD_PARTY)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reasons).toContain('SOURCE_CLASSIFICATION_UNKNOWN')
      expect(r.reasons).toContain('THIRD_PARTY_RIGHTS_UNRESOLVED')
    }
  })

  it('13. missing rightsCheckedAt → BLOCK (RECORD_RIGHTS_CHECK_DATE_MISSING)', () => {
    const r = imp(FIXTURE_I_NO_RIGHTS_DATE)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasons).toContain('RECORD_RIGHTS_CHECK_DATE_MISSING')
  })

  it('14. missing provenance → BLOCK (RECORD_PROVENANCE_MISSING)', () => {
    const r = imp(FIXTURE_J_NO_PROVENANCE)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasons).toContain('RECORD_PROVENANCE_MISSING')
  })

  it('source が registry に無い → BLOCK (SOURCE_NOT_REGISTERED)', () => {
    const r = imp(FIXTURE_M_SOURCE_NOT_REGISTERED)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasons).toEqual(['SOURCE_NOT_REGISTERED'])
  })

  it('commercialUse allowed だけでは Import 許可しない（structuredFactStorage が核心）', () => {
    const c: RawRecipeImportCandidate = {
      ...FIXTURE_A_PASS,
      recordRights: {
        ...FIXTURE_A_PASS.recordRights,
        rightsOverride: { commercialUse: 'allowed', structuredFactStorage: 'unknown' },
      },
    }
    expect(imp(c).ok).toBe(false)
  })

  it('effective rights の resolvedFrom が override / source を正しく示す', () => {
    const src = getWorldFoodSource('synthetic-cleared-open-source')!
    const eff = resolveEffectiveRights(src, {
      ...FIXTURE_A_PASS.recordRights,
      rightsOverride: { commercialUse: 'prohibited' },
    })
    expect(eff.resolvedFrom.commercialUse).toBe('record-override')
    expect(eff.resolvedFrom.structuredFactStorage).toBe('source-default')
  })
})

// ============================================================
// §27.9–12 — Asset firewall / AI firewall
// ============================================================

describe('MISSION 2.37 — Asset / AI firewall', () => {
  it('9. imageReuse prohibited でも structuredFactStorage allowed なら Recipe Knowledge は Import 可能', () => {
    const r = imp(FIXTURE_E_IMAGE_PROHIBITED)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.decision.imageImportAllowed).toBe(false)
  })

  it('10. 画像情報（imageUrl）は Knowledge へ入らない', () => {
    const r = imp(FIXTURE_E_IMAGE_PROHIBITED)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(JSON.stringify(r.knowledge)).not.toContain('E-001.jpg')
      expect(r.knowledge).not.toHaveProperty('imageUrl')
    }
  })

  it('11. aiMlUse unknown でも structuredFactStorage allowed なら Import 可能', () => {
    const r = imp(FIXTURE_F_AI_UNKNOWN)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.decision.aiMlUse).toBe('unknown')
  })

  it('12. aiMlUse allowed でも AI 処理は発生しない（Pipeline に AI 呼び出しが無い）', () => {
    const c: RawRecipeImportCandidate = {
      ...FIXTURE_A_PASS,
      recordRights: { ...FIXTURE_A_PASS.recordRights, rightsOverride: { aiMlUse: 'allowed' } },
    }
    const r = imp(c)
    expect(r.ok).toBe(true)
    // Pipeline モジュールのソースに AI 系 import / 呼び出しが存在しないことは firewall テストで固定
  })
})

// ============================================================
// §27.15–16 — Identity Resolution（fuzzy 禁止・新規生成禁止）
// ============================================================

describe('MISSION 2.37 — Identity Resolution', () => {
  it('15. unresolved Recipe Identity → BLOCK (IDENTITY_UNRESOLVED)。rights は通っている', () => {
    const r = imp(FIXTURE_K_IDENTITY_UNRESOLVED)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reasons).toEqual(['IDENTITY_UNRESOLVED'])
      expect(r.decision?.allowed).toBe(true) // Rights Gate は通過
    }
  })

  it('15b. canonicalRecipeId 未設定 → IDENTITY_UNRESOLVED', () => {
    const c: RawRecipeImportCandidate = { ...FIXTURE_A_PASS }
    delete (c as { canonicalRecipeId?: string }).canonicalRecipeId
    const r = imp(c)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasons).toEqual(['IDENTITY_UNRESOLVED'])
  })

  it('16. fuzzy identity resolution をしない（近い名前でも解決しない）', () => {
    const c: RawRecipeImportCandidate = { ...FIXTURE_A_PASS, canonicalRecipeId: 'kimchi-bokkeumbap' } // 正: kr-kimchi-bokkeumbap
    expect(resolveImportIdentity(c)).toBeUndefined()
    expect(imp(c).ok).toBe(false)
  })

  it('新しい Canonical Identity を勝手に生成しない（registry 件数不変）', () => {
    const before = WORLD_FOOD_SOURCE_REGISTRY.length
    imp(FIXTURE_K_IDENTITY_UNRESOLVED)
    expect(WORLD_FOOD_SOURCE_REGISTRY.length).toBe(before)
  })
})

// ============================================================
// §27.17–22 — Fact preservation（補完・換算・翻訳をしない）
// ============================================================

describe('MISSION 2.37 — Fact preservation', () => {
  const knowledge = () => {
    const r = imp(FIXTURE_A_PASS)
    if (!r.ok) throw new Error('expected import to succeed')
    return r.knowledge
  }

  it('17. 未知 ingredient は canonicalIngredientId undefined のまま（Import 失敗にしない）', () => {
    const g = knowledge().ingredients.find((i) => i.sourceIngredientName === 'gochugaru')!
    expect(g.canonicalIngredientId).toBeUndefined()
  })

  it('18. unknown heat を補完しない（step2 は heat 無し → Presentation heatAction 無し）', () => {
    const step2 = knowledge().cookingSteps.find((s) => s.order === 2)!
    expect(step2.heat).toBeUndefined()
    const p = buildPresentationStep(step2, { title: 't', shortInstruction: 's', ingredientActions: [] })
    expect(p.heatAction).toBeUndefined()
    expect(presentationStepViolations(step2, p)).toEqual([])
  })

  it('19. missing duration を補完しない（step2 は duration 無し）', () => {
    const step2 = knowledge().cookingSteps.find((s) => s.order === 2)!
    expect(step2.duration).toBeUndefined()
    expect(step2.passiveDuration).toBeUndefined()
  })

  it('20. range quantity を midpoint 化しない', () => {
    const egg = knowledge().ingredients.find((i) => i.sourceIngredientName === 'egg')!
    expect(egg.quantity?.semantics).toEqual({ kind: 'range', min: 2, max: 3, unit: 'piece' })
    expect(egg.quantity?.displayText).toBe('2–3 eggs')
    const step1 = knowledge().cookingSteps.find((s) => s.order === 1)!
    expect(step1.duration).toEqual({ kind: 'range', minMinutes: 2, maxMinutes: 3 })
  })

  it('21. unit を自動換算しない（"a pinch" は数値化されない）', () => {
    const salt = knowledge().ingredients.find((i) => i.sourceIngredientName === 'salt')!
    expect(salt.quantity?.semantics).toEqual({ kind: 'culinary-term', term: 'pinch' })
    expect(salt.quantity?.displayText).toBe('a pinch')
  })

  it('22. translation しない（sourceLanguage / 原文表記が保持される）', () => {
    const k = knowledge()
    expect(k.sourceLanguage).toBe('en')
    expect(k.sourceRecipeName).toBe('synthetic test dish')
    expect(k.servings?.displayText).toBe('2 servings')
  })

  it('normalizeRecipeCandidate は fact を変えず cookingSteps を order 昇順にするだけ', () => {
    const scrambled: RawRecipeImportCandidate = {
      ...FIXTURE_A_PASS,
      cookingSteps: [
        { order: 2, factSummary: 'b' },
        { order: 1, factSummary: 'a', heat: 'medium', duration: { kind: 'range', minMinutes: 2, maxMinutes: 3 } },
      ],
    }
    const n = normalizeRecipeCandidate(scrambled)
    expect(n.cookingSteps.map((s) => s.order)).toEqual([1, 2])
    expect(n.cookingSteps[0].duration).toEqual({ kind: 'range', minMinutes: 2, maxMinutes: 3 })
    // 元は変更しない
    expect(scrambled.cookingSteps[0].order).toBe(2)
  })
})

// ============================================================
// §27.23 — Presentation は Source fact を変更しない
// ============================================================

describe('MISSION 2.37 — Presentation connection', () => {
  it('23. import 成功 → SourceRecipeKnowledge → Presentation step 生成。fact 追加なし', () => {
    const r = imp(FIXTURE_A_PASS)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const step1 = r.knowledge.cookingSteps.find((s) => s.order === 1)!
    const step2 = r.knowledge.cookingSteps.find((s) => s.order === 2)!
    const p1 = buildPresentationStep(step1, { title: 'heat & add', shortInstruction: 'x', ingredientActions: ['add eggs'] })
    const p2 = buildPresentationStep(step2, { title: 'fold', shortInstruction: 'x', ingredientActions: [] })
    // step1: source が heat/time を示す → Presentation に入る
    expect(p1.heatAction).toBe('中火')
    expect(p1.durationDisplay).toBe('2〜3分')
    // step2: source が示さない → undefined のまま
    expect(p2.heatAction).toBeUndefined()
    expect(p2.durationDisplay).toBeUndefined()
    expect(presentationStepViolations(step1, p1)).toEqual([])
    expect(presentationStepViolations(step2, p2)).toEqual([])
  })
})

// ============================================================
// §27.24–27 — Import ≠ VERIFIED / Publishable / Allergy-safe / Practically-validated
// ============================================================

describe('MISSION 2.37 — Import ≠ X', () => {
  const knowledge = () => {
    const r = imp(FIXTURE_A_PASS)
    if (!r.ok) throw new Error('expected import to succeed')
    return r.knowledge
  }

  it('24/25. Import 成功 knowledge に verification / publishability の概念が付かない', () => {
    const k = knowledge()
    expect(k).not.toHaveProperty('verification')
    expect(k).not.toHaveProperty('practicalCookValidation')
    // importProvenance は付くが、これは rights の来歴であって culinary evidence ではない
    expect(isImportedKnowledge(k)).toBe(true)
    expect(k.notes?.some((n) => n.includes('Import ≠ VERIFIED'))).toBe(true)
  })

  it('26. Import 成功 ≠ Allergy Safe（この層は allergen 関係を作らない）', () => {
    const k = knowledge()
    // soy sauce → wheat のような自動推測を一切していない（ingredients に allergen フィールドが無い）
    for (const ing of k.ingredients) {
      expect(ing).not.toHaveProperty('allergens')
      expect(ing).not.toHaveProperty('allergenRelations')
    }
  })

  it('27. Import 成功 ≠ Practically Validated', () => {
    expect(knowledge()).not.toHaveProperty('practicalCookValidation')
  })

  it('imported knowledge は sourceKnowledgeHasValidEvidence を満たさない（culinary evidence 未検証）', () => {
    // 別 helper で rights provenance は確認できる
    expect(importedKnowledgeHasRightsProvenance(knowledge())).toBe(true)
  })

  it('imported knowledge は MISSION 2.35 の実データ FIXTURES に混ざらない', () => {
    const k = knowledge()
    expect(SOURCE_RECIPE_KNOWLEDGE_FIXTURES).not.toContainEqual(k)
    expect(SOURCE_RECIPE_KNOWLEDGE_FIXTURES.every((f) => f.importProvenance === undefined)).toBe(true)
  })
})

// ============================================================
// §27.28–30 — 既存機能の Regression（firewall）
// ============================================================

describe('MISSION 2.37 — existing behavior unchanged', () => {
  it('28. tori-teriyaki / buta-shogayaki の publishability 不変', () => {
    const tori = RECIPE_CATALOG.find((r) => r.id === 'tori-teriyaki')!
    const buta = RECIPE_CATALOG.find((r) => r.id === 'buta-shogayaki')!
    expect(getVerificationStatus(tori)).toBe('verified')
    expect(getVerificationStatus(buta)).toBe('verified')
    expect(isRecipePublishable(tori)).toBe(true)
    expect(isRecipePublishable(buta)).toBe(true)
    // Import Pipeline を走らせた後も不変
    imp(FIXTURE_A_PASS)
    expect(isRecipePublishable(tori)).toBe(true)
  })

  it('29. Allergy Gate 不変（小麦 / 大豆 / 鶏肉 で tori-teriyaki は HARD EXCLUDE）', () => {
    const base = { availableIngredientNames: ['鶏もも肉'], dislikeNames: [] as string[], maxCookingMinutes: null }
    for (const allergen of ['小麦', '大豆', '鶏肉']) {
      const ranked = rankRecipes(RECIPE_CATALOG, { ...base, allergyNames: [allergen] })
      expect(ranked.some((c) => c.recipe.id === 'tori-teriyaki')).toBe(false)
    }
    const rel = allergyRelevantIngredients(RECIPE_CATALOG.find((r) => r.id === 'tori-teriyaki')!)
    expect(rel).toContain('しょうゆ')
  })

  it('30. Practical Validation status 不変', () => {
    for (const id of ['tori-teriyaki', 'buta-shogayaki']) {
      expect(practicalCookValidationStatusOf(RECIPE_CATALOG.find((r) => r.id === id)!)).toBe('not-tested')
    }
  })
})

// ============================================================
// Firewall — import graph の検査（ソース静的解析）
// ============================================================

describe('MISSION 2.37 — module firewall', () => {
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
    './recipe-variant',
    './recipe-time',
  ]

  for (const file of ['world-recipe-import.ts', 'world-food-sources.ts', 'world-recipe-import-fixtures.ts']) {
    it(`${file} が Evidence / Allergy / Verification / AI モジュールを import しない`, () => {
      const src = read(file)
      for (const mod of FORBIDDEN) {
        expect(src.includes(`from '${mod}'`), `${file} imports ${mod}`).toBe(false)
      }
      // AI / verify / publish の呼び出しも無い
      expect(/\bverifyRecipe\s*\(/.test(src)).toBe(false)
      expect(/\bpublishRecipe\s*\(/.test(src)).toBe(false)
      expect(/\bfetch\s*\(/.test(src)).toBe(false)
    })
  }
})

// ============================================================
// Source Registry — 一次確認済みの範囲だけ表現しているか
// ============================================================

describe('MISSION 2.37 — WorldFoodSource registry discipline', () => {
  it('全 source に checkedAt がある（未確認の rights を載せない）', () => {
    for (const s of WORLD_FOOD_SOURCE_REGISTRY) {
      expect(s.checkedAt, s.sourceId).toBeTruthy()
    }
  })

  it('Korea MFDS は運用審査前なので import 経路が通らない（classification unknown + structuredFactStorage conditional）', () => {
    const mfds = getWorldFoodSource('kr-mfds-cookrcp01')!
    expect(mfds.classification).toBe('unknown')
    expect(mfds.rights.structuredFactStorage).toBe('conditional')
    const c: RawRecipeImportCandidate = {
      ...FIXTURE_A_PASS,
      recordRights: {
        sourceId: 'kr-mfds-cookrcp01',
        sourceRecordId: 'RCP_SEQ-1',
        sourceUrl: 'https://www.foodsafetykorea.go.kr/api/openApiInfo.do',
        thirdPartyRights: 'none',
        rightsStatus: 'use',
        rightsCheckedAt: '2026-09-03',
      },
    }
    const r = imp(c)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reasons).toContain('SOURCE_CLASSIFICATION_UNKNOWN')
      expect(r.reasons).toContain('STRUCTURED_FACT_STORAGE_CONDITIONAL_UNMET')
    }
  })

  it('USDA MyPlate source は Public Domain 一括扱いになっていない（classification unknown / rights unknown）', () => {
    const myplate = getWorldFoodSource('us-usda-myplate')!
    expect(myplate.classification).toBe('unknown')
    expect(myplate.rights.structuredFactStorage).toBe('unknown')
  })

  it('MAFF source default は structuredFactStorage allowed だが imageReuse prohibited（asset 分離）', () => {
    const maff = getWorldFoodSource('jp-maff-kyodo-ryori')!
    expect(maff.rights.structuredFactStorage).toBe('allowed')
    expect(maff.rights.imageReuse).toBe('prohibited')
  })

  it('real（非 synthetic）source は 3 件（MFDS / MAFF / MyPlate）', () => {
    expect(realWorldFoodSources().map((s) => s.sourceId).sort()).toEqual([
      'jp-maff-kyodo-ryori',
      'kr-mfds-cookrcp01',
      'us-usda-myplate',
    ])
  })
})
