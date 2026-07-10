export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-100 dark:border-gray-900 bg-white dark:bg-black">
      <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <svg
            className="w-4 h-4 text-blue-600 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="2" y="2" width="7" height="7" rx="0.5" />
            <rect x="11" y="2" width="7" height="7" rx="0.5" />
            <rect x="2" y="11" width="7" height="7" rx="0.5" />
            <rect x="13" y="13" width="2" height="2" />
            <rect x="16" y="13" width="2" height="2" />
            <rect x="13" y="16" width="5" height="2" />
          </svg>
          <span className="text-[11px] font-medium tracking-[0.25em] text-gray-900 dark:text-white uppercase">
            Nukitoru
          </span>
        </div>
        <span className="text-[9px] tracking-[0.2em] text-gray-300 dark:text-gray-700 uppercase">
          Free
        </span>
      </div>
    </header>
  )
}
