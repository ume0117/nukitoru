'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const PAYMENT_LINK_URL = 'https://buy.stripe.com/3cI5kEf6mdLj9j9ar4d3i00'
const PRO_MAX_PAYMENT_LINK_URL = 'https://buy.stripe.com/4gM00k8HYePn66Xar4d3i01'
const LANG_STORAGE_KEY = 'nukitoru_lang'

const TEXT = {
  ja: {
    heading: 'NUKITORU PRO / PRO MAX',
    intro: '価格比較・CSV出力・出品下書き・価格改定アラートなど、コア機能はどなたでも無料・無制限でお使いいただけます。PROは複数ファイル処理やバーコード/QRコード生成など日々の作業を効率化する機能、PRO MAXはさらに商品画像リサイズの全モール同時処理など、複数モール展開を加速させる機能をまとめたプランです。',
    colFeature: '機能',
    tryPro: 'Proを試す',
    tryProMax: 'Pro Maxを試す',
    priceNote: 'Pro 月額¥390 / Pro Max 月額¥1,980・共に7日間無料トライアル・いつでも解約可能',
    tryLink: '試してみる →',
    rows: [
      { label: 'PDF・画像からJANコード一括抽出', free: '○', pro: '○', proMax: '○' },
      { label: '楽天・Yahoo!価格比較', free: '無制限', pro: '無制限', proMax: '無制限' },
      { label: 'CSV+価格出力', free: '無制限', pro: '無制限', proMax: '無制限' },
      { label: 'CATALOGモード', free: '無制限', pro: '無制限', proMax: '無制限' },
      { label: '一括再チェック', free: '無制限', pro: '無制限', proMax: '無制限' },
      { label: '出品下書き自動生成', free: '無制限', pro: '無制限', proMax: '無制限' },
      { label: '価格改定アラート', free: '無制限（要メール登録）', pro: '無制限', proMax: '無制限' },
      { label: '複数ファイル一括処理', free: '5ファイルまで', pro: '無制限', proMax: '無制限' },
      { label: 'バーコード / QRコード画像生成', free: '2件まで', pro: '無制限+ZIP出力', proMax: '無制限+ZIP出力' },
      { label: 'CSV一括アップロード・ラベルシート印刷', free: '－', pro: '○', proMax: '○' },
      { label: '検索履歴クラウド同期', free: '－', pro: '○', proMax: '○' },
      { label: '商品画像リサイズ（モール別プリセット）', free: '1モールずつ', pro: '同時3モールまで+ZIP', proMax: '全モール同時+ZIP' },
    ],
    featureDetails: [
      { title: '複数ファイル一括処理', desc: 'PDFやCSVなど複数ファイルをまとめて処理できます。無料版は一度に5ファイルまで、PRO版は無制限です。', href: '/' },
      { title: 'バーコード / QRコード画像生成', desc: '数字やコードを入力するとバーコード画像を、URLやテキストを入力するとQRコード画像を作成できます。CSV一括アップロードやラベルシート印刷用PDF作成にも対応。無料版は一度に2件まで、PRO版はまとめて生成してZIPでダウンロードできます。', href: '/barcode-generator' },
      { title: '商品画像リサイズ', desc: '楽天・Yahoo!・Amazonなど8モールの推奨サイズにまとめて変換。PROは同時3モールまで、PRO MAXは全モール同時に一括処理・ZIPダウンロードできます。', href: '/image-resize' },
      { title: '検索履歴クラウド同期', desc: '別のデバイス・ブラウザでも検索履歴を共有できます。PRO限定機能です。', href: '/' },
    ],
  },
  en: {
    heading: 'NUKITORU PRO / PRO MAX',
    intro: 'Core features like price comparison, CSV export, listing drafts, and price drop alerts are free and unlimited for everyone. PRO adds tools that speed up daily work, such as bulk file processing and barcode/QR code generation. PRO MAX adds simultaneous image resizing across all marketplaces to accelerate multi-marketplace selling.',
    colFeature: 'Feature',
    tryPro: 'Try Pro',
    tryProMax: 'Try Pro Max',
    priceNote: 'Pro ¥390/month / Pro Max ¥1,980/month · Both include a 7-day free trial · Cancel anytime',
    tryLink: 'Try it →',
    rows: [
      { label: 'Bulk JAN code extraction from PDF/images', free: '○', pro: '○', proMax: '○' },
      { label: 'Rakuten / Yahoo! price comparison', free: 'Unlimited', pro: 'Unlimited', proMax: 'Unlimited' },
      { label: 'CSV + price export', free: 'Unlimited', pro: 'Unlimited', proMax: 'Unlimited' },
      { label: 'CATALOG mode', free: 'Unlimited', pro: 'Unlimited', proMax: 'Unlimited' },
      { label: 'Bulk recheck', free: 'Unlimited', pro: 'Unlimited', proMax: 'Unlimited' },
      { label: 'Auto listing draft generation', free: 'Unlimited', pro: 'Unlimited', proMax: 'Unlimited' },
      { label: 'Price drop alerts', free: 'Unlimited (email signup required)', pro: 'Unlimited', proMax: 'Unlimited' },
      { label: 'Bulk multi-file processing', free: 'Up to 5 files', pro: 'Unlimited', proMax: 'Unlimited' },
      { label: 'Barcode / QR code image generation', free: 'Up to 2 items', pro: 'Unlimited + ZIP export', proMax: 'Unlimited + ZIP export' },
      { label: 'CSV bulk upload / label sheet printing', free: '－', pro: '○', proMax: '○' },
      { label: 'Cloud sync of search history', free: '－', pro: '○', proMax: '○' },
      { label: 'Product image resize (marketplace presets)', free: '1 marketplace at a time', pro: 'Up to 3 at once + ZIP', proMax: 'All marketplaces at once + ZIP' },
    ],
    featureDetails: [
      { title: 'Bulk multi-file processing', desc: 'Process multiple PDFs or CSVs at once. The free version allows up to 5 files at a time; PRO is unlimited.', href: '/' },
      { title: 'Barcode / QR code image generation', desc: 'Enter numbers or codes to create barcode images, or URLs/text to create QR codes. Also supports CSV bulk upload and label sheet PDF printing. The free version handles up to 2 items at a time; PRO generates in bulk and downloads as a ZIP.', href: '/barcode-generator' },
      { title: 'Product image resize', desc: 'Convert images to the recommended sizes for 8 marketplaces including Rakuten, Yahoo!, and Amazon. PRO handles up to 3 marketplaces at once; PRO MAX processes all marketplaces simultaneously with ZIP download.', href: '/image-resize' },
      { title: 'Cloud sync of search history', desc: 'Share your search history across devices and browsers. PRO-only feature.', href: '/' },
    ],
  },
}

