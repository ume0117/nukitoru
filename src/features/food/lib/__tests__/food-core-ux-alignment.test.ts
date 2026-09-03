// ============================================================
// food-core-ux-alignment.test.ts
//
// MISSION 2.40A — Core UX Alignment。
// 既存 Stock → Food Decision / Primary Home Hierarchy / Working Completion Share。
// §14 の 18 項目を固定する（既存 2.40 の 56 tests は不変）。
// ============================================================

import { describe, it, expect } from 'vitest'
import type { FoodStockIngredientSnapshot, StockStatusEntry } from '@/features/food/types'
import {
  persistedStockAvailability,
  projectPersistedStockToFoodSnapshots,
  summarizeStockSnapshots,
  matchRecipesFromStock,
} from '../food-matching'
import { toForwardMatchListPresentation } from '../food-match-presentation'
import { SOURCE_RECIPE_KNOWLEDGE_FIXTURES } from '../world-food-fixtures'
import {
  buildFoodShareText,
  buildFoodShareHashtags,
  buildSnsShareUrls,
  factualTagsFrom,
  shareFood,
} from '../food-share'

const map = (entries: Record<string, StockStatusEntry['status']>): Record<string, StockStatusEntry> =>
  Object.fromEntries(Object.entries(entries).map(([k, s]) => [k, { status: s }]))

// ============================================================
// §14.1–3 — persisted status → availability mapping
// ============================================================

describe('MISSION 2.40A — persisted stock status mapping', () => {
  it('1. persisted available → snapshot available', () => {
    expect(persistedStockAvailability(map({ じゃがいも: 'available' }), 'じゃがいも')).toBe('available')
  })
  it('2. persisted low → snapshot low', () => {
    expect(persistedStockAvailability(map({ 玉ねぎ: 'low' }), '玉ねぎ')).toBe('low')
  })
  it('3. persisted out → snapshot unavailable', () => {
    expect(persistedStockAvailability(map({ にんにく: 'out' }), 'にんにく')).toBe('unavailable')
  })
  it('エントリ無し → 既存 getStockStatus と同じ安全側の available', () => {
    expect(persistedStockAvailability({}, 'なにか')).toBe('available')
    expect(persistedStockAvailability(map({}), '未登録')).toBe('available')
  })
})

// ============================================================
// §14.4–6 — canonicalization 接続（推測しない）
// ============================================================

describe('MISSION 2.40A — canonicalization on persisted stock', () => {
  it('4. resolved ingredient は canonicalIngredientId を保持', () => {
    const snaps = projectPersistedStockToFoodSnapshots({
      itemNames: ['じゃがいも', '玉ねぎ'],
      statusMap: map({ じゃがいも: 'available', 玉ねぎ: 'low' }),
    })
    expect(snaps.find((s) => s.sourceName === 'じゃがいも')?.canonicalIngredientId).toBe('potato')
    expect(snaps.find((s) => s.sourceName === '玉ねぎ')?.canonicalIngredientId).toBe('onion')
    expect(snaps.find((s) => s.sourceName === '玉ねぎ')?.availabilityStatus).toBe('low')
  })

  it('5. unresolved ingredient は推測しない（UNRESOLVED / canonicalIngredientId undefined）', () => {
    const snaps = projectPersistedStockToFoodSnapshots({
      itemNames: ['謎の野菜'],
      statusMap: map({ 謎の野菜: 'available' }),
    })
    expect(snaps[0].identityStatus).toBe('UNRESOLVED')
    expect(snaps[0].canonicalIngredientId).toBeUndefined()
  })

  it('6. ambiguous ingredient は勝手に決めない（AMBIGUOUS / candidateIds 保持）', () => {
    // world-ingredient registry には本番で曖昧なものは無い。合成 registry でテスト
    const AMBIG_REGISTRY = [
      {
        canonicalIngredientId: 'x-a',
        canonicalName: 'x-a',
        names: [{ language: 'ja', name: 'あいまい食材', kind: 'canonical' as const }],
      },
      {
        canonicalIngredientId: 'x-b',
        canonicalName: 'x-b',
        names: [{ language: 'ja', name: 'あいまい食材', kind: 'canonical' as const }],
      },
    ]
    const snaps = projectPersistedStockToFoodSnapshots(
      { itemNames: ['あいまい食材'], statusMap: map({ あいまい食材: 'available' }) },
      AMBIG_REGISTRY,
    )
    expect(snaps[0].identityStatus).toBe('AMBIGUOUS')
    expect(snaps[0].canonicalIngredientId).toBeUndefined()
    expect(snaps[0].candidateIds).toEqual(['x-a', 'x-b'])
  })

  it('7. 既存 Stock data（itemNames / statusMap）を mutate しない', () => {
    const itemNames = ['じゃがいも', 'じゃがいも', '玉ねぎ']
    const statusMap = map({ じゃがいも: 'available' })
    const beforeNames = JSON.stringify(itemNames)
    const beforeMap = JSON.stringify(statusMap)
    projectPersistedStockToFoodSnapshots({ itemNames, statusMap })
    expect(JSON.stringify(itemNames)).toBe(beforeNames)
    expect(JSON.stringify(statusMap)).toBe(beforeMap)
  })

  it('同名の重複は 1 件に集約される', () => {
    const snaps = projectPersistedStockToFoodSnapshots({
      itemNames: ['じゃがいも', 'じゃがいも', ' じゃがいも '],
      statusMap: map({ じゃがいも: 'available' }),
    })
    expect(snaps).toHaveLength(1)
  })
})

