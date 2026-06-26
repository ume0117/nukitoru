/**
 * processor.ts
 * PDF.js を使って PDF を全ページ解析し、
 * ① バーコード画像スキャン
 * ② テキストレイヤーから JAN・URL 抽出
 * の両方を実行する。
 */

import type { ScanResult } from '@/types'
import { scanCanvas } from '@/lib/scanner/scanner'
import { deduplicateResults, generateId } from '@/lib/utils/dedup'

export type ProgressCallback = (
  current: number,
  total: number,
  message: string,
) => void

async function loadPdfJs() {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
  return pdfjsLib
}

/** EAN-13 チェックデジット検証 + 日本JANコード判定 */
function isValidEAN13(digits: string): boolean {
  if (!/^\d{13}$/.test(digits)) return false
  // 日本のJANコードは 45 または 49 始まり
  if (!digits.startsWith('45') && !digits.startsWith('49')) return false
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * (i % 2 === 0 ? 1 : 3)
  }
  return (10 - (sum % 10)) % 10 === parseInt(digits[12])
}

/** テキストから有効な JAN コードをすべて抽出する（最もシンプルな実装） */
function extractJANsFromRawText(text: string): string[] {
  const found = new Set<string>()
  // 13桁の数字をすべて抽出
  const matches = text.match(/\d{13}/g) ?? []
  for (const m of matches) {
    if (isValidEAN13(m)) found.add(m)
  }
  return Array.from(found)
}

/** テキストから URL を抽出する */
function extractURLsFromRawText(text: string): string[] {
  const found = new Set<string>()
  const pattern = /https?:\/\/[^\s\u3000\u3001\u3002\uff0c\uff0e）)】\]」』]+/g
  let m = pattern.exec(text)
  while (m) {
    const url = m[0].replace(/[.,!?）)】\]」』]+$/, '')
    found.add(url)
    m = pattern.exec(text)
  }
  return Array.from(found)
}

export async function processPdf(
  file: File,
  onProgress: ProgressCallback,
): Promise<ScanResult[]> {
  const pdfjsLib    = await loadPdfJs()
  const arrayBuffer = await file.arrayBuffer()
  const pdf         = await pdfjsLib.getDocument({
    data: arrayBuffer,
    // 日本語フォント（CMap）を CDN から読み込む
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
  }).promise
  const totalPages  = pdf.numPages

  onProgress(0, totalPages, `PDF 読み込み完了（全 ${totalPages} ページ）`)

  const allResults: ScanResult[] = []
  const canvas = document.createElement('canvas')
  const ctx    = canvas.getContext('2d')!

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress(pageNum, totalPages, `ページ ${pageNum} / ${totalPages} を解析中...`)

    const page     = await pdf.getPage(pageNum)
    const scale    = 3.0
    const viewport = page.getViewport({ scale })

    canvas.width  = viewport.width
    canvas.height = viewport.height

    await page.render({ canvasContext: ctx, viewport }).promise

    // ① バーコード画像スキャン
    const imageResults = await scanCanvas(canvas, pageNum)
    allResults.push(...imageResults)

    // ② テキストレイヤーから JAN・URL 抽出（シンプル実装）
    try {
      const textContent = await page.getTextContent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: string[] = textContent.items.map((item: any) => item.str ?? '')

      // スペースなし結合（カッコ内JAN対応）とスペースあり結合の両方を試す
      const rawText = items.join('') + ' ' + items.join(' ')

      // JAN コード抽出
      for (const jan of extractJANsFromRawText(rawText)) {
        allResults.push({ id: generateId(), type: 'EAN_13', value: jan, page: pageNum })
      }

      // URL 抽出
      for (const url of extractURLsFromRawText(rawText)) {
        allResults.push({ id: generateId(), type: 'QR_CODE', value: url, page: pageNum })
      }
    } catch (err) {
      console.warn(`ページ ${pageNum} のテキスト抽出をスキップ:`, err)
    }

    page.cleanup()
  }

  canvas.width  = 0
  canvas.height = 0

  onProgress(totalPages, totalPages, '解析完了')

  return deduplicateResults(allResults)
}
