# Nukitoru

**PDF・画像からQRコード・JANコード・バーコードを高精度で抽出する無料Webツール**

---

## 機能（MVP）

| 機能 | 詳細 |
|---|---|
| ファイル対応 | PDF（最大50MB）/ JPG・PNG・WEBP（最大20MB）|
| 対応コード | QR Code / JAN（EAN-13）/ EAN-8 / CODE 128 |
| 複数抽出 | グリッドスキャン＋コントラスト強化で全件取りこぼし最小化 |
| PDFページ | 全ページ自動解析（進捗バー表示） |
| プライバシー | ブラウザ内処理、サーバー送信なし |
| ダークモード | OS設定に自動対応 |
| モバイル | スマホはファイル選択、PCはドラッグ&ドロップ対応 |

---

## 技術スタック

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS** (`darkMode: 'media'` によるOS自動対応)
- **PDF.js 4.x** — ページ2倍スケールで高解像度レンダリング
- **@zxing/library** — QR・1Dバーコード検出（TRY_HARDER + グリッドスキャン）

### スキャン戦略（高精度優先）

ZXing は1回の呼び出しで1コードしか検出できない仕様のため、以下の領域を順次スキャンして全件抽出する：

1. 画像全体 × 1
2. 2×2 グリッド（オーバーラップ10%）× 4
3. 3×3 グリッド（画像300px以上の場合）× 9
4. 水平ストリップ × 6（1Dバーコード特化）
5. コントラスト強化（ヒストグラム正規化）版で全体再スキャン × 1

合計 **21スキャン/Canvas** → type+value で重複除外。

---

## セットアップ

### 必要環境

- Node.js 18 以上
- npm / yarn / pnpm

### インストール & 起動

```bash
npm install
npm run dev
# http://localhost:3000 でアクセス
```

### 本番ビルド確認

```bash
npm run build
npm start
```

---

## Vercel デプロイ

1. GitHub にプッシュ
2. [vercel.com](https://vercel.com) でプロジェクト作成 → リポジトリ連携
3. Framework: **Next.js** を選択（自動検出）
4. 環境変数: 現時点では不要
5. Deploy → 完了

> **Note:** Vercel でビルドする場合は `src/app/layout.tsx` の
> Inter フォントのコメントを解除すると、よりきれいなフォントになります。

---

## ディレクトリ構成

```
src/
├── app/
│   ├── layout.tsx          # ルートレイアウト・SEOメタ
│   ├── page.tsx            # ホームページ（サーバーコンポーネント）
│   └── globals.css
├── components/
│   ├── ScannerSection.tsx  # クライアント統合コンポーネント
│   ├── layout/
│   │   └── Header.tsx
│   ├── upload/
│   │   └── UploadArea.tsx  # D&D + ファイル選択
│   ├── scanner/
│   │   └── ScanProgress.tsx
│   └── results/
│       ├── ResultList.tsx
│       └── ResultItem.tsx
├── hooks/
│   └── useFileProcessor.ts # スキャン状態管理
├── lib/
│   ├── scanner/
│   │   └── scanner.ts      # ZXing グリッドスキャン
│   ├── pdf/
│   │   └── processor.ts    # PDF.js 全ページ処理
│   └── utils/
│       ├── cn.ts
│       ├── dedup.ts
│       └── validation.ts
└── types/
    └── index.ts            # 型定義（将来拡張スタブ含む）
```

---

## 将来の拡張予定（設計上の考慮済み）

| 機能 | 技術 | 備考 |
|---|---|---|
| ユーザー認証 | NextAuth.js / Clerk | `src/types/index.ts` に `UserPlan` スタブあり |
| 履歴保存（Pro） | Supabase / PlanetScale | `ScanHistoryEntry` スタブあり |
| CSV出力（Pro） | ブラウザ内生成 | クライアントのみで実装可能 |
| 一括処理（Pro） | ページネーション追加 | 現設計で対応可能 |
| 商品検索（Pro） | Amazon PA-API | 売上実績後に申請 |
| AI解析（Pro） | Anthropic API | Vercel 関数タイムアウトに要注意（60秒） |
| 決済 | Stripe（アカウント取得済み） | Pro プランUI追加後に実装 |

---

## 注意事項

- **PDF.js Worker**: `unpkg.com` CDN から取得。オフライン環境では PDF 解析が動作しない。
  - 完全オフライン対応が必要な場合は `public/pdf.worker.min.mjs` にコピーして workerSrc を変更。
- **ZXing**: ブラウザ専用ライブラリ。SSRでは動作しない（動的インポートで対策済み）。
- **Vercel 無料プラン**: サーバーレス関数タイムアウト60秒。現状はすべてクライアント処理のため制約なし。

---

## ライセンス

MIT
