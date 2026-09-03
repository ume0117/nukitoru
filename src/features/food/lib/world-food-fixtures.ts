// ============================================================
// world-food-fixtures.ts
//
// MISSION 2.35 — World Food Knowledge Foundation。
//
// SOURCE RECIPE KNOWLEDGE と NUKITORU PRESENTATION の Schema / Pipeline 検証用の
// 最小 Fixture。**大量 Recipe Import ではない**。
//
// 絶対ルール:
// - 架空の Recipe facts を入れない。ここに入る料理事実は、すべて既存
//   EVIDENCE_SOURCE_CATALOG に実在する情報源に由来する。
// - 現状の 2 件（tori-teriyaki / buta-shogayaki）は、既存 catalog で
//   Recipe Evidence VERIFIED 済みの NHKきょうの料理・河野雅子の掲載事実を
//   「新しい Knowledge 形へ構造化し直した」ものであり、新しい Evidence では
//   ない（同じ NHK source を指す）。
// - 情報源が示さなかった火加減・時間は付けない（tori step3/4 の heat/time、
//   tori step5 / buta step3-4 の time は意図的に undefined）。
// - Presentation は buildPresentationStep 経由で生成し、料理事実を SOURCE から
//   のみ導出する（FACTS MUST NOT CHANGE を構造で担保）。
// - 国際料理の SOURCE RECIPE KNOWLEDGE は本 MISSION では未収録（Globalization Gap。
//   非日本語の権威ある情報源を開いて確認する作業は次 MISSION）。
// ============================================================

import type {
  NukitoruPresentation,
  SourceRecipeKnowledge,
} from '@/features/food/types'
import { buildPresentationStep, type AuthoredPresentationText } from './world-food-knowledge'

export { WORLD_RECIPE_IDENTITY_REGISTRY } from './world-recipe-identity'

const STRUCTURED_AT = '2026-09-03'

// ------------------------------------------------------------
// SOURCE RECIPE KNOWLEDGE
// ------------------------------------------------------------

/**
 * 鶏の照り焼き — NHKきょうの料理・河野雅子（kyounoryouri-toriteriyaki-kawano-2026）。
 * 事実は既存 recipe-catalog.ts の tori-teriyaki（VERIFIED #1）に記録済みの
 * NHK 観測サマリ（SOURCE D）と一致する。
 */
