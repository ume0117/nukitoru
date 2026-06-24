/**
 * processor.ts
 * PDF.js を使って PDF を全ページ解析し、各ページを Canvas にレンダリングして
 * バーコードスキャナーに渡す。
 *
 * - 動的インポート: ブラウザ専用 API のため SSR を回避
 * - 逐次処理: 大容量 PDF でもメモリ枯渇を防ぐ
 * - 2× スケール: バーコード検出精度向上
 */

import type { ScanResult } from '@/types'
import { scanCanvas } from '@/lib/scanner/scanner'
import { deduplicateResults } from '@/lib/utils/dedup'

export type ProgressCallback = (
  current: number,
  total: number,
  message: string,
) => void

/** PDF.js を動的インポートして Worker を CDN から設定する */
async function loadPdfJs() {
  const pdfjsLib = await import('pdfjs-dist')

  // Worker を unpkg CDN から取得（Vercel 無料プランで追加設定不要）
  // バージョンをインストール済み pdfjs-dist に固定してバージョン不一致を防ぐ
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

  return pdfjsLib
}

/**
 * PDF ファイルを全ページ解析してバーコード結果を返す。
 * @param file       ユーザーがアップロードした PDF File オブジェクト
 * @param onProgress ページごとの進捗コールバック
 */
export async function processPdf(
  file: File,
  onProgress: ProgressCallback,
): Promise<ScanResult[]> {
  const pdfjsLib = await loadPdfJs()

  // ArrayBuffer として読み込み（File API → pdfjs）
  const arrayBuffer = await file.arrayBuffer()
  const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const totalPages  = pdf.numPages

  onProgress(0, totalPages, `PDF 読み込み完了（全 ${totalPages} ページ）`)

  const allResults: ScanResult[] = []

  // Canvas を 1 枚だけ作成して各ページで再利用（メモリ効率化）
  const canvas = document.createElement('canvas')
  const ctx    = canvas.getContext('2d')!

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress(
      pageNum,
      totalPages,
      `ページ ${pageNum} / ${totalPages} を解析中...`,
    )

    const page = await pdf.getPage(pageNum)

    // 2.0 倍スケールで高解像度レンダリング（= 約 144 DPI 相当）
    const scale    = 2.0
    const viewport = page.getViewport({ scale })

    // Canvas をページサイズに合わせてリサイズ（前ページのピクセルは自動クリア）
    canvas.width  = viewport.width
    canvas.height = viewport.height

    await page.render({ canvasContext: ctx, viewport }).promise

    const pageResults = await scanCanvas(canvas, pageNum)
    allResults.push(...pageResults)

    // PDF.js の内部リソースを解放（メモリリーク防止）
    page.cleanup()
  }

  // Canvas のピクセルデータを解放して GC を促進
  canvas.width  = 0
  canvas.height = 0

  onProgress(totalPages, totalPages, '解析完了')

  // 全ページ結果をまとめて重複除外
  return deduplicateResults(allResults)
}
