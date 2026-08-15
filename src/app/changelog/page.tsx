import Link from 'next/link'

const versions = [
  {
    version: 'v1.6.1',
    date: '2026-08-15',
    label: 'Latest',
    changes: [
      { type: 'new', text: 'QRコード生成：バーコード生成ページでバーコード/QRコードを切り替えて生成可能に。URLやテキストからQRコード画像を作成（無料版2件まで、PROは無制限+ZIP出力）' },
      { type: 'improve', text: 'QRコード画像はスマートフォンで長押し保存に対応' },
      { type: 'new', text: 'CSV一括アップロード：CSVファイルからバーコード/QRコードをまとめて生成可能に。コード列・商品名列（任意）・番号の付け方（自動連番/CSV内の列）を選択できる' },
      { type: 'new', text: 'CSVアップロードはドラッグ&ドロップに対応' },
      { type: 'new', text: '手入力・CSVどちらのモードにも入力内容と生成結果を一括リセットする「クリア」ボタンを追加' },
    ]
  },
  {
    version: 'v1.6.0',
    date: '2026-08-13',
    label: '',
    changes: [
      { type: 'new', text: 'NUKITORU Pro 公開（月額¥390・7日間無料トライアル）' },
      { type: 'new', text: '出品下書き生成（PRO）：JANコードから楽天・Amazon・Yahoo!向けタイトル案と説明文雛形を自動生成' },
      { type: 'new', text: '一括再チェック（PRO）：過去にダウンロードしたCSVを再アップロードして最新価格を一括取得' },
      { type: 'new', text: '価格改定アラート（PRO）：登録した商品の値下がりを毎日自動チェックしメールで通知（最大20件）' },
      { type: 'new', text: '全店舗の価格分布表示（PRO）：楽天・Yahoo!の全取得店舗の価格を確認可能' },
      { type: 'new', text: '検索履歴のクラウド同期（PRO）：別デバイス・ブラウザでも検索履歴を共有' },
      { type: 'new', text: 'バーコード画像生成：テキストからCODE128バーコード画像を作成（無料版2件まで、PROは無制限+ZIP出力）' },
      { type: 'new', text: 'ライセンスキー管理ページ（/license）追加' },
    ]
  },
  {
    version: 'v1.5.0',
    date: '2026-08-11',
    label: '',
    changes: [
      { type: 'new', text: 'SNSシェアボタン追加（X / Bluesky / Facebook / LINE）' },
      { type: 'new', text: '使い方ガイドページ（/docs）追加・日英対応' },
      { type: 'new', text: 'バージョン履歴ページ（/changelog）追加' },
      { type: 'new', text: 'SEOキーワード・タイトル・description強化' },
      { type: 'new', text: '検索履歴機能（最大20件・削除対応）' },
      { type: 'new', text: 'Enterキーで自動価格比較→最安値モールへジャンプ' },
      { type: 'fix', text: '×ボタンで価格データもリセットされるよう修正' },
    ]
  },
  {
    version: 'v1.4.0',
    date: '2026-08-04',
    label: '',
    changes: [
      { type: 'new', text: 'CATALOGモード実装（PDF→JAN全自動抽出→価格取得→CSV）' },
      { type: 'new', text: 'CSV+¥（楽天・Yahoo!最安値付きCSV出力）' },
      { type: 'new', text: 'ManualSearchに価格比較機能追加' },
      { type: 'new', text: 'アフィリエイト表記をフッターに追加' },
    ]
  },
  {
    version: 'v1.3.0',
    date: '2026-07-17',
    label: '',
    changes: [
      { type: 'new', text: '楽天・Yahoo!ショッピング価格比較機能' },
      { type: 'new', text: '商品画像・商品名の自動表示' },
      { type: 'new', text: '最安値ハイライト表示' },
      { type: 'new', text: 'Cloudflare Worker Originセキュリティ強化' },
    ]
  },
  {
    version: 'v1.2.0',
    date: '2026-07-16',
    label: '',
    changes: [
      { type: 'new', text: 'Excel出力機能（.xlsx）' },
      { type: 'new', text: 'フィルター機能（ALL/JAN/URL/QR/CODE128）' },
      { type: 'new', text: '自動フィルター選択（抽出結果に応じて）' },
      { type: 'new', text: '複数ファイル一括処理対応' },
      { type: 'new', text: 'ダークモード完全統一' },
    ]
  },
  {
    version: 'v1.1.0',
    date: '2026-07-12',
    label: '',
    changes: [
      { type: 'new', text: 'デザイン全面リニューアル（fragment × Blue）' },
      { type: 'new', text: 'Vercel → Cloudflare Pages移行' },
      { type: 'new', text: 'OGP・ファビコン更新' },
      { type: 'new', text: 'ManualSearch（JAN/SKU/ASIN手動検索）追加' },
    ]
  },
  {
    version: 'v1.0.0',
    date: '2026-07-01',
    label: '',
    changes: [
      { type: 'new', text: 'NUKITORU 公開' },
      { type: 'new', text: 'PDF・画像からQR/JAN/EAN-8/CODE128を抽出' },
      { type: 'new', text: 'カメラスキャン機能' },
      { type: 'new', text: '棚卸しモード（INVENTORY）' },
      { type: 'new', text: 'CSV出力' },
    ]
  },
]

