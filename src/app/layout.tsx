import type { Metadata, Viewport } from 'next'
import { Header } from '@/components/layout/Header'
import { InstallBanner } from '@/components/pwa/InstallBanner'
import './globals.css'

const BASE_URL = 'https://nukitoru.vercel.app'

// ── ビューポート・テーマカラー設定 ──
export const viewport: Viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
}

// ── SEO・OGP・PWA メタデータ ──
export const metadata: Metadata = {
  title: 'Nukitoru（ヌキトル）- PDF・画像からURLやコードを一発抽出',
  description:
    'PDFや画像・スクリーンショットからQRコード・JANコード・EAN・バーコードを無料で一括抽出。URLはすぐ開ける。Chrome・Safari対応。ブラウザだけで動作。',
  keywords: [
    'QRコード抽出', 'JANコード', 'バーコード読み取り', 'PDF QR',
    'EAN-13', 'CODE128', '無料ツール', 'ヌキトル', 'Nukitoru',
  ],
  // ── ファビコン ──
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  // ── PWA ──
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Nukitoru',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  // ── Google Search Console ──
  verification: {
    google: '2qpRvXKiMdZY23ZcxcT9GsbawXqSN1NUHgtlgLXLZL8',
  },
  // ── OGP ──
  openGraph: {
    title: 'Nukitoru（ヌキトル）- PDF・画像からURLを一発抽出',
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
    title: 'Nukitoru（ヌキトル）- PDF・画像からURLを一発抽出',
    description: 'PDFや画像からQRコード・JANコード・バーコードを無料で一括抽出。',
    images: [`${BASE_URL}/ogp.png`],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="font-sans bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased">
        <div id="scroll-root">
        <Header />
        {children}

        {/* フッター */}
        <footer className="mt-4 border-t border-gray-200 dark:border-gray-800 py-4">
          <div className="max-w-3xl mx-auto px-4 text-center text-xs text-gray-400 dark:text-gray-600 space-y-1">
            <p>ファイルはブラウザ内で処理されます。</p>
            <p>サーバーへの送信は一切行いません。</p>
            <p className="mt-2">
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSd-weZVjjVo953gs0ML79bstzrDvxde3YIZbjEn1_crjERgmA/viewform"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
              >
                お問い合わせ・バグ報告
              </a>
            </p>
            <p className="mt-1">© 2026 Nukitoru by 4REAL. All rights reserved.</p>
          </div>
        </footer>

        </div>
        {/* PWA インストール案内バナー */}
        <InstallBanner />

        {/* モバイルのみ scroll-lock を適用 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                document.documentElement.classList.add('mobile-lock');
              }
            `,
          }}
        />

        {/* Service Worker 登録 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.log('SW registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
