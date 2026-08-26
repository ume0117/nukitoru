import type { Metadata } from 'next'
import Link from 'next/link'
import { ScannerSection } from '@/components/ScannerSection'
import { FoodEntryCard } from '@/features/food/components/FoodEntryCard'

const BASE_URL = 'https://nukitoru.pages.dev'

export const metadata: Metadata = {
  title: 'NUKITORU SCAN - PDF・画像からJANコード一括抽出｜楽天・Amazon・Yahoo!価格比較',
  description:
    'PDFや画像からJANコード・QRコード・バーコードを無料で一括抽出。楽天・Amazon・Yahoo!ショッピングの最安値をその場で比較。EC事業者・商品登録代行・棚卸し作業に最適。ブラウザ完結・登録不要・インストール不要。',
  keywords: [
    'JANコード抽出', 'QRコード抽出', 'バーコード読み取り', 'PDF JANコード',
    'EAN-13', 'CODE128', '無料ツール', 'ヌキトル', 'NUKITORU', 'NUKITORU SCAN',
    '楽天価格比較', 'Amazon価格比較', 'Yahoo!ショッピング',
    'EC事業者', '商品登録', '棚卸し', 'バーコードスキャン',
    'せどり', 'メーカーカタログ', '在庫管理', '無料バーコードリーダー',
  ],
  openGraph: {
    title: 'NUKITORU SCAN - PDF・画像からJANコード一括抽出｜楽天・Amazon・Yahoo!価格比較',
    description: 'PDFや画像からJANコード・バーコードを無料で一括抽出。楽天・Amazon・Yahoo!最安値比較。EC事業者・棚卸し・商品登録に最適。',
    type: 'website',
    locale: 'ja_JP',
    url: `${BASE_URL}/scan`,
    siteName: 'NUKITORU',
    images: [
      {
        url: `${BASE_URL}/ogp.png`,
        width: 1200,
        height: 630,
        alt: 'NUKITORU SCAN - PDF・画像からコードを一発抽出',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NUKITORU SCAN - PDF・画像からJANコード一括抽出｜楽天・Amazon・Yahoo!価格比較',
    description: 'PDFや画像からJANコード・バーコードを無料で一括抽出。楽天・Amazon・Yahoo!最安値比較。EC事業者・棚卸し・商品登録に最適。',
    images: [`${BASE_URL}/ogp.png`],
  },
}

export default function ScanPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 pb-2">
      <div className="pt-4 pb-1">
        <Link
          href="/"
          className="inline-block text-[10px] tracking-[0.15em] text-gray-400 dark:text-gray-600 hover:text-blue-600 uppercase transition-colors"
        >
          ← NUKITORU
        </Link>
      </div>
      <ScannerSection />
      <FoodEntryCard />
    </main>
  )
}
