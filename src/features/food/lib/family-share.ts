// ============================================================
// family-share.ts
//
// MISSION 2.12 PHASE A — Family Share MVP。
//
// LINE専用実装にしない。Web Share API（navigator.share）を第一候補とし、
// 使えない環境ではnavigator.clipboardへの文言コピーへfallbackする。
// どちらも使えない場合は'unavailable'を返し、呼び出し側が文言を画面上に
// 表示してユーザー自身にコピーしてもらう（最後の安全なfallback）。
//
// 絶対ルール:
// - 共有先・連絡先・送信結果の詳細は一切取得・保存しない
//   （navigator.share()のPromiseは成功/失敗のみを返し、相手の情報は
//   そもそも取得不可能であることを利用する）。
// - 共有文にEvidence未確認Recipeを「安全」「検証済み」「根拠あり」等と
//   断定する表現を含めない。
// - 共有URLは実在するroute（/food）のみを使う。存在しないURLを作らない。
// ============================================================

export interface ShareCandidateInput {
  title: string
  estimatedMinutes?: number | null
}

const SHARE_URL = 'https://nukitoru.pages.dev/food'

/**
 * 候補単体の共有文を組み立てる。テンプレートは1種類のみ。
 * Evidence状態（VERIFIED/REVIEW/UNVERIFIED）に関する断定表現は含めない。
 */
export function buildCandidateShareText(input: ShareCandidateInput): string {
  const lines = ['今日これどう？', '', input.title]
  if (input.estimatedMinutes != null) {
    lines.push(`約${input.estimatedMinutes}分`)
  }
  lines.push('', 'NUKITORU FOOD', SHARE_URL)
  return lines.join('\n')
}

export type ShareOutcome = 'shared' | 'copied' | 'unavailable' | 'cancelled'

/**
 * Web Share API → clipboard → unavailable の順でfallbackする。
 * 将来LINE/WhatsApp/Messenger等、特定channel専用の実装を追加する必要が
 * ないよう、OSのShare Sheetへ委譲するだけの channel-neutral な設計とする。
 */
export async function shareCandidate(input: ShareCandidateInput): Promise<ShareOutcome> {
  const text = buildCandidateShareText(input)

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'NUKITORU FOOD', text })
      return 'shared'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'cancelled'
      }
      // Web Share自体が失敗した場合はclipboard fallbackへ進む
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return 'copied'
    } catch {
      return 'unavailable'
    }
  }

  return 'unavailable'
}
