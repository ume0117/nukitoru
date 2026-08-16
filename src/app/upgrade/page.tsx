'use client'

import Link from 'next/link'

const PAYMENT_LINK_URL = 'https://buy.stripe.com/3cI5kEf6mdLj9j9ar4d3i00'

const ROWS = [
  { label: 'PDF・画像からJANコード一括抽出', free: '○', pro: '○' },
  { label: '楽天・Yahoo!価格比較', free: '無制限', pro: '無制限' },
  { label: 'CSV+価格出力', free: '無制限', pro: '無制限' },
  { label: 'CATALOGモード', free: '無制限', pro: '無制限' },
  { label: '一括再チェック', free: '無制限', pro: '無制限' },
  { label: '出品下書き自動生成', free: '無制限', pro: '無制限' },
  { label: '価格改定アラート', free: '無制限（要メール登録）', pro: '無制限' },
  { label: '複数ファイル一括処理', free: '5ファイルまで', pro: '無制限' },
  { label: 'バーコード / QRコード画像生成', free: '2件まで', pro: '無制限+ZIP出力' },
  { label: 'CSV一括アップロード・ラベルシート印刷', free: '－', pro: '○' },
  { label: '検索履歴クラウド同期', free: '－', pro: '○' },
]

const FEATURE_DETAILS = [
  { title: '複数ファイル一括処理', desc: 'PDFやCSVなど複数ファイルをまとめて処理できます。無料版は一度に5ファイルまで、PRO版は無制限です。', href: '/' },
  { title: 'バーコード / QRコード画像生成', desc: '数字やコードを入力するとバーコード画像を、URLやテキストを入力するとQRコード画像を作成できます。CSV一括アップロードやラベルシート印刷用PDF作成にも対応。無料版は一度に2件まで、PRO版はまとめて生成してZIPでダウンロードできます。', href: '/barcode-generator' },
  { title: '検索履歴クラウド同期', desc: '別のデバイス・ブラウザでも検索履歴を共有できます。PRO限定機能です。', href: '/' },
]

export default function UpgradePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-[10px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase hover:text-blue-600 transition-colors">← NUKITORU</Link>
        </div>

        <div className="mb-8">
          <h1 className="text-[13px] tracking-[0.3em] text-gray-900 dark:text-white uppercase font-medium">NUKITORU PRO</h1>
          <p className="text-[11px] text-gray-500 leading-relaxed mt-2">価格比較・CSV出力・出品下書き・価格改定アラートなど、コア機能はどなたでも無料・無制限でお使いいただけます。PROは、複数ファイル処理やバーコード/QRコード生成、ラベルシート印刷など、日々の出品作業をさらに効率化する機能をまとめたプランです。</p>
        </div>

        <div className="border border-gray-100 dark:border-gray-800 mb-8">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-[9px] tracking-[0.15em] text-gray-400 dark:text-gray-600 uppercase font-medium p-3">機能</th>
                <th className="text-[9px] tracking-[0.15em] text-gray-400 dark:text-gray-600 uppercase font-medium p-3 text-center">Free</th>
                <th className="text-[9px] tracking-[0.15em] text-blue-600 uppercase font-medium p-3 text-center">Pro</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 dark:border-gray-900 last:border-0">
                  <td className="text-[11px] text-gray-700 dark:text-gray-300 p-3">{row.label}</td>
                  <td className="text-[10px] text-gray-500 dark:text-gray-500 p-3 text-center">{row.free}</td>
                  <td className="text-[10px] text-blue-600 p-3 text-center font-medium">{row.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <a href={PAYMENT_LINK_URL} className="block w-full h-12 leading-[48px] bg-blue-600 hover:bg-blue-700 text-white text-[11px] tracking-[0.2em] uppercase text-center transition-colors mb-2">7日間無料でPROを試す</a>
        <p className="text-[10px] text-gray-400 dark:text-gray-600 text-center mb-10">月額¥390・いつでも解約可能</p>

        <div className="space-y-6">
          {FEATURE_DETAILS.map((f, i) => (
            <div key={i} className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-[11px] tracking-[0.15em] text-gray-900 dark:text-white uppercase font-medium">{f.title}</h2>
                <Link href={f.href} className="text-[9px] tracking-[0.1em] text-blue-500 hover:text-blue-600 uppercase whitespace-nowrap">試してみる →</Link>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
