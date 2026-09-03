import type { Metadata } from 'next'
import { WorldFoodDecideApp } from '@/features/food/components/WorldFoodDecideApp'

export const metadata: Metadata = {
  title: 'NUKITORU FOOD | 今日、どうする？',
  description:
    '家にあるもので作る / 作りたいものから探す。スマホで、片手で、料理中は左右スワイプだけで進める NUKITORU FOOD の料理体験。',
  robots: { index: false },
}

export default function FoodDecidePage() {
  return (
    <main className="pb-8">
      <WorldFoodDecideApp />
    </main>
  )
}
