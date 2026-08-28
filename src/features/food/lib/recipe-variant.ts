// ============================================================
// recipe-variant.ts
//
// MISSION 2.13 — Evidence Variant Foundation。
//
// 「同じ料理名でも複数の正当な作り方が存在する」という現実を、
// Evidence Systemの中で安全に扱うための決定論的ルールチェッカー。
//
// 絶対ルール:
// - AIによるテキスト解析・fuzzy matching・隠れた自動分類は一切行わない。
//   ここにある関数はすべて、人間の研究者が実際にSourceを読んで確認した
//   事実（boolean/文字列）を引数として渡すことを前提とする純粋関数。
// - 数値の食い違いだけを理由にvariantを自動生成しない
//   （isEstablishedVariant()のcreatedOnlyToResolveConflictフラグ参照）。
// - source数の多数決でvariantを決めない。
// - isRecipePublishable()のEvidence解決判定を、この関数の結果で
//   緩めたり迂回したりしない（このモジュールは分類の判定のみを行い、
//   publishability判定には一切接続しない）。
// ============================================================

/**
 * variantを正当化しうる調理上の次元。
 * MEANINGFUL_DIMENSIONSに含まれる6種のみがvariantの根拠になり得る。
 * seasoning-amount / source-author / numeric-difference / brand-preference /
 * product-decisionは、単独では絶対にvariantの根拠にならない
 * （EVIDENCE_POLICY.md「Variant Establishment Rules」参照）。
 */
export type VariantDimensionKind =
  | 'cooking-method'
  | 'sauce-base'
  | 'major-ingredient-structure'
  | 'regional-style'
  | 'serving-form'
  | 'preparation-method'
  | 'seasoning-amount'
  | 'source-author'
  | 'numeric-difference'
  | 'brand-preference'
  | 'product-decision'

const MEANINGFUL_DIMENSIONS: ReadonlySet<VariantDimensionKind> = new Set([
  'cooking-method',
  'sauce-base',
  'major-ingredient-structure',
  'regional-style',
  'serving-form',
  'preparation-method',
])

/**
 * 与えられた次元が、variantを正当化しうる「意味のある」次元かどうかを判定する。
 * 小さな調味料量の違い・情報源の著者・恣意的な数値差・ブランドの好み・
 * Product Decisionは、単独では絶対にfalseを返す。
 */
export function isMeaningfulVariantDimension(kind: VariantDimensionKind): boolean {
  return MEANINGFUL_DIMENSIONS.has(kind)
}

export interface VariantEstablishmentInput {
  /** 安定したID。数値conflictの解消のためだけに作らない */
  variantId: string
  /** このvariantを特徴づける具体的な調理上の特徴の説明文一覧 */
  definingCharacteristics: string[]
  /** 上記の特徴がどの次元に基づくか（isMeaningfulVariantDimensionで判定される） */
  dimensionKinds: VariantDimensionKind[]
  /** このvariant概念を支持するsource id一覧 */
  sourceIds: string[]
  /**
   * true = 人間の研究者が、権威ある情報源（政府・メーカー公式・専門家等）が
   * それ自体でこのvariantを明示的に別の調理法/styleとして区別して提示している
   * ことを確認した場合のみtrueにする（例: キッコーマン公式ページが
   * 「フライパン法」「グリル法」を別セクションとして明示している、等）。
   */
  hasExplicitAuthoritativeSource: boolean
  /**
   * 人間の研究者が設定する誠実性フラグ。trueの場合、他の条件に関わらず
   * variantとして確立しない（「数値の食い違いを解消するためだけに
   * variantを作った」ことを意味するため）。
   */
  createdOnlyToResolveConflict: boolean
}

/**
 * MISSION 2.13で採用したvariant確立ルール（EVIDENCE_POLICY.md参照）:
 *
 * variantとして確立できるのは、次のすべてを満たす場合のみ:
 * 1. variantIdが空でない（安定ID）
 * 2. definingCharacteristicsが1件以上ある
 * 3. dimensionKindsのうち少なくとも1つがisMeaningfulVariantDimension()を満たす
 * 4. （2独立source）または（1件の権威ある情報源がそれ自体でこのvariantを
 *    明示している）のいずれかを満たす
 * 5. createdOnlyToResolveConflictがtrueでない
 *
 * これはisRecipePublishable()のEvidence解決判定には一切接続しない
 * （variantが確立されたとしても、それだけではどのfieldもVERIFIED解決済みにはならない）。
 */
export function isEstablishedVariant(input: VariantEstablishmentInput): boolean {
  if (input.createdOnlyToResolveConflict) return false
  if (input.variantId.trim().length === 0) return false
  if (input.definingCharacteristics.length === 0) return false
  if (!input.dimensionKinds.some(isMeaningfulVariantDimension)) return false
  if (input.hasExplicitAuthoritativeSource) return true
  return new Set(input.sourceIds).size >= 2
}
