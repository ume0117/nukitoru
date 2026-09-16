// ============================================================
// evidence-quantity-foundation.test.ts
//
// MISSION 2.17 — Evidence Traceability & Quantity Semantics Foundation。
//
// Part A: mutable source の変更検出（fingerprint / reverify）
// Part B: 分量の意味論（exact/range/approximate/to-taste/optional/unknown/
//          culinary-term）と表示テキストの分離
//
// いずれも「表現・検出できること」だけを固定化する。Recipe fact・status・
// Batch 1/2 の結論・Allergy/Coherence/Time/From-Now-to-Table は変えない。
// ============================================================

import { describe, it, expect } from 'vitest'
import type {
  EvidenceSourceObservation,
  QuantitySemantics,
  RecipeEvidenceSource,
} from '@/features/food/types'
import {
  normalizeObservationSummary,
  computeContentFingerprint,
  classifySourceChange,
  sourceChangeRequiresReview,
  needsReverification,
  withReverification,
} from '../evidence-traceability'
import {
  isKnownQuantity,
  isNumericQuantity,
  isUserDiscretionQuantity,
  quantityUpperBound,
  quantitiesEqual,
  describeQuantitySemantics,
  refineFromUnknown,
  makeQuantityStatement,
  statementHasEvidence,
} from '../quantity-semantics'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { EVIDENCE_SOURCE_CATALOG, getEvidenceSourceById } from '../evidence-sources'
import { isRecipePublishable } from '../recipe-publishability'
import { rankRecipes } from '../recipe-suggestion-engine'
import { allergyRelevantIngredients } from '../recipe-safety'
import { isEligibleForMaxElapsedTime } from '../recipe-time'
import { deriveFromNowToTable } from '../from-now-to-table'

function recipe(id: string) {
  const r = RECIPE_CATALOG.find((x) => x.id === id)
  if (!r) throw new Error(`recipe not found: ${id}`)
  return r
}

// pork-cabbage-miso-stirfry の観測サマリ（NUKITORU自作の要約。source本文ではない）
const PORK_CABBAGE_V1 = '豚肉200g|キャベツ1/4個|味噌大さじ1|砂糖小さじ1|酒大さじ1'
const PORK_CABBAGE_V2 = // Batch 2 で観測した現行 DELISH KITCHEN 内容
  '豚バラ薄切り200g|キャベツ4枚|にんにく1かけ|サラダ油大さじ1|酒大さじ1|みりん大さじ1|砂糖小さじ1|味噌大さじ1と1/2|監修:佐藤ゆか'

