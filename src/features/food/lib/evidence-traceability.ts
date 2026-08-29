// ============================================================
// evidence-traceability.ts
//
// MISSION 2.17 Part A — Evidence Traceability / Mutable Source。
//
// 実際の Recipe Resolution（MISSION 2.16 Batch 2）で、既に引用済みの
// DELISH KITCHEN のURLの掲載内容が後日変わっていた（味噌量・みりん・
// にんにく・監修者の追加）ことが判明した。URLの存在は「NUKITORUが
// 何を確認したか」の証明にならない。
//
// このモジュールは最小限の変更検出のみを提供する:
//   - 実際に本文を確認したときの観測（fingerprint + 日付）を記録できる
//   - 同一URLで後日 fingerprint が変われば「内容が変わった」と検出できる
//   - fingerprint 未設定は「legacy / 不明」であって「unchanged」ではない
//   - reverifyAfter に照らして再確認が必要かを判定できる
//
// 絶対ルール:
// - contentFingerprint は「NUKITORUが依拠した事実」を要約した NUKITORU 自作の
//   正規化文字列の SHA-256 であり、source 本文の複製ではない。source 本文は
//   ハッシュもしないし保存もしない。
// - SHA-256 fingerprint は Evidence の品質・情報源の権威・掲載内容の真正性・
//   レシピの正しさ・レシピの安全性・RecipeVerificationStatus・VERIFIED 適格性を
//   一切証明しない。提供するのは「NUKITORUが観測時に記録した事実表現」に対する
//   強い決定論的識別子だけ。検出できるのは「今観測した内容が、以前記録した内容と
//   同じ/違う」ということのみ（change detection / traceability であって Evidence
//   そのものではない）。
// - HUMAN-SUMMARY LIMITATION: 人間が書いた観測サマリが不完全なら、fingerprint は
//   「そもそも記録されなかった事実」の変化を検出できない。したがって fingerprint の
//   品質は観測（記録）の網羅性に依存する。将来は自由記述サマリではなく
//   「観測した critical fact の構造化」へ進む余地があるが、本 MISSION では作らない。
// - source が変わっても Recipe fact は自動的に書き換わらない。conflict も
//   coherence も自動解決しない。ここでは「検出可能にする」だけ。
// - cron / scheduler / background job / crawler / 通知UI は作らない。
// - 全 source へ一律の再確認間隔を課さない（reverifyAfter は source ごと・任意）。
// ============================================================

import { createHash } from 'node:crypto'
import type { EvidenceSourceObservation } from '@/features/food/types'

/**
 * 観測サマリの正規化: `|` 区切りのトークン集合として扱う。
 * - 各トークンを trim / 連続空白を1つに / 小文字化
 * - 空トークンを除去
 * - トークンを昇順ソート（観測事実の「並び順」の違いで別物にしない）
 * - `|` で再結合
 *
 * これにより「豚肉200g|味噌大さじ1」と「味噌大さじ1 | 豚肉200g」は同一指紋になる。
 */
export function normalizeObservationSummary(summary: string): string {
  return summary
    .split('|')
    .map((token) => token.trim().replace(/\s+/g, ' ').toLowerCase())
    .filter((token) => token.length > 0)
    .sort()
    .join('|')
}

/**
 * 決定論的なコンテンツ指紋。変更検出 / traceability 用であって Evidence ではない。
 *
 * 正規化した観測サマリ（NUKITORU 自作。source 本文ではない）の SHA-256 を
 * 64 桁の小文字16進で返す。同一入力（正規化後）→ 常に同一出力。
 *
 * MISSION 2.17A: 旧実装（FNV-1a ⊕ djb2 / 16 hex）から SHA-256 へ強化。
 * node:crypto の同期 createHash を使用（このモジュールは client bundle から
 * 参照されておらず、Node/テスト環境でのみ動く）。SHA-256 のためだけの
 * 外部依存は追加していない。
 */
export function computeContentFingerprint(observedSummary: string): string {
  const normalized = normalizeObservationSummary(observedSummary)
  return createHash('sha256').update(normalized, 'utf8').digest('hex')
}

export type SourceChangeStatus =
  | 'unchanged' // 記録済み fingerprint と今回の fingerprint が一致
  | 'changed' // 記録済み fingerprint と今回の fingerprint が不一致（要 REVIEW）
  | 'unknown-legacy' // 記録済み observation が無い、または今回の fingerprint が無い

/**
 * 記録済みの observation と、今回観測した内容の fingerprint を比較する。
 *
 * - unchanged: 内容が変わっていないことだけを示す（真正性・品質は示さない）
 * - changed:   内容が変わったので人間の再確認が必要。Recipe fact は自動変更しない
 * - unknown-legacy: 比較できない（初回未記録 or 今回未観測）。「unchanged」ではない
 */
export function classifySourceChange(
  recorded: EvidenceSourceObservation | undefined,
  currentFingerprint: string | undefined,
): SourceChangeStatus {
  if (!recorded?.contentFingerprint || !currentFingerprint) return 'unknown-legacy'
  return recorded.contentFingerprint === currentFingerprint ? 'unchanged' : 'changed'
}

/**
 * source drift の結果として「人間の再確認が必要か」を返す純粋な判定。
 * `changed` のときだけ true。`unchanged` / `unknown-legacy` は
 * このモジュールでは false（legacy は別途 needsReverification で扱う）。
 *
 * この関数は Recipe fact・conflict・coherence・status を一切変更しない。
 */
export function sourceChangeRequiresReview(status: SourceChangeStatus): boolean {
  return status === 'changed'
}

/**
 * reverifyAfter に照らして再確認期日を過ぎているか。
 * - observation が無い or reverifyAfter が無い → false
 *   （「普遍的な再確認間隔」を勝手に定義しない。期日未設定なら催促しない）
 * - asOf >= reverifyAfter → true
 */
export function needsReverification(
  observation: EvidenceSourceObservation | undefined,
  asOf: string,
): boolean {
  if (!observation?.reverifyAfter) return false
  return asOf >= observation.reverifyAfter
}

/**
 * 既存 observation に「再確認した」記録を足した新しい observation を返す。
 * fingerprint が変わっていれば新しい fingerprint を採用しつつ lastReverifiedAt を更新する。
 * 元のオブジェクトは変更しない（Recipe fact も当然変更しない）。
 */
export function withReverification(
  observation: EvidenceSourceObservation,
  reverifiedAt: string,
  currentFingerprint: string,
): EvidenceSourceObservation {
  return {
    ...observation,
    contentFingerprint: currentFingerprint,
    lastReverifiedAt: reverifiedAt,
  }
}
