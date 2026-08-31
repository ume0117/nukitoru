// ============================================================
// batch3-evidence-resolution.test.ts
//
// MISSION 2.18 — Recipe Resolution Batch 3（tori-teriyaki / buta-shogayaki）。
//
// 両 recipe は従来 verification ブロックが無かった。Batch 3 で初めて
// Evidence Resolution を行い、いずれも REVIEW（0 VERIFIED）で確定。
// Recipe fact は一切変更していない（分量・材料・手順・時間・人数・器具は凍結）。
//
// 併せて MISSION 2.17 の EvidenceSourceObservation を初めて実運用したので、
// 新規 source の fingerprint が観測サマリから再現できること、legacy source が
// legacy のままであること、fingerprint が VERIFIED を意味しないこと等を固定化する。
//
// MISSION 2.19A — tori-teriyaki の4 source観測レコードを2026-08-30に開き直して訂正。
// Batch 3 の観測サマリに転記漏れ・過剰記述（NHKの未記載「骨なし」、白ごはん/職人醤油の
// ふた・時間注記の不足、キッコーマンの脂の拭き取り量）があった。掲載レシピ自体は不変
// （source driftではない）。observedAt/lastReverifiedAt を 2026-08-30 に更新し fingerprint を
// 訂正後サマリから再計算。Recipe fact・status は一切不変（tori-teriyaki は REVIEW のまま）。
// ============================================================

import { describe, it, expect } from 'vitest'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { EVIDENCE_SOURCE_CATALOG, getEvidenceSourceById } from '../evidence-sources'
import { isRecipePublishable } from '../recipe-publishability'
import { rankRecipes } from '../recipe-suggestion-engine'
import { allergyRelevantIngredients } from '../recipe-safety'
import { computeContentFingerprint, classifySourceChange } from '../evidence-traceability'
import { isEligibleForMaxElapsedTime } from '../recipe-time'
import { deriveFromNowToTable } from '../from-now-to-table'

function recipe(id: string) {
  const r = RECIPE_CATALOG.find((x) => x.id === id)
  if (!r) throw new Error(`recipe not found: ${id}`)
  return r
}

