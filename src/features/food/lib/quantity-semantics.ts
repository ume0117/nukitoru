// ============================================================
// quantity-semantics.ts
//
// MISSION 2.17 Part B — Quantity Semantics Foundation。
//
// 食材・調味料の分量は必ずしも exact number ではない。実際の Recipe
// Resolution（MISSION 2.16）で、hiyayakko の「しょうゆ 適量」、
// maguro-don の「食卓で各自が使う」しょうゆ、shio-musubi/onigiri-nori の
// 「塩 ひとつまみ」など、数値化できない/すべきでない分量が繰り返し現れた。
//
// このモジュールは表示テキストと意味論を分離して扱うための最小限の
// helper のみを提供する。
//
// 絶対ルール:
// - displayText（ユーザーが見る文字列）は常に保持する。semantics は
//   別レイヤー。displayText から semantics を勝手に推論しない
//   （no regex / no AI / no fuzzy inference。明示的にしか作らない）。
// - 「ひとつまみ」≠「適量」、「少々」≠ 数値range、「お好みで」= ユーザー選択、
//   「optional」= 省略可、「unknown」= 不明。これらは型として区別されたまま。
// - semantics は Evidence を生まない。unknown からより具体的な意味へ変えるには
//   それを裏付ける evidenceSourceIds が必須（下記 refineFromUnknown）。
// - range を midpoint 化しない。approximate を exact 化しない。
// - 既存 44 Recipe の amount 文字列は移行しない（このモジュールは触れない）。
// ============================================================

import type { QuantitySemantics, QuantityStatement } from '@/features/food/types'

/** kind が 'unknown' 以外（何らかの意味が確定しているか） */
export function isKnownQuantity(q: QuantitySemantics): boolean {
  return q.kind !== 'unknown'
}

/** 数値として解釈できる意味か（exact / range / approximate） */
export function isNumericQuantity(q: QuantitySemantics): boolean {
  return q.kind === 'exact' || q.kind === 'range' || q.kind === 'approximate'
}

/** ユーザーの選択・調整に委ねられる意味か（to-taste / optional） */
export function isUserDiscretionQuantity(q: QuantitySemantics): boolean {
  return q.kind === 'to-taste' || q.kind === 'optional'
}

/**
 * 保守的フィルタ用の上限値（recipe-time.ts の resolvedUpperBoundMinutes と同じ思想）。
 * - exact:       その値
 * - range:       max（midpoint も min も使わない）
 * - approximate: null（既定で自動的に上限扱いしない）
 * - to-taste / optional / unknown / culinary-term: null
 */
export function quantityUpperBound(q: QuantitySemantics): number | null {
  switch (q.kind) {
    case 'exact':
      return q.value
    case 'range':
      return q.max
    case 'approximate':
    case 'to-taste':
    case 'optional':
    case 'unknown':
    case 'culinary-term':
      return null
  }
}

/**
 * 2つの QuantitySemantics が構造的に等しいか。
 * range を「代表値が同じなら等しい」とはしない（min/max の一致が必要）。
 */
export function quantitiesEqual(a: QuantitySemantics, b: QuantitySemantics): boolean {
  if (a.kind !== b.kind) return false
  switch (a.kind) {
    case 'exact':
      return b.kind === 'exact' && a.value === b.value && a.unit === b.unit
    case 'approximate':
      return b.kind === 'approximate' && a.value === b.value && a.unit === b.unit
    case 'range':
      return b.kind === 'range' && a.min === b.min && a.max === b.max && a.unit === b.unit
    case 'culinary-term':
      return b.kind === 'culinary-term' && a.term === b.term
    case 'to-taste':
    case 'optional':
    case 'unknown':
      return true
  }
}

/**
 * semantics を人間が読める短い説明にする（将来の「なぜこの分量？」UI 用の素材）。
 * NUKITORU 自作の説明であり、source 本文の複製ではない。
 */
export function describeQuantitySemantics(q: QuantitySemantics): string {
  switch (q.kind) {
    case 'exact':
      return `情報源が単一の数値を明示: ${q.value}${q.unit}`
    case 'range':
      return `情報源が範囲を明示: ${q.min}〜${q.max}${q.unit}（代表値へ収縮させない）`
    case 'approximate':
      return `情報源が概数を示す: 約${q.value}${q.unit}（exact ではない）`
    case 'to-taste':
      return '適量・お好みで（作り手が調整する。NUKITORU は数値化していない）'
    case 'optional':
      return '入れなくてよい（省略が許容される）'
    case 'unknown':
      return 'NUKITORU は根拠を確認できていない（推測で埋めない）'
    case 'culinary-term':
      return `情報源自身が「${q.term}」という表現を使っている（NUKITORU は g へ変換していない）`
  }
}

/**
 * MISSION 2.17 Part B の firewall。
 *
 * semantics を `unknown` からより具体的な意味へ変更するには、それを裏付ける
 * evidenceSourceIds が非空でなければならない。裏付けの無い変更は null（＝拒否）。
 *
 * これにより「unknown → to-taste」「unknown → exact」等が Evidence 無しに
 * 起きること（semantics が Evidence を捏造すること）を構造的に防ぐ。
 * proposed 自体が 'unknown' の場合はそのまま返す（no-op は許可）。
 */
export function refineFromUnknown(
  proposed: QuantitySemantics,
  evidenceSourceIds: readonly string[],
): QuantitySemantics | null {
  if (proposed.kind === 'unknown') return proposed
  if (evidenceSourceIds.length === 0) return null
  return proposed
}

/**
 * QuantityStatement を組み立てる。displayText は必須で常に保持される。
 * semantics が 'unknown' 以外なのに evidenceSourceIds が空の場合でも
 * 生成は許可する（「意味論は記録したが Evidence 未裏付け」という
 * 正当な中間状態のため）。ただし後から unknown を脱するには
 * refineFromUnknown を通す必要がある。
 */
export function makeQuantityStatement(
  displayText: string,
  semantics: QuantitySemantics,
  options: { evidenceSourceIds?: string[]; rationale?: string } = {},
): QuantityStatement {
  return {
    displayText,
    semantics,
    ...(options.evidenceSourceIds ? { evidenceSourceIds: options.evidenceSourceIds } : {}),
    ...(options.rationale ? { rationale: options.rationale } : {}),
  }
}

/**
 * QuantityStatement の semantics が Evidence で裏付けられているか。
 * 「意味論の記録」と「Evidence による裏付け」は別物、という区別を明示する。
 */
export function statementHasEvidence(statement: QuantityStatement): boolean {
  return (statement.evidenceSourceIds ?? []).length > 0
}
