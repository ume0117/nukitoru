// ============================================================
// ingredient-normalization.ts
//
// 食材名の正規化・canonicalization（表記ゆれ吸収）を一箇所に集約する。
// 料理検索・アレルギー判定・recipe validationのすべてが必ずこの実装だけを
// 経由する（バラバラのnormalize実装を増やさない）。
//
// 安全上の絶対ルール:
// - fuzzy matching（編集距離・AI類似判定・部分一致による自動同一視）は禁止。
//   使うのは人間が確認した明示的なsynonym辞書のみ。
// - 辞書にない食材は勝手に他の食材へ変換しない（trimのみ行い、そのまま返す）。
// - 「豚バラ/豚ロース/豚ひき肉」のように、料理として意味が異なる食材まで
//   広く同一視するcanonical化はしない（辞書に意図的に含めない）。
// - ユーザーのアレルギー登録名とrecipe側の食材名は、必ず同じ
//   canonicalizeIngredientName() を通してから比較する
//   （検索用とアレルギー用でnormalizeを分けない）。
// ============================================================

function normalize(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * 明示的なsynonym辞書（人間が確認した最小限のエントリのみ）。
 * key = normalize(表記ゆれ), value = canonical名（このアプリで通常使う表記）。
 * 「料理として代替可能かどうか」を考えずに広すぎるcanonical化をしない。
 * 例えば豚バラ・豚ロース・豚ひき肉は意図的にこの辞書へ含めない。
 */
const INGREDIENT_SYNONYMS: Record<string, string> = {
  [normalize('マグロ')]: 'マグロ',
  [normalize('まぐろ')]: 'マグロ',
  [normalize('鮪')]: 'マグロ',
  [normalize('tuna')]: 'マグロ',

  [normalize('のり')]: 'のり',
  [normalize('海苔')]: 'のり',
  [normalize('ノリ')]: 'のり',
  [normalize('nori')]: 'のり',
  [normalize('seaweed')]: 'のり',

  [normalize('卵')]: '卵',
  [normalize('たまご')]: '卵',
  [normalize('玉子')]: '卵',
  [normalize('egg')]: '卵',

  // 「pork」は一般的な豚肉を指す場合のみここへ含める。
  // 「pork belly」「ground pork」等、料理上意味が異なる部位・挽き肉は
  // 意図的にこの辞書へ含めない（日本語の豚バラ・豚ひき肉と同様）。
  [normalize('豚肉')]: '豚肉',
  [normalize('豚こま')]: '豚肉',
  [normalize('豚こま切れ')]: '豚肉',
  [normalize('pork')]: '豚肉',

  [normalize('豆腐')]: '豆腐',
  [normalize('とうふ')]: '豆腐',
  [normalize('tofu')]: '豆腐',

  [normalize('鮭')]: '鮭',
  [normalize('さけ')]: '鮭',
  [normalize('サケ')]: '鮭',
  [normalize('salmon')]: '鮭',

  [normalize('鶏肉')]: '鶏肉',
  [normalize('chicken')]: '鶏肉',

  [normalize('牛肉')]: '牛肉',
  [normalize('beef')]: '牛肉',

  // MISSION 2.11 PHASE D.2 — 米（生米・要炊飯）とごはん（炊飯済み）は
  // 料理として明確に別物のため、意図的に別canonicalとして扱う。
  // 「米」を入力したユーザーへ炊飯済み前提の短時間レシピを出さない。
  [normalize('米')]: '米',
  // 英語の rice は文脈依存性が高いが、bare wordは原則「米」側へ寄せる
  // （炊飯済み扱いへ安易に倒さない、という保守的な判断）。
  [normalize('rice')]: '米',

  [normalize('ごはん')]: 'ごはん',
  [normalize('ご飯')]: 'ごはん',
  [normalize('炊いたごはん')]: 'ごはん',
  [normalize('炊いたご飯')]: 'ごはん',
  [normalize('cooked rice')]: 'ごはん',
  [normalize('steamed rice')]: 'ごはん',

  [normalize('キャベツ')]: 'キャベツ',
  [normalize('cabbage')]: 'キャベツ',

  [normalize('玉ねぎ')]: '玉ねぎ',
  [normalize('たまねぎ')]: '玉ねぎ',
  [normalize('onion')]: '玉ねぎ',

  [normalize('にんじん')]: 'にんじん',
  [normalize('人参')]: 'にんじん',
  [normalize('carrot')]: 'にんじん',

  [normalize('じゃがいも')]: 'じゃがいも',
  [normalize('ジャガイモ')]: 'じゃがいも',
  [normalize('potato')]: 'じゃがいも',

  [normalize('きのこ')]: 'きのこ',
  [normalize('キノコ')]: 'きのこ',
  [normalize('mushroom')]: 'きのこ',

  [normalize('納豆')]: '納豆',
  [normalize('natto')]: '納豆',

  [normalize('うどん')]: 'うどん',
  [normalize('udon')]: 'うどん',

  [normalize('パスタ')]: 'パスタ',
  [normalize('pasta')]: 'パスタ',

  [normalize('牛乳')]: '牛乳',
  [normalize('milk')]: '牛乳',
}

/**
 * 入力文字列をcanonical ingredient nameへ変換する。
 * 辞書に存在しない食材は、trimのみ行った元の文字列をそのまま返す
 * （未知の食材を勝手に別の食材へ変換しない）。
 */
export function canonicalizeIngredientName(raw: string): string {
  const key = normalize(raw)
  return INGREDIENT_SYNONYMS[key] ?? raw.trim()
}

/**
 * 2つの食材名が同一のcanonical ingredientを指すかどうかを判定する。
 * 料理検索・アレルギー判定の両方でこの関数を使うことで、
 * 「たまご」と「卵」のような表記ゆれが原因でアレルギー判定を
 * すり抜けることを防ぐ。
 */
export function isSameIngredient(a: string, b: string): boolean {
  return canonicalizeIngredientName(a) === canonicalizeIngredientName(b)
}
