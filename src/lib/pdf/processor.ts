/**
 * processor.ts
 * PDF.js を使って PDF を全ページ解析し、
 * ① バーコード画像スキャン
 * ② テキストレイヤーから JAN・URL 抽出
 * の両方を実行する。
 */

import type { ScanResult } from '@/types'
import { scanCanvas } from '@/lib/scanner/scanner'
import { deduplicateResults } from '@/lib/utils/dedup'
import { extractAllFromText } from '@/lib/utils/text-extractor'

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

export async function processPdf(
  file: File,
  onProgress: ProgressCallback,
): Promise<ScanResult[]> {
  const pdfjsLib    = await loadPdfJs()
  const arrayBuffer = await file.arrayBuffer()
  const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
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

    // ② テキストレイヤーから JAN・URL 抽出
    try {
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => item.str ?? '')
        .join(' ')
      const textResults = extractAllFromText(pageText, pageNum)
      allResults.push(...textResults)
    } catch {
      // テキストレイヤーがない場合はスキップ
    }

    page.cleanup()
  }

  canvas.width  = 0
  canvas.height = 0

  onProgress(totalPages, totalPages, '解析完了')

  return deduplicateResults(allResults)
}