export const TORI_TERIYAKI_SOURCE_KNOWLEDGE: SourceRecipeKnowledge = {
  canonicalRecipeId: 'jp-tori-teriyaki',
  sourceRecipeName: '鶏の照り焼き',
  evidenceSourceId: 'kyounoryouri-toriteriyaki-kawano-2026',
  sourceLanguage: 'ja',
  servings: { displayText: '2人分', semantics: { kind: 'exact', value: 2, unit: '人分' } },
  ingredients: [
    {
      sourceIngredientName: '鶏もも肉',
      canonicalIngredientId: 'chicken',
      normalizedName: '鶏もも肉',
      japaneseName: '鶏もも肉',
      englishName: 'chicken thigh',
      originalLanguage: 'ja',
      role: 'required',
      quantity: {
        displayText: '（大）1枚 300g',
        semantics: { kind: 'exact', value: 300, unit: 'g' },
      },
    },
    {
      sourceIngredientName: 'スナップえんどう',
      japaneseName: 'スナップえんどう',
      englishName: 'snap peas',
      originalLanguage: 'ja',
      role: 'garnish',
      quantity: { displayText: '100g', semantics: { kind: 'exact', value: 100, unit: 'g' } },
    },
    {
      sourceIngredientName: 'しょうゆ',
      japaneseName: 'しょうゆ',
      englishName: 'soy sauce',
      originalLanguage: 'ja',
      role: 'seasoning',
      quantity: {
        displayText: '大さじ1',
        semantics: { kind: 'exact', value: 1, unit: '大さじ' },
      },
    },
    {
      sourceIngredientName: '酒',
      japaneseName: '酒',
      englishName: 'sake',
      originalLanguage: 'ja',
      role: 'seasoning',
      quantity: {
        displayText: '大さじ1',
        semantics: { kind: 'exact', value: 1, unit: '大さじ' },
      },
    },
    {
      sourceIngredientName: 'みりん',
      japaneseName: 'みりん',
      englishName: 'mirin',
      originalLanguage: 'ja',
      role: 'seasoning',
      quantity: {
        displayText: '大さじ1',
        semantics: { kind: 'exact', value: 1, unit: '大さじ' },
      },
    },
    {
      sourceIngredientName: '砂糖',
      japaneseName: '砂糖',
      englishName: 'sugar',
      originalLanguage: 'ja',
      role: 'seasoning',
      quantity: {
        displayText: '小さじ1',
        semantics: { kind: 'exact', value: 1, unit: '小さじ' },
      },
    },
    {
      sourceIngredientName: '塩',
      japaneseName: '塩',
      englishName: 'salt',
      originalLanguage: 'ja',
      role: 'seasoning',
      quantity: { displayText: '少々', semantics: { kind: 'culinary-term', term: '少々' } },
    },
    {
      sourceIngredientName: 'サラダ油',
      japaneseName: 'サラダ油',
      englishName: 'salad oil',
      originalLanguage: 'ja',
      role: 'seasoning',
      quantity: {
        displayText: '小さじ1',
        semantics: { kind: 'exact', value: 1, unit: '小さじ' },
      },
    },
  ],
  preCookPreparation: [
    {
      text: '調理する約30分前に鶏もも肉を室温に戻す',
      passiveWait: true,
      duration: { kind: 'approximate', minutes: 30 },
    },
  ],
  preparation: [
    { text: '鶏もも肉の余分な脂肪を除く' },
    { text: '筋の多いところや厚いところに切り目を入れる' },
    { text: '縦半分に切り、1切れを3等分にする（計6切れ）' },
    { text: 'しょうゆ・酒・みりん・砂糖・塩を混ぜ合わせてたれを作っておく' },
  ],
  equipment: ['フライパン'],
  cookingSteps: [
    {
      order: 1,
      factSummary: 'サラダ油小さじ1を中火で熱し、鶏もも肉を皮を下にして並べて焼く',
      ingredientsUsed: ['サラダ油', '鶏もも肉'],
      heat: 'medium',
      duration: { kind: 'range', minMinutes: 2, maxMinutes: 3 },
      oilUsage: 'サラダ油小さじ1',
      lidUsage: 'lid-off',
      completionSign: '焼き色がついたら',
    },
    {
      order: 2,
      factSummary: '返してふたをして弱めの中火で蒸し焼きにする',
      heat: 'medium-low',
      passiveDuration: { kind: 'range', minMinutes: 3, maxMinutes: 4 },
      lidUsage: 'lid-on',
    },
    {
      order: 3,
      factSummary: 'ふたを取り、ペーパータオルで溶け出た脂を拭く',
      lidUsage: 'lid-off',
      // 情報源はこの手順の火加減・時間を示していない → heat/duration は設定しない
    },
    {
      order: 4,
      factSummary: '混ぜ合わせておいたたれを回し入れる',
      ingredientsUsed: ['しょうゆ', '酒', 'みりん', '砂糖', '塩'],
      // 情報源はこの手順の火加減・時間を示していない
    },
    {
      order: 5,
      factSummary: '煮詰めながら照りが出るまでからめる',
      heat: 'medium-high',
      completionSign: '照りが出るまで',
      // 情報源はこの手順の所要時間（分）を示していない → duration は設定しない
    },
  ],
  // NHK は「調理時間15分」（※鶏肉を常温に戻す時間は除く）
  sourceStatedTotalTime: { kind: 'exact', minutes: 15 },
  structuredAt: STRUCTURED_AT,
  notes: [
    'NHK の掲載時間15分は「鶏肉を常温に戻す時間（約30分）を除く」と明記されている。'
      + 'ここでは足し算をせず sourceStatedTotalTime=15分 と preCookPreparation=約30分 を別々に保持する。',
    'スナップえんどう100g は別ゆでの付け合わせ（garnish）。tori-teriyaki 本体の '
      + 'Recipe Identity には含めない（既存 catalog の判定と一致）。',
  ],
}

/**
 * 豚の生姜焼き — NHKきょうの料理・河野雅子（kyounoryouri-butashogayaki-kawano-2026）。
 * 事実は既存 recipe-catalog.ts の buta-shogayaki（VERIFIED #2）に記録済み。
 */
