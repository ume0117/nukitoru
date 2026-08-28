import { describe, it, expect } from 'vitest'
import { canonicalizeIngredientName, isSameIngredient } from '../ingredient-normalization'

describe('ingredient-normalization.ts', () => {
  it('A1: "マグロ" → "マグロ"', () => {
    expect(canonicalizeIngredientName('マグロ')).toBe('マグロ')
  })

  it('A2: "まぐろ" → "マグロ"', () => {
    expect(canonicalizeIngredientName('まぐろ')).toBe('マグロ')
  })

  it('A3: "鮪" → "マグロ"', () => {
    expect(canonicalizeIngredientName('鮪')).toBe('マグロ')
  })

  it('A4: "海苔"/"ノリ"/"のり" → 同一canonical', () => {
    const a = canonicalizeIngredientName('海苔')
    const b = canonicalizeIngredientName('ノリ')
    const c = canonicalizeIngredientName('のり')
    expect(a).toBe(b)
    expect(b).toBe(c)
    expect(a).toBe('のり')
  })

  it('A5: "たまご"/"玉子"/"卵" → 卵', () => {
    expect(canonicalizeIngredientName('たまご')).toBe('卵')
    expect(canonicalizeIngredientName('玉子')).toBe('卵')
    expect(canonicalizeIngredientName('卵')).toBe('卵')
  })

  it('A6: trim / 前後の空白を除去して同一視する', () => {
    expect(canonicalizeIngredientName('  マグロ  ')).toBe('マグロ')
    expect(canonicalizeIngredientName('\tまぐろ\n')).toBe('マグロ')
  })

  it('A7: 未知食材は勝手に別食材へ変換しない（trimのみ）', () => {
    expect(canonicalizeIngredientName('パクチー')).toBe('パクチー')
    expect(canonicalizeIngredientName('  ズッキーニ  ')).toBe('ズッキーニ')
  })

  it('A8: 豚バラ/豚ひき肉等、意味の異なる食材を過度に同一視しない', () => {
    expect(canonicalizeIngredientName('豚バラ')).toBe('豚バラ')
    expect(canonicalizeIngredientName('豚ロース')).toBe('豚ロース')
    expect(canonicalizeIngredientName('豚ひき肉')).toBe('豚ひき肉')
    // 豚こま/豚こま切れのみ豚肉へ正規化され、他の部位名は別物のまま
    expect(canonicalizeIngredientName('豚こま')).toBe('豚肉')
    expect(canonicalizeIngredientName('豚バラ')).not.toBe(canonicalizeIngredientName('豚こま'))
  })

  it('A9: allergy側とrecipe側の入力が同じcanonicalization結果になる（isSameIngredient）', () => {
    // ユーザーが「たまご」とアレルギー登録、レシピ側は「卵」を要求していても
    // 同一食材として判定できなければならない
    expect(isSameIngredient('たまご', '卵')).toBe(true)
    expect(isSameIngredient('海苔', 'ノリ')).toBe(true)
    expect(isSameIngredient('マグロ', 'サーモン')).toBe(false)
  })
})

describe('ingredient-normalization.ts — PHASE C.1 英語食材入力対応', () => {
  it('"tuna" → マグロ', () => {
    expect(canonicalizeIngredientName('tuna')).toBe('マグロ')
  })

  it('"egg" → 卵', () => {
    expect(canonicalizeIngredientName('egg')).toBe('卵')
  })

  it('"tofu" → 豆腐', () => {
    expect(canonicalizeIngredientName('tofu')).toBe('豆腐')
  })

  it('"salmon" → 鮭', () => {
    expect(canonicalizeIngredientName('salmon')).toBe('鮭')
  })

  it('"chicken" → 鶏肉', () => {
    expect(canonicalizeIngredientName('chicken')).toBe('鶏肉')
  })

  it('"beef" / "pork" / "rice" も対応する主要食材のcanonicalに変換される', () => {
    expect(canonicalizeIngredientName('beef')).toBe('牛肉')
    expect(canonicalizeIngredientName('pork')).toBe('豚肉')
    expect(canonicalizeIngredientName('rice')).toBe('米')
  })

  it('"cabbage"/"onion"/"carrot"/"potato"/"mushroom"/"natto"/"udon"/"pasta"/"milk" も対応する', () => {
    expect(canonicalizeIngredientName('cabbage')).toBe('キャベツ')
    expect(canonicalizeIngredientName('onion')).toBe('玉ねぎ')
    expect(canonicalizeIngredientName('carrot')).toBe('にんじん')
    expect(canonicalizeIngredientName('potato')).toBe('じゃがいも')
    expect(canonicalizeIngredientName('mushroom')).toBe('きのこ')
    expect(canonicalizeIngredientName('natto')).toBe('納豆')
    expect(canonicalizeIngredientName('udon')).toBe('うどん')
    expect(canonicalizeIngredientName('pasta')).toBe('パスタ')
    expect(canonicalizeIngredientName('milk')).toBe('牛乳')
  })

  it('"nori" / "seaweed" → のり', () => {
    expect(canonicalizeIngredientName('nori')).toBe('のり')
    expect(canonicalizeIngredientName('seaweed')).toBe('のり')
  })

  it('表記体系: マグロ/まぐろ/鮪/tuna が全て同一canonicalになる', () => {
    const forms = ['マグロ', 'まぐろ', '鮪', 'tuna']
    const canonicals = forms.map(canonicalizeIngredientName)
    expect(new Set(canonicals).size).toBe(1)
    expect(canonicals[0]).toBe('マグロ')
  })

  it('表記体系: 卵/たまご/玉子/egg が全て同一canonicalになる', () => {
    const forms = ['卵', 'たまご', '玉子', 'egg']
    const canonicals = forms.map(canonicalizeIngredientName)
    expect(new Set(canonicals).size).toBe(1)
  })

  it('C19: 未知の英単語は勝手に既存食材へ変換しない（trimのみ）', () => {
    expect(canonicalizeIngredientName('cilantro')).toBe('cilantro')
    expect(canonicalizeIngredientName('  zucchini  ')).toBe('zucchini')
  })

  it('C24: "ground pork" 等は通常のporkへ潰さない（意図しない同一視をしていない）', () => {
    expect(canonicalizeIngredientName('ground pork')).toBe('ground pork')
    expect(canonicalizeIngredientName('pork belly')).toBe('pork belly')
    expect(canonicalizeIngredientName('ground pork')).not.toBe(canonicalizeIngredientName('pork'))
    expect(canonicalizeIngredientName('pork belly')).not.toBe(canonicalizeIngredientName('pork'))
  })

  it('アレルギーとの共有確認: allergy="egg" と recipe側"卵"が同一canonicalになる（isSameIngredient）', () => {
    expect(isSameIngredient('egg', '卵')).toBe(true)
    expect(isSameIngredient('tuna', 'マグロ')).toBe(true)
  })
})
