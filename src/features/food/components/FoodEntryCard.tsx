import Link from 'next/link'

export function FoodEntryCard() {
  return (
    <div className="mt-4 border border-gray-100 dark:border-gray-800 p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[9px] tracking-[0.15em] px-1.5 py-0.5 bg-blue-600 text-white uppercase font-medium">
          New
        </span>
        <span className="text-[11px] tracking-[0.2em] text-gray-900 dark:text-white uppercase font-medium">
          NUKITORU FOOD
        </span>
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
        冷蔵庫にあるもので、今日の献立を考える
      </p>
      <Link
        href="/food"
        className="inline-flex items-center justify-center h-9 px-4 border border-gray-400 dark:border-gray-600 hover:border-blue-600 hover:text-blue-600 text-[10px] tracking-[0.15em] uppercase text-gray-500 dark:text-gray-400 transition-colors"
      >
        試してみる →
      </Link>
    </div>
  )
}
