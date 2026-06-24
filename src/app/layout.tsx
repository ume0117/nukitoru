import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import './globals.css'

/**
 * NOTE: Vercel / インターネット環境でビルドする場合は以下を有効化
 *
 * import { Inter } from 'next/font/google'
 * const inter = Inter({ subsets: ['latin'], display: 'swap' })
 *
 * そして body の className に `${inter.className}` を追加する。
 * ローカル・オフライン環境では Google Fonts にアクセスできないためコメントアウトしておく。
 */

export const metadata: Metadata = {
  title: 'ScanHub - PDF・画像からQRコード・JANコードを抽出',
  description:
    'PDFや画像・スクリーンショットからQRコード・JANコード・EAN・バーコードを無料で一括抽出。ブラウザ内処理でファイルはサーバーに送信されません。せどり・EC事業・フリマ出品・物流業務に対応。',
  keywords: [
    'QRコード抽出', 'JANコード', 'バーコード読み取り', 'PDF QR',
    'EAN-13', 'CODE128', '無料ツール', 'せどり', 'EC',
  ],
  openGraph: {
    title: 'ScanHub - PDF・画像からQRコード・JANコードを抽出',
    description: 'PDFや画像からQRコード・JANコード・バーコードを無料で一括抽出。',
    type: 'website',
    locale: 'ja_JP',
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

        {/* フッター */}
        <footer className="mt-16 border-t border-gray-200 dark:border-gray-800 py-8">
          <div className="max-w-3xl mx-auto px-4 text-center text-xs text-gray-400 dark:text-gray-600 space-y-1">
            <p>
              ファイルはブラウザ内で処理されます。サーバーへの送信は一切行いません。
            </p>
            <p>© 2024 ScanHub. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  )
}
