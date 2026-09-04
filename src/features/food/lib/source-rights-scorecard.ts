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
