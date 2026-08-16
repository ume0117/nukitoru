'use client'

import Link from 'next/link'

const FEATURE_DETAILS = [
  { title: 'バーコード画像生成', desc: '数字やコードを入力すると、バーコード画像を作成できます。無料版は一度に2件まで、PRO版はまとめて生成してZIPでダウンロードできます。', href: '/barcode-generator' },
  { title: '全店舗の価格分布表示', desc: '無料版では最安値のお店だけが表示されますが、PRO版では楽天・Yahoo!それぞれで見つかった全てのお店の価格を見比べられます。', href: null },
  { title: '一括再チェック', desc: '以前ダウンロードしたCSVを再アップロードするだけで、含まれる商品の最新価格をまとめて取得し直せます。1件ずつ調べ直す手間が省けます。', href: '/recheck' },
  { title: '出品下書き自動生成', desc: 'JANコードから、楽天・Amazon・Yahoo!それぞれ向けの商品タイトル案と説明文の雛形をまとめて作成します。出品作業の下準備に使えます。', href: '/draft' },
  { title: '価格改定アラート', desc: '気になる商品を登録しておくと（最大20件）、毎日自動で価格をチェックし、値下がりした時にメールでお知らせします。競合の値下げにすぐ気づけます。', href: '/watch' },
  { title: '検索履歴クラウド同期', desc: '検索した商品の履歴を、パソコンとスマホなど別のデバイス・ブラウザでも同じように見られるようにします。', href: '/license' },
]

const PAYMENT_LINK_URL = 'https://buy.stripe.com/3cI5kEf6mdLj9j9ar4d3i00'

const ROWS = [
  { label: 'PDF・画像からJANコード一括抽出', free: '○', pro: '○' },
  { label: '楽天・Yahoo!価格比較', free: '10回/日', pro: '無制限' },
  { label: 'CSV+価格出力', free: '3回/日', pro: '無制限' },
  { label: 'CATALOGモード', free: '3ページまで', pro: '無制限' },
  { label: '複数ファイル一括処理', free: '5ファイルまで', pro: '無制限' },
  { label: 'バーコード / QRコード画像生成', free: '2件まで', pro: '無制限+ZIP出力' },
  { label: '全店舗の価格分布表示', free: '最安値のみ', pro: '○' },
  { label: '一括再チェック', free: '－', pro: '○' },
  { label: '出品下書き自動生成', free: '－', pro: '○' },
  { label: '価格改定アラート', free: '－', pro: '○（最大20件監視）' },
  { label: '検索履歴クラウド同期', free: '－', pro: '○' },
]

export default function UpgradePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-[10px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase hover:text-blue-600 transition-colors">← NUKITORU</Link>
        </div>

        <div className="mb-10 text-center">
          <p className="text-[11px] tracking-[0.3em] text-blue-500 uppercase mb-2">NUKITORU PRO</p>
          <h1 className="text-xl font-medium text-gray-900 dark:text-white tracking-wide mb-3">すべての機能を無制限で</h1>
          <p className="text-[12px] text-gray-500 leading-relaxed">月額¥390、7日間の無料トライアル付き<br />トライアル中の解約なら課金は発生しません</p>
        </div>

        <div className="border border-gray-100 dark:border-gray-800 mb-8">
          <div className="grid grid-cols-3 border-b border-gray-100 dark:border-gray-800">
            <div className="p-3"></div>
            <div className="p-3 text-center text-[10px] tracking-[0.15em] text-gray-400 dark:text-gray-600 uppercase border-l border-gray-100 dark:border-gray-800">Free</div>
            <div className="p-3 text-center text-[10px] tracking-[0.15em] text-blue-500 uppercase border-l border-gray-100 dark:border-gray-800">Pro</div>
          </div>
          {ROWS.map((row, i) => (
            <div key={i} className="grid grid-cols-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
              <div className="p-3 text-[11px] text-gray-700 dark:text-gray-300">{row.label}</div>
              <div className="p-3 text-center text-[11px] text-gray-400 dark:text-gray-600 border-l border-gray-100 dark:border-gray-800">{row.free}</div>
              <div className="p-3 text-center text-[11px] text-blue-500 font-medium border-l border-gray-100 dark:border-gray-800">{row.pro}</div>
            </div>
          ))}
        </div>

        <a href={PAYMENT_LINK_URL} target="_blank" rel="noopener noreferrer" className="block w-full h-12 leading-[48px] text-center bg-blue-600 hover:bg-blue-700 text-white text-[11px] tracking-[0.2em] uppercase transition-colors mb-4">
          7日間無料でProを試す
        </a>
        <p className="text-[10px] text-gray-400 dark:text-gray-600 text-center leading-relaxed mb-12">
          いつでも解約できます。トライアル中の解約は無料です。
        </p>

        <h2 className="text-[11px] tracking-[0.25em] text-gray-900 dark:text-white uppercase font-medium mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">機能の詳細</h2>
        <div className="space-y-3">
          {FEATURE_DETAILS.map((f, i) => (
            <div key={i} className="border border-gray-100 dark:border-gray-800 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] text-gray-900 dark:text-white font-medium">{f.title}</p>
                {f.href && (
                  <Link href={f.href} className="text-[9px] tracking-[0.1em] text-blue-500 hover:text-blue-600 uppercase whitespace-nowrap ml-2">試してみる →</Link>
                )}
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <Link href="/" className="text-[10px] tracking-[0.15em] text-blue-600 uppercase">← Back to NUKITORU</Link>
          <Link href="/docs#pro" className="text-[10px] tracking-[0.15em] text-gray-400 dark:text-gray-600 uppercase hover:text-blue-600 transition-colors">詳細を見る →</Link>
        </div>
      </div>
    </div>
  )
}
