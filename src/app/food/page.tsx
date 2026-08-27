import type { Metadata } from 'next'
import { FoodApp } from '@/features/food/components/FoodApp'

const BASE_URL = 'https://nukitoru.pages.dev'

export const metadata: Metadata = {
  title: 'NUKITORU FOOD | 家にあるもので、今日どうする？',
  description:
    '家にある食材を入力するだけで、今日の献立を提案するNUKITORU FOOD。アレルギー・苦手食材・調理時間に配慮し、作った後は食材の在庫状態も記録できます。ブラウザ完結・登録不要・インストール不要。',
  openGraph: {
    title: 'NUKITORU FOOD | 家にあるもので、今日どうする？',
    description:
      '家にある食材を入力するだけで、今日の献立を提案。アレルギー・苦手食材・調理時間に配慮し、作った後は食材の在庫状態も記録できます。',
    type: 'website',
    locale: 'ja_JP',
    url: `${BASE_URL}/food`,
    siteName: 'NUKITORU',
    images: [
      {
        url: `${BASE_URL}/ogp-food.png`,
        width: 1200,
        height: 630,
        alt: 'NUKITORU FOOD - 家にあるもので、今日どうする？',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NUKITORU FOOD | 家にあるもので、今日どうする？',
    description:
      '家にある食材を入力するだけで、今日の献立を提案。アレルギー・苦手食材・調理時間に配慮し、作った後は食材の在庫状態も記録できます。',
    images: [`${BASE_URL}/ogp-food.png`],
  },
}

export default function FoodPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 pb-2">
      <FoodApp />
    </main>
  )
}
