'use client'

import { useState } from 'react'
import Link from 'next/link'

const JA = {
  title: '使い方ガイド',
  subtitle: 'NUKITORU の全機能を解説します',
  sections: [
    {
      id: 'intro',
      title: 'NUKITORUの使い方（はじめての方へ）',
      content: [
        { step: '無料でできること', desc: 'PDF・画像からのコード一括抽出、楽天・Yahoo!の価格比較、CSV出力、CATALOGモード、一括再チェック、出品下書き生成、価格改定アラート（無料メール登録）など、日々の出品作業に使うコア機能はすべて無料・無制限でお使いいただけます。会員登録も不要です。' },
        { step: 'PROでできること', desc: 'バーコード/QRコードの生成・ラベルシート印刷用PDF出力、複数ファイルの無制限一括処理、検索履歴のクラウド同期など、作業をさらに効率化する追加機能です。月額¥390、7日間無料トライアル付きでお試しいただけます。' },
        { step: 'まず何をすればいい？', desc: 'トップページの「SELECT FILE」からPDFや画像をアップロードするか、検索窓にJANコード・型番・ASINを直接入力してください。詳しい使い方は以下の各セクションをご覧ください。' },
      ]
    },
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
      id: 'draft',
      title: '出品下書き生成（PRO）',
      content: [
        { step: '使い方', desc: 'トップページの「出品下書き生成」から、過去にダウンロードしたCSVを選択すると、楽天・Amazon・Yahoo!向けのタイトル案と商品説明文の雛形をまとめて自動生成します。生成されたCSVをダウンロードして、各モールの規約に合わせて内容を調整してからご利用ください。' },
      ]
    },
    {
      id: 'recheck',
      title: '一括再チェック（PRO）',
      content: [
        { step: '使い方', desc: 'トップページの「一括再チェック」から、過去にダウンロードしたCSVを再アップロードすると、含まれる商品の最新価格をまとめて再取得し、新しいCSVとして出力します。' },
      ]
    },
    {
      id: 'watch',
      title: '価格改定アラート（無料）',
      content: [
        { step: '使い方', desc: 'トップページの「価格改定アラート」からメールアドレスを登録すると、無料でご利用いただけます。JANコードや型番を登録すると、毎日自動で価格をチェックし、値下がりした際にメールでお知らせします。最大20件まで登録できます。' },
        { step: '通知条件', desc: '登録時に「◯円以上下がったら通知」の金額を指定できます。空欄の場合は1円でも下がれば通知します。' },
        { step: '入荷通知', desc: '「入荷したら通知する」をオンにすると、在庫切れ（価格が取得できない状態）から入荷（価格が取得できるようになった状態）に変わったタイミングでもメールでお知らせします。' },
        { step: 'CSV一括登録', desc: '「CSVアップロード」タブから、コード・しきい値（任意）・入荷通知（任意）の3列のCSVをまとめてアップロードできます。テンプレート以外の形式のCSVでも取り込み可能です。' },
      ]
    },
    {
      id: 'barcode',
      title: 'バーコード / QRコード生成',
      content: [
        { step: '使い方', desc: 'トップページの「バーコード / QRコード生成」から、バーコードとQRコードを切り替えて生成できます。数字やコードを1行ずつ入力するとバーコード画像（CODE128形式）を、URLやテキストを1行ずつ入力するとQRコード画像を生成できます。無料版は1回に2件まで、PRO版は無制限に生成し、まとめてZIPでダウンロードできます。' },
        { step: 'CSV一括アップロード', desc: '「CSVアップロード」タブから、CSVファイルをドラッグ&ドロップ、またはクリックして選択すると、まとめて生成できます。コードの列・商品名の列（任意）を選んで指定でき、画像下に表示する番号は自動連番かCSV内の任意の列から選べます。印刷物には商品名の代わりに番号のみ表示され、番号と商品名の対応はアップロードしたCSVで確認できます。' },
        { step: '画像の保存・印刷', desc: '生成したバーコード（JANコードなど）・QRコードは、どちらもスマートフォンで画像を長押しすると「写真に保存」できます。印刷する場合は各コードの「↓ PNG」ボタンからダウンロードしてください。' },
        { step: 'ラベルシートに印刷（PRO）', desc: '複数件を生成すると「ラベルシートに印刷する」から対応ラベル型番（エーワン 72265・72244/31516・72212）を選び、A4のラベルシートにそのまま印刷できるPDFを作成できます。他の型番のご要望があればお問い合わせください。' },
        { step: 'クリア', desc: '「クリア」ボタンで入力内容・アップロードしたCSV・生成結果をまとめてリセットできます。' },
      ]
    },
    {
      id: 'pro',
      title: 'PRO版について',
      content: [
        { step: '無料でできること', desc: '価格比較・CSV+価格出力・CATALOGモード・一括再チェック・出品下書き生成・価格改定アラート（メール登録制）など、コア機能はどなたでも無料・無制限でご利用いただけます。' },
        { step: '複数ファイル一括処理', desc: '無料版は1回あたり5ファイルまで。PRO版は無制限で使えます。' },
        { step: 'バーコード / QRコード画像生成', desc: '無料版は一度に2件まで。PRO版は無制限で生成でき、まとめてZIPダウンロードやラベルシート印刷用PDF作成もできます。' },
        { step: '検索履歴のクラウド同期', desc: 'PRO限定機能。ライセンスキーページで同期をオンにすると、検索履歴がサーバーに保存され、別のデバイス・ブラウザでも同じ履歴を引き継げます。' },
        { step: '料金・トライアル', desc: '月額¥390、7日間の無料トライアル付き。トライアル中の解約でも課金は発生しません。いつでも解約できます。' },
        { step: '解約方法', desc: '決済完了時に届くメール内の「サブスクリプションを管理」リンクから、いつでもご自身で解約できます。解約してもトライアル期間・請求期間の終了日までは引き続きPRO機能をご利用いただけます。' },
        { step: 'ライセンスキーの利用範囲', desc: 'ライセンスキーは1名（1事業者）につき1つのご利用を前提としています。複数人・複数事業者での共有や譲渡・転売など、不正な利用が確認された場合、予告なくライセンスを無効化させていただく場合があります。' },
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
      id: 'intro',
      title: 'How to use NUKITORU (new here?)',
      content: [
        { step: 'What\'s free', desc: 'Bulk code extraction from PDFs and images, price comparison on Rakuten and Yahoo!, CSV export, CATALOG mode, bulk recheck, listing draft generation, and price drop alerts (free email signup) — all core features you use for daily listing work are free and unlimited. No account required.' },
        { step: 'What PRO adds', desc: 'Barcode/QR code generation, label-sheet-ready PDF export, unlimited batch multi-file processing, and cloud sync for search history — extras that speed up your workflow further. ¥390/month with a 7-day free trial.' },
        { step: 'Where to start', desc: 'Upload a PDF or image from "SELECT FILE" on the home page, or type a JAN code, model number, or ASIN directly into the search box. See the sections below for details on each feature.' },
      ]
    },
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
      id: 'draft',
      title: 'Listing Draft Generator (PRO)',
      content: [
        { step: 'How to use', desc: 'From "Listing Draft" on the home page, upload a CSV you previously downloaded to auto-generate title drafts and description templates for Rakuten, Amazon, and Yahoo!. Adjust the generated content to match each marketplace\'s rules before use.' },
      ]
    },
    {
      id: 'recheck',
      title: 'Bulk Recheck (PRO)',
      content: [
        { step: 'How to use', desc: 'From "Bulk Recheck" on the home page, re-upload a CSV you previously downloaded to fetch the latest prices for all included products and export a new CSV.' },
      ]
    },
    {
      id: 'watch',
      title: 'Price Drop Alert (Free)',
      content: [
        { step: 'How to use', desc: 'From "Price Alert" on the home page, sign up with your email address to use this feature for free. Register a JAN code or model number to automatically check its price daily and get an email when it drops. Up to 20 items.' },
        { step: 'Notification threshold', desc: 'You can set a minimum price drop (in yen) to trigger a notification. Leave it blank to be notified on any drop.' },
        { step: 'Arrival alert', desc: 'Turn on "Notify when back in stock" to get an email when an item goes from out-of-stock (price unavailable) to back in stock (price available again).' },
        { step: 'Bulk CSV upload', desc: 'From the "CSV Upload" tab, upload a CSV with code, threshold (optional), and arrival alert (optional) columns to register items in bulk. CSVs in other formats can be imported too.' },
      ]
    },
    {
      id: 'barcode',
      title: 'Barcode / QR Code Generator',
      content: [
        { step: 'How to use', desc: 'From "Barcode / QR Code Generator" on the home page, switch between barcode and QR code modes. Enter one code per line to generate CODE128 barcode images, or one URL/text per line to generate QR code images. Free: up to 2 at a time. PRO: unlimited, with bulk ZIP download.' },
        { step: 'Bulk CSV upload', desc: 'From the "CSV Upload" tab, drag and drop a CSV file or click to select one to generate codes in bulk. Choose which column holds the code and, optionally, which column holds the product name. The number shown under each printed image can be an auto-sequence or pulled from any column in your CSV. Printed images show only the number, not the product name — check your uploaded CSV to match numbers to products.' },
        { step: 'Saving & printing images', desc: 'Both barcode (e.g. JAN code) and QR code images can be saved by long-pressing them on a smartphone. To print, use the "↓ PNG" button next to each code to download it.' },
        { step: 'Print on label sheets (PRO)', desc: 'Once you generate multiple codes, use "Print on label sheets" to choose a supported A-one label part number (72265, 72244/31516, or 72212) and create a ready-to-print PDF laid out for that sheet. Let us know if you need another size supported.' },
        { step: 'Clear', desc: 'Use the "Clear" button to reset your input, uploaded CSV, and generated results at once.' },
      ]
    },
    {
      id: 'pro',
      title: 'About PRO',
      content: [
        { step: 'Free for everyone', desc: 'Core features — price comparison, CSV + price export, CATALOG mode, bulk recheck, listing draft generator, and price drop alerts (free email signup required) — are free and unlimited for everyone.' },
        { step: 'Batch multi-file processing', desc: 'Free: up to 5 files per run. PRO: unlimited.' },
        { step: 'Barcode / QR code generation', desc: 'Free: up to 2 at a time. PRO: unlimited, with bulk ZIP download and label-sheet-ready PDF export.' },
        { step: 'Cloud sync for search history', desc: 'PRO-only feature. Turn on sync on the license key page to save your search history to the server and carry it across devices and browsers.' },
        { step: 'Pricing & trial', desc: '¥390/month with a 7-day free trial. No charge if you cancel during the trial. Cancel anytime.' },
        { step: 'How to cancel', desc: 'You can cancel anytime yourself via the "Manage subscription" link in the receipt email you received at checkout. PRO features remain available until the end of your current trial or billing period.' },
        { step: 'License key usage', desc: 'Each license key is intended for use by one individual or business. Sharing, transferring, or reselling a key to multiple people or businesses may result in the license being disabled without notice.' },
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
