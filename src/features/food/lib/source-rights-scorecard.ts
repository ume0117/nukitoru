// ============================================================
// source-rights-scorecard.ts
//
// MISSION 2.41C — MAFF Record Rights Resolution。
//
// 目的: Rights Evidence / Rights Decision / Rights Conditions / Unresolved Questions を
// **分離して保持**する。Claude Code 自身は法的結論を生成しない（§8）。
//
// 絶対ルール:
// - 既存 RightsFlag（allowed / conditional / prohibited / unknown）を再利用。新 enum を作らない（§9）。
// - reason は string code。列挙型を乱立させない。
// - Source Score は Research Prioritization のためだけ（§14）。数値スコアで Rights を自動決定しない。
//   Rights Decision ≠ Source Score。
// - 「禁止 Evidence」と「許可 Evidence 不足」を混同しない（§11）。
//   第三者 Credit があるだけで prohibited にしない。source-level allowed だけで third-party cleared にしない。
// - Firewall: このモジュールは recipe-publishability / recipe-safety / practical-cook-validation /
//   recipe-catalog / ai-provider / food-matching / world-food-knowledge を import しない。
//   Rights Gate（recipe-evidence-pack.ts の validate / canEnterRecipeImport）を変更しない。
//   ネットワーク通信・ページ自動取得・ブラウザ操作を実装しない（§24）。
// ============================================================

import type { RightsFlag } from '@/features/food/types'

// ------------------------------------------------------------
// Rights Evidence Record（§6 / §7 / §9）
// ------------------------------------------------------------

/** Rights を判断する対象の層。SOURCE ≠ RECORD ≠ ASSET を維持（§5） */
export type RightsScope = 'source-purpose' | 'record' | 'third-party' | 'asset'

export interface RightsEvidenceRecord {
  scope: RightsScope
  /** External Research Layer が確認した事実（利用を支持する / 条件を示す記述）。法的結論ではない */
  evidenceFound: string[]
  /** commercial structured-fact reuse を確定するのに不足している Evidence */
  evidenceMissing: string[]
  /**
   * 現時点の判断（RightsFlag を再利用）。
   * cleared / allowed へは External Research の明示 Evidence 無しに動かさない（§20）。
   */
  decision: RightsFlag
  /** 判断の string reason code（新 enum を作らない — §9） */
  reasonCodes: string[]
  /** Rights を前へ進める research action（§12 の A〜E に対応） */
  nextResearch: string[]
}

/**
 * MAFF「うちの郷土料理」の Record Rights 分析（MISSION 2.41C・External Research Evidence 由来）。
 *
 * これは「NUKITORU が第三者 Credit つき Record の Structured Facts を商用利用してよいか」を
 * **確定するものではない**。現時点で Evidence から言えることと、不足している Evidence を分離して記録する。
 */
