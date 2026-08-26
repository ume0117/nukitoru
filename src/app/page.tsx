import { HomeLauncher } from '@/components/home/HomeLauncher'

/**
 * ルートページ（サーバーコンポーネント）
 * NUKITORU HOME。FOOD / SCAN / COMING SOONへの導線はHomeLauncherが担当する。
 */
export default function HomePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 pb-2">
      <HomeLauncher />
    </main>
  )
}
