// ============================================================
// evidence-sources.ts
//
// MISSION 2.11 PHASE D.6 — Recipe Provenance & Fact/Evidence Gate。
//
// RecipeEvidenceSourceを一箇所に正規化して集約する（Recipeへ直接埋め込むと
// 同一情報源が複数Recipeから参照される場合に重複・不整合が起きるため）。
// Recipe.verification.sourceIdsはここのidを参照する。
//
// D.6時点ではEVIDENCE_SOURCE_CATALOGは空だった。PHASE D.7-Aで、
// 最初の10 Recipeについて実際にWeb上の信頼できる情報源を1件ずつ開いて
// 本文を確認した結果のみをここへ追加した（検索結果のsnippetだけで登録した
// ものは1件もない。AI一般知識・推測をsourceとして登録しない。
// EVIDENCE_POLICY.md参照）。
// ============================================================

import type { RecipeEvidenceSource } from '@/features/food/types'

const CHECKED_AT_D7A = '2026-08-28'

export const EVIDENCE_SOURCE_CATALOG: RecipeEvidenceSource[] = [
  {
    id: 'maff-rice-weight-2026',
    publisher: '農林水産省',
    title: 'お米の重さとご飯の重さの違いを教えてください。',
    url: 'https://www.maff.go.jp/j/heya/kodomo_sodan/0103/01.html',
    sourceType: 'government',
    checkedAt: CHECKED_AT_D7A,
  },
  {
    id: 'hitachi-rice-cooker-time-2026',
    publisher: '日立（日立の家電品）',
    title: '炊飯コースの使い分けを知りたいです。',
    url: 'https://kadenfan.hitachi.co.jp/support/kitchen/q_a/help60.html',
    sourceType: 'manufacturer',
    checkedAt: CHECKED_AT_D7A,
  },
  {
    id: 'sirogohan-siomusubi-2026',
    publisher: '白ごはん.com（冨田ただすけ）',
    title: '塩むすび（塩おにぎり）の作り方/レシピ',
    url: 'https://www.sirogohan.com/recipe/siomusubi/',
    sourceType: 'professional',
    checkedAt: CHECKED_AT_D7A,
  },
  {
    id: 'sirogohan-torisoboro-2026',
    publisher: '白ごはん.com（冨田ただすけ）',
    title: '鶏そぼろのレシピ/作り方',
    url: 'https://www.sirogohan.com/recipe/torisoboro/',
    sourceType: 'professional',
    checkedAt: CHECKED_AT_D7A,
  },
  {
    id: 'kikkoman-torisoborodon-2026',
    publisher: 'キッコーマン',
    title: '基本の鶏そぼろ丼(二色丼)のレシピ･つくり方',
    url: 'https://www.kikkoman.co.jp/homecook/washoku/030/',
    sourceType: 'manufacturer',
    checkedAt: CHECKED_AT_D7A,
  },
  {
    id: 'kikkoman-gyudon-2026',
    publisher: 'キッコーマン',
    title: '牛丼のレシピ･つくり方【家庭で人気の味わい】',
    url: 'https://www.kikkoman.co.jp/homecook/washoku/090/',
    sourceType: 'manufacturer',
    checkedAt: CHECKED_AT_D7A,
  },
  {
    id: 'kikkoman-oyakodon-2026',
    publisher: 'キッコーマン',
    title: '基本の親子丼のレシピ･つくり方【卵も人気のとろとろ食感】',
    url: 'https://www.kikkoman.co.jp/homecook/washoku/020/',
    sourceType: 'manufacturer',
    checkedAt: CHECKED_AT_D7A,
  },
  {
    id: 'kamada-maguro-zukedon-2026',
    publisher: '鎌田醤油',
    title: 'マグロの漬け丼',
    url: 'https://www.kamada.co.jp/recipe/list/3274',
    sourceType: 'manufacturer',
    checkedAt: CHECKED_AT_D7A,
  },
  {
    id: 'kewpie-tunamayo-2026',
    publisher: 'キユーピー',
    title: 'ツナマヨごはんのレシピ・作り方',
    url: 'https://www.kewpie.co.jp/recipes/recipe/QP10007505/',
    sourceType: 'manufacturer',
    checkedAt: CHECKED_AT_D7A,
  },
  {
    id: 'housefoods-vermont-curry-2026',
    publisher: 'ハウス食品',
    title: 'バーモントカレー',
    url: 'https://housefoods.jp/recipe/rcp_00027252.html',
    sourceType: 'manufacturer',
    checkedAt: CHECKED_AT_D7A,
  },
  {
    id: 'marukawamiso-pork-cabbage-2026',
    publisher: 'マルカワみそ（越前有機味噌蔵）',
    title: '味噌屋が教える豚肉とキャベツの味噌炒め',
    url: 'https://marukawamiso.com/recepi/r71.html',
    sourceType: 'manufacturer',
    checkedAt: CHECKED_AT_D7A,
  },
  {
    id: 'delishkitchen-pork-cabbage-2026',
    publisher: 'DELISH KITCHEN',
    title: '少ない材料で簡単10分！ご飯が進むみそ炒め（豚肉とキャベツの味噌炒め）',
    url: 'https://delishkitchen.tv/recipes/204011258012239082',
    sourceType: 'other-trusted',
    checkedAt: CHECKED_AT_D7A,
  },
  // ---- PHASE D.7-B（Evidence Resolution Protocol再監査で追加） ----
  {
    id: 'tabechoku-rice-servings-2026',
    publisher: 'vivid garden Inc.（食べチョク）',
    title: '米1合は何グラム？炊飯前後の重さと水加減を解説',
    url: 'https://www.tabechoku.com/feature_articles/kome_1go-g',
    sourceType: 'other-trusted',
    checkedAt: '2026-08-28',
  },
  {
    id: 'seikatuchiebukuro-tuna-can-size-2026',
    publisher: '生活知恵袋',
    title: 'ツナ缶、シーチキンの重さは1缶で何グラム、大きさやカロリーは？',
    url: 'https://www.seikatu-cb.com/omosa/tuna.html',
    sourceType: 'other-trusted',
    checkedAt: '2026-08-28',
  },
  // ---- MISSION 2.12 PHASE B（Starter Set Evidence Resolution）で追加 ----
  {
    id: 'sirogohan-gyudon-2026',
    publisher: '白ごはん.com（冨田ただすけ）',
    title: '丼ものでNo.1人気！牛丼のレシピ/作り方',
    url: 'https://www.sirogohan.com/recipe/gyuudon/',
    sourceType: 'professional',
    checkedAt: '2026-08-28',
  },
  {
    id: 'ajinomoto-oyakodon-2026',
    publisher: '味の素パーク',
    title: 'とろ～り卵に仕上げる！基本の親子丼の作り方',
    url: 'https://park.ajinomoto.co.jp/recipe/card/703024/',
    sourceType: 'manufacturer',
    checkedAt: '2026-08-28',
  },
  {
    id: 'sirogohan-oyakodon-2026',
    publisher: '白ごはん.com（冨田ただすけ）',
    title: '親子丼のレシピ/作り方',
    url: 'https://www.sirogohan.com/recipe/oyakodon/',
    sourceType: 'professional',
    checkedAt: '2026-08-28',
  },
  {
    id: 'kyounoryouri-medamayaki-2026',
    publisher: 'NHKみんなのきょうの料理（瀬田金行）',
    title: '基本の目玉焼き',
    url: 'https://www.kyounoryouri.jp/recipe/30298_%E5%9F%BA%E6%9C%AC%E3%81%AE%E7%9B%AE%E7%8E%89%E7%84%BC%E3%81%8D.html',
    sourceType: 'professional',
    checkedAt: '2026-08-28',
  },
  {
    id: 'kikkoman-medamayaki-tips-2026',
    publisher: 'キッコーマン',
    title: '目玉焼きの基本のつくり方、教えます！',
    url: 'https://www.kikkoman.co.jp/homecook/tsushin/tips0066/',
    sourceType: 'manufacturer',
    checkedAt: '2026-08-28',
  },
  {
    id: 'ajinomoto-hiyayakko-2026',
    publisher: '味の素パーク',
    title: '冷奴（絹ごし豆腐＋小ねぎの小口切りを使ったレシピ）',
    url: 'https://park.ajinomoto.co.jp/recipe/card/705616/',
    sourceType: 'manufacturer',
    checkedAt: '2026-08-28',
  },
  {
    id: 'kikkoman-sakeyakikata-2026',
    publisher: 'キッコーマン',
    title: '鮭の焼き方を解説！フライパン、グリルでおいしく焼くコツ。下ごしらえも！',
    url: 'https://www.kikkoman.co.jp/homecook/tsushin/tips0071/',
    sourceType: 'manufacturer',
    checkedAt: '2026-08-28',
  },
  {
    id: 'oishikenko-sakeshioyaki-2026',
    publisher: 'おいしい健康（管理栄養士監修）',
    title: 'さけの塩焼き',
    url: 'https://oishi-kenko.com/recipes/10926',
    sourceType: 'professional',
    checkedAt: '2026-08-28',
  },
  {
    id: 'yamaki-misoshiru-2026',
    publisher: 'ヤマキ',
    title: '基本のお味噌汁',
    url: 'https://www.yamaki.co.jp/recipe/%E5%9F%BA%E6%9C%AC%E3%81%AE%E3%81%8A%E5%91%B3%E5%99%8C%E6%B1%81',
    sourceType: 'manufacturer',
    checkedAt: '2026-08-28',
  },
  {
    id: 'marukome-misoshiru-faq-2026',
    publisher: 'マルコメ',
    title: 'お椀1杯のみそ汁を作るときの、味噌とお湯の量は？',
    url: 'https://faq.marukome.co.jp/%E3%81%8A%E6%A4%801%E6%9D%AF%E3%81%AE%E3%81%BF%E3%81%9D%E6%B1%81%E3%82%92%E4%BD%9C%E3%82%8B%E3%81%A8%E3%81%8D%E3%81%AE%E3%80%81%E5%91%B3%E5%99%8C%E3%81%A8%E3%81%8A%E6%B9%AF%E3%81%AE%E9%87%8F%E3%81%AF%EF%BC%9F-67a4aebd6f8cbf4ae8e844ba',
    sourceType: 'manufacturer',
    checkedAt: '2026-08-28',
  },
  // ---- MISSION 2.14（First 10 Families Starter Set Evidence Resolution）で追加 ----
  {
    id: 'hinode-mirin-oyakodon-2026',
    publisher: '日の出みりん',
    title: '親子丼',
    url: 'https://hinode-mirin.co.jp/recipe/basic/2024/07/6395/',
    sourceType: 'manufacturer',
    checkedAt: '2026-08-29',
  },
  {
    id: 'honmirin-oyakodon-2026',
    publisher: '全国味淋協会',
    title: '親子丼・和風',
    url: 'https://www.honmirin.org/recipes/217',
    sourceType: 'other-trusted',
    checkedAt: '2026-08-29',
  },
  {
    id: 'kyounoryouri-torisoboro-2026',
    publisher: 'NHKみんなのきょうの料理（栗原はるみ）',
    title: '鶏そぼろ',
    url: 'https://www.kyounoryouri.jp/recipe/19472_%E9%B6%8F%E3%81%9D%E3%81%BC%E3%82%8D.html',
    sourceType: 'professional',
    checkedAt: '2026-08-29',
  },
  {
    id: 'oishikenko-hiyayakko-2026',
    publisher: 'おいしい健康（管理栄養士監修）',
    title: '冷奴（しょうが、ねぎ、しょうゆ）',
    url: 'https://oishi-kenko.com/recipes/11970',
    sourceType: 'professional',
    checkedAt: '2026-08-29',
  },
  {
    id: 'marukome-tofu-wakame-basic-2026',
    publisher: 'マルコメ',
    title: '料亭の味（だし入り）｜豆腐とわかめのおみそ汁｜基本のレシピ',
    url: 'https://www.marukome.co.jp/recipe/basic/01/',
    sourceType: 'manufacturer',
    checkedAt: '2026-08-29',
  },

  // ---- MISSION 2.16（Verified Starter Set — Evidence Resolution Batch 1）で追加 ----
  // Batch 1で本文を実際に開いて確認した情報源。いずれも既存のRecipe factを
  // 直接支持する（＝statusを上げる）には至らず、REVIEW維持の根拠として記録する。
  {
    id: 'kubara-hiyayakko-yakumi-2026',
    publisher: '久原本家（茅乃舎）',
    title: '薬味たっぷり冷奴',
    url: 'https://www.kubara.jp/recipe/3411/',
    sourceType: 'manufacturer',
    checkedAt: '2026-08-29',
  },
  {
    id: 'kurashiru-hiyayakko-simple-2026',
    publisher: 'クラシル',
    title: 'シンプルでおいしい 冷奴',
    url: 'https://www.kurashiru.com/recipes/4636b598-b490-4834-be40-21e5bfc17599',
    sourceType: 'other-trusted',
    checkedAt: '2026-08-29',
  },
  {
    id: 'orangepage-magurodon-2026',
    publisher: 'オレンジページnet（浜内千波）',
    title: 'まぐろ丼のレシピ・作り方',
    url: 'https://www.orangepage.net/recipes/110223',
    sourceType: 'professional',
    checkedAt: '2026-08-29',
  },
  {
    id: 'orangepage-gyudon-2026',
    publisher: 'オレンジページnet（上田淳子）',
    title: '基本の牛丼のレシピ・作り方',
    url: 'https://www.orangepage.net/recipes/302258',
    sourceType: 'professional',
    checkedAt: '2026-08-29',
  },
  {
    id: 'kobayashi-tofu-misoshiru-2026',
    publisher: '小林食品（和食の旨み・元料理人）',
    title: '豆腐の味噌汁の作り方 豆腐の種類、選び方、入れるタイミングのすべて',
    url: 'https://www.kobayashi-foods.co.jp/washoku-no-umami/miso-soup-tofu',
    sourceType: 'professional',
    checkedAt: '2026-08-29',
  },

  // ---- MISSION 2.16（Evidence Resolution Batch 2）で追加 ----
  // Batch 2で本文を実際に開いて確認した情報源。いずれも既存のRecipe factを
  // 直接支持する（＝statusを上げる）には至らず、REVIEW維持の根拠として記録する。
  {
    id: 'kyounoryouri-torisoborodon-oba-2026',
    publisher: 'NHKみんなのきょうの料理（大庭英子）',
    title: '鶏そぼろ丼',
    url: 'https://www.kyounoryouri.jp/recipe/15642_%E9%B6%8F%E3%81%9D%E3%81%BC%E3%82%8D%E4%B8%BC.html',
    sourceType: 'professional',
    checkedAt: '2026-08-29',
  },
  {
    id: 'orangepage-tunamayodon-2026',
    publisher: 'オレンジページnet（長谷川よし子）',
    title: 'ツナマヨ丼のレシピ・作り方',
    url: 'https://www.orangepage.net/recipes/126338',
    sourceType: 'professional',
    checkedAt: '2026-08-29',
  },
  {
    id: 'kurashiru-tunamayodon-2026',
    publisher: 'クラシル',
    title: 'ツナマヨ丼',
    url: 'https://www.kurashiru.com/recipes/94668315-7387-424e-afe1-a04c4f3cdbee',
    sourceType: 'other-trusted',
    checkedAt: '2026-08-29',
  },
  {
    id: 'hoteifoods-tunamayodon-2026',
    publisher: 'ホテイフーズ',
    title: 'ツナマヨ丼',
    url: 'https://www.hoteifoods.co.jp/recipe/tuna17/',
    sourceType: 'manufacturer',
    checkedAt: '2026-08-29',
  },
]

export function getEvidenceSourceById(
  id: string,
  catalog: RecipeEvidenceSource[] = EVIDENCE_SOURCE_CATALOG,
): RecipeEvidenceSource | undefined {
  return catalog.find((source) => source.id === id)
}

/**
 * 架空URL・placeholder URLをproduction evidenceとして許可しない（Gate BE）。
 * 「URLが存在するだけではEvidence成立とみなさない」の一部として、
 * 明らかにダミー・テスト用と分かるドメイン/文字列パターンを検出する。
 */
const PLACEHOLDER_URL_PATTERNS = [
  /example\.(com|org|net)/i,
  /localhost/i,
  /127\.0\.0\.1/i,
  /placeholder/i,
  /lorem/i,
  /\btest\.com\b/i,
  /foo\.bar/i,
  /yourdomain/i,
  /xxx+/i,
  /\bTBD\b/i,
  /\bTODO\b/i,
]

export function isPlaceholderUrl(url: string): boolean {
  return PLACEHOLDER_URL_PATTERNS.some((pattern) => pattern.test(url))
}