export const MAFF_KYODO_RYORI_RIGHTS_ANALYSIS: RightsEvidenceRecord[] = [
  {
    scope: 'source-purpose',
    evidenceFound: [
      'MAFF「うちの郷土料理」ABOUT/TOP: 各地域で選定された郷土料理のいわれ・歴史・レシピ・地域背景等の'
        + 'データベースを作成し情報発信する目的と説明されている',
      'MAFF は家庭での調理だけでなく、外食企業でのメニュー化・食品製造企業での商品化・郷土料理の調査'
        + '等への活用を明示的に案内している',
    ],
    evidenceMissing: [
      '「活用の案内」は source-purpose の記述であり、第三者レシピ提供元表示のある個別 Record について'
        + 'NUKITORU による商用 structured-fact reuse が許諾されているかを個別に確定するものではない',
    ],
    decision: 'conditional',
    reasonCodes: [
      'SOURCE_PURPOSE_SUPPORTS_REUSE',
      'COMMERCIAL_MENU_AND_PRODUCT_USE_ENCOURAGED_AT_SOURCE_LEVEL',
      'COMMERCIAL_STRUCTURED_FACT_REUSE_NOT_EXPLICIT_PER_RECORD',
    ],
    nextResearch: [
      '§12-A: MAFF「リンク・著作権について」/ 当該コンテンツ利用規約で第三者 Recipe Record の扱いを明示確認',
    ],
  },
  {
    scope: 'record',
    evidenceFound: [
      'MAFF SEARCH & MENU: 47 都道府県・1,365 種の郷土料理をレシピ・歴史等で検索できる Official Database'
        + 'であることを確認（Database existence の Evidence）',
    ],
    evidenceMissing: [
      'Database の存在は個々の Record の再利用権をまとめて clear しない',
      '第三者提供 Record の record-level 商用 structured-fact reuse を明示する Evidence',
    ],
    decision: 'unknown',
    reasonCodes: ['OFFICIAL_DATABASE', 'DATABASE_EXISTENCE_NOT_RECORD_CLEARANCE', 'RECORD_REUSE_NOT_EXPLICIT'],
    nextResearch: [
      '§12-B: MAFF 担当部署へ Structured Facts の商用利用について確認',
      '§12-D: 第三者 Credit の無い MAFF-held / 自治体提供 Record を Batch 対象として優先',
    ],
  },
  {
    scope: 'third-party',
    evidenceFound: [
      '親子丼・玉子焼き（東京都）: 「近藤 惠津子（『食材選びからわかるおうちごはん』より）」の'
        + 'レシピ提供元表示が存在する',
      '他の「うちの郷土料理」ページにも、レシピ提供元名・書籍名・個人名の表示が存在することを'
        + 'External Research Layer で確認している',
    ],
    evidenceMissing: [
      '第三者提供元（個人 / 書籍出版社）による structured-fact の商用再利用に関する利用条件',
      'MAFF 掲載が第三者著作物の再利用許諾まで含むのかを示す明示的記述',
    ],
    decision: 'unknown',
    reasonCodes: ['THIRD_PARTY_RECIPE_CREDIT', 'ATTRIBUTION_PRESENT', 'LEGAL_REVIEW_REQUIRED'],
    nextResearch: [
      '§12-C: 第三者 Recipe 提供元 / 権利者の利用条件を確認',
      '§12-D: 第三者 Credit の無い Record を優先',
      '§12-E: 別の Official Source で commercial structured-fact reuse が明確な Recipe を選ぶ',
    ],
  },
  {
    scope: 'asset',
    evidenceFound: [
      'MAFF 個別ページ: ダウンロード可能画像は「リンク・著作権について」を確認し、'
        + '「農林水産省 うちの郷土料理」を出典として明記、画像提供元表示がある場合はその提供元も記載、と案内',
    ],
    evidenceMissing: [],
    decision: 'conditional',
    reasonCodes: ['ASSET_SEPARATE', 'ATTRIBUTION_REQUIRED', 'IMAGE_PROVIDER_CREDIT_MAY_APPLY'],
    nextResearch: [
      'NUKITORU は今回画像を一切利用しない。Evidence Pack の imageAssetStatus は保守的に prohibited のまま'
        + '（変更しない）。画像利用が必要になった時点で別途 asset review',
    ],
  },
]

/** MISSION 2.41C 時点の結論（§10 / §11）。cleared へ変更禁止（§20） */
export const MAFF_KYODO_RYORI_CURRENT_DECISION = {
  oyakodon: 'REVIEW_REQUIRED' as const,
  tamagoyaki: 'REVIEW_REQUIRED' as const,
  /** PROHIBITED ではない。「許可 Evidence 不足」であって「禁止 Evidence」ではない（§11） */
  isProhibited: false,
  note:
    'Source-level では MAFF が外食メニュー化・食品商品化・調査への活用を推奨している。しかし第三者 Recipe '
    + 'Credit のある個別 Record について NUKITORU による commercial structured-fact reuse が明示許諾されている'
    + 'とまでは今回の Evidence だけで確定しない。したがって REVIEW_REQUIRED を維持し、cleared にしない。',
}

// ------------------------------------------------------------
// Source Selection Scorecard（§14）— Research Prioritization のみ
// ------------------------------------------------------------

/** 各軸の「NUKITORU 採用にとっての明確さ / 有利さ」。数値化しない */
export type ScorecardRating = 'strong' | 'moderate' | 'weak' | 'unknown'

