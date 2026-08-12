'use client'

import { useState } from 'react'
import Link from 'next/link'

const JA = {
  title: '使い方ガイド',
  subtitle: 'NUKITORU の全機能を解説します',
  sections: [
    {
      id: 'basic',
      title: '基本的な使い方',
      content: [
        { step: '① ファイルを選択', desc: '「SELECT FILE」をタップしてPDF・JPG・PNG・WEBPファイルを選択します。複数ファイルの同時選択も可能です。PDFは最大50MB、画像は最大20MBまで対応。' },
        { step: '② 自動スキャン', desc: 'ファイルを選択すると自動でスキャンが始まります。PDFは全ページを処理し、QRコード・JANコード・EAN-8・CODE128を検出します。' },
        { step: '③ 結果を確認', desc: '抽出されたコードが一覧表示されます。フィルターでJAN・URL・QR・CODE128に絞り込めます。' },
      ]
    },
    {
      id: 'camera',
      title: 'カメラスキャン',
      content: [
        { step: '使い方', desc: '「CAMERA SCAN」ボタンをタップするとスマホのカメラが起動します。バーコードをカメラに向けると自動で読み取ります。' },
      ]
    },
    {
      id: 'search',
      title: '商品検索・価格比較',
      content: [
        { step: 'Enterキーで最安値へ', desc: 'JANコードを入力してEnterキーを押すと、自動で楽天・Yahoo!の価格を比較し最安値のモールへジャンプします。' },
        { step: '¥ Check Price', desc: 'JANコードを入力後「¥ Check Price」を押すと楽天・Yahoo!の最安値を取得して比較表示します。商品画像と商品名も自動表示されます。' },
        { step: 'モール直接検索', desc: 'RAKUTEN・AMAZON・YAHOO!ボタンで各モールの検索結果に直接アクセスできます。' },
        { step: '検索履歴', desc: '入力欄をタップすると過去の検索履歴（最大20件）が表示されます。タップで再入力、×で削除できます。' },
      ]
    },
    {
      id: 'export',
      title: 'CSV・Excel出力',
      content: [
        { step: '↓ CSV', desc: '抽出結果をCSV形式でダウンロードします。Type・Value・Page・DateTimeが含まれます。' },
        { step: '↓ CSV+¥', desc: '楽天・Yahoo!の最安値情報付きCSVをダウンロードします。商品名・楽天最安値・Yahoo最安値・総合最安値が含まれます。' },
        { step: '↓ Excel', desc: '抽出結果をExcel形式（.xlsx）でダウンロードします。' },
      ]
    },
    {
      id: 'catalog',
      title: 'カタログモード',
      content: [
        { step: '使い方', desc: '「CATALOG」ボタンをタップしてPDFを選択するだけで、全JANコードの自動抽出→楽天・Yahoo!価格一括取得→CSV出力まで全て自動で完了します。メーカーカタログPDFの処理に最適です。' },
      ]
    },
    {
      id: 'inventory',
      title: '棚卸しモード',
      content: [
        { step: '使い方', desc: '「INVENTORY」ボタンをタップするとカメラが起動し、バーコードを連続スキャンして個数をカウントします。同じ商品をスキャンするたびに個数が加算されます。終了後にCSVでダウンロードできます。' },
        { step: '履歴', desc: '「HISTORY」ボタンで過去30件の棚卸し結果を確認できます。各履歴からCSVの再ダウンロードも可能です。' },
      ]
    },
    {
      id: 'pro',
      title: 'PRO版について',
      content: [
        { step: '価格比較', desc: '無料版は1日10回まで。PRO版は無制限で使えます。' },
        { step: 'CSV+価格出力', desc: '無料版は1日3回まで。PRO版は無制限で使えます。' },
        { step: 'CATALOGモード', desc: '無料版は1回あたり3ページまで。PRO版は無制限で使えます。' },
        { step: '複数ファイル一括処理', desc: '無料版は1回あたり5ファイルまで。PRO版は無制限で使えます。' },
        { step: '料金・トライアル', desc: '月額¥390、7日間の無料トライアル付き。トライアル中の解約でも課金は発生しません。いつでも解約できます。' },
        { step: '解約方法', desc: '決済完了時に届くメール内の「サブスクリプションを管理」リンクから、いつでもご自身で解約できます。解約してもトライアル期間・請求期間の終了日までは引き続きPRO機能をご利用いただけます。' },
      ]
    },
    {
      id: 'privacy',
      title: 'プライバシー',
      content: [
        { step: 'ブラウザ完結', desc: 'アップロードしたファイルはサーバーに送信されません。全ての処理はブラウザ内で完結します。アカウント登録も不要です。' },
      ]
    }
  ]
}