export default function UpgradePage() {
  const [lang, setLang] = useState<'ja' | 'en'>('ja')

  useEffect(() => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY)
    if (saved === 'en' || saved === 'ja') setLang(saved)
  }, [])

  const switchLang = (next: 'ja' | 'en') => {
    setLang(next)
    localStorage.setItem(LANG_STORAGE_KEY, next)
  }

  const t = TEXT[lang]

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-[10px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase hover:text-blue-600 transition-colors">← NUKITORU</Link>
          <div className="flex items-center gap-1">
            <button onClick={() => switchLang('ja')} className={`text-[9px] tracking-[0.1em] px-2 h-6 border transition-colors ${lang === 'ja' ? 'border-blue-600 text-blue-600' : 'border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600'}`}>JA</button>
            <button onClick={() => switchLang('en')} className={`text-[9px] tracking-[0.1em] px-2 h-6 border transition-colors ${lang === 'en' ? 'border-blue-600 text-blue-600' : 'border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600'}`}>EN</button>
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-[13px] tracking-[0.3em] text-gray-900 dark:text-white uppercase font-medium">{t.heading}</h1>
          <p className="text-[11px] text-gray-500 leading-relaxed mt-2">{t.intro}</p>
        </div>

        <div className="border border-gray-100 dark:border-gray-800 mb-8 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-[9px] tracking-[0.15em] text-gray-400 dark:text-gray-600 uppercase font-medium p-3">{t.colFeature}</th>
                <th className="text-[9px] tracking-[0.15em] text-gray-400 dark:text-gray-600 uppercase font-medium p-3 text-center">Free</th>
                <th className="text-[9px] tracking-[0.15em] text-blue-600 uppercase font-medium p-3 text-center">Pro</th>
                <th className="text-[9px] tracking-[0.15em] text-purple-500 uppercase font-medium p-3 text-center">Pro Max</th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 dark:border-gray-900 last:border-0">
                  <td className="text-[11px] text-gray-700 dark:text-gray-300 p-3 whitespace-nowrap">{row.label}</td>
                  <td className="text-[10px] text-gray-500 dark:text-gray-500 p-3 text-center whitespace-nowrap">{row.free}</td>
                  <td className="text-[10px] text-blue-600 p-3 text-center font-medium whitespace-nowrap">{row.pro}</td>
                  <td className="text-[10px] text-purple-500 p-3 text-center font-medium whitespace-nowrap">{row.proMax}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <a href={PAYMENT_LINK_URL} className="block w-full h-12 leading-[48px] bg-blue-600 hover:bg-blue-700 text-white text-[11px] tracking-[0.2em] uppercase text-center transition-colors">{t.tryPro}</a>
          <a href={PRO_MAX_PAYMENT_LINK_URL} className="block w-full h-12 leading-[48px] bg-purple-600 hover:bg-purple-700 text-white text-[11px] tracking-[0.2em] uppercase text-center transition-colors">{t.tryProMax}</a>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-600 text-center mb-10">{t.priceNote}</p>

        <div className="space-y-6">
          {t.featureDetails.map((f, i) => (
            <div key={i} className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-[11px] tracking-[0.15em] text-gray-900 dark:text-white uppercase font-medium">{f.title}</h2>
                <Link href={f.href} className="text-[9px] tracking-[0.1em] text-blue-500 hover:text-blue-600 uppercase whitespace-nowrap">{t.tryLink}</Link>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