export interface SourceSelectionScorecard {
  sourceId: string
  sourceName: string
  axes: {
    officiality: ScorecardRating
    sourceBodyAccessibility: ScorecardRating
    structuredFactCompleteness: ScorecardRating
    commercialUseClarity: ScorecardRating
    recordRightsClarity: ScorecardRating
    /** 高複雑度ほど weak（＝第三者権利が絡むほど不利） */
    thirdPartyRightsComplexity: ScorecardRating
    assetSeparation: ScorecardRating
    attributionRequirements: ScorecardRating
    recipeProcessCompleteness: ScorecardRating
    ingredientCoverageUtility: ScorecardRating
  }
  /** Research Prioritization メモのみ。Rights Decision ではない */
  researchNote: string
}

/**
 * §14 — Source 選定用 Scorecard。**aggregate 数値スコアを持たない**。
 * Rights Decision ≠ Source Score。用途は「次にどの Source を調べるか」の優先順位付けのみ。
 */
export const SOURCE_SELECTION_SCORECARDS: SourceSelectionScorecard[] = [
  {
    sourceId: 'jp-maff-kyodo-ryori',
    sourceName: '農林水産省「うちの郷土料理」',
    axes: {
      officiality: 'strong',
      sourceBodyAccessibility: 'moderate', // External Research Layer は本文確認可。Claude Code 直接 fetch は 403
      structuredFactCompleteness: 'strong', // 親子丼: 分量・火加減・時間・完成 Cue まで確認できた
      commercialUseClarity: 'moderate', // source-level は前向き。個別 record は不明確
      recordRightsClarity: 'weak', // 第三者 Credit つき record の再利用権が不明
      thirdPartyRightsComplexity: 'weak', // 個人名・書籍名の Credit が record ごとに異なる
      assetSeparation: 'strong', // 画像 rights が独自条件で明確に分離されている
      attributionRequirements: 'moderate', // MAFF + 提供元の attribution が必要
      recipeProcessCompleteness: 'strong',
      ingredientCoverageUtility: 'moderate', // egg branch → 複数 Recipe へ分岐
    },
    researchNote:
      'Source-level は商用利用に前向きだが、第三者 Credit のある個別 Record は record rights が不明。'
      + '第三者 Credit の無い MAFF-held / 自治体提供 Record を優先すれば adoption コストが下がる（§12-D / §15）。'
      + 'または MAFF「リンク・著作権について」の明示確認（§12-A）で record 扱いを確定する。',
  },
]

// ------------------------------------------------------------
// Third-party-free candidate 識別（§15）
// ------------------------------------------------------------

/** Evidence Pack の rights から「第三者 review が要る」ものを識別する最小 signal */
export interface ThirdPartyReviewSignal {
  needsThirdPartyReview: boolean
  reason: string
}

/**
 * §15 — 第三者 review の要否を返す純粋関数。
 * `thirdPartyIndication === true` かつ review が 'cleared' でなければ review 必要。
 * 外部サイトへの自動アクセスはしない（Candidate Evidence は External Research Layer が提供する）。
 */
export function thirdPartyReviewSignalFor(rights: {
  thirdPartyIndication?: boolean
  thirdPartyRightsReview?: 'cleared' | 'unresolved' | 'not-reviewed'
}): ThirdPartyReviewSignal {
  if (rights.thirdPartyIndication !== true) {
    return { needsThirdPartyReview: false, reason: '第三者 Credit なし（thirdPartyIndication 未設定 / false）' }
  }
  if (rights.thirdPartyRightsReview === 'cleared') {
    return { needsThirdPartyReview: false, reason: 'record-level rights review 済み（cleared）' }
  }
  return {
    needsThirdPartyReview: true,
    reason: `第三者 Credit あり・review = ${rights.thirdPartyRightsReview ?? 'not-set'}（fail-closed）`,
  }
}

/** §15 — 第三者 review 不要な pack だけを返す（Batch 優先度付け用） */
export function partitionByThirdPartyReview<
  T extends { rights: Parameters<typeof thirdPartyReviewSignalFor>[0] },
>(packs: T[]): { thirdPartyFree: T[]; needsReview: T[] } {
  const thirdPartyFree: T[] = []
  const needsReview: T[] = []
  for (const p of packs) {
    if (thirdPartyReviewSignalFor(p.rights).needsThirdPartyReview) needsReview.push(p)
    else thirdPartyFree.push(p)
  }
  return { thirdPartyFree, needsReview }
}

// ============================================================
// MISSION 2.41D — Public-sector provider distinction（§7 / §8 / §21）
// ============================================================

