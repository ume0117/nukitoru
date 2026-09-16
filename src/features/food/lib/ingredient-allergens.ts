// ============================================================
// ingredient-allergens.ts
//
// MISSION 2.25 — Japan Allergen Evidence & Minimal Relation Model。
//
// MISSION 2.24 の ALLERGEN_EVIDENCE_REQUIRED を解消する。
//
// 【canonicalization / taxonomy / allergen composition の3層分離】
//   - canonicalization（ingredient-normalization.ts）: 表記ゆれ（chicken → 鶏肉）
//   - taxonomy（ingredient-taxonomy.ts）: 同じ食材の broader/narrower（鶏もも肉 → 鶏肉）
//   - allergen composition（このモジュール）: 加工食品 → 含まれ得るアレルゲン
//     （しょうゆ → 小麦 / 大豆 のリスク）。前2層とは別概念。
//     「しょうゆ broader 小麦」のような taxonomy 関係は作らない。
//     canonicalize で しょうゆ = 小麦 に潰さない。
//
// 【絶対ルール】
// - AI一般知識をEvidenceにしない。すべての関係は、実際に開いた
//   公的資料（消費者庁）または製造者公式のアレルギー表示に基づき、
//   sourceIds で EVIDENCE_SOURCE_CATALOG の実在 entry を参照する。
// - fuzzy / substring / Levenshtein / runtime AI 分類は一切しない。
//   人間が確認した明示的な relation table のみ。
// - relation table にない ingredient は「アレルゲン関係なし」ではなく
//   「未評価（このモジュールの対象外）」。UNKNOWN を勝手に named allergen へ
//   変換しない（Section 12）。
// - STOCK / candidate matching には一切影響しない（allergy 判定のみ）。
// - 既存の Allergy HARD EXCLUSION（ingredient-taxonomy.ts / recipe-safety.ts）を
//   一切弱めない。このモジュールは「さらに除外する」方向にのみ働く（fail-safe）。
//
// 【日本の食品表示制度（2026-08時点。令和8年4月1日施行の区分）】
//   特定原材料（義務表示・9品目）: えび かに くるみ 小麦 そば 卵 乳
//     落花生 カシューナッツ
//   特定原材料に準ずるもの（推奨表示・20品目）: アーモンド あわび いか
//     いくら オレンジ キウイフルーツ 牛肉 ごま さけ さば 大豆 鶏肉
//     バナナ ピスタチオ 豚肉 マカダミアナッツ もも やまいも りんご ゼラチン
//   出典: 消費者庁「食物アレルギー表示に関する情報」（caa-food-allergy-labeling-2026）
// ============================================================

import { canonicalizeIngredientName } from './ingredient-normalization'

/**
 * ingredient と allergen の関係の種類。
 *
 * - 'default-generic-risk':
 *   標準的な市販 generic product として扱う限り、この allergen に関連する。
 *   同名でアレルゲン不使用の variant が実在する（＝ product-specific）が、
 *   Recipe が特定の allergen-free variant を明示的に verified していない限り、
 *   NUKITORU は fail-safe にこの allergen 関連として HARD EXCLUDE する（Section 8）。
 *   「すべての◯◯がこの allergen を含む」という主張ではなく、fail-safe な
 *   PRODUCT POLICY である。
 *
 * - 'contains'（MISSION 2.30）:
 *   食材の identity 自体がこの regulated allergen 関係を確立する。
 *   同名でアレルゲン不使用の variant が実在しない（別物なら別名になる）。
 *   例: 「小麦粉」は小麦を挽いた粉であり、小麦不使用の「小麦粉」は存在しない
 *   （米粉・そば粉・大豆粉等は別名称）。消費者庁 食品表示基準 別表第3 は
 *   「小麦粉」を「小麦」の拡大表記として扱う（原材料名に含めれば小麦使用が表示上明らか）。
 *   product-specific override の余地はない。default-generic-risk より強い。
 */
export type AllergenRelationType = 'default-generic-risk' | 'contains'

