import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Header } from '@/components/layout/Header'
import { InstallBanner } from '@/components/pwa/InstallBanner'
import './globals.css'

const GA_ID = 'G-5H84XXS8W2'

const BASE_URL = 'https://nukitoru.pages.dev'

// ── ビューポート・テーマカラー設定 ──
export const viewport: Viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
}

// ── SEO・OGP・PWA メタデータ ──
export const metadata: Metadata = {
  title: 'NUKITORU - PDF・画像からJANコード一括抽出｜楽天・Amazon・Yahoo!価格比較',
  description:
    'PDFや画像からJANコード・QRコード・バーコードを無料で一括抽出。楽天・Amazon・Yahoo!ショッピングの最安値をその場で比較。EC事業者・商品登録代行・棚卸し作業に最適。ブラウザ完結・登録不要・インストール不要。',
  keywords: [
    'JANコード抽出', 'QRコード抽出', 'バーコード読み取り', 'PDF JANコード',
    'EAN-13', 'CODE128', '無料ツール', 'ヌキトル', 'NUKITORU',
    '楽天価格比較', 'Amazon価格比較', 'Yahoo!ショッピング',
    'EC事業者', '商品登録', '棚卸し', 'バーコードスキャン',
    'せどり', 'メーカーカタログ', '在庫管理', '無料バーコードリーダー',
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
    title: 'NUKITORU',
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
    title: 'NUKITORU - PDF・画像からJANコード一括抽出｜楽天・Amazon・Yahoo!価格比較',
    description: 'PDFや画像からJANコード・バーコードを無料で一括抽出。楽天・Amazon・Yahoo!最安値比較。EC事業者・棚卸し・商品登録に最適。',
    type: 'website',
    locale: 'ja_JP',
    url: BASE_URL,
    siteName: 'NUKITORU',
    images: [
      {
        url: `${BASE_URL}/ogp.png`,
        width: 1200,
        height: 630,
        alt: 'NUKITORU - PDF・画像からコードを一発抽出',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NUKITORU - PDF・画像からJANコード一括抽出｜楽天・Amazon・Yahoo!価格比較',
    description: 'PDFや画像からJANコード・バーコードを無料で一括抽出。楽天・Amazon・Yahoo!最安値比較。EC事業者・棚卸し・商品登録に最適。',
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
      <body className="font-sans bg-white dark:bg-black text-gray-900 dark:text-gray-100 antialiased">
        {/* Google Analytics */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>
        <div id="scroll-root">
        <Header />
        {children}

        {/* フッター */}
        <footer className="mt-4 border-t border-gray-200 dark:border-gray-800 py-4">
          <div className="max-w-3xl mx-auto px-4 text-center text-xs text-gray-400 dark:text-gray-600 space-y-1">
            <p>ファイルはブラウザ内で処理されます。</p>
            <p>サーバーへの送信は一切行いません。</p>
            <p className="mt-2">
              <a href="/docs" className="text-[10px] tracking-[0.15em] text-gray-400 dark:text-gray-600 hover:text-blue-600 transition-colors">使い方</a>
                <span className="text-gray-600 dark:text-gray-700"> · </span>
                <a href="/changelog" className="text-[10px] tracking-[0.15em] text-gray-400 dark:text-gray-600 hover:text-blue-600 transition-colors">更新履歴</a>
                <span className="text-gray-600 dark:text-gray-700"> · </span>
                <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSd-weZVjjVo953gs0ML79bstzrDvxde3YIZbjEn1_crjERgmA/viewform"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
              >
                お問い合わせ・バグ報告
              </a>
            </p>
            <p className="mt-1">© 2026 NUKITORU by 4REAL. All rights reserved.</p>

            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-[9px] tracking-[0.2em] text-gray-600 uppercase text-center mb-3">Share NUKITORU</p>
              <div className="flex items-center justify-center gap-3">
                <a href="https://twitter.com/intent/tweet?text=PDFや画像からJANコードを一括抽出！%0A楽天・Amazon・Yahoo!で即検索・価格比較できます。%0A%0A🔍 無料・ブラウザ完結・登録不要%0A%0Anukitoru.pages.dev%0A%0A%23NUKITORU %23EC事業者 %23バーコード抽出" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-9 h-9 border border-gray-800 hover:border-gray-600 transition-colors" title="X(Twitter)でシェア">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-gray-500 hover:fill-white transition-colors"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://bsky.app/intent/compose?text=PDFや画像からJANコードを一括抽出！%0A楽天・Amazon・Yahoo!で即検索・価格比較できます。%0A%0A🔍 無料・ブラウザ完結・登録不要%0A%0Anukitoru.pages.dev%0A%0A%23NUKITORU %23EC事業者 %23バーコード抽出" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-9 h-9 border border-gray-800 hover:border-gray-600 transition-colors" title="Blueskyでシェア">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-gray-500 hover:fill-white transition-colors"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.204-.659-.299-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/></svg>
                </a>
                <a href="https://www.facebook.com/sharer/sharer.php?u=https://nukitoru.pages.dev" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-9 h-9 border border-gray-800 hover:border-gray-600 transition-colors" title="Facebookでシェア">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-gray-500 hover:fill-white transition-colors"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="https://social-plugins.line.me/lineit/share?url=https://nukitoru.pages.dev" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-9 h-9 border border-gray-800 hover:border-gray-600 transition-colors" title="LINEでシェア">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-gray-500 hover:fill-white transition-colors"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                </a>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-600">本サービスは楽天アフィリエイト・Amazonアソシエイト・Yahoo!ショッピングアフィリエイトプログラムに参加しています。<br />リンク経由で購入された場合、紹介料を受け取ることがあります。</p>
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