const EN = {
  title: 'User Guide',
  subtitle: 'Complete guide to all NUKITORU features',
  sections: [
    {
      id: 'basic',
      title: 'Basic Usage',
      content: [
        { step: '① Select File', desc: 'Tap "SELECT FILE" to choose PDF, JPG, PNG, or WEBP files. Multiple files can be selected at once. PDF up to 50MB, images up to 20MB.' },
        { step: '② Auto Scan', desc: 'Scanning starts automatically after file selection. All PDF pages are processed to detect QR codes, JAN codes, EAN-8, and CODE128.' },
        { step: '③ View Results', desc: 'Extracted codes are displayed in a list. Use filters to narrow down by JAN, URL, QR, or CODE128.' },
      ]
    },
    {
      id: 'camera',
      title: 'Camera Scan',
      content: [
        { step: 'How to use', desc: 'Tap "CAMERA SCAN" to activate your smartphone camera. Point it at a barcode to scan automatically.' },
      ]
    },
    {
      id: 'search',
      title: 'Product Search & Price Comparison',
      content: [
        { step: 'Enter key → Cheapest store', desc: 'Enter a JAN code and press Enter to automatically compare prices and jump to the cheapest marketplace.' },
        { step: '¥ Check Price', desc: 'Enter a JAN code then press "¥ Check Price" to fetch the lowest prices from Rakuten and Yahoo! Shopping, with product image and name.' },
        { step: 'Direct Search', desc: 'Use RAKUTEN, AMAZON, or YAHOO! buttons to go directly to each marketplace search results.' },
        { step: 'Search History', desc: 'Tap the input field to see your recent search history (up to 20 items). Tap to reuse, × to delete.' },
      ]
    },
    {
      id: 'export',
      title: 'CSV & Excel Export',
      content: [
        { step: '↓ CSV', desc: 'Download results as CSV with Type, Value, Page, and DateTime.' },
        { step: '↓ CSV+¥', desc: 'Download CSV with Rakuten and Yahoo! price data including product name, min prices, and overall best price.' },
        { step: '↓ Excel', desc: 'Download results in Excel format (.xlsx).' },
      ]
    },
    {
      id: 'catalog',
      title: 'Catalog Mode',
      content: [
        { step: 'How to use', desc: 'Tap "CATALOG" and select a PDF. NUKITORU automatically extracts all JAN codes, fetches prices from Rakuten and Yahoo!, and downloads a CSV — all in one click. Perfect for manufacturer catalogs.' },
      ]
    },
    {
      id: 'inventory',
      title: 'Inventory Mode',
      content: [
        { step: 'How to use', desc: 'Tap "INVENTORY" to start the camera and continuously scan barcodes. Each scan of the same product adds to its count. Download results as CSV when done.' },
        { step: 'History', desc: 'Tap "HISTORY" to view the last 30 inventory sessions. Re-download any session as CSV.' },
      ]
    },
    {
      id: 'pro',
      title: 'About PRO',
      content: [
        { step: 'Price comparison', desc: 'Free: up to 10 times/day. PRO: unlimited.' },
        { step: 'CSV + price export', desc: 'Free: up to 3 times/day. PRO: unlimited.' },
        { step: 'CATALOG mode', desc: 'Free: up to 3 pages per run. PRO: unlimited.' },
        { step: 'Batch multi-file processing', desc: 'Free: up to 5 files per run. PRO: unlimited.' },
        { step: 'Pricing & trial', desc: '¥390/month with a 7-day free trial. No charge if you cancel during the trial. Cancel anytime.' },
        { step: 'How to cancel', desc: 'You can cancel anytime yourself via the "Manage subscription" link in the receipt email you received at checkout. PRO features remain available until the end of your current trial or billing period.' },
      ]
    },
    {
      id: 'privacy',
      title: 'Privacy',
      content: [
        { step: 'Browser-only processing', desc: 'Uploaded files are never sent to any server. All processing happens entirely in your browser. No account required.' },
      ]
    }
  ]
}

export default function DocsPage() {
  const [lang, setLang] = useState<'ja' | 'en'>('ja')
  const t = lang === 'ja' ? JA : EN

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-[10px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase hover:text-blue-600 transition-colors">← NUKITORU</Link>
          <div className="flex gap-2">
            <button onClick={() => setLang('ja')} className={`text-[10px] tracking-[0.15em] px-3 h-7 border transition-colors ${lang === 'ja' ? 'border-blue-600 text-blue-600' : 'border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600'}`}>JA</button>
            <button onClick={() => setLang('en')} className={`text-[10px] tracking-[0.15em] px-3 h-7 border transition-colors ${lang === 'en' ? 'border-blue-600 text-blue-600' : 'border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600'}`}>EN</button>
          </div>
        </div>
        <div className="mb-8">
          <h1 className="text-[13px] tracking-[0.3em] text-gray-900 dark:text-white uppercase font-medium">{t.title}</h1>
          <p className="text-[10px] tracking-[0.1em] text-gray-400 dark:text-gray-600 mt-2">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2 mb-8">
          {t.sections.map(s => (
            <a key={s.id} href={`#${s.id}`} className="text-[9px] tracking-[0.15em] px-2.5 py-1 border border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-600 uppercase hover:border-blue-600 hover:text-blue-600 transition-colors">{s.title}</a>
          ))}
        </div>
        <div className="space-y-10">
          {t.sections.map(s => (
            <div key={s.id} id={s.id}>
              <h2 className="text-[11px] tracking-[0.25em] text-gray-900 dark:text-white uppercase font-medium mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">{s.title}</h2>
              <div className="space-y-4">
                {s.content.map((c, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-[10px] tracking-[0.15em] text-blue-600 uppercase">{c.step}</p>
                    <p className="text-[12px] text-gray-600 dark:text-gray-400 leading-relaxed">{c.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <Link href="/" className="text-[10px] tracking-[0.15em] text-blue-600 uppercase">← Back to NUKITORU</Link>
          <Link href="/changelog" className="text-[10px] tracking-[0.15em] text-gray-400 dark:text-gray-600 uppercase hover:text-blue-600 transition-colors">Changelog →</Link>
        </div>
      </div>
    </div>
  )
}
