import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import './globals.css'

const BASE_URL = 'https://nukitoru.vercel.app'

export const metadata: Metadata = {
  title: 'Nukitoru（ヌキトル）- PDF・画像からQRコード・JANコードを抽出',
  description:
    'PDFや画像・スクリーンショットからQRコード・JANコード・EAN・バーコードを無料で一括抽出。ブラウザ内処理でファイルはサーバーに送信されません。Chrome・Safari対応。',
  keywords: [
    'QRコード抽出', 'JANコード', 'バーコード読み取り', 'PDF QR',
    'EAN-13', 'CODE128', '無料ツール', 'ヌキトル', 'Nukitoru',
  ],
  // ── ファビコン設定 ──
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  // ── OGP（SNS シェア用） ──
  openGraph: {
    title: 'Nukitoru（ヌキトル）- PDF・画像からQRコードを一発抽出',
    description: 'PDFや画像からQRコード・JANコード・バーコードを無料で一括抽出。Chrome・Safari対応。',
    type: 'website',
    locale: 'ja_JP',
    url: BASE_URL,
    siteName: 'Nukitoru',
    images: [
      {
        url: `${BASE_URL}/ogp.png`,
        width: 1200,
        height: 630,
        alt: 'Nukitoru - PDF・画像からコードを一発抽出',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nukitoru（ヌキトル）- PDF・画像からQRコードを一発抽出',
    description: 'PDFや画像からQRコード・JANコード・バーコードを無料で一括抽出。',
    images: [`${BASE_URL}/ogp.png`],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className="font-sans bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased min-h-screen"
      >
        <Header />
        {children}

        <footer className="mt-16 border-t border-gray-200 dark:border-gray-800 py-8">
          <div className="max-w-3xl mx-auto px-4 text-center text-xs text-gray-400 dark:text-gray-600 space-y-1">
            <p>ファイルはブラウザ内で処理されます。</p>
            <p>サーバーへの送信は一切行いません。</p>
            <p>© 2026 Nukitoru. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  )
}
