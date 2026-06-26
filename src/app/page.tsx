import { ScannerSection } from '@/components/ScannerSection'

/**
 * ルートページ（サーバーコンポーネント）
 * ヒーロー・使い方・スキャン機能はすべて ScannerSection に統合済み。
 */
export default function HomePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 pb-2">
      <div id="debug-width" className="text-xs text-red-500 text-center py-1" />
      <script dangerouslySetInnerHTML={{ __html: `document.getElementById("debug-width").textContent = "幅: " + window.innerWidth + "px"` }} />
      <ScannerSection />
    </main>
  )
}