/**
 * Recipe 提供元の分類。§8 / §21 — private individual/publisher と public-sector を同一扱いしない。
 * ただし「public-sector だから自動 allowed」もしない（provider type は Rights Decision の入力の一つ）。
 */
export type RecipeProviderClass =
  | 'maff-held' // 提供元表示なし = MAFF 自身
  | 'public-sector' // 都道府県・自治体・公的機関
  | 'private-individual' // 個人名
  | 'private-publisher' // 書籍・出版社・民間企業
  | 'unknown'

/** 明示登録した提供元名だけを分類する（推測しない。未知は 'unknown'） */
const PUBLIC_SECTOR_PROVIDERS = new Set<string>([
  '山形県', '青森県', '岩手県', '宮城県', '秋田県', '福島県', '茨城県', '栃木県', '群馬県',
  '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県',
  '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県',
  '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県',
  '沖縄県', '北海道',
])

/**
 * §8 / §21 — 提供元名の分類。
 * - 空 / 未指定 → 'maff-held'
 * - 47 都道府県のいずれか（完全一致のみ）→ 'public-sector'
 * - 「〜より」等で書籍を含む → 'private-publisher'
 * - それ以外の個人名らしき表記 → 'private-individual'
 * - 判定できなければ 'unknown'
 */
export function classifyRecipeProvider(providerName: string | undefined | null): RecipeProviderClass {
  const p = (providerName ?? '').trim()
  if (p.length === 0) return 'maff-held'
  if (PUBLIC_SECTOR_PROVIDERS.has(p)) return 'public-sector'
  if (/『.+』|より$|出版|社$/.test(p)) return 'private-publisher'
  if (/^[一-龥ぁ-んァ-ヶ]{2,4}\s?[一-龥ぁ-んァ-ヶ]{1,4}$/.test(p)) return 'private-individual'
  return 'unknown'
}

/**
 * §2〜§6 — MAFF「リンクについて・著作権」本文 + PDL1.0 の追加 Evidence。
 * これは Source **General Rule** の Evidence であって、個別 Record への適用を確定するものではない（§6）。
 */
export const MAFF_LINK_COPYRIGHT_EVIDENCE = {
  evidenceUrl: 'https://www.maff.go.jp/j/use/link.html',
  generalRule:
    'MAFF ウェブサイトで掲載・発信しているコンテンツは、特記されていない限り農林水産省に著作権が帰属し、'
    + '権利表記の記載がない限り「公共データ利用規約（第1.0版）PDL1.0」に準拠した利用条件の下で利用可能。',
  pdlScope:
    'PDL1.0 適用対象コンテンツは、複製・公衆送信・翻訳・変形等の翻案を含め自由に利用でき、商用利用も可能。'
    + 'ただし PDL1.0 applicable content であることが前提で、第三者権利物には自動適用しない。',
  attributionCondition: 'コンテンツ利用時は出典を記載する。',
  modificationCondition:
    '編集・加工等して利用する場合は、出典とは別に「編集・加工したこと」を記載する。'
    + '加工した情報を、あたかも国・府省等が作成した情報であるかのように公表・利用してはいけない。',
  thirdPartyCondition:
    '第三者が権利を有していることを表示・示唆している場合、利用者側で確認する必要がある。',
} as const

/**
 * §9〜§22 — 山形県提供の「うちの郷土料理」Record（芋煮 / 納豆汁 / 玉こんにゃく）についての
 * Rights 分析。Claude Code は法的結論を生成しない（§7）。Evidence / Missing / Reason / NextResearch を分離保持。
 *
 * 結論: **public-sector provider（山形県）は private third-party（近藤 惠津子・書籍）とは別分類**だが、
 * 「都道府県提供 Record が MAFF の PDL1.0 grant に含まれる」ことを追加 Evidence が**明示していない**ため、
 * record-level PDL1.0 applicability を推測せずに PASS にはできない → REVIEW_REQUIRED（§22 / §40）。
 */