export const BUTA_SHOGAYAKI_SOURCE_KNOWLEDGE: SourceRecipeKnowledge = {
  canonicalRecipeId: 'jp-buta-shogayaki',
  sourceRecipeName: '豚のしょうが焼き',
  evidenceSourceId: 'kyounoryouri-butashogayaki-kawano-2026',
  sourceLanguage: 'ja',
  servings: { displayText: '2人分', semantics: { kind: 'exact', value: 2, unit: '人分' } },
  ingredients: [
    {
      sourceIngredientName: '豚肩ロース肉',
      normalizedName: '豚肩ロース肉',
      japaneseName: '豚肩ロース肉（薄切り）',
      englishName: 'thinly sliced pork shoulder loin',
      originalLanguage: 'ja',
      role: 'required',
      quantity: { displayText: '200g', semantics: { kind: 'exact', value: 200, unit: 'g' } },
      preparationState: '薄切り',
    },
    {
      sourceIngredientName: '玉ねぎ',
      canonicalIngredientId: 'onion',
      normalizedName: '玉ねぎ',
      japaneseName: '玉ねぎ',
      englishName: 'onion',
      originalLanguage: 'ja',
      role: 'required',
      quantity: {
        displayText: '1/2個（100g）',
        semantics: { kind: 'exact', value: 100, unit: 'g' },
      },
    },
    {
      sourceIngredientName: 'しょうゆ',
      japaneseName: 'しょうゆ',
      englishName: 'soy sauce',
      originalLanguage: 'ja',
      role: 'seasoning',
      quantity: {
        displayText: '大さじ1と1/2',
        semantics: { kind: 'exact', value: 1.5, unit: '大さじ' },
      },
    },
    {
      sourceIngredientName: 'みりん',
      japaneseName: 'みりん',
      englishName: 'mirin',
      originalLanguage: 'ja',
      role: 'seasoning',
      quantity: {
        displayText: '大さじ1と1/2',
        semantics: { kind: 'exact', value: 1.5, unit: '大さじ' },
      },
    },
    {
      sourceIngredientName: 'しょうが',
      japaneseName: 'しょうが（すりおろし）',
      englishName: 'grated ginger',
      originalLanguage: 'ja',
      role: 'seasoning',
      quantity: {
        displayText: '小さじ2（すりおろし）',
        semantics: { kind: 'exact', value: 2, unit: '小さじ' },
      },
      preparationState: 'すりおろし',
    },
    {
      sourceIngredientName: '小麦粉',
      japaneseName: '小麦粉',
      englishName: 'wheat flour',
      originalLanguage: 'ja',
      role: 'seasoning',
      quantity: { displayText: '適量', semantics: { kind: 'to-taste' } },
    },
    {
      sourceIngredientName: '油',
      japaneseName: '油',
      englishName: 'oil',
      originalLanguage: 'ja',
      role: 'seasoning',
      quantity: {
        displayText: '小さじ1（玉ねぎ用）と大さじ1（豚肉用）',
        semantics: { kind: 'unknown' },
      },
    },
  ],
  preparation: [
    { text: '豚肩ロース薄切り肉をバットに広げ、小麦粉を茶こしに入れて全体に薄くふる' },
    { text: '玉ねぎを1cm幅のくし形に切る' },
    { text: 'みりん・しょうゆ・すりおろししょうがを混ぜ合わせてたれを作っておく' },
  ],
  equipment: ['フライパン', '茶こし'],
  cookingSteps: [
    {
      order: 1,
      factSummary: 'フライパンに油小さじ1を中火で熱し、玉ねぎを炒めてから火を止めて取り出す',
      ingredientsUsed: ['油', '玉ねぎ'],
      heat: 'medium',
      heatTransition: 'turn-off',
      duration: { kind: 'approximate', minutes: 1 },
      oilUsage: '油小さじ1',
    },
    {
      order: 2,
      factSummary: '同じフライパンに油大さじ1を足して中火で熱し、豚肩ロース肉を重ならないように並べる',
      ingredientsUsed: ['油', '豚肩ロース肉'],
      heat: 'medium',
      oilUsage: '油大さじ1',
    },
    {
      order: 3,
      factSummary: '豚肉をほぐしながら炒め、全体に火を通す',
      completionSign: '肉の色が変わったら',
      // 情報源はこの手順の所要時間を示していない
    },
    {
      order: 4,
      factSummary: '玉ねぎを戻し入れ、サッと炒め合わせる',
      ingredientsUsed: ['玉ねぎ'],
      // 情報源はこの手順の火加減・時間を示していない
    },
    {
      order: 5,
      factSummary: '混ぜ合わせておいたたれを回し入れ、全体にからめる',
      ingredientsUsed: ['しょうゆ', 'みりん', 'しょうが'],
      heat: 'medium-high',
      // 情報源はこの手順の所要時間を示していない
    },
  ],
  // NHK は「調理時間15分」（tori-teriyaki と違い除外時間の注記なし）
  sourceStatedTotalTime: { kind: 'exact', minutes: 15 },
  structuredAt: STRUCTURED_AT,
  notes: [
    '油は NHK 出典が種類を特定していない（generic「油」）。semantics は unknown のまま。',
    '小麦粉「適量」は to-taste（数値化しない）。',
  ],
}

export const SOURCE_RECIPE_KNOWLEDGE_FIXTURES: SourceRecipeKnowledge[] = [
  TORI_TERIYAKI_SOURCE_KNOWLEDGE,
  BUTA_SHOGAYAKI_SOURCE_KNOWLEDGE,
]

// ------------------------------------------------------------
// NUKITORU PRESENTATION（buildPresentationStep 経由で SOURCE から生成）
// ------------------------------------------------------------

