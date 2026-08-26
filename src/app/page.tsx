import { ScannerSection } from '@/components/ScannerSection'
import { FoodEntryCard } from '@/features/food/components/FoodEntryCard'

/**
 * ルートページ（サーバーコンポーネント）
 * ヒーロー・使い方・スキャン機能はすべて ScannerSection に統合済み。
 */
export default function HomePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 pb-2">
<ScannerSection />
      <FoodEntryCard />
    </main>
  )
}
