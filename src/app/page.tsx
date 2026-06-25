import { ScannerSection } from '@/components/ScannerSection'

export default function HomePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 pb-12">
      {/* ヒーロー */}
      <section className="pt-8 pb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          PDF・画像からURLを一発抽出
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          スマホに保存したPDFや画像のQRコードからURLをすぐ開けます。
          <br className="hidden sm:block" />
          JANコード・バーコードの抽出にも対応。ファイルはサーバーに送信されません。
        </p>

        {/* 特徴バッジ */}
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            '🔗 URLをすぐ開ける',
            '📄 PDF全ページ対応',
            '🔒 プライバシー安全',
            '⚡ ブラウザ内処理',
          ].map((badge) => (
            <span
              key={badge}
              className="text-xs px-3 py-1 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 shadow-sm"
            >
              {badge}
            </span>
          ))}
        </div>
      </section>

      {/* スキャナー（クライアントコンポーネント） */}
      <ScannerSection />

      {/* 使い方 */}
      <section className="mt-12 space-y-4">
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">
          使い方
        </h2>
        <ol className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
          {[
            ['1', 'PDFまたは画像をアップロード', 'PDF・JPG・PNG・WEBPに対応。ドラッグ&ドロップも可。'],
            ['2', 'URLやコードを自動検出', 'QRコード・JANコード・バーコードを全ページから抽出します。'],
            ['3', 'URLをタップして開く', 'URLは「開く」ボタンで即アクセス。コピーして使うことも可能。'],
          ].map(([num, title, desc]) => (
            <li key={num} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {num}
              </span>
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-300">{title}</p>
                <p className="text-gray-500 dark:text-gray-500">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
