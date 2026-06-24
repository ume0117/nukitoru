import { ScannerSection } from '@/components/ScannerSection'

/**
 * ルートページ（サーバーコンポーネント）
 *
 * - 静的テキスト（SEO対象）はここでサーバーレンダリング
 * - インタラクティブ部分は ScannerSection（Client Component）に分離
 */
export default function HomePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 pb-12">
      {/* ヒーロー */}
      <section className="pt-8 pb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          PDF・画像からコードを一発抽出
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          QRコード・JANコード・EAN・CODE128 に対応。PDF は全ページ自動解析、複数コードも全件抽出。
          <br className="hidden sm:block" />
          ファイルはブラウザ内で処理され、サーバーには送信されません。
        </p>

        {/* 特徴バッジ */}
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            '🔒 プライバシー安全',
            '📄 PDF 全ページ対応',
            '🔍 複数コード同時抽出',
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

      {/* インタラクティブ部分（Client Component） */}
      <ScannerSection />

      {/* 使い方セクション（SEO コンテンツ） */}
      <section className="mt-12 space-y-4">
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">
          使い方
        </h2>
        <ol className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
          {[
            ['1', 'PDFまたは画像をアップロード', 'PDF・JPG・PNG・WEBPファイルに対応しています。'],
            ['2', '自動で全件解析', 'PDFは全ページ、画像はグリッド分割で隅々まで解析します。'],
            ['3', '結果をコピー', 'QRコード・JANコードをワンクリックでコピーできます。'],
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