// ============================================================
// §14.8–10 — 再入力不要 flow / empty state / summary
// ============================================================

describe('MISSION 2.40A — no-reinput forward flow', () => {
  it('8. Stock があれば再入力なしで Forward Matching へ進める（persisted snapshot → matchRecipesFromStock）', () => {
    const snaps = projectPersistedStockToFoodSnapshots({
      itemNames: ['鶏もも肉', 'しょうゆ', '酒', 'みりん', '砂糖', '塩'],
      statusMap: map({}),
    })
    const results = matchRecipesFromStock(snaps, SOURCE_RECIPE_KNOWLEDGE_FIXTURES)
    const list = toForwardMatchListPresentation(results)
    // 追加入力なしで tori-teriyaki の availability が計算できている
    const tori = list.items.find((i) => i.canonicalRecipeId === 'jp-tori-teriyaki')!
    expect(tori).toBeDefined()
    expect(tori.atHomeCount).toBeGreaterThan(0)
  })

  it('9. Stock empty → snapshot は [] / summary は全 0（fake count なし）', () => {
    const snaps = projectPersistedStockToFoodSnapshots({ itemNames: [], statusMap: {} })
    expect(snaps).toEqual([])
    const summary = summarizeStockSnapshots(snaps)
    expect(summary).toEqual({
      availableCount: 0,
      lowCount: 0,
      unavailableCount: 0,
      resolvedCount: 0,
      unresolvedCount: 0,
      ambiguousCount: 0,
      totalCount: 0,
    })
  })

  it('summarizeStockSnapshots は実データからのみ（available/low/unavailable/resolved を正しく数える）', () => {
    const snaps: FoodStockIngredientSnapshot[] = [
      { stockItemKey: 'a', sourceName: 'じゃがいも', canonicalIngredientId: 'potato', identityStatus: 'RESOLVED', availabilityStatus: 'available' },
      { stockItemKey: 'b', sourceName: '玉ねぎ', canonicalIngredientId: 'onion', identityStatus: 'RESOLVED', availabilityStatus: 'low' },
      { stockItemKey: 'c', sourceName: 'にんにく', canonicalIngredientId: 'garlic', identityStatus: 'RESOLVED', availabilityStatus: 'unavailable' },
      { stockItemKey: 'd', sourceName: '謎', identityStatus: 'UNRESOLVED', availabilityStatus: 'available' },
    ]
    const s = summarizeStockSnapshots(snaps)
    expect(s.availableCount).toBe(2)
    expect(s.lowCount).toBe(1)
    expect(s.unavailableCount).toBe(1)
    expect(s.resolvedCount).toBe(3)
    expect(s.unresolvedCount).toBe(1)
    expect(s.totalCount).toBe(4)
  })

  it('10. Primary CTA hierarchy: 既存 Stock を主データにする関数が存在し、Forward が persisted snapshot を直接受け取れる', () => {
    // projectPersistedStockToFoodSnapshots の戻り値がそのまま matchRecipesFromStock の第1引数型
    const snaps = projectPersistedStockToFoodSnapshots({ itemNames: ['じゃがいも'], statusMap: map({}) })
    const results = matchRecipesFromStock(snaps, SOURCE_RECIPE_KNOWLEDGE_FIXTURES)
    expect(Array.isArray(results)).toBe(true)
  })
})

