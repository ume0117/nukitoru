// ============================================================
// completion-photo.ts
//
// MISSION 2.40B — 完成写真 metadata の純粋関数群（**画像 binary を扱わない**）。
//
// 絶対ルール:
// - Completion Photo ≠ Recipe Evidence ≠ Rights permission ≠ commercial reuse permission。
// - 写真保存 ≠ 公開許可 ≠ SNS 共有 ≠ 分析許可 ≠ AI 学習許可（すべて別 flag）。
// - consent の default は必ず 'not-granted'（安全側）。単一 flag にまとめない。
// - visibility の default は必ず 'private'。写真を追加しただけで public にならない。
// - 画像そのもの（バイナリ）を永続保存しない。位置情報メタデータを抽出・保存しない。
// - AI による写真の解析・自動判定・採点・食材推定・味の評価をしない。
// - server upload / cloud storage / image CDN を作らない。
// - Firewall: このモジュールは ai-provider / recipe-* / world-recipe-import を import しない。
// ============================================================

import type {
  CompletionPhotoMetadata,
  ConsentState,
  PhotoConsentState,
  PhotoVisibility,
} from '@/features/food/types'

/** 写真の default 可視範囲。必ず private */
export function defaultPhotoVisibility(): PhotoVisibility {
  return 'private'
}

const NOT_GRANTED: ConsentState = 'not-granted'

/**
 * 写真の consent 状態を作る。**すべて default 'not-granted'**。
 * 個別に明示的な override を渡した項目だけが変わる（単一 flag にまとめない）。
 */
export function createPhotoConsentState(
  now: string,
  overrides: Partial<Omit<PhotoConsentState, 'recordedAt'>> = {},
): PhotoConsentState {
  return {
    publicationConsent: overrides.publicationConsent ?? NOT_GRANTED,
    serviceImprovementConsent: overrides.serviceImprovementConsent ?? NOT_GRANTED,
    aggregateAnalyticsConsent: overrides.aggregateAnalyticsConsent ?? NOT_GRANTED,
    aiTrainingConsent: overrides.aiTrainingConsent ?? NOT_GRANTED,
    recordedAt: now,
  }
}

/** すべての consent が 'not-granted' か（＝一切許可されていない安全な初期状態） */
export function isFullyUnconsented(consent: PhotoConsentState): boolean {
  return (
    consent.publicationConsent === NOT_GRANTED &&
    consent.serviceImprovementConsent === NOT_GRANTED &&
    consent.aggregateAnalyticsConsent === NOT_GRANTED &&
    consent.aiTrainingConsent === NOT_GRANTED
  )
}

export interface CreateCompletionPhotoInput {
  cookedMealRecordId: string
  /** session 内のローカル参照（blob: URL 等）。永続化しない */
  localReference?: string
  mimeType?: string
  width?: number
  height?: number
  /** 端末が渡す撮影/選択日時。写真ファイル内のメタデータ由来ではない */
  capturedAt?: string
}

/** id は (now, cookedMealRecordId) から決定論的に導出 */
function derivePhotoId(now: string, cookedMealRecordId: string): string {
  return `cph_${now.replace(/[^0-9]/g, '')}_${cookedMealRecordId}`
}

/**
 * 完成写真 metadata を作る純粋関数。
 * - visibility は必ず 'private'（引数で public を受け取らない）。
 * - consent は必ず全項目 'not-granted'。
 * - localReference は渡されたものをそのまま持つ（session 内のみ）。
 * - **画像そのもの（バイナリ）は持たない**。
 */
export function createCompletionPhotoMetadata(
  input: CreateCompletionPhotoInput,
  options: { now?: string; id?: string } = {},
): CompletionPhotoMetadata {
  const now = options.now ?? new Date().toISOString()
  return {
    id: options.id ?? derivePhotoId(now, input.cookedMealRecordId),
    cookedMealRecordId: input.cookedMealRecordId,
    ...(input.localReference !== undefined ? { localReference: input.localReference } : {}),
    ...(input.mimeType !== undefined ? { mimeType: input.mimeType } : {}),
    ...(input.width !== undefined ? { width: input.width } : {}),
    ...(input.height !== undefined ? { height: input.height } : {}),
    ...(input.capturedAt !== undefined ? { capturedAt: input.capturedAt } : {}),
    createdAt: now,
    visibility: 'private',
    consent: createPhotoConsentState(now),
  }
}

/** 永続化前に localReference を必ず除去する（blob: URL は session を跨がない・binary を保存しない） */
export function stripLocalReferenceForPersistence(
  meta: CompletionPhotoMetadata,
): Omit<CompletionPhotoMetadata, 'localReference'> {
  const { localReference: _omit, ...rest } = meta
  return rest
}

/**
 * blob: object URL を revoke する副作用ヘルパー（UI の cleanup 用）。
 * blob: 以外（data: や http: 等）は何もしない。純粋ではないが binary は扱わない。
 */
export function revokeObjectUrlReference(localReference: string | undefined): void {
  if (typeof localReference !== 'string') return
  if (!localReference.startsWith('blob:')) return
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(localReference)
  }
}

/** localReference を差し替えた新しい metadata を返す（写真の選び直し・削除用・非破壊） */
export function replacePhotoLocalReference(
  meta: CompletionPhotoMetadata,
  nextLocalReference: string | undefined,
  nextMimeType?: string,
): CompletionPhotoMetadata {
  const { localReference: _drop, ...rest } = meta
  return {
    ...rest,
    ...(nextLocalReference !== undefined ? { localReference: nextLocalReference } : {}),
    ...(nextMimeType !== undefined
      ? { mimeType: nextMimeType }
      : meta.mimeType !== undefined
        ? { mimeType: meta.mimeType }
        : {}),
  }
}

/**
 * Firewall: 写真を選択しても Share 本文へ勝手に含めない。
 * この関数は「写真の存在が share text に影響しない」ことを型で示すための no-op boundary。
 * 写真つき Share は将来、ユーザーが明示的に選択した場合にのみ別途実装する。
 */
export function photoIsExcludedFromShareText(): true {
  return true
}
