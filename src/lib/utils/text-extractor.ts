/**
 * text-extractor.ts
 *
 * PDF・画像のテキストレイヤーから
 * JAN コード・URL・メール・電話番号を正規表現で抽出する。
 *
 * 対象：
 * - サンワサプライ型：(4969887595664) のようにカッコ付きで記載
 * - エレコム型：4580333622996 のように13桁数字がそのまま記載
 * - URL・メール・電話番号（テキスト記載のもの）
 */

import { generateId } from '@/lib/utils/dedup'
import type { ScanResult } from '@/types'

// ============================================================
// JAN コード抽出
// ============================================================

/**
 * JAN コード（EAN-13）の判定：
 * - 13桁の数字
 * - 先頭が 45 または 49（日本のJANコード）
 * - カッコ付き (4969887595664) も対応
 * - チェックデジット検証で精度を上げる
 */
function isValidJAN(digits: string): boolean {
  if (digits.length !== 13) return false
  if (!/^\d{13}$/.test(digits)) return false
  // 日本のJANコードは 45 または 49 始まりに限定（誤検出防止）
  if (!digits.startsWith('45') && !digits.startsWith('49')) return false

  // EAN-13 チェックデジット検証
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * (i % 2 === 0 ? 1 : 3)
  }
  const check = (10 - (sum % 10)) % 10
  return check === parseInt(digits[12])
}

export function extractJANFromText(text: string): string[] {
  const found = new Set<string>()

  // カッコ付き形式：(4969887595664) または （4969887595664）
  const bracketPattern = /[（(]\s*(\d{13})\s*[）)]/g
  let m = bracketPattern.exec(text)
  while (m) {
    if (isValidJAN(m[1])) found.add(m[1])
    m = bracketPattern.exec(text)
  }

  // 単独の13桁数字（スペースや改行で区切られているもの）
  const standalonePattern = /(?<![0-9])(\d{13})(?![0-9])/g
  let m2 = standalonePattern.exec(text)
  while (m2) {
    if (isValidJAN(m2[1])) found.add(m2[1])
    m2 = standalonePattern.exec(text)
  }

  return Array.from(found)
}

// ============================================================
// URL 抽出
// ============================================================

export function extractURLsFromText(text: string): string[] {
  const found = new Set<string>()
  const pattern = /https?:\/\/[^\s\u3000\u3001\u3002\uff0c\uff0e）)】\]」』]+/g
  let m = pattern.exec(text)
  while (m) {
    // 末尾の句読点や括弧を除去
    const url = m[0].replace(/[.,!?）)】\]」』]+$/, '')
    found.add(url)
    m = pattern.exec(text)
  }
  return Array.from(found)
}

// ============================================================
// メール抽出
// ============================================================

export function extractEmailsFromText(text: string): string[] {
  const found = new Set<string>()
  const pattern = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  let m = pattern.exec(text)
  while (m) {
    found.add(m[0])
    m = pattern.exec(text)
  }
  return Array.from(found)
}

// ============================================================
// 電話番号抽出（日本）
// ============================================================

export function extractPhonesFromText(text: string): string[] {
  const found = new Set<string>()
  // 固定電話・携帯・フリーダイヤル
  const patterns = [
    /0[789]0[-\s]?\d{4}[-\s]?\d{4}/g,          // 携帯
    /0120[-\s]?\d{3}[-\s]?\d{3}/g,              // フリーダイヤル
    /0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4}/g,       // 固定電話
    /\+81[-\s]?\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4}/g, // 国際
  ]
  for (const pattern of patterns) {
    let m = pattern.exec(text)
    while (m) {
      found.add(m[0])
      m = pattern.exec(text)
    }
  }
  return Array.from(found)
}

// ============================================================
// テキスト全体から全種類を一括抽出
// ============================================================

export function extractAllFromText(
  text: string,
  page?: number,
): ScanResult[] {
  const results: ScanResult[] = []

  // JAN コード
  for (const jan of extractJANFromText(text)) {
    results.push({
      id: generateId(),
      type: 'EAN_13',
      value: jan,
      page,
    })
  }

  // URL（QR_CODE 扱いで内容は URL）
  for (const url of extractURLsFromText(text)) {
    results.push({
      id: generateId(),
      type: 'QR_CODE',
      value: url,
      page,
    })
  }

  return results
}