export const MAFF_YAMAGATA_PUBLIC_SECTOR_RIGHTS_ANALYSIS: RightsEvidenceRecord[] = [
  {
    scope: 'source-purpose',
    evidenceFound: [
      MAFF_LINK_COPYRIGHT_EVIDENCE.generalRule,
      MAFF_LINK_COPYRIGHT_EVIDENCE.pdlScope,
      '2.41C: MAFF は「うちの郷土料理」の外食メニュー化・食品商品化・調査等への活用を明示的に案内',
    ],
    evidenceMissing: [
      '「General Rule = PDL1.0」は個別 Record（特に外部提供元クレジットのある Record）への適用を'
        + '自動的に確定しない（§6 — Source General Rule ≠ Individual Record Applicability）',
    ],
    decision: 'conditional',
    reasonCodes: ['SOURCE_PURPOSE_SUPPORTS_REUSE', 'PDL1_0_GENERAL_RULE', 'PDL_APPLICABILITY_PER_RECORD_NOT_CONFIRMED'],
    nextResearch: [
      '§12-A: MAFF「リンクについて・著作権」/ コンテンツ利用条件で、都道府県提供 Record の PDL1.0 適用可否を明示確認',
    ],
  },
  {
    scope: 'record',
    evidenceFound: [
      '芋煮 / 納豆汁 / 玉こんにゃく: いずれも農林水産省ドメインの Official page・Source Body 逐語確認済み',
      'レシピ提供元名 = 「山形県」= public-sector provider（classifyRecipeProvider → public-sector）',
      'ページ上に「無断転載禁止」等の別利用条件・PDL 除外の権利表記は確認されていない',
    ],
    evidenceMissing: [
      '都道府県が MAFF データベースへ提供した Record が、MAFF の PDL1.0 grant の対象なのか、'
        + 'それとも 山形県 が別に権利を保持しているのかを示す明示的記述',
      '「レシピ提供：山形県」を required attribution に含めれば足りるのか、山形県の別途許諾が必要なのか',
    ],
    decision: 'unknown',
    reasonCodes: [
      'PUBLIC_SECTOR_PROVIDER',
      'NOT_PRIVATE_THIRD_PARTY',
      'NO_SEPARATE_TERMS_OBSERVED',
      'PDL_APPLICABILITY_TO_RECORD_NOT_EXPLICIT',
    ],
    nextResearch: [
      '§12-A: MAFF へ都道府県提供 Record の PDL1.0 適用を確認',
      '§12-C: 山形県（提供元）の郷土料理コンテンツ利用条件を確認',
    ],
  },
  {
    scope: 'third-party',
    evidenceFound: [
      '提供元「山形県」は 2.41B の「近藤 惠津子（『食材選びからわかるおうちごはん』より）」= '
        + 'private-individual + private-publisher とは**別分類（public-sector）**',
      '個人・出版社・民間企業の権利表示は確認されていない',
    ],
    evidenceMissing: [
      'public-sector provider の場合に MAFF の第三者確認条項（§4）が求める「確認」の到達点',
    ],
    decision: 'conditional',
    reasonCodes: ['PROVIDER_IS_PUBLIC_SECTOR', 'NOT_PRIVATE_COPYRIGHT_HOLDER', 'REVIEW_STILL_REQUIRED_FOR_PDL_APPLICABILITY'],
    nextResearch: [
      '山形県 = public-sector なので private-party HOLD とは扱わない。ただし record PDL applicability の'
        + '確認が済むまで REVIEW_REQUIRED（§21 / §22）',
    ],
  },
  {
    scope: 'asset',
    evidenceFound: [
      '納豆汁ページ: Recipe image provider =「やまがたの広報写真ライブラリー」（Recipe Record provider = 山形県 とは別）',
      '2.41C: MAFF 画像は「リンク・著作権について」確認 + 出典明記 + 画像提供元表示、と独自条件',
    ],
    evidenceMissing: [],
    decision: 'prohibited',
    reasonCodes: ['ASSET_SEPARATE', 'IMAGE_PROVIDER_DIFFERS_FROM_RECIPE_PROVIDER', 'IMAGES_NOT_USED_THIS_BATCH'],
    nextResearch: ['今回画像を一切利用しない。Evidence Pack の imageAssetStatus は prohibited のまま変更しない'],
  },
]