// Batch 3 で追加した source の観測サマリ（NUKITORU自作。source本文ではない）。
// catalog の reviewNotes に記録したものと同一文字列。fingerprint はこれの正規化 SHA-256。
// tori-teriyaki の4件は MISSION 2.19A で 2026-08-30 に訂正した「訂正版」を保持する。
const OBSERVED = {
  'kikkoman-toriteriyaki-2026':
    '2人分|鶏もも肉大1枚250g(皮の明記なし・皮目を下に焼く)|小麦粉大さじ1|サラダ油小さじ2|ピーマン2個|合わせだれ=生しょうゆ大さじ1と1/2+本みりん大さじ2|砂糖の記載なし|酒の記載なし|下ごしらえ=余分な脂肪を除く+筋を切る+厚みを均一+4等分+ペーパータオルで余分な水分を取る+下処理の20分ほどで室温に戻す|工程=小麦粉をまぶす→油を中火で2分ほど熱す→皮目を下に中火で4〜5分→ピーマンは焼き色後に取り出す→肉を返して余分な脂を半分程度拭き取る→中央をあけて合わせだれを注ぐ→3〜4分たれが大さじ2〜3残るまで煮からめる|ふたの記載なし|調理時間約20分|監修小田真規子',
  'sshoyu-toriteriyaki-2026':
    '2人分|鶏もも肉2枚(皮の明記なし・皮目を下に焼く)|醤油(濃口/溜)大さじ2+みりん大さじ2(1対1)|砂糖の記載なし|サラダ油少々|酒適量|小麦粉なし|下ごしらえ=余分な脂を除く+厚いところに切り目を入れる+酒をふっておく|工程=油を中火で熱す→皮目を下に焼き色→裏返して同様→火をとめて余分な油をふきとる→よく混ぜた醤油とみりんを加える→すぐに火をつけてたれに肉を煮絡める→鶏肉を2cm幅に切って盛る|ふたの記載なし|たれは焼き色後に投入・事前によく混ぜる|運営=職人醤油(醤油の知識・レシピ・生産者紹介の教育メディアと通販を兼ねるサイト)',
  'sirogohan-toriteriyaki-2026':
    '1〜2人分|鶏もも肉1枚約300g|たれ=砂糖大さじ1/2+醤油大さじ1と1/2+みりん大さじ1と1/2+酒大さじ1と1/2|油をひかない|塩をしない|小麦粉なし|下ごしらえ=できれば20〜30分常温に戻す+余分な脂や皮を切り落とす+皮目をフォークや包丁の切っ先で何度かつく+たれを事前に合わせる|工程=油をひかず皮目から焼き始める→3〜4分かけてじっくり皮目を焼く→裏返して2〜3分→合わせたたれを加えて煮つめる→たれを皮に何度もかけるのを繰り返す|ふたは基本使わないが火通りが不十分な場合のみ裏返して火を弱め蓋をして蒸し焼き|調理時間20分※常温に戻す時間を除く|サイト=白ごはん.com',
  'kyounoryouri-toriteriyaki-kawano-2026':
    '2人分|鶏もも肉(大)1枚300g(骨の有無の記載なし・皮を下にして焼く)|スナップえんどう100g|合わせだれA=しょうゆ大さじ1+酒大さじ1+みりん大さじ1+砂糖小さじ1+塩少々|サラダ油小さじ1|小麦粉なし|下ごしらえ=調理する約30分前に常温に戻す+余分な脂肪を除く+筋の多いところや厚いところに切り目+縦半分に切り1切れを3等分|工程=サラダ油小さじ1を中火で熱す→鶏肉を皮を下に2〜3分→焼き色がついたら返してふたをして弱めの中火で3〜4分→ペーパータオルで溶け出た脂を拭く→混ぜておいたAを回し入れる→強めの中火で煮詰めながら照りが出るまでからめる|ふたあり(返した後・片面のみ)|調理時間15分※鶏肉を常温に戻す時間は除く|講師河野雅子',
  'kikkoman-butashogayaki-2026':
    '2人分|豚肩ロース肉しょうが焼き用250〜300g|玉ねぎなし|しょうが3かけ分すりおろしで1かけA下味と2かけBたれ|しょうゆ大さじ2|砂糖大さじ1|酒=小さじ2Aと大さじ1B|みりんなし|油大さじ1/2|小麦粉なし|下ごしらえ=ペーパーで余分な水気をふく+Aのしょうがと酒を絡めて5分置く|筋切りの記載なし|工程=中火で2〜3分動かさず焼く→返して30秒〜1分→Bのたれを中央に加える→火を強めて煮立ててから絡める→フライパンの底が見えるまで煮つめる|ふたなし|調理時間約20分|監修記載なし',
  'sirogohan-butashogayaki-2026':
    '2人分|豚ロース肉生姜焼き用200gで4〜6枚|玉ねぎ1/4個2mm薄切り|たれ=しょうゆ大さじ2+みりん大さじ1+酒大さじ1+砂糖小さじ2+しょうがすりおろしとしぼり汁20〜30g+ケチャップ小さじ1+ごま油小さじ1/2+こしょう少々|油小さじ1|小麦粉なし|下ごしらえ=1cm間隔で筋切り+しょうがとにんにくをすりおろす+みりんと酒としぼり汁で10分漬け込む2〜3回返す|工程=油を熱し玉ねぎを先に炒める→豚肉を加える→両面を焼く→たれを加えて約2分からめる|ふたなし|著者冨田ただすけ',
} as const

// MISSION 2.19A で訂正する前の欠陥のあった Batch 3 観測サマリ（tori-teriyaki のみ）。
// 「訂正で fingerprint が変わる」ことの固定化に使う。source本文ではない。
const OBSERVED_BATCH3_DEFECTIVE = {
  'kikkoman-toriteriyaki-2026':
    '2人分|鶏もも肉大1枚250g皮つき|小麦粉大さじ1|サラダ油小さじ2|ピーマン2個|合わせだれ=しょうゆ大さじ1と1/2+みりん大さじ2|砂糖なし|酒なし|下ごしらえ=余分な脂を除く+筋切り+厚みを均一+4等分+水気をふく+常温に20分|工程=小麦粉をまぶす→油を中火2分→皮目を下に4〜5分動かさず→返して脂をふく→合わせだれを注ぐ→3〜4分たれが大さじ2〜3残るまで煮からめる|ふたなし|調理時間約20分|監修小田真規子',
  'sshoyu-toriteriyaki-2026':
    '2人分|鶏もも肉2枚皮つき|醤油(濃口/溜)大さじ2+みりん大さじ2(1対1)|砂糖なし|油少々|小麦粉なし|下ごしらえ=余分な脂を除く+厚い部分に切り込み筋切り+酒をふって置く|工程=皮目を下に中火で焼き色→返して同様→余分な油を除く→よく混ぜた醤油とみりんを加える→煮からめる|ふたなし|たれは焼き色後に投入で事前に混ぜる|運営=職人醤油(醤油専門の販売と教育メディア)',
  'sirogohan-toriteriyaki-2026':
    '1〜2人分|鶏もも肉1枚約300g皮つき|たれ=砂糖大さじ1/2+醤油大さじ1と1/2+みりん大さじ1と1/2+酒大さじ1と1/2|油なし|小麦粉なし|下ごしらえ=常温に20〜30分戻す+余分な脂と皮を除く+皮目をフォークや包丁で数か所つく|工程=油なしで皮目を下に3〜4分ときどき押さえる→脂をペーパーでふく→返して身側2〜3分→合わせたたれを加えて煮つめる→皮にたれを何度もかけてツヤを出す|ふたなし|たれは事前に合わせる|調理時間20分|著者冨田ただすけ',
  'kyounoryouri-toriteriyaki-kawano-2026':
    '2人分|鶏もも肉大1枚300g骨なし皮つき|合わせだれA=しょうゆ大さじ1+酒大さじ1+みりん大さじ1+砂糖小さじ1+塩少々|サラダ油小さじ1|小麦粉なし|下ごしらえ=常温に約30分+余分な脂を除く+筋の多い所や厚い所に切り目+縦半分から3等分|工程=皮目を下に2〜3分→返してふたをして弱めの中火3〜4分の蒸し焼き→出た脂をふく→合わせだれAを加える→強めの中火で照りが出るまで煮つめる|ふたあり片面|調理講師河野雅子',
} as const

