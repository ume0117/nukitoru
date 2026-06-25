/**
 * qr-content.ts
 *
 * QRコードの値から内容種別を判定し、URLの場合は注意喚起分析を行う。
 *
 * 重要方針：
 * - 安全判定・危険判定は一切行わない
 * - ユーザーが判断するための材料を提供するのみ
 * - 「安全です」「危険です」という表現は禁止
 */

import type { QRContentType, URLAnalysis, URLWarning } from '@/types'

// ============================================================
// QRコード内容種別の判定
// ============================================================

/**
 * QR_CODE フォーマットで検出された値の種別を判定する。
 * バーコードフォーマット（EAN_13 等）とは独立した判定。
 */
export function detectQRContentType(value: string): QRContentType {
  if (/^https?:\/\//i.test(value))    return 'URL'
  if (/^WIFI:/i.test(value))           return 'WIFI'
  if (/^BEGIN:VCARD/i.test(value))     return 'VCARD'
  if (/^mailto:/i.test(value))         return 'EMAIL'
  if (/^tel:/i.test(value))            return 'TEL'
  return 'TEXT'
}

// ============================================================
// QRコード内容種別ごとの表示定義
// ============================================================

export const QR_CONTENT_META: Record<QRContentType, {
  icon: string
  label: string
  canOpen: boolean
}> = {
  URL:   { icon: '🔗', label: 'URL',   canOpen: true  },
  WIFI:  { icon: '📶', label: 'WiFi設定', canOpen: false },
  VCARD: { icon: '👤', label: '連絡先',   canOpen: false },
  EMAIL: { icon: '📧', label: 'メール',   canOpen: false },
  TEL:   { icon: '📞', label: '電話番号', canOpen: false },
  TEXT:  { icon: '📄', label: 'テキスト', canOpen: false },
}

// ============================================================
// URL 注意喚起分析（安全判定ではない）
// ============================================================

/** 短縮URLサービスのドメイン一覧 */
const URL_SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd',
  'ow.ly', 'buff.ly', 'short.link', 'rb.gy', 'cutt.ly',
  'short.io', 'tiny.cc', 'lnkd.in', 'youtu.be',
])

/** 注意が必要な TLD 一覧 */
const SUSPICIOUS_TLDS = new Set([
  '.top', '.click', '.zip', '.review', '.country',
  '.work', '.gq', '.cf', '.tk', '.ml', '.ga',
  '.pw', '.rest', '.fit', '.date', '.racing',
])

/**
 * ドメイン名を URL から抽出する。
 * www. プレフィックスは除去して表示用に整形。
 */
export function extractDomain(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * URL の注意喚起分析を行う。
 *
 * 安全性の保証や危険性の断定は行わない。
 * ユーザーが判断するための材料を提供することが目的。
 */
export function analyzeURL(url: string): URLAnalysis {
  const domain = extractDomain(url)
  const warnings: URLWarning[] = []

  // 1. IP アドレス形式
  if (/^https?:\/\/\d{1,3}(\.\d{1,3}){3}(:\d+)?([/?#]|$)/.test(url)) {
    warnings.push({ type: 'ip', message: 'IPアドレス形式のURLです' })
  }

  // 2. Punycode（国際化ドメイン）
  if (domain.split('.').some(part => part.startsWith('xn--'))) {
    warnings.push({ type: 'punycode', message: '国際化ドメイン(Punycode)です' })
  }

  // 3. 短縮URL
  if (URL_SHORTENERS.has(domain)) {
    warnings.push({ type: 'shortener', message: '短縮URLです。遷移先を確認してください' })
  }

  // 4. 注意が必要な TLD
  const tldMatch = domain.match(/(\.[^.]+)$/)
  if (tldMatch && SUSPICIOUS_TLDS.has(tldMatch[1])) {
    warnings.push({ type: 'suspicious_tld', message: '注意が必要なドメイン形式です' })
  }

  // 5. 非常に長い URL
  if (url.length > 200) {
    warnings.push({ type: 'long_url', message: '非常に長いURLです' })
  }

  return { domain, warnings, hasWarnings: warnings.length > 0 }
}

// ============================================================
// 表示優先度（ソート用）
// ============================================================

/**
 * 結果カードの表示優先度を返す（数値が小さいほど上位）
 * URL > QR（その他）> JAN > EAN-8 > CODE128
 */
export function getResultPriority(
  type: string,
  value: string,
): number {
  if (type === 'QR_CODE') {
    const contentType = detectQRContentType(value)
    return contentType === 'URL' ? 0 : 1
  }
  if (type === 'EAN_13')  return 2
  if (type === 'EAN_8')   return 3
  if (type === 'CODE_128') return 4
  return 5
}