/** §22 — 山形県 3 Record の現時点の結論（cleared / allowed へ変更禁止・§40） */
export const MAFF_YAMAGATA_CURRENT_DECISION = {
  imoni: 'REVIEW_REQUIRED' as const,
  nattojiru: 'REVIEW_REQUIRED' as const,
  tamakonnyaku: 'REVIEW_REQUIRED' as const,
  isProhibited: false, // 禁止 Evidence は無い。「PDL applicability 未確認」であって「禁止」ではない
  providerClass: 'public-sector' as const,
  note:
    'MAFF の General Rule（PDL1.0・商用可・出典 + 加工表示条件）と「うちの郷土料理」の商用活用推奨は確認済み。'
    + '提供元「山形県」は public-sector で private third-party（書籍・個人）とは別分類。しかし「都道府県提供 Record が '
    + 'MAFF の PDL1.0 grant に含まれる」ことを追加 Evidence が明示していないため、record-level PDL applicability を'
    + '推測せずに Rights PASS にはしない（§22 / §40）。3 Record とも REVIEW_REQUIRED を維持し Import しない。',
}

export const MAFF_YAMAGATA_SCORECARD: SourceSelectionScorecard = {
  sourceId: 'jp-maff-kyodo-ryori',
  sourceName: '農林水産省「うちの郷土料理」× 山形県提供 Record',
  axes: {
    officiality: 'strong',
    sourceBodyAccessibility: 'moderate',
    structuredFactCompleteness: 'strong', // 芋煮: 分量・工程・条件付き Fact まで確認
    commercialUseClarity: 'moderate', // General Rule は明確・record 適用は未確認
    recordRightsClarity: 'moderate', // public-sector provider・別利用条件なし。ただし PDL applicability 未確認
    thirdPartyRightsComplexity: 'moderate', // private ではないが「確認要」条項が残る
    assetSeparation: 'strong',
    attributionRequirements: 'moderate', // MAFF + 山形県 の attribution + 加工表示
    recipeProcessCompleteness: 'strong', // 芋煮: 手順順序 + 一部火加減。玉こんにゃくは火加減・時間 SOURCE_NOT_STATED
    ingredientCoverageUtility: 'moderate',
  },
  researchNote:
    'private-party（親子丼・玉子焼き）より record rights は明確に近い（public-sector provider・別利用条件なし）。'
    + '残る 1 点「都道府県提供 Record への PDL1.0 適用」を §12-A / §12-C で確認できれば Rights PASS へ進める可能性が高い。'
    + 'これが「同じ条件の Public-sector Recipe を安全に増やせる」道になり得る（§0 / §42）。',
}

// ============================================================
// MISSION 2.41E — Public-sector Record Rights Final Gap
//
// 追加 External Research: MAFF 別紙・山形県 Open Data 条件。
// **License が存在すること ≠ 目的の Record へその License が適用されること**（§31）。
// License inheritance をしない。Source / Record / Provider / Asset ごとに保持（§10）。
// ============================================================

/**
 * §3 — MAFF「利用規約」別紙 `https://www.maff.go.jp/j/use/bessi.html`。
 * 「第三者に権利があることを表示・示唆している例」として示されているもの。
 * **「レシピ提供元名」という語は直接列挙されていない** → NUKITORU では「必ず第三者著作権」とも
 * 「権利表記ではない」とも断定せず、Review Signal として扱う。
 */
export const MAFF_APPENDIX_THIRD_PARTY_EVIDENCE = {
  evidenceUrl: 'https://www.maff.go.jp/j/use/bessi.html',
  indicatedExamples: ['資料：○○', '写真提供：○○', '○○ホームページ', '出典：○○'],
  recipeProviderNameListed: false,
  nukitoruTreatment:
    '「レシピ提供元名：山形県」は上記例示に直接該当しない。しかし非 MAFF provider の明示であることは事実。'
    + '「必ず第三者著作権」とも「権利表記ではない」とも断定せず、Rights Review Signal（thirdPartyIndication=true）として扱う。',
} as const

/**
 * §6 / §7 — 山形県オープンデータカタログ。
 * `https://www.pref.yamagata.jp/020051/kensei/shoukai/toukeijouhou/tokeijoho-opendate/opendata/index.html`
 * カタログ掲載データは注記があるものを除き **CC BY 4.0**。ただし外部サイトへのリンク先は Open Data ではなく、
 * リンク先サイトの著作権の取扱いに従う（§7 external-link boundary）。
 */