const BATCH3_NEW_SOURCE_IDS = Object.keys(OBSERVED)
const TORI_SOURCE_IDS_2_19A = Object.keys(OBSERVED_BATCH3_DEFECTIVE)

describe('MISSION 2.18 — Evidence Resolution Batch 3', () => {
  // ---- Recipe fact freeze ----

  it('DA: tori-teriyaki は MISSION 2.19E-RESUME-2 で NHK-anchored に修正済み（Batch 3 の凍結値ではない）', () => {
    const r = recipe('tori-teriyaki')
    // MISSION 2.19E-RESUME-2: Batch 3 で HOLD としていた unsupported legacy fact を NHK anchor で修正した
    expect(r.requiredIngredients).toEqual([{ name: '鶏もも肉', amount: '300g' }])
    expect(r.seasonings).toEqual([
      { name: 'しょうゆ', amount: '大さじ1' },
      { name: 'みりん', amount: '大さじ1' },
      { name: '酒', amount: '大さじ1' },
      { name: '砂糖', amount: '小さじ1' },
      { name: '塩', amount: '少々' },
      { name: 'サラダ油', amount: '小さじ1' },
    ])
    expect(r.servingsBase).toBe(2)
    expect(r.equipment).toEqual(['フライパン']) // 菜箸（unsupported legacy inference）は除去
    expect(r.steps).toEqual([
      'フライパンにサラダ油小さじ1を入れ、鶏もも肉を皮目を下にして並べ、中火で2〜3分焼く',
      '焼き色がついたら返し、ふたをして弱めの中火で3〜4分蒸し焼きにする',
      'ふたを取り、ペーパータオルで溶け出た脂を拭く',
      'あらかじめ混ぜ合わせたたれを回し入れる',
      '強めの中火で煮詰めながら、照りが出るまでからめる',
    ])
    expect(r.cookingLiquids).toBeUndefined() // 水は輸入していない
    // legacy cookingTimeMinutes は残るが Product Time としては review
    expect(r.cookingTimeMinutes).toBe(15)
    expect(r.verification?.timeVerification?.productTimeStatus).toBe('review')
  })

  it('DB: buta-shogayaki の Recipe fact は Batch 3 で凍結', () => {
    const r = recipe('buta-shogayaki')
    expect(r.requiredIngredients).toEqual([
      { name: '豚肉', amount: '200g' },
      { name: '玉ねぎ', amount: '1/2個' },
    ])
    expect(r.seasonings).toEqual([
      { name: 'しょうゆ', amount: '大さじ1と1/2' },
      { name: 'みりん', amount: '大さじ1' },
      { name: 'しょうが', amount: '小さじ1' },
    ])
    expect(r.cookingTimeMinutes).toBe(15)
    expect(r.servingsBase).toBe(2)
    expect(r.steps).toEqual([
      '玉ねぎを薄切りにする',
      'フライパンで豚肉と玉ねぎを炒める',
      '豚肉の中心まで色が変わったら、しょうゆ、みりん、しょうがを加えてからめる',
    ])
  })

  it('DC: 下ごしらえ（常温に戻す・筋切り・漬け込み・下味）は steps に追加されていない', () => {
    const forbidden = ['常温', '筋切り', '筋を切', '漬け込', '下味', 'フォーク', 'すりおろし']
    for (const id of ['tori-teriyaki', 'buta-shogayaki']) {
      const stepText = (recipe(id).steps ?? []).join(' ')
      for (const term of forbidden) {
        expect(stepText.includes(term), `${id} steps should not contain ${term}`).toBe(false)
      }
    }
  })

  // ---- status / classification ----

  it('DD: buta-shogayaki は status=review（tori-teriyaki は MISSION 2.26 で verified）', () => {
    expect(recipe('tori-teriyaki').verification?.status).toBe('verified')
    expect(recipe('buta-shogayaki').verification?.status).toBe('review')
  })

  it('DE: buta-shogayaki は hasUnsupportedInference=true・非publishable（tori-teriyaki は MISSION 2.26 で解消）', () => {
    expect(recipe('buta-shogayaki').verification?.hasUnsupportedInference).toBe(true)
    expect(isRecipePublishable(recipe('buta-shogayaki'))).toBe(false)
    expect(recipe('tori-teriyaki').verification?.hasUnsupportedInference).toBe(false)
    expect(isRecipePublishable(recipe('tori-teriyaki'))).toBe(true)
  })

  it('DF: catalog 全体の VERIFIED 数は 0 のまま', () => {
    expect(RECIPE_CATALOG.filter((r) => r.verification?.status === 'verified').map((r) => r.id)).toEqual(['tori-teriyaki']) /* MISSION 2.26: 初の VERIFIED */
  })

  it('DG: RecipeIdentity が確立された（canonicalDish / coreMethod）', () => {
    expect(recipe('tori-teriyaki').verification?.recipeIdentity?.canonicalDish).toBe('鶏の照り焼き')
    expect(recipe('buta-shogayaki').verification?.recipeIdentity?.canonicalDish).toBe('豚の生姜焼き')
    expect(recipe('buta-shogayaki').verification?.recipeIdentity?.coreMethod).toContain('漬け込み')
  })

  it('DH: buta-shogayaki は直接支持でない critical field を direct にしていない（tori-teriyaki は 2.19E-RESUME-2 で NHK direct へ修正済み）', () => {
    // tori-teriyaki: MISSION 2.19E-RESUME-2 で全 critical field が NHK anchor の direct になった
    const tt = recipe('tori-teriyaki').verification?.fieldVerifications ?? []
    expect(tt.find((f) => f.field === 'seasoningAmounts')?.supportType).toBe('direct')
    // process 系 field はすべて NHK anchor の direct（allergyIdentity は MISSION 2.26 で derived + allergen source）
    const processFvs = tt.filter((f) => f.field !== 'allergyIdentity')
    expect(processFvs.every((f) => f.supportType === 'direct' && f.sourceIds.length === 1 && f.sourceIds[0] === 'kyounoryouri-toriteriyaki-kawano-2026')).toBe(true)
    expect(tt.find((f) => f.field === 'allergyIdentity')?.supportType).toBe('derived')
    // buta-shogayaki は未修正のまま variant
    const bs = recipe('buta-shogayaki').verification?.fieldVerifications ?? []
    expect(bs.find((f) => f.field === 'seasoningAmounts')?.supportType).toBe('variant')
    expect(bs.find((f) => f.field === 'criticalSteps')?.supportType).toBe('variant')
  })

  // ---- traceability: new source observations ----

  it('DI: Batch 3 の新規 source すべてに observation がある（tori-teriyakiは2.19Aで2026-08-30に更新）', () => {
    for (const id of BATCH3_NEW_SOURCE_IDS) {
      const s = getEvidenceSourceById(id)
      expect(s, id).toBeDefined()
      expect(s!.observation, id).toBeDefined()
      const expectedDate = (TORI_SOURCE_IDS_2_19A as string[]).includes(id) ? '2026-08-30' : '2026-08-29'
      expect(s!.observation!.observedAt, id).toBe(expectedDate)
    }
  })

  it('DJ: 新規 fingerprint は 64桁小文字16進、かつ観測サマリから再現できる', () => {
    for (const id of BATCH3_NEW_SOURCE_IDS) {
      const recorded = getEvidenceSourceById(id)!.observation!.contentFingerprint
      expect(recorded).toMatch(/^[0-9a-f]{64}$/)
      // catalog に記録された fingerprint が、NUKITORU自作サマリの SHA-256 と一致する
      expect(recorded).toBe(computeContentFingerprint(OBSERVED[id as keyof typeof OBSERVED]))
      // 記録済み fingerprint と再計算が一致 = 'unchanged'
      expect(classifySourceChange(getEvidenceSourceById(id)!.observation, recorded)).toBe('unchanged')
    }
  })

  it('DK: 再開しなかった legacy source は legacy のまま（observation 未設定）', () => {
    // Batch 1/2 で触れた既存 source は observation を持たない
    for (const id of [
      'kikkoman-gyudon-2026',
      'sirogohan-gyudon-2026',
      'ajinomoto-hiyayakko-2026',
      'delishkitchen-pork-cabbage-2026',
      'kikkoman-oyakodon-2026',
    ]) {
      expect(getEvidenceSourceById(id)?.observation).toBeUndefined()
    }
    // Batch 3 で開いた 6 件以外に observation が付いていない
    const withObs = EVIDENCE_SOURCE_CATALOG.filter((s) => s.observation).map((s) => s.id).sort()
    expect(withObs).toEqual([...BATCH3_NEW_SOURCE_IDS].sort())
  })

  it('DL: observation / fingerprint 一致は VERIFIED の根拠ではない（publishability は observation を参照しない）', () => {
    // fingerprint が一致していても、それ自体が publishability の根拠にはならない
    const s = getEvidenceSourceById('sirogohan-toriteriyaki-2026')!
    expect(
      classifySourceChange(
        s.observation,
        computeContentFingerprint(OBSERVED['sirogohan-toriteriyaki-2026']),
      ),
    ).toBe('unchanged')
    // buta-shogayaki は同様に observation を持つ source を使うが review・非publishable
    expect(recipe('buta-shogayaki').verification?.status).toBe('review')
    expect(isRecipePublishable(recipe('buta-shogayaki'))).toBe(false)
    // tori-teriyaki が publishable なのは MISSION 2.26 の Recipe-Evidence 全field解決＋coherence であって
    // fingerprint 一致が理由ではない
    expect(recipe('tori-teriyaki').verification?.status).toBe('verified')
  })

  it('DM: 外部 source 本文は保存されていない（observation は fingerprint と日付のみ）', () => {
    for (const id of BATCH3_NEW_SOURCE_IDS) {
      const obs = getEvidenceSourceById(id)!.observation!
      const allowed = ['contentFingerprint', 'lastReverifiedAt', 'observedAt', 'reverifyAfter']
      const keys = Object.keys(obs)
      // fingerprint と日付フィールドのみ。source本文・レシピ本文の複製は無い。
      expect(keys.every((k) => allowed.includes(k)), `${id}: ${keys}`).toBe(true)
      expect(keys).toContain('contentFingerprint')
      expect(keys).toContain('observedAt')
    }
  })

  // ---- no cross-identity / cross-variant transfer; source silence ----

  it('DN: buta-shogayaki は source silence を否定的 Evidence に使っていない（HOLD 方針を維持）', () => {
    // buta-shogayaki は未修正のまま: reviewNotes に「HOLD」「勝手に追加しない」の方針が残る
    const bsNotes = (recipe('buta-shogayaki').verification?.reviewNotes ?? []).join('')
    expect(bsNotes).toContain('HOLD')
    expect(bsNotes).toContain('勝手に追加しない')
    // tori-teriyaki（MISSION 2.26 verified）: 監査履歴・source比較は provenanceNotes に保持され、
    // source silence を否定的 Evidence にしていないことが明記される（reviewNotes は空）
    expect(recipe('tori-teriyaki').verification?.reviewNotes).toEqual([])
    const ttProv = (recipe('tori-teriyaki').verification?.provenanceNotes ?? []).join('')
    expect(ttProv).toContain('source silence')
    expect(ttProv).toContain('NHK-SPECIFIC')
    expect(ttProv).toContain('ABSOLUTE NO-IMPORT')
  })

  it('DO: cross-variant のたれ数値転写をしていない（buta の砂糖・酒は追加されていない）', () => {
    const names = (recipe('buta-shogayaki').seasonings ?? []).map((s) => s.name)
    expect(names).not.toContain('砂糖')
    expect(names).not.toContain('酒')
    expect(names).not.toContain('ケチャップ')
    expect(names).not.toContain('ごま油')
  })

  it('DP: range を midpoint 化していない（豚肩ロース250〜300g を数値に潰していない）', () => {
    // buta の豚肉量は 200g のまま（SOURCE A の 250〜300g range の中央値等にしていない）
    expect(recipe('buta-shogayaki').requiredIngredients[0].amount).toBe('200g')
  })

  // ---- regressions ----

  it('DQ: Allergy HARD EXCLUSION 無傷', () => {
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

  it('DR: Batch 1/2 の結論が保たれている', () => {
    for (const id of [
      'hiyayakko',
      'maguro-don',
      'gyudon',
      'oyako-don',
      'tofu-miso-soup',
      'tori-soboro-don',
      'tuna-mayo-don',
      'pork-cabbage-miso-stirfry',
      'shio-musubi',
      'onigiri-nori',
    ]) {
      expect(recipe(id).verification?.status).toBe('review')
      expect(isRecipePublishable(recipe(id))).toBe(false)
    }
    // pork-cabbage の direct→variant 訂正が残っている
    const fvs = recipe('pork-cabbage-miso-stirfry').verification?.fieldVerifications ?? []
    expect(fvs.every((f) => f.supportType !== 'direct')).toBe(true)
  })

  it('DS: Recipe Coherence Gate 無傷', () => {
    expect(recipe('medama-yaki').verification?.coherenceReview?.status).toBe('incoherent')
    expect(recipe('sake-shioyaki').verification?.coherenceReview?.status).toBe('incoherent')
  })

  it('DT: From-Now-to-Table 無傷（呼び出しても recipe を変えない）', () => {
    const before = recipe('tori-teriyaki').cookingTimeMinutes
    const result = deriveFromNowToTable(
      { mealId: 'x', requiredComponents: ['chicken'], tasks: [] },
      { componentStates: { chicken: 'unknown' } },
    )
    expect(result.kind).toBe('unresolved')
    expect(recipe('tori-teriyaki').cookingTimeMinutes).toBe(before)
    expect(isEligibleForMaxElapsedTime(recipe('tori-teriyaki'), 15)).toBe(false)
  })

  it('DU: 全 recipe の sourceIds は実在し重複なし', () => {
    for (const r of RECIPE_CATALOG) {
      const ids = r.verification?.sourceIds ?? []
      expect(new Set(ids).size).toBe(ids.length)
      for (const id of ids) {
        expect(getEvidenceSourceById(id), `${r.id} -> ${id}`).toBeDefined()
      }
    }
  })
})

// ============================================================
// MISSION 2.19A — tori-teriyaki の観測レコード訂正
// ============================================================

// 訂正後の tori-teriyaki 4 source に記録されるべき最終 fingerprint。
// これらは OBSERVED（訂正版）を正規化 SHA-256 した値であり、evidence-sources.ts の
// contentFingerprint と一致していなければならない。
const CORRECTED_FINGERPRINTS_2_19A: Record<string, string> = {
  'kikkoman-toriteriyaki-2026':
    'b4954ed9e6600cb63e015959e0e86fded1a55f1a27fb4af64186f3b674b0d22d',
  'sshoyu-toriteriyaki-2026':
    '54a3b65dde243c941448820282277e3c3800318cdc423a1c3d3fa398d97c5e31',
  'sirogohan-toriteriyaki-2026':
    '973d8cd746e5222d7b06f5e097b722e2dd965b93e9666bab986edaa3a4f95df9',
  'kyounoryouri-toriteriyaki-kawano-2026':
    '9fdc33d901d00ac75b3fd9cf867e9a56a0fe9caea8dc137e0eb006e2d3b63401',
}

function toriNotes(): string {
  // MISSION 2.26: 監査履歴・source比較は provenanceNotes へ移動（reviewNotes は空）
  const v = recipe('tori-teriyaki').verification
  return [...(v?.reviewNotes ?? []), ...(v?.provenanceNotes ?? [])].join('\n')
}

describe('MISSION 2.19A — tori-teriyaki observation record correction', () => {
  it('EA: 訂正後 fingerprint 4件はすべて 64桁小文字16進', () => {
    for (const id of TORI_SOURCE_IDS_2_19A) {
      const fp = getEvidenceSourceById(id)!.observation!.contentFingerprint
      expect(fp, id).toMatch(/^[0-9a-f]{64}$/)
      expect(fp, id).toBe(CORRECTED_FINGERPRINTS_2_19A[id])
    }
  })

  it('EB: 各 fingerprint は「最終的に保存された訂正サマリ」から再計算できる', () => {
    for (const id of TORI_SOURCE_IDS_2_19A) {
      const recorded = getEvidenceSourceById(id)!.observation!.contentFingerprint
      expect(recorded, id).toBe(
        computeContentFingerprint(OBSERVED[id as keyof typeof OBSERVED]),
      )
    }
  })

  it('EC: 欠陥のあった Batch 3 サマリと訂正サマリは同一 fingerprint にならない', () => {
    for (const id of TORI_SOURCE_IDS_2_19A) {
      const oldFp = computeContentFingerprint(
        OBSERVED_BATCH3_DEFECTIVE[id as keyof typeof OBSERVED_BATCH3_DEFECTIVE],
      )
      const newFp = computeContentFingerprint(OBSERVED[id as keyof typeof OBSERVED])
      expect(newFp, id).not.toBe(oldFp)
    }
  })

  it('ED: fingerprint 不一致だけでは source drift の証明にはならない（今回は観測訂正=B）', () => {
    // 記録済み observation を、欠陥サマリの fingerprint と比較すると「changed」になる。
    // だが「changed」は A=掲載内容の変化 でも B=観測表現の訂正 でも起こり得る。
    for (const id of TORI_SOURCE_IDS_2_19A) {
      const obs = getEvidenceSourceById(id)!.observation
      const oldFp = computeContentFingerprint(
        OBSERVED_BATCH3_DEFECTIVE[id as keyof typeof OBSERVED_BATCH3_DEFECTIVE],
      )
      expect(classifySourceChange(obs, oldFp), id).toBe('changed')
    }
    // reviewNotes が「これは source drift ではなく観測レコードの訂正」と明記している。
    const notes = toriNotes()
    expect(notes).toContain('source drift ではない')
    expect(notes).toContain('観測レコードの訂正')
    expect(notes).toMatch(/A=.*変化.*B=.*訂正|観測表現の訂正/)
  })

  it('EE: キッコーマンの皮目焼き=4〜5分（Batch 3が正しく、2.19再検証の解釈が誤り）', () => {
    expect(OBSERVED['kikkoman-toriteriyaki-2026']).toContain('皮目を下に中火で4〜5分')
    const notes = toriNotes()
    expect(notes).toContain('皮目の焼き=4〜5分')
    expect(notes).toContain('2.19')
    // 「source は皮目焼きを3〜4分と言っている」という記述は残っていない
    expect(notes).not.toContain('皮目焼き3〜4分')
    expect(notes).not.toContain('皮目を下に3〜4分')
  })

  it('EF: キッコーマンのたれ煮からめ=3〜4分', () => {
    expect(OBSERVED['kikkoman-toriteriyaki-2026']).toContain(
      '3〜4分たれが大さじ2〜3残るまで煮からめる',
    )
    expect(toriNotes()).toContain('たれの煮からめ=3〜4分')
  })

  it('EG: キッコーマンの2工程時間は別個の process fact として保持', () => {
    const s = OBSERVED['kikkoman-toriteriyaki-2026']
    const sear = s.indexOf('皮目を下に中火で4〜5分')
    const reduce = s.indexOf('3〜4分たれが大さじ2〜3残るまで煮からめる')
    expect(sear).toBeGreaterThanOrEqual(0)
    expect(reduce).toBeGreaterThan(sear)
    expect(toriNotes()).toContain('別個の process fact')
  })

  it('EH: キッコーマンの脂の拭き取りは「半分程度」', () => {
    expect(OBSERVED['kikkoman-toriteriyaki-2026']).toContain('余分な脂を半分程度拭き取る')
  })

  it('EI: キッコーマンのふたは source silence（「ふたなし」と断定しない）', () => {
    const s = OBSERVED['kikkoman-toriteriyaki-2026']
    expect(s).toContain('ふたの記載なし')
    expect(s).not.toContain('ふたなし')
  })

  it('EJ: 職人醤油は「火をとめる→油をふく→醤油とみりん→再点火→煮からめる」を保持', () => {
    const s = OBSERVED['sshoyu-toriteriyaki-2026']
    const stop = s.indexOf('火をとめて余分な油をふきとる')
    const sauce = s.indexOf('よく混ぜた醤油とみりんを加える')
    const reignite = s.indexOf('すぐに火をつけてたれに肉を煮絡める')
    expect(stop).toBeGreaterThanOrEqual(0)
    expect(sauce).toBeGreaterThan(stop)
    expect(reignite).toBeGreaterThan(sauce)
  })

  it('EK: 職人醤油の最後の「2cm幅に切る」工程を保持', () => {
    expect(OBSERVED['sshoyu-toriteriyaki-2026']).toContain('鶏肉を2cm幅に切って盛る')
  })

  it('EL: 職人醤油のふたは source silence（「ふたなし」と断定しない）', () => {
    const s = OBSERVED['sshoyu-toriteriyaki-2026']
    expect(s).toContain('ふたの記載なし')
    expect(s).not.toContain('ふたなし')
  })

  it('EM: 職人醤油の運営記述は「商業ブランドサイト」と単純化していない', () => {
    const s = OBSERVED['sshoyu-toriteriyaki-2026']
    expect(s).toContain('教育メディアと通販を兼ねるサイト')
    expect(s).not.toContain('醤油の商業ブランドサイト')
  })

  it('EN: 白ごはん.com のふたは条件付き（無条件「ふたなし」ではない）', () => {
    const s = OBSERVED['sirogohan-toriteriyaki-2026']
    expect(s).toContain('火通りが不十分な場合のみ')
    expect(s).toContain('蓋をして蒸し焼き')
    expect(s).not.toContain('ふたなし')
  })

  it('EO: 白ごはん.com の表示調理時間は常温戻し20〜30分と区別されている', () => {
    expect(OBSERVED['sirogohan-toriteriyaki-2026']).toContain('調理時間20分※常温に戻す時間を除く')
  })

  it('EP: 2.19 再著述の未支持追記（約8割/スプーン/へらで押さえ）は保存されていない', () => {
    const s = OBSERVED['sirogohan-toriteriyaki-2026']
    expect(s).not.toContain('約8割')
    expect(s).not.toContain('スプーンで')
    expect(s).not.toContain('へらで押さえ')
  })

  it('EQ: NHK は骨の有無を主張していない', () => {
    const s = OBSERVED['kyounoryouri-toriteriyaki-kawano-2026']
    expect(s).not.toContain('骨なし')
    expect(s).not.toContain('骨つき')
    expect(s).toContain('骨の有無の記載なし')
  })

  it('ER: NHK は調理時間15分を記録し、常温に戻す時間を除くと明記', () => {
    expect(OBSERVED['kyounoryouri-toriteriyaki-kawano-2026']).toContain(
      '調理時間15分※鶏肉を常温に戻す時間は除く',
    )
  })

  it('ES: NHK の実際のふた/蒸し焼き工程は保持されている', () => {
    const s = OBSERVED['kyounoryouri-toriteriyaki-kawano-2026']
    expect(s).toContain('返してふたをして弱めの中火で3〜4分')
    expect(s).toContain('ふたあり(返した後・片面のみ)')
  })

  it('ET: 外部ページ本文は保存されていない（observation は fingerprint と日付フィールドのみ）', () => {
    const allowed = ['contentFingerprint', 'lastReverifiedAt', 'observedAt', 'reverifyAfter']
    for (const id of TORI_SOURCE_IDS_2_19A) {
      const obs = getEvidenceSourceById(id)!.observation!
      expect(Object.keys(obs).every((k) => allowed.includes(k)), id).toBe(true)
      expect(obs.observedAt).toBe('2026-08-30')
      expect(obs.lastReverifiedAt).toBe('2026-08-30')
    }
  })

  it('EU: tori-teriyaki の Evidence 観測レコード（2.19A訂正版）は 2.19E-RESUME-2 でも不変', () => {
    // 2.19E-RESUME-2 は Recipe body を修正したが、evidence-sources.ts の observation は触っていない
    for (const id of TORI_SOURCE_IDS_2_19A) {
      const obs = getEvidenceSourceById(id)!.observation!
      expect(obs.observedAt).toBe('2026-08-30')
      expect(obs.lastReverifiedAt).toBe('2026-08-30')
      expect(obs.contentFingerprint).toBe(
        computeContentFingerprint(OBSERVED[id as keyof typeof OBSERVED]),
      )
    }
    // Recipe identity の canonicalDish は不変
    expect(recipe('tori-teriyaki').verification?.recipeIdentity?.canonicalDish).toBe('鶏の照り焼き')
  })

  it('EV: tori-teriyaki は MISSION 2.26 で verified・publishable（Product Time は別 dimension で review）', () => {
    expect(recipe('tori-teriyaki').verification?.status).toBe('verified')
    expect(recipe('tori-teriyaki').verification?.hasUnsupportedInference).toBe(false)
    expect(isRecipePublishable(recipe('tori-teriyaki'))).toBe(true)
    expect(recipe('tori-teriyaki').verification?.timeVerification?.productTimeStatus).toBe('review')
  })

  it('EW: buta-shogayaki の source observation は 2.19A で不変（2026-08-29 / lastReverifiedAt無し）', () => {
    for (const id of ['kikkoman-butashogayaki-2026', 'sirogohan-butashogayaki-2026']) {
      const obs = getEvidenceSourceById(id)!.observation!
      expect(obs.observedAt).toBe('2026-08-29')
      expect(obs.lastReverifiedAt).toBeUndefined()
    }
    expect(recipe('buta-shogayaki').verification?.status).toBe('review')
  })

  it('EX: VERIFIED は tori-teriyaki のみ（MISSION 2.26 の初 VERIFIED）', () => {
    expect(
      RECIPE_CATALOG.filter((r) => r.verification?.status === 'verified').map((r) => r.id),
    ).toEqual(['tori-teriyaki'])
  })

  it('EY: Allergy HARD EXCLUSION は 2.19A で不変', () => {
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

  it('EZ: From-Now-to-Table は 2.19A で不変（呼んでも recipe を変えない）', () => {
    const before = recipe('tori-teriyaki').cookingTimeMinutes
    const result = deriveFromNowToTable(
      { mealId: 'x', requiredComponents: ['chicken'], tasks: [] },
      { componentStates: { chicken: 'unknown' } },
    )
    expect(result.kind).toBe('unresolved')
    expect(recipe('tori-teriyaki').cookingTimeMinutes).toBe(before)
  })
})
