import { ScannerSection } from '@/components/ScannerSection'

/**
 * ルートページ（サーバーコンポーネント）
 * ヒーロー・使い方・スキャン機能はすべて ScannerSection に統合済み。
 */
export default function HomePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 pb-12">
      <ScannerSection />
    </main>
  )
}