// ============================================================
// §14.11–15 — Completion Share（実動化・privacy）
// ============================================================

describe('MISSION 2.40A — completion share', () => {
  it('11. Share text は #NUKITORU を含む', () => {
    expect(buildFoodShareText({ recipeName: '鶏の照り焼き' })).toContain('#NUKITORU')
  })
  it('12. Share text は #NUKITORUFOOD を含む', () => {
    expect(buildFoodShareText({ recipeName: '鶏の照り焼き' })).toContain('#NUKITORUFOOD')
  })
  it('13. Share payload は stock を含まない', () => {
    const text = buildFoodShareText({ recipeName: '鶏の照り焼き' })
    expect(text).not.toMatch(/在庫|じゃがいも|玉ねぎ|鶏もも肉|Stock/i)
    for (const u of Object.values(buildSnsShareUrls({ recipeName: '鶏の照り焼き' }))) {
      expect(decodeURIComponent(u)).not.toMatch(/在庫|じゃがいも|Stock/i)
    }
  })
  it('14. Share payload は allergy / family / preference を含まない', () => {
    const text = buildFoodShareText({ recipeName: '鶏の照り焼き', factualTags: ['日本料理'] })
    expect(text).not.toMatch(/アレル|allergy|家族|family|preference|好み|苦手|世帯/i)
    // FoodShareInput は recipeName + factualTags のみ（stock/allergy を渡す口が無い）
    expect(factualTagsFrom({ mealOccasions: ['snack'] })).toEqual(['おやつ'])
  })
  it('15. Completion share は実動化（shareFood が存在し Promise<outcome> を返す・disabled ではない）', async () => {
    expect(typeof shareFood).toBe('function')
    // jsdom/node 環境（navigator.share 無し）では 'unavailable' か 'copied'
    const outcome = await shareFood({ recipeName: 'テスト' })
    expect(['shared', 'copied', 'unavailable', 'cancelled']).toContain(outcome)
  })
  it('buildSnsShareUrls は X/Bluesky/Facebook/LINE を返す（既存 layout.tsx と同型）', () => {
    const u = buildSnsShareUrls({ recipeName: 'x' })
    expect(u.x).toMatch(/^https:\/\/twitter\.com\/intent\/tweet\?text=/)
    expect(u.bluesky).toMatch(/^https:\/\/bsky\.app\/intent\/compose\?text=/)
    expect(u.facebook).toMatch(/^https:\/\/www\.facebook\.com\/sharer\/sharer\.php\?u=/)
    expect(u.line).toMatch(/^https:\/\/social-plugins\.line\.me\/lineit\/share\?url=/)
  })
})

// ============================================================
// §14.16–18 — 未実装アクションを完成画面から隠す
// ============================================================

describe('MISSION 2.40A — unimplemented deferred actions hidden', () => {
  const src = () =>
    require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, '..', '..', 'components', 'CookingModeView.tsx'),
      'utf8',
    ) as string

  it('16. 未実装 Favorite は完成画面に描画しない', () => {
    const s = src()
    // Completion 関数内に「♡ お気に入り」ボタンが無い（Share だけが実ボタン）
    expect(s).not.toContain('♡ お気に入り')
  })
  it('17. 未実装 Repeat は完成画面に描画しない', () => {
    expect(src()).not.toContain('また作る</button>')
    expect(src()).not.toMatch(/deferred(Action)?s?:\s*FoodDeferredAction\[\]\s*=\s*\[/)
  })
  it('18. 未実装 Print は完成画面に描画しない', () => {
    const s = src()
    expect(s).not.toContain('プリント</button>')
  })
  it('Completion に disabled ボタンの grid を並べていない', () => {
    const s = src()
    expect(s).not.toMatch(/disabled\s*\n?\s*title="今後のアップデート/)
  })
  it('Completion の Share ボタンは disabled ではない', () => {
    const s = src()
    // onShare を持つ button があり、その近くに disabled が無い
    expect(s).toContain('onClick={onShare}')
    const shareBtnBlock = s.slice(s.indexOf('onClick={onShare}'), s.indexOf('onClick={onShare}') + 200)
    expect(shareBtnBlock).not.toContain('disabled')
  })
})
