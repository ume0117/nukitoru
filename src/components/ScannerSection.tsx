<h1 className="text-[11px] tracking-[0.3em] text-gray-400 dark:text-gray-600 uppercase">
          PDF · Image · Barcode Extractor
        </h1>
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            'URL open',
            'PDF all pages',
            'Privacy safe',
            'Browser only',
          ].map((label) => (
            <span
              key={label}
              className="text-[9px] tracking-[0.15em] px-2.5 py-1 border border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-600 uppercase"
            >
              {label}
            </span>
          ))}
        </div>