export const YAMAGATA_OPEN_DATA_EVIDENCE = {
  evidenceUrl:
    'https://www.pref.yamagata.jp/020051/kensei/shoukai/toukeijouhou/tokeijoho-opendate/opendata/index.html',
  catalogLicense: 'CC BY 4.0',
  catalogLicenseScope: '山形県 Open Data Catalog で公開するデータのうち、注記があるものを除く',
  externalLinkBoundary:
    'カタログ内の外部サイトへのリンク先は Open Data ではない。リンク先サイトの著作権の取扱いに従う。'
    + 'よって「Yamagata Open Data Catalog = CC BY 4.0」から MAFF 掲載「芋煮 山形県」まで CC BY 4.0 と推論しない（§7）。',
} as const

/**
 * §8 — 完全分離すべき 5 つの Content 区分。A が CC BY 4.0 でも B/C/D/E へ自動継承しない。
 */
export const CONTENT_CATEGORY_SEPARATION = [
  { key: 'A', label: '山形県 Open Data Catalog に直接掲載されている Data', license: 'CC BY 4.0（注記除く）' },
  { key: 'B', label: '山形県 Web Site 上の通常 Content', license: '山形県サイトの著作権の取扱いに従う（未確認）' },
  { key: 'C', label: '山形県が MAFF へ提供した Content（芋煮等のレシピ）', license: 'NOT ESTABLISHED（本 MISSION の Gap）' },
  { key: 'D', label: 'MAFF が自ら作成した Content', license: 'PDL1.0 general rule（権利表記がない限り）' },
  { key: 'E', label: '第三者 private provider Content（親子丼・玉子焼き = 近藤 惠津子・書籍）', license: 'record-level review required（2.41B HOLD）' },
] as const

/**
 * §9 — Rights Matrix。License が存在することと、目的 Record へ適用されることを分離して保持。
 */
export const MAFF_YAMAGATA_RIGHTS_MATRIX: {
  subject: string
  licenseEvidence: string
  appliesToTargetRecord: RightsFlag
  note: string
}[] = [
  {
    subject: 'MAFF General Content',
    licenseEvidence: 'PDL1.0 general rule exists（MAFF「リンクについて・著作権」）',
    appliesToTargetRecord: 'conditional',
    note: 'General rule は存在。個別 Record への適用は条件次第（権利表記の有無等）',
  },
  {
    subject: 'MAFF content with no rights indication',
    licenseEvidence: 'potentially PDL1.0 applicable, subject to conditions',
    appliesToTargetRecord: 'conditional',
    note: '出典表示・加工表示等の条件を満たせば適用可能性がある',
  },
  {
    subject: 'MAFF content with provider indication（芋煮等）',
    licenseEvidence: 'record-specific review required',
    appliesToTargetRecord: 'unknown',
    note: '「レシピ提供元名：山形県」= 非 MAFF provider indication。record 単位の確認が要る',
  },
  {
    subject: 'Yamagata Open Data Catalog content',
    licenseEvidence: 'CC BY 4.0, subject to catalog terms',
    appliesToTargetRecord: 'unknown',
    note: 'カタログ掲載データには適用。MAFF 掲載レシピには自動適用しない（external-link boundary）',
  },
  {
    subject: 'Yamagata-provided MAFF Recipe（芋煮 / 納豆汁 / 玉こんにゃく）',
    licenseEvidence: 'license currently NOT ESTABLISHED',
    appliesToTargetRecord: 'unknown',
    note: '本 MISSION の core gap。PDL1.0 と CC BY 4.0 のどちらが適用されるか、あるいは別条件かが未確定',
  },
]

/**
 * §10 — License inheritance をしない。PDL1.0 と CC BY 4.0 を統合しない。
 * どちらか有利な License を勝手に Recipe へ適用しない。
 */
export const LICENSE_INHERITANCE_RULE = {
  prohibited: true,
  statement:
    'PDL1.0 と CC BY 4.0 を統合しない。有利な License を Record へ勝手に適用しない。'
    + 'Source / Record / Provider / Asset ごとに License を保持する。',
} as const

/**
 * §12 — 現在残っている Rights Gap（非常に限定された 2 問）。
 * この 2 問のどちらかが「はい」なら Rights PASS へ進める。
 */