export interface IngredientAllergenRelation {
  /** canonical ingredient name（canonicalizeIngredientName 適用後） */
  ingredientName: string
  /** canonical allergen name（消費者庁の特定原材料等カテゴリ名） */
  allergenName: string
  relationType: AllergenRelationType
  /** この関係を裏付ける EVIDENCE_SOURCE_CATALOG の実在 id（1件以上） */
  sourceIds: string[]
  /** なぜこの関係を採用したかの人間による説明（fail-safe 方針を含む）。空文字不可 */
  policyReason: string
}

/**
 * 人間が確認した ingredient → allergen 関係。
 * scope: MISSION 2.25 で実際に公式資料・製造者公式を開いて確認したものだけ。
 * 大量の Food Graph は作らない。追加は都度、開いた Evidence に基づいて行う。
 *
 * ここに載るのは「HARD EXCLUDE を発火させる」関係のみ。
 * 「評価したがアレルゲン表示不要（例: 精製サラダ油の大豆）」は Recipe 側の
 * allergyIdentity 派生根拠（reviewNotes / derivation）に記録し、ここには載せない。
 */
const INGREDIENT_ALLERGEN_RELATIONS: readonly IngredientAllergenRelation[] = [
  {
    ingredientName: 'しょうゆ',
    allergenName: '小麦',
    relationType: 'default-generic-risk',
    sourceIds: [
      'caa-food-allergy-labeling-2026',
      'kikkoman-shoyu-allergen-2026',
      'sanj-glutenfree-shoyu-2026',
    ],
    policyReason:
      '標準的な市販こいくちしょうゆ（例: キッコーマン「しょうゆ」）は原材料に小麦を含み、'
      + 'アレルギー物質として「小麦」を表示する（小麦は特定原材料・義務表示）。'
      + '小麦不使用のたまり／グルテンフリーしょうゆ（例: サンジルシ醸造）も実在するため、'
      + '「しょうゆ」は product-specific だが、Recipe が特定の小麦不使用製品を verified に'
      + '明示しない限り、NUKITORU は fail-safe に小麦関連として HARD EXCLUDE する。',
  },
  {
    ingredientName: 'しょうゆ',
    allergenName: '大豆',
    relationType: 'default-generic-risk',
    sourceIds: [
      'caa-food-allergy-labeling-2026',
      'kikkoman-shoyu-allergen-2026',
      'sanj-glutenfree-shoyu-2026',
    ],
    policyReason:
      '標準的な市販しょうゆ（こいくち・たまりとも）は脱脂加工大豆／大豆を原材料とし、'
      + 'アレルギー物質として「大豆」を表示する（大豆は特定原材料に準ずるもの・推奨表示）。'
      + '大豆不使用のしょうゆ風調味料（米由来等）も実在するが、Recipe が verified に'
      + 'それを明示しない限り、fail-safe に大豆関連として HARD EXCLUDE する。',
  },
  {
    ingredientName: '小麦粉',
    allergenName: '小麦',
    relationType: 'contains',
    sourceIds: [
      'caa-food-allergy-labeling-2026',
      'tokyo-shokuhin-eisei-allergen-2026',
      'labelbank-allergy-hyoji-2026',
    ],
    policyReason:
      '「小麦粉」は小麦を挽いた粉であり、小麦不使用の「小麦粉」という製品は存在しない'
      + '（米粉・そば粉・大豆粉・コーンスターチ等はいずれも別名称）。'
      + '消費者庁 食品表示基準 別表第3 は「小麦粉」を「小麦」の拡大表記として例示しており'
      + '（原材料名に「小麦粉」と記載すれば小麦を使用していることが表示上明らか）、'
      + 'これは product-specific なリスク（default-generic-risk）ではなく食材 identity 自体が'
      + '確立する関係のため relationType を contains とする。'
      + '小麦は特定原材料（義務表示・9品目）。'
      + 'この関係は しょうゆ の default-generic-risk 関係とは独立に、'
      + '小麦アレルギー × 小麦粉を使う recipe を HARD EXCLUDE する。',
  },
  {
    // PUBLIC BETA RELEASE SPRINT 1D — niku-udon（豚肉こま切れ・うどん）の allergyIdentity
    // 完成のために追加。標準的な市販「うどん」は小麦粉を原材料とし小麦を表示するが、
    // 「米粉うどん」というグルテンフリー・小麦不使用の同名variantが実在の製品として
    // 販売されている（東亜食品工業・小林製麺 等、実際に確認）。小麦粉のような
    // 「同名で不使用variantが存在しない」ケースとは異なるため、relationTypeは
    // contains ではなく しょうゆ と同じ default-generic-risk とする。
    ingredientName: 'うどん',
    allergenName: '小麦',
    relationType: 'default-generic-risk',
    sourceIds: ['caa-food-allergy-labeling-2026'],
    policyReason:
      '標準的な市販うどん（乾麺・ゆで麺とも）は小麦粉を原材料とし、アレルギー物質として'
      + '「小麦」を表示する（小麦は特定原材料・義務表示）。「米粉うどん」という小麦不使用の'
      + 'グルテンフリー製品も実在するため product-specific だが、Recipe が特定の'
      + '小麦不使用製品を verified に明示しない限り、NUKITORU は fail-safe に小麦関連として'
      + 'HARD EXCLUDE する。',
  },
  {
    // PUBLIC BETA RELEASE SPRINT 1D — napolitan（パスタ）の allergyIdentity 完成のために追加。
    ingredientName: 'パスタ',
    allergenName: '小麦',
    relationType: 'default-generic-risk',
    sourceIds: ['caa-food-allergy-labeling-2026'],
    policyReason:
      '標準的な市販パスタ（乾麺）はデュラム小麦等の小麦粉を原材料とし、アレルギー物質として'
      + '「小麦」を表示する（小麦は特定原材料・義務表示）。「米粉パスタ」「ライスパスタ」という'
      + '小麦不使用のグルテンフリー製品も実在するため product-specific だが、Recipe が特定の'
      + '小麦不使用製品を verified に明示しない限り、NUKITORU は fail-safe に小麦関連として'
      + 'HARD EXCLUDE する（うどん・しょうゆと同型のdefault-generic-risk）。',
  },
]