const TORI_TERIYAKI_AUTHORED: AuthoredPresentationText[] = [
  {
    title: '鶏肉を皮目から焼く',
    shortInstruction: 'フライパンにサラダ油をひき、鶏もも肉を皮を下にして並べて焼く',
    ingredientActions: ['サラダ油小さじ1を入れる', '鶏もも肉を皮を下にして並べる'],
    toolAction: 'フライパン',
  },
  {
    title: '返してふたをして蒸し焼き',
    shortInstruction: '鶏肉を返し、ふたをして蒸し焼きにする',
    ingredientActions: ['鶏もも肉を返す'],
    toolAction: 'ふたをする',
  },
  {
    title: '脂を拭く',
    shortInstruction: 'ふたを取り、ペーパータオルで溶け出た脂を拭く',
    ingredientActions: [],
    toolAction: 'ふたを取る',
  },
  {
    title: 'たれを入れる',
    shortInstruction: 'あらかじめ混ぜ合わせたたれを回し入れる',
    ingredientActions: ['合わせだれを回し入れる'],
  },
  {
    title: '照りが出るまでからめる',
    shortInstruction: 'たれを煮詰めながら鶏肉にからめる',
    ingredientActions: ['鶏もも肉にたれをからめる'],
  },
]

const BUTA_SHOGAYAKI_AUTHORED: AuthoredPresentationText[] = [
  {
    title: '玉ねぎを炒めて取り出す',
    shortInstruction: 'フライパンに油をひき、玉ねぎを炒めてから火を止めて取り出す',
    ingredientActions: ['油小さじ1を入れる', '玉ねぎを入れて炒める', '玉ねぎを取り出す'],
    toolAction: 'フライパン',
  },
  {
    title: '豚肉を並べる',
    shortInstruction: '同じフライパンに油を足し、豚肉を重ならないように並べる',
    ingredientActions: ['油大さじ1を足す', '豚肩ロース肉を重ならないように並べる'],
  },
  {
    title: '豚肉を炒める',
    shortInstruction: '豚肉をほぐしながら炒め、全体に火を通す',
    ingredientActions: ['豚肩ロース肉をほぐしながら炒める'],
  },
  {
    title: '玉ねぎを戻す',
    shortInstruction: '取り出した玉ねぎを戻し入れ、サッと炒め合わせる',
    ingredientActions: ['玉ねぎを戻し入れる'],
  },
  {
    title: 'たれをからめる',
    shortInstruction: '混ぜ合わせたたれを回し入れ、全体にからめる',
    ingredientActions: ['合わせだれを回し入れる'],
  },
]

function buildPresentation(
  knowledge: SourceRecipeKnowledge,
  authored: AuthoredPresentationText[],
  displayName: string,
): NukitoruPresentation {
  return {
    canonicalRecipeId: knowledge.canonicalRecipeId,
    sourceEvidenceSourceId: knowledge.evidenceSourceId,
    displayName,
    displayLocale: { language: 'ja', country: 'JP' },
    preCookChecklist: [
      { label: '食べる人数', kind: 'diners' },
      { label: '作る量', kind: 'servings', sourceReference: knowledge.servings?.displayText },
      { label: '使う道具', kind: 'equipment', sourceReference: (knowledge.equipment ?? []).join('・') },
      { label: '熱源', kind: 'heat-source' },
      ...(knowledge.preCookPreparation && knowledge.preCookPreparation.length > 0
        ? [
            {
              label: '事前準備',
              kind: 'pre-cook-prep' as const,
              sourceReference: knowledge.preCookPreparation.map((p) => p.text).join(' / '),
            },
          ]
        : []),
      {
        label: '下準備',
        kind: 'prep',
        sourceReference: (knowledge.preparation ?? []).map((p) => p.text).join(' / '),
      },
    ],
    steps: knowledge.cookingSteps.map((step, i) => buildPresentationStep(step, authored[i])),
    generatedAt: STRUCTURED_AT,
  }
}

export const TORI_TERIYAKI_PRESENTATION: NukitoruPresentation = buildPresentation(
  TORI_TERIYAKI_SOURCE_KNOWLEDGE,
  TORI_TERIYAKI_AUTHORED,
  '鶏の照り焼き',
)

export const BUTA_SHOGAYAKI_PRESENTATION: NukitoruPresentation = buildPresentation(
  BUTA_SHOGAYAKI_SOURCE_KNOWLEDGE,
  BUTA_SHOGAYAKI_AUTHORED,
  '豚の生姜焼き',
)

export const NUKITORU_PRESENTATION_FIXTURES: NukitoruPresentation[] = [
  TORI_TERIYAKI_PRESENTATION,
  BUTA_SHOGAYAKI_PRESENTATION,
]