export const MAFF_YAMAGATA_REMAINING_RIGHTS_GAP = {
  questionA:
    'MAFF「うちの郷土料理」で「レシピ提供元名：山形県」と表示されている Recipe Record は、'
    + 'MAFF Website の PDL1.0 に基づいて商用サービスで利用可能な Content に含まれるか。',
  questionB:
    '含まれない場合、山形県は MAFF へ提供した当該 Recipe Record の料理名・材料・分量・調理工程等の '
    + 'Structured Facts について、出典を明示し必要な加工表示を行う条件で、商用 Web Service での再利用を認めているか。',
  resolvedBy: 'MAFF または 山形県 への確認のみ（コード変更不要）',
} as const

/**
 * §13 — 問い合わせ / 再利用の対象を広げすぎない。
 */
export const NUKITORU_STRUCTURED_FACT_SCOPE = {
  wanted: ['料理名', '材料名', '材料分量', '人数', '下準備', '調理工程', '火加減', '時間', '完成Cue'],
  notWanted: ['Recipe 写真', 'Recipe 動画', 'イラスト', 'ロゴ', '文章の丸ごと転載', '書籍本文', '画像 Asset'],
} as const

/** §14 — 問い合わせ時に説明できる NUKITORU の使い方（簡潔版） */
export const NUKITORU_USE_CASE_SUMMARY =
  'NUKITORU は、家庭にある食材から作れそうな料理を探し、材料・不足食材・調理手順をスマートフォンで'
  + '分かりやすく表示する Web Service。Source Recipe をそのまま転載せず、Structured Facts として整理し'
  + 'NUKITORU 独自 UI で表示する。商用サービスになる可能性がある。Source attribution を保持し、必要な'
  + '加工表示にも対応可能。画像は利用しない。'

/**
 * §16 / §17 — 問い合わせ Draft（送信しない — §18）。docs / manifest 用の下書き文面。
 * 法的断定を求めず「この利用方法は貴サイトの利用条件の対象に含まれますか」の確認形式。
 */
export const RIGHTS_INQUIRY_DRAFTS = {
  maff:
    '農林水産省「うちの郷土料理」に掲載されている「レシピ提供元名：山形県」等の公的機関提供レシピについて、'
    + '料理名・材料・分量・調理工程等を構造化し、出典を明示したうえで商用 Web Service 内で再構成して表示する場合、'
    + '農林水産省 Web Site の PDL1.0 準拠利用条件の対象として利用可能でしょうか。'
    + '写真・動画等は利用しません。編集・加工表示等、必要な表示条件があればご教示ください。',
  yamagata:
    '農林水産省「うちの郷土料理」に掲載され、レシピ提供元名として「山形県」と表示されている芋煮・納豆汁・'
    + '玉こんにゃく等について、料理名・材料・分量・調理工程等を構造化し、出典（農林水産省／レシピ提供：山形県）'
    + '等を表示したうえで、商用 Web Service 内で再構成して表示することは可能でしょうか。写真・動画は利用しません。'
    + '山形県オープンデータカタログの CC BY 4.0 が当該提供レシピにも適用されるか、または別の利用条件があるか、ご教示ください。',
  contactNotSent: true, // §18 — メール / フォーム / 電話 いずれも送信していない
} as const

/**
 * §21 — Recipe Source を Recipe count だけで評価しないための KPI Concept（数値実装不要）。
 */
export const RIGHTS_CLEAR_SOURCE_KPI_CONCEPTS = [
  'Rights-clear Recipe Count',
  'Evidence-complete Recipe Count',
  'Canonicalizable Ingredient Coverage',
  'Process-complete Recipe Count',
  'Stock-to-Dish Branch Coverage',
  'Rights Review Cost per Recipe',
  'Attribution Complexity',
] as const

/**
 * §19 / §20 — Rights 問い合わせを待つ間の alternative source strategy（Discovery 実装なし）。
 */
export const ALTERNATIVE_SOURCE_PRIORITY = {
  criteria: [
    'Official',
    'Record-level License explicit',
    'Commercial reuse explicit',
    'Structured Fact completeness high',
    'No private third-party provider',
    'No asset dependency',
    'Attribution manageable',
  ],
  candidateShapes: ['Government Open Data', 'CC BY / CC0 Recipe Dataset', 'Official API with storage/reuse permission'],
  productDecision:
    '1 Source に固執しない。MAFF の Rights 確認コストが大量 Recipe 拡張のボトルネックになるなら、'
    + 'より明示的に Open License された Food Knowledge Source を Primary にし、MAFF は Supplementary / '
    + 'Regional Cuisine Source として利用する（§20）。',
} as const
