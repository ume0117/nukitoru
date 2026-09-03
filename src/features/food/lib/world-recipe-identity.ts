// ============================================================
// world-recipe-identity.ts
//
// MISSION 2.35 — World Food Knowledge Foundation。
//
// World Recipe Identity Registry（表示名から独立した「世界のある料理そのもの」の
// 同一性）。Schema / Knowledge Pipeline 検証用の最小 Fixture であり、公開 Recipe 数
// ではない。
//
// 絶対ルール:
// - 表示名（japaneseName / englishName）と canonicalRecipeId を混同しない。
//   日本語訳によって Recipe Identity を別 Recipe へ変えない。
// - ここに登録するのは「名称・由来（国／料理圏）」という identity 事実のみ。
//   分量・時間・工程等の料理事実（SOURCE RECIPE KNOWLEDGE）はここに置かない。
//   Identity の登録は SOURCE RECIPE KNOWLEDGE の Evidence には一切ならない。
// - 架空の料理・架空の別名を入れない。国際エントリは MISSION 2.35 本文が例示した
//   ものに限定する（提供された data の構造化であって発明ではない）。
// - fuzzy matching 禁止（解決は world-food-knowledge.ts が完全一致で行う）。
// ============================================================

import type { WorldRecipeIdentity } from '@/features/food/types'

/**
 * World Recipe Identity の最小 Registry。
 *
 * 日本 5 / 海外 4。すべて MISSION 2.35 本文が明示的に例示した料理
 * （teriyaki / shogayaki / Tortilla Española / aglio e olio / ratatouille /
 * kimchi-bokkeumbap）と、既存 catalog に VERIFIED 実体がある日本料理に限る。
 *
 * identityEvidenceSourceIds を持つのは、既存 EVIDENCE_SOURCE_CATALOG に
 * その料理の情報源が実在するエントリのみ。国際エントリは identity 用 Evidence
 * 未添付（一般的な名称として登録。次 MISSION で情報源を開いて添付する）。
 */
export const WORLD_RECIPE_IDENTITY_REGISTRY: WorldRecipeIdentity[] = [
  // ---- 日本（既存 catalog / EVIDENCE_SOURCE_CATALOG に実体あり） ----
  {
    canonicalRecipeId: 'jp-tori-teriyaki',
    canonicalName: '鶏の照り焼き',
    localName: '鶏の照り焼き',
    originalLanguage: 'ja',
    country: 'JP',
    cuisine: 'japanese',
    japaneseName: '鶏の照り焼き',
    englishName: 'Chicken Teriyaki',
    aliases: ['照り焼きチキン', 'てりやきチキン', 'teriyaki chicken'],
    identityEvidenceSourceIds: ['kyounoryouri-toriteriyaki-kawano-2026'],
  },
  {
    canonicalRecipeId: 'jp-buta-shogayaki',
    canonicalName: '豚の生姜焼き',
    localName: '豚の生姜焼き',
    originalLanguage: 'ja',
    country: 'JP',
    cuisine: 'japanese',
    japaneseName: '豚の生姜焼き',
    englishName: 'Pork Shogayaki',
    aliases: ['豚のしょうが焼き', 'しょうが焼き', 'ぶたのしょうがやき', 'ginger pork'],
    identityEvidenceSourceIds: ['kyounoryouri-butashogayaki-kawano-2026'],
  },
  {
    canonicalRecipeId: 'jp-gyudon',
    canonicalName: '牛丼',
    localName: '牛丼',
    originalLanguage: 'ja',
    country: 'JP',
    cuisine: 'japanese',
    japaneseName: '牛丼',
    englishName: 'Gyudon (beef bowl)',
    aliases: ['ぎゅうどん', 'beef bowl', 'beef rice bowl'],
    identityEvidenceSourceIds: ['sirogohan-gyudon-2026', 'kikkoman-gyudon-2026'],
  },
  {
    canonicalRecipeId: 'jp-oyakodon',
    canonicalName: '親子丼',
    localName: '親子丼',
    originalLanguage: 'ja',
    country: 'JP',
    cuisine: 'japanese',
    japaneseName: '親子丼',
    englishName: 'Oyakodon (chicken and egg bowl)',
    aliases: ['おやこどん', 'chicken and egg rice bowl'],
    identityEvidenceSourceIds: ['sirogohan-oyakodon-2026', 'kikkoman-oyakodon-2026'],
  },
  {
    canonicalRecipeId: 'jp-misoshiru',
    canonicalName: 'みそ汁',
    localName: 'みそ汁',
    originalLanguage: 'ja',
    country: 'JP',
    cuisine: 'japanese',
    japaneseName: 'みそ汁',
    englishName: 'Miso soup',
    aliases: ['味噌汁', 'おみそ汁', 'miso soup'],
    identityEvidenceSourceIds: ['yamaki-misoshiru-2026', 'marukome-misoshiru-faq-2026'],
  },

  // ---- 海外（MISSION 2.35 本文の例示。identity 用 Evidence は次 MISSION で添付） ----
  {
    canonicalRecipeId: 'es-tortilla-espanola',
    canonicalName: 'Tortilla Española',
    localName: 'Tortilla de patatas',
    originalLanguage: 'es',
    country: 'ES',
    cuisine: 'spanish',
    japaneseName: 'スペイン風オムレツ',
    englishName: 'Spanish Omelette',
    aliases: ['tortilla espanola', 'tortilla de papas', 'スパニッシュオムレツ'],
  },
  {
    canonicalRecipeId: 'it-aglio-e-olio',
    canonicalName: 'Spaghetti aglio e olio',
    localName: 'Spaghetti aglio, olio e peperoncino',
    originalLanguage: 'it',
    country: 'IT',
    cuisine: 'italian',
    japaneseName: 'ペペロンチーノ',
    englishName: 'Garlic and oil spaghetti',
    aliases: ['aglio e olio', 'aglio olio', 'ペペロンチーノ', 'アーリオ・オーリオ'],
  },
  {
    canonicalRecipeId: 'fr-ratatouille',
    canonicalName: 'Ratatouille',
    localName: 'Ratatouille niçoise',
    originalLanguage: 'fr',
    country: 'FR',
    region: 'Provence',
    cuisine: 'french',
    japaneseName: 'ラタトゥイユ',
    englishName: 'Ratatouille',
    aliases: ['ratatouille nicoise', 'ラタトゥユ'],
  },
  {
    canonicalRecipeId: 'kr-kimchi-bokkeumbap',
    canonicalName: '김치볶음밥',
    localName: '김치볶음밥',
    originalLanguage: 'ko',
    country: 'KR',
    cuisine: 'korean',
    japaneseName: 'キムチチャーハン',
    englishName: 'Kimchi fried rice',
    aliases: ['kimchi bokkeumbap', 'kimchi-bokkeumbap', 'キムチ炒飯', 'キムチチャーハン'],
  },
]
