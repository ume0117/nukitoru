export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
        {/* ロゴアイコン */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}
          aria-hidden="true"
        >
          {/* QRコード風アイコン */}
          <svg
            className="w-5 h-5 text-white"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <rect x="2" y="2" width="7" height="7" rx="1" />
            <rect x="11" y="2" width="7" height="7" rx="1" />
            <rect x="2" y="11" width="7" height="7" rx="1" />
            <rect x="13" y="13" width="2" height="2" />
            <rect x="16" y="13" width="2" height="2" />
            <rect x="13" y="16" width="5" height="2" />
          </svg>
        </div>

        {/* テキスト */}
        <div className="flex flex-col leading-none">
          <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
            ScanHub
          </span>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            PDF・画像コード抽出ツール
          </span>
        </div>

        {/* 無料バッジ（右端） */}
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline-block text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            無料で使えます
          </span>
        </div>
      </div>
    </header>
  )
}