describe('MISSION 2.17 — Evidence Traceability & Quantity Semantics Foundation', () => {
  // ================================================================
  // Part A — Traceability
  // ================================================================

  it('TA0: fingerprint は SHA-256（64桁小文字16進）で決定論的（MISSION 2.17A）', async () => {
    const fp = computeContentFingerprint(PORK_CABBAGE_V1)
    expect(fp).toMatch(/^[0-9a-f]{64}$/)
    // 決定論的: 同一入力 → 同一出力
    expect(computeContentFingerprint(PORK_CABBAGE_V1)).toBe(fp)
    // 既知ベクトル: 正規化後 "a" の SHA-256（広く知られた値）
    expect(computeContentFingerprint(' A ')).toBe(
      'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
    )
    // 実際に SHA-256 であることを、node:crypto の独立パスで正規化文字列から再計算して照合
    const { createHash } = await import('node:crypto')
    const { normalizeObservationSummary } = await import('../evidence-traceability')
    const expected = createHash('sha256')
      .update(normalizeObservationSummary(PORK_CABBAGE_V1), 'utf8')
      .digest('hex')
    expect(fp).toBe(expected)
  })

  it('TA0b: source 本文を保存しない（fingerprint 入力は NUKITORU 自作サマリのみ）', () => {
    // 長い外部本文を渡しても、出力は固定長 64 hex（本文は保持されない）
    const longBody = 'これは外部レシピの本文を模した非常に長い文字列。'.repeat(200)
    const fp = computeContentFingerprint(longBody)
    expect(fp).toMatch(/^[0-9a-f]{64}$/)
    expect(fp.length).toBe(64)
    // EvidenceSourceObservation 型には本文を格納する場所が存在しない
    const obs: EvidenceSourceObservation = { contentFingerprint: fp, observedAt: '2026-08-29' }
    expect(Object.keys(obs).sort()).toEqual(['contentFingerprint', 'observedAt'])
    expect(JSON.stringify(obs)).not.toContain('外部レシピの本文')
  })

  it('TA1: same URL + same fingerprint = unchanged', () => {
    const fp = computeContentFingerprint(PORK_CABBAGE_V1)
    const recorded: EvidenceSourceObservation = { contentFingerprint: fp, observedAt: '2026-08-28' }
    expect(classifySourceChange(recorded, computeContentFingerprint(PORK_CABBAGE_V1))).toBe('unchanged')
  })

  it('TA2: same URL + different fingerprint = changed（DELISH KITCHEN drift を検出）', () => {
    const recorded: EvidenceSourceObservation = {
      contentFingerprint: computeContentFingerprint(PORK_CABBAGE_V1),
      observedAt: '2026-08-28',
    }
    const status = classifySourceChange(recorded, computeContentFingerprint(PORK_CABBAGE_V2))
    expect(status).toBe('changed')
    expect(sourceChangeRequiresReview(status)).toBe(true)
  })

  it('TA3: missing fingerprint = unknown-legacy（"unchanged" ではない）', () => {
    expect(classifySourceChange(undefined, computeContentFingerprint(PORK_CABBAGE_V1))).toBe(
      'unknown-legacy',
    )
    const recorded: EvidenceSourceObservation = {
      contentFingerprint: computeContentFingerprint(PORK_CABBAGE_V1),
      observedAt: '2026-08-28',
    }
    expect(classifySourceChange(recorded, undefined)).toBe('unknown-legacy')
    // unknown-legacy は「変更なし(unchanged)」とは別物として扱う
    expect(sourceChangeRequiresReview('unknown-legacy')).toBe(false)
    expect(sourceChangeRequiresReview('unchanged')).toBe(false)
    expect(sourceChangeRequiresReview('changed')).toBe(true)
  })

  it('TA4: fingerprint は情報源の権威を示さない', () => {
    // 権威の低い匿名ブログでも fingerprint は計算できる＝計算可能性≠権威
    const blogFp = computeContentFingerprint('個人ブログ|分量てきとう|味噌おおさじ2くらい')
    const govFp = computeContentFingerprint('農林水産省|米1合150g')
    expect(blogFp).toMatch(/^[0-9a-f]{64}$/)
    expect(govFp).toMatch(/^[0-9a-f]{64}$/)
    // fingerprint 値そのものに sourceType の情報は含まれない
    expect(blogFp).not.toBe(govFp)
  })

  it('TA5: fingerprint は VERIFIED の根拠にならない（publishability は fingerprint を参照しない）', () => {
    const src = getEvidenceSourceById('delishkitchen-pork-cabbage-2026')!
    const withObs: RecipeEvidenceSource = {
      ...src,
      observation: { contentFingerprint: computeContentFingerprint('opaque-fixture-1'), observedAt: '2026-08-29' },
    }
    // observation を足しても recipe は review のまま・publishable にならない
    const r = recipe('pork-cabbage-miso-stirfry')
    expect(isRecipePublishable(r, [...EVIDENCE_SOURCE_CATALOG, withObs])).toBe(false)
    expect(r.verification?.status).toBe('review')
  })

  it('TA6: source change は Recipe fact を書き換えない', () => {
    const before = JSON.stringify(recipe('pork-cabbage-miso-stirfry').seasonings)
    const status = classifySourceChange(
      { contentFingerprint: computeContentFingerprint(PORK_CABBAGE_V1), observedAt: '2026-08-28' },
      computeContentFingerprint(PORK_CABBAGE_V2),
    )
    expect(status).toBe('changed')
    // 検出しただけで catalog は不変
    expect(JSON.stringify(recipe('pork-cabbage-miso-stirfry').seasonings)).toBe(before)
    expect(recipe('pork-cabbage-miso-stirfry').seasonings?.[0]).toEqual({ name: '味噌', amount: '大さじ1' })
  })

  it('TA7: source change は conflict を自動解決しない', () => {
    // gyudon は同一identity conflict のまま。drift 検出関数は conflict に触れない
    const gyudon = recipe('gyudon')
    const conflictFvs = (gyudon.verification?.fieldVerifications ?? []).filter(
      (f) => f.variantRelation === 'conflicting-within-variant',
    )
    expect(conflictFvs.length).toBeGreaterThan(0)
    classifySourceChange(
      { contentFingerprint: computeContentFingerprint('gyudon-obs-old'), observedAt: '2026-08-20' },
      computeContentFingerprint('gyudon-obs-new'),
    )
    expect(
      (recipe('gyudon').verification?.fieldVerifications ?? []).filter(
        (f) => f.variantRelation === 'conflicting-within-variant',
      ).length,
    ).toBe(conflictFvs.length)
  })

  it('TA8: source change は coherence gate を迂回しない（PUBLIC BETA RELEASE SPRINT 1Cでmedama-yakiがcoherentへ解決したため、安定した対照例のsake-shioyakiを使う）', () => {
    expect(recipe('sake-shioyaki').verification?.coherenceReview?.status).toBe('incoherent')
    classifySourceChange(undefined, computeContentFingerprint('sake-shioyaki-obs'))
    expect(recipe('sake-shioyaki').verification?.coherenceReview?.status).toBe('incoherent')
    expect(isRecipePublishable(recipe('sake-shioyaki'))).toBe(false)
  })

  it('TA9: re-verification metadata を表現できる（reverifyAfter / lastReverifiedAt）', () => {
    const obs: EvidenceSourceObservation = {
      contentFingerprint: computeContentFingerprint(PORK_CABBAGE_V1),
      observedAt: '2026-08-28',
      reverifyAfter: '2027-02-28',
    }
    expect(needsReverification(obs, '2026-12-01')).toBe(false)
    expect(needsReverification(obs, '2027-03-01')).toBe(true)
    const reverified = withReverification(obs, '2027-03-02', computeContentFingerprint(PORK_CABBAGE_V2))
    expect(reverified.lastReverifiedAt).toBe('2027-03-02')
    expect(reverified.contentFingerprint).toBe(computeContentFingerprint(PORK_CABBAGE_V2))
    // 元オブジェクトは不変
    expect(obs.lastReverifiedAt).toBeUndefined()
  })

  it('TA10: 普遍的な再確認間隔を発明しない（reverifyAfter 未設定なら催促しない）', () => {
    const obs: EvidenceSourceObservation = {
      contentFingerprint: computeContentFingerprint('legacy-obs'),
      observedAt: '2020-01-01',
    }
    // 6 年後でも reverifyAfter が無ければ false（勝手な期限を作らない）
    expect(needsReverification(obs, '2026-08-29')).toBe(false)
    expect(needsReverification(undefined, '2099-01-01')).toBe(false)
  })

  it('TA extra: fingerprint は観測事実の並び順に依存しない（正規化）', () => {
    const a = computeContentFingerprint('豚肉200g|味噌大さじ1|酒大さじ1')
    const b = computeContentFingerprint('  酒大さじ1 |豚肉200g|  味噌大さじ1  ')
    expect(a).toBe(b)
    expect(normalizeObservationSummary('B|a| |A ')).toBe('a|a|b')
  })

  it('TA extra: observation 未設定の legacy source は有効なまま／付いている場合は 64hex（no mass migration）', () => {
    for (const s of EVIDENCE_SOURCE_CATALOG) {
      // observation は任意。未設定でも source として壊れない
      expect(typeof s.id).toBe('string')
      if (s.observation) {
        expect(s.observation.contentFingerprint).toMatch(/^[0-9a-f]{64}$/)
        expect(typeof s.observation.observedAt).toBe('string')
      }
    }
    // observation を持つのは MISSION 2.18 Batch 3 で実際に本文を再確認した少数のみ
    // （一括移行はしていない：全体のごく一部）
    const withObs = EVIDENCE_SOURCE_CATALOG.filter((s) => s.observation)
    expect(withObs.length).toBeGreaterThan(0)
    expect(withObs.length).toBeLessThan(EVIDENCE_SOURCE_CATALOG.length / 2)
  })

  // ================================================================
  // Part B — Quantity Semantics
  // ================================================================

  const exact: QuantitySemantics = { kind: 'exact', value: 2, unit: '大さじ' }
  const range: QuantitySemantics = { kind: 'range', min: 3, max: 4, unit: '分' }
  const approx: QuantitySemantics = { kind: 'approximate', value: 30, unit: '分' }
  const toTaste: QuantitySemantics = { kind: 'to-taste' }
  const optional: QuantitySemantics = { kind: 'optional' }
  const unknown: QuantitySemantics = { kind: 'unknown' }
  const pinch: QuantitySemantics = { kind: 'culinary-term', term: 'ひとつまみ' }

  it('TB11: exact が区別できる', () => {
    expect(exact.kind).toBe('exact')
    expect(isNumericQuantity(exact)).toBe(true)
    expect(quantityUpperBound(exact)).toBe(2)
  })

  it('TB12: range が区別できる（min/max 保持）', () => {
    expect(range.kind).toBe('range')
    expect(range).toEqual({ kind: 'range', min: 3, max: 4, unit: '分' })
    expect(quantityUpperBound(range)).toBe(4)
  })

  it('TB13: approximate が区別できる（exact ではない）', () => {
    expect(approx.kind).toBe('approximate')
    expect(approx.kind).not.toBe('exact')
    expect(quantityUpperBound(approx)).toBeNull()
  })

  it('TB14: to-taste が区別できる', () => {
    expect(toTaste.kind).toBe('to-taste')
    expect(isUserDiscretionQuantity(toTaste)).toBe(true)
    expect(isNumericQuantity(toTaste)).toBe(false)
  })

  it('TB15: optional が区別できる', () => {
    expect(optional.kind).toBe('optional')
    expect(isUserDiscretionQuantity(optional)).toBe(true)
  })

  it('TB16: unknown が区別できる', () => {
    expect(unknown.kind).toBe('unknown')
    expect(isKnownQuantity(unknown)).toBe(false)
    expect(quantityUpperBound(unknown)).toBeNull()
  })

  it('TB17: culinary-term / pinch が区別できる', () => {
    expect(pinch.kind).toBe('culinary-term')
    expect(pinch.kind === 'culinary-term' && pinch.term).toBe('ひとつまみ')
    expect(quantityUpperBound(pinch)).toBeNull()
  })

  it('TB18: pinch != to-taste', () => {
    expect(quantitiesEqual(pinch, toTaste)).toBe(false)
    expect(pinch.kind).not.toBe(toTaste.kind)
    // 「少々」も別の culinary-term であり、pinch とも to-taste とも別
    const sukoshi: QuantitySemantics = { kind: 'culinary-term', term: '少々' }
    expect(quantitiesEqual(sukoshi, pinch)).toBe(false)
    expect(quantitiesEqual(sukoshi, toTaste)).toBe(false)
  })

  it('TB19: optional != unknown', () => {
    expect(quantitiesEqual(optional, unknown)).toBe(false)
    expect(optional.kind).not.toBe(unknown.kind)
  })

  it('TB20: approximate != exact', () => {
    expect(quantitiesEqual(approx, { kind: 'exact', value: 30, unit: '分' })).toBe(false)
  })

  it('TB21: range は midpoint 化されない', () => {
    // 型に midpoint を表現する手段が無い＋ helper も max/min のみ
    expect('value' in range).toBe(false)
    expect(quantityUpperBound(range)).toBe(4) // 上限であって 3.5 ではない
    expect(quantitiesEqual(range, { kind: 'range', min: 3, max: 4, unit: '分' })).toBe(true)
    expect(quantitiesEqual(range, { kind: 'exact', value: 3.5, unit: '分' })).toBe(false)
  })

  it('TB22: displayText は保持される（semantics と別レイヤー）', () => {
    const s = makeQuantityStatement('塩 ひとつまみ', pinch)
    expect(s.displayText).toBe('塩 ひとつまみ')
    expect(s.semantics).toEqual(pinch)
    const s2 = makeQuantityStatement('しょうゆ 適量', toTaste)
    expect(s2.displayText).toBe('しょうゆ 適量')
    expect(s2.semantics.kind).toBe('to-taste')
  })

  it('TB23: semantic metadata は Evidence を生まない', () => {
    // Evidence 無しでも statement は作れるが「Evidence 裏付けあり」にはならない
    const s = makeQuantityStatement('しょうゆ 適量', toTaste)
    expect(statementHasEvidence(s)).toBe(false)
    const s2 = makeQuantityStatement('しょうゆ 適量', toTaste, { evidenceSourceIds: ['kikkoman-x'] })
    expect(statementHasEvidence(s2)).toBe(true)
    // statement を作っても recipe verification は不変
    expect(recipe('hiyayakko').verification?.status).toBe('review')
  })

  it('TB24: unknown は Evidence 無しに to-taste へ自動昇格できない', () => {
    expect(refineFromUnknown(toTaste, [])).toBeNull() // 裏付けなし → 拒否
    expect(refineFromUnknown(toTaste, ['kikkoman-hiyayakko-x'])).toEqual(toTaste) // 裏付けあり → 許可
    expect(refineFromUnknown({ kind: 'exact', value: 1, unit: '小さじ' }, [])).toBeNull()
    expect(refineFromUnknown(unknown, [])).toEqual(unknown) // no-op は許可
  })

  it('TB25: hiyayakko の amount は不変（しょうゆ 小さじ1）', () => {
    expect(recipe('hiyayakko').seasonings).toEqual([{ name: 'しょうゆ', amount: '小さじ1' }])
  })

  it('TB26: maguro-don の amount は不変（しょうゆ 大さじ1）', () => {
    expect(recipe('maguro-don').seasonings).toEqual([{ name: 'しょうゆ', amount: '大さじ1' }])
  })

  it('TB27: shio-musubi の「ひとつまみ」は不変（数値化されていない）', () => {
    const salt = recipe('shio-musubi').seasonings?.find((s) => s.name === '塩')
    expect(salt?.amount).toBe('ひとつまみ')
    expect(salt?.amount).not.toMatch(/[0-9g]/)
  })

  it('TB28: onigiri-nori の amount は不変（米1合・のり2枚・塩ひとつまみ）', () => {
    const r = recipe('onigiri-nori')
    expect(r.requiredIngredients).toEqual([
      { name: '米', amount: '1合' },
      { name: 'のり', amount: '2枚' },
    ])
    expect(r.seasonings).toEqual([{ name: '塩', amount: 'ひとつまみ' }])
  })

  it('TB extra: describeQuantitySemantics は g へ変換しない旨を明示する', () => {
    expect(describeQuantitySemantics(pinch)).toContain('g へ変換していない')
    expect(describeQuantitySemantics(toTaste)).toContain('数値化していない')
    expect(describeQuantitySemantics(range)).toContain('収縮させない')
    expect(describeQuantitySemantics(unknown)).toContain('推測で埋めない')
  })

  it('TB extra: 既存 44 Recipe に QuantityStatement は一切付与されていない（no mass migration）', () => {
    for (const r of RECIPE_CATALOG) {
      for (const ing of [...r.requiredIngredients, ...(r.seasonings ?? [])]) {
        // amount は今も単純な文字列のまま
        expect(typeof ing.amount).toBe('string')
        expect(ing).not.toHaveProperty('semantics')
        expect(ing).not.toHaveProperty('quantityStatement')
      }
    }
  })

  // ================================================================
  // Regressions
  // ================================================================

  it('R29: Batch 1 の結論が保たれている（5 recipe review・非publishable）', () => {
    for (const id of ['hiyayakko', 'maguro-don', 'gyudon', 'oyako-don', 'tofu-miso-soup']) {
      expect(recipe(id).verification?.status).toBe('review')
      expect(isRecipePublishable(recipe(id))).toBe(false)
    }
  })

  it('R30: Batch 2 の結論が保たれている（5 recipe review・pork-cabbage は supportType=variant）', () => {
    for (const id of [
      'tori-soboro-don',
      'tuna-mayo-don',
      'pork-cabbage-miso-stirfry',
      'shio-musubi',
      'onigiri-nori',
    ]) {
      expect(recipe(id).verification?.status).toBe('review')
    }
    const fvs = recipe('pork-cabbage-miso-stirfry').verification?.fieldVerifications ?? []
    expect(fvs.every((f) => f.supportType !== 'direct')).toBe(true)
  })

  it('R31: Allergy HARD EXCLUSION 無傷', () => {
    expect(allergyRelevantIngredients(recipe('medama-yaki'))).toEqual(
      expect.arrayContaining(['卵']),
    )
    const result = rankRecipes(RECIPE_CATALOG, {
      availableIngredientNames: ['卵', '油'],
      allergyNames: ['卵'],
      dislikeNames: [],
      maxCookingMinutes: null,
    })
    expect(result.some((c) => c.recipe.id === 'medama-yaki')).toBe(false)
  })

  it('R32: Recipe Coherence Gate 無傷（sake-shioyaki=incoherentのまま／medama-yakiはPUBLIC BETA RELEASE SPRINT 1Cでcoherentへ解決）', () => {
    expect(recipe('medama-yaki').verification?.coherenceReview?.status).toBe('coherent')
    expect(recipe('sake-shioyaki').verification?.coherenceReview?.status).toBe('incoherent')
    expect(RECIPE_CATALOG.filter((r) => r.verification?.status === 'verified').map((r) => r.id)).toEqual(['tori-teriyaki', 'buta-shogayaki', 'nikujaga', 'medama-yaki', 'yudofu', 'niku-udon', 'napolitan']) /* MISSION 2.26: 初のVERIFIED。SPRINT 1Cでmedama-yaki追加 */
  })

  it('R33: Source Silence 原則（EVIDENCE_POLICY.md）無傷', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const content = fs.readFileSync(
      path.join(process.cwd(), 'src/features/food/EVIDENCE_POLICY.md'),
      'utf-8',
    )
    expect(content).toContain('Source Silence')
  })

  it('R34: Variant semantics 無傷（gyudon は偽variant化されていない）', () => {
    expect(recipe('gyudon').verification?.recipeIdentity?.variantIdentity).toBeUndefined()
  })

  it('R35: Cooking Time semantics 無傷', () => {
    expect(isEligibleForMaxElapsedTime(recipe('shio-musubi'), 15)).toBe(false)
    expect(recipe('shio-musubi').verification?.timeVerification).toBeUndefined()
  })

  it('R36: From-Now-to-Table 無傷（呼び出しても recipe を変えない）', () => {
    const before = recipe('shio-musubi').cookingTimeMinutes
    const result = deriveFromNowToTable(
      { mealId: 'x', requiredComponents: ['rice'], tasks: [] },
      { componentStates: { rice: 'unknown' } },
    )
    expect(result.kind).toBe('unresolved')
    expect(recipe('shio-musubi').cookingTimeMinutes).toBe(before)
  })
})