/** ingredientName（canonical）に紐づく allergen relation の一覧 */
export function ingredientAllergenRelations(ingredientName: string): IngredientAllergenRelation[] {
  const canonical = canonicalizeIngredientName(ingredientName)
  return INGREDIENT_ALLERGEN_RELATIONS.filter((r) => r.ingredientName === canonical)
}

/**
 * ある recipe ingredient が、あるアレルギー名に対して除外対象のリスクを持つか。
 * canonical 完全一致で allergen 名を突き合わせる（fuzzy なし）。
 */
export function ingredientHitsAllergen(ingredientName: string, allergyName: string): boolean {
  const allergen = canonicalizeIngredientName(allergyName)
  return ingredientAllergenRelations(ingredientName).some((r) => r.allergenName === allergen)
}

/**
 * recipe の食材名のいずれかが、与えられたアレルギー名のいずれかに対して
 * allergen relation 上のリスクを持つか（基本Recipeの HARD EXCLUSION 追加判定）。
 * ingredient-taxonomy.ts の name/broader 判定とは独立で、両方が OR で効く。
 */
export function recipeIngredientsHitAllergenRisk(
  recipeIngredientNames: string[],
  allergyNames: string[],
): boolean {
  return recipeIngredientNames.some((ingredient) =>
    allergyNames.some((allergy) => ingredientHitsAllergen(ingredient, allergy)),
  )
}

/** テスト・監査用に relation table 全体を読み取り専用で公開する */
export function allIngredientAllergenRelations(): readonly IngredientAllergenRelation[] {
  return INGREDIENT_ALLERGEN_RELATIONS
}