const upcoming = [
  { title: '楽天RMS形式CSV出力', desc: '楽天市場への商品一括登録に対応したCSVフォーマット' },
  { title: 'Amazon形式CSV出力', desc: 'Amazon出品用フォーマットのCSV出力' },
  { title: 'Yahoo!ショッピング形式CSV出力', desc: 'Yahoo!ショッピング出品用フォーマットのCSV出力' },
  { title: 'Amazon価格取得', desc: 'Amazon Creators APIを使った価格比較（条件達成後）' },
  { title: 'AI商品名生成', desc: 'JANコードから商品名をAIで自動生成（今後の利用状況次第で検討）' },
]

const typeColors: Record<string, string> = {
  new: 'text-blue-600 border-blue-600/30 bg-blue-600/5',
  fix: 'text-gray-400 border-gray-600/30 bg-gray-600/5',
  improve: 'text-green-600 border-green-600/30 bg-green-600/5',
}

const typeLabels: Record<string, string> = {
  new: 'NEW',
  fix: 'FIX',
  improve: 'UPD',
}

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-[10px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase hover:text-blue-600 transition-colors">← NUKITORU</Link>
          <Link href="/docs" className="text-[10px] tracking-[0.15em] text-gray-400 dark:text-gray-600 uppercase hover:text-blue-600 transition-colors">Docs →</Link>
        </div>

        <div className="mb-10">
          <h1 className="text-[13px] tracking-[0.3em] text-gray-900 dark:text-white uppercase font-medium">Changelog</h1>
          <p className="text-[10px] tracking-[0.1em] text-gray-400 dark:text-gray-600 mt-2">バージョン履歴・今後の予定</p>
        </div>

        {/* 今後の予定 */}
        <div className="mb-12">
          <h2 className="text-[11px] tracking-[0.25em] text-gray-900 dark:text-white uppercase font-medium mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">Upcoming</h2>
          <div className="space-y-3">
            {upcoming.map((item, i) => (
              <div key={i} className="border border-gray-100 dark:border-gray-800 p-3">
                <p className="text-[11px] tracking-[0.1em] text-gray-700 dark:text-gray-300 font-medium">{item.title}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* バージョン履歴 */}
        <div className="space-y-8">
          {versions.map((v) => (
            <div key={v.version}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[11px] tracking-[0.2em] text-gray-900 dark:text-white font-medium">{v.version}</span>
                {v.label && <span className="text-[8px] tracking-[0.15em] px-2 py-0.5 bg-blue-600 text-white uppercase">{v.label}</span>}
                <span className="text-[9px] text-gray-400 dark:text-gray-600 ml-auto">{v.date}</span>
              </div>
              <div className="space-y-2 pl-2 border-l border-gray-100 dark:border-gray-800">
                {v.changes.map((c, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`text-[8px] tracking-[0.1em] px-1.5 py-0.5 border shrink-0 mt-0.5 ${typeColors[c.type]}`}>{typeLabels[c.type]}</span>
                    <p className="text-[11px] text-gray-600 dark:text-gray-400">{c.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-gray-100 dark:border-gray-800">
          <Link href="/" className="text-[10px] tracking-[0.15em] text-blue-600 uppercase">← Back to NUKITORU</Link>
        </div>
      </div>
    </div>
  )
}
