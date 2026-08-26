// ============================================================
// stock-master-data.ts
//
// 常備品の候補となる静的マスターデータ。ユーザーデータではない。
// 同じ食品を複数カテゴリへ物理的に重複登録しないため、
// 複数の用途を持つ食品（バター・にんにく・しょうが・冷凍主食等）は
// 1箇所にのみ実体を置き、tags で用途を表現する。
//
// - SEASONING_MASTER   : 既存 Pantry.staples（常備調味料）用の候補
// - REGULAR_FOODS_MASTER: regularFoods（常備食材）用の候補
// - FROZEN_FOODS_MASTER : frozenFoods（冷凍庫）用の候補
// - PANTRY_FOODS_MASTER : pantryFoods（保存食品）用の候補
//
// featured は「よく使うもの」の明示フラグ。配列の並び順には依存しない。
// defaultStorageLocation / tags は将来拡張用で、MISSION 2.2では未使用。
// ============================================================

import type { MasterGroup } from '@/features/food/types'

export const SEASONING_MASTER: MasterGroup[] = [
  {
    label: '基本',
    items: [
      { id: 'salt', label: '塩', featured: true },
      { id: 'sugar', label: '砂糖', featured: true },
      { id: 'soy_sauce', label: 'しょうゆ', featured: true },
      { id: 'miso', label: '味噌', featured: true },
      { id: 'vinegar', label: '酢', featured: true },
      { id: 'mirin', label: 'みりん' },
      { id: 'cooking_sake', label: '料理酒' },
      { id: 'pepper', label: 'こしょう' },
    ],
  },
  {
    label: 'だし・スープ',
    items: [
      { id: 'mentsuyu', label: 'めんつゆ' },
      { id: 'shirodashi', label: '白だし' },
      { id: 'granule_dashi', label: '顆粒和風だし' },
      { id: 'kombu_dashi', label: '昆布だし' },
      { id: 'kombu', label: '昆布' },
      { id: 'katsuobushi', label: 'かつお節' },
      { id: 'consomme', label: 'コンソメ' },
      { id: 'chicken_stock', label: '鶏ガラスープの素' },
      { id: 'chinese_dashi', label: '中華だし' },
      { id: 'ajinomoto', label: '味の素' },
    ],
  },
  {
    label: '油',
    items: [
      { id: 'salad_oil', label: 'サラダ油', featured: true },
      { id: 'sesame_oil', label: 'ごま油' },
      { id: 'olive_oil', label: 'オリーブオイル' },
    ],
  },
  {
    label: 'ソース・調味ソース',
    items: [
      { id: 'mayonnaise', label: 'マヨネーズ', featured: true },
      { id: 'ketchup', label: 'ケチャップ', featured: true },
      { id: 'chuno_sauce', label: '中濃ソース' },
      { id: 'worcester_sauce', label: 'ウスターソース' },
      { id: 'tonkatsu_sauce', label: 'とんかつソース' },
      { id: 'ponzu', label: 'ポン酢' },
      { id: 'oyster_sauce', label: 'オイスターソース' },
      { id: 'yakiniku_sauce', label: '焼肉のたれ' },
    ],
  },
  {
    label: '香味・辛味',
    items: [
      { id: 'wasabi', label: 'わさび' },
      { id: 'karashi', label: 'からし' },
      { id: 'doubanjiang', label: '豆板醤' },
      { id: 'tenmenjan', label: '甜麺醤' },
      { id: 'gochujang', label: 'コチュジャン' },
      { id: 'rayu', label: 'ラー油' },
    ],
  },
  {
    label: '粉・その他',
    items: [
      { id: 'flour', label: '小麦粉' },
      { id: 'katakuriko', label: '片栗粉' },
      { id: 'panko', label: 'パン粉' },
      { id: 'curry_powder', label: 'カレー粉' },
      { id: 'iri_goma', label: 'いりごま' },
      { id: 'suri_goma', label: 'すりごま' },
      { id: 'honey', label: 'はちみつ' },
      { id: 'jam', label: 'ジャム' },
    ],
  },
]

export const REGULAR_FOODS_MASTER: MasterGroup[] = [
  {
    label: '主食',
    items: [
      { id: 'rice', label: '米', defaultStorageLocation: 'room_temperature', featured: true },
      { id: 'bread', label: '食パン', defaultStorageLocation: 'room_temperature' },
      { id: 'pasta', label: 'パスタ', defaultStorageLocation: 'room_temperature' },
      { id: 'udon', label: 'うどん', defaultStorageLocation: 'room_temperature' },
      { id: 'soba', label: 'そば', defaultStorageLocation: 'room_temperature' },
      { id: 'somen', label: 'そうめん', defaultStorageLocation: 'room_temperature' },
      { id: 'mochi', label: '餅', defaultStorageLocation: 'room_temperature' },
    ],
  },
  {
    label: '冷蔵',
    items: [
      { id: 'egg', label: '卵', defaultStorageLocation: 'refrigerated', featured: true },
      { id: 'milk', label: '牛乳', defaultStorageLocation: 'refrigerated', featured: true },
      { id: 'yogurt', label: 'ヨーグルト', defaultStorageLocation: 'refrigerated' },
      {
        id: 'butter',
        label: 'バター',
        defaultStorageLocation: 'refrigerated',
        tags: ['dairy', 'seasoning'],
      },
      { id: 'cheese', label: 'チーズ', defaultStorageLocation: 'refrigerated' },
      { id: 'natto', label: '納豆', defaultStorageLocation: 'refrigerated' },
      { id: 'tofu', label: '豆腐', defaultStorageLocation: 'refrigerated', featured: true },
      { id: 'aburaage', label: '油揚げ', defaultStorageLocation: 'refrigerated' },
      { id: 'ham', label: 'ハム', defaultStorageLocation: 'refrigerated' },
      { id: 'bacon', label: 'ベーコン', defaultStorageLocation: 'refrigerated' },
      { id: 'sausage', label: 'ウインナー', defaultStorageLocation: 'refrigerated' },
    ],
  },
  {
    label: '野菜・香味',
    items: [
      { id: 'onion', label: '玉ねぎ', defaultStorageLocation: 'room_temperature', featured: true },
      { id: 'potato', label: 'じゃがいも', defaultStorageLocation: 'room_temperature', featured: true },
      { id: 'carrot', label: 'にんじん', defaultStorageLocation: 'refrigerated', featured: true },
      { id: 'cabbage', label: 'キャベツ', defaultStorageLocation: 'refrigerated', featured: true },
      { id: 'green_onion', label: 'ねぎ', defaultStorageLocation: 'refrigerated' },
      { id: 'garlic', label: 'にんにく', defaultStorageLocation: 'refrigerated', tags: ['seasoning'] },
      { id: 'ginger', label: 'しょうが', defaultStorageLocation: 'refrigerated', tags: ['seasoning'] },
      { id: 'mushroom', label: 'きのこ類', defaultStorageLocation: 'refrigerated' },
    ],
  },
]

export const FROZEN_FOODS_MASTER: MasterGroup[] = [
  {
    label: '冷凍食品',
    items: [
      { id: 'frozen_rice', label: '冷凍ご飯', defaultStorageLocation: 'frozen', featured: true },
      { id: 'frozen_udon', label: '冷凍うどん', defaultStorageLocation: 'frozen', featured: true },
      { id: 'frozen_soba', label: '冷凍そば', defaultStorageLocation: 'frozen' },
      { id: 'frozen_pasta', label: '冷凍パスタ', defaultStorageLocation: 'frozen' },
      { id: 'frozen_broccoli', label: '冷凍ブロッコリー', defaultStorageLocation: 'frozen' },
      { id: 'frozen_spinach', label: '冷凍ほうれん草', defaultStorageLocation: 'frozen' },
      { id: 'frozen_edamame', label: '冷凍枝豆', defaultStorageLocation: 'frozen' },
      { id: 'frozen_mixed_vegetables', label: '冷凍ミックス野菜', defaultStorageLocation: 'frozen', featured: true },
      { id: 'frozen_fruit', label: '冷凍フルーツ', defaultStorageLocation: 'frozen' },
      { id: 'frozen_meat', label: '冷凍肉', defaultStorageLocation: 'frozen' },
      { id: 'frozen_fish', label: '冷凍魚', defaultStorageLocation: 'frozen' },
      { id: 'frozen_seafood', label: '冷凍シーフード', defaultStorageLocation: 'frozen' },
      { id: 'frozen_gyoza', label: '冷凍餃子', defaultStorageLocation: 'frozen', featured: true },
      { id: 'frozen_karaage', label: '冷凍から揚げ', defaultStorageLocation: 'frozen', featured: true },
      { id: 'frozen_korokke', label: '冷凍コロッケ', defaultStorageLocation: 'frozen' },
      { id: 'frozen_hamburger_steak', label: '冷凍ハンバーグ', defaultStorageLocation: 'frozen' },
      { id: 'frozen_fried_rice', label: '冷凍チャーハン', defaultStorageLocation: 'frozen' },
      { id: 'frozen_potato', label: '冷凍ポテト', defaultStorageLocation: 'frozen' },
      { id: 'frozen_bread', label: '冷凍パン', defaultStorageLocation: 'frozen' },
    ],
  },
]

export const PANTRY_FOODS_MASTER: MasterGroup[] = [
  {
    label: '缶詰',
    items: [
      { id: 'canned_tuna', label: 'ツナ缶', defaultStorageLocation: 'room_temperature', featured: true },
      { id: 'canned_saba', label: 'サバ缶', defaultStorageLocation: 'room_temperature', featured: true },
      { id: 'canned_sardine', label: 'いわし缶', defaultStorageLocation: 'room_temperature' },
      { id: 'canned_corn', label: 'コーン缶', defaultStorageLocation: 'room_temperature' },
      { id: 'canned_tomato', label: 'トマト缶', defaultStorageLocation: 'room_temperature' },
      { id: 'canned_yakitori', label: '焼き鳥缶', defaultStorageLocation: 'room_temperature' },
    ],
  },
  {
    label: '乾物',
    items: [
      { id: 'nori', label: '海苔', defaultStorageLocation: 'room_temperature', featured: true },
      { id: 'wakame', label: 'わかめ', defaultStorageLocation: 'room_temperature' },
      { id: 'hijiki', label: 'ひじき', defaultStorageLocation: 'room_temperature' },
      { id: 'kiriboshi_daikon', label: '切り干し大根', defaultStorageLocation: 'room_temperature' },
      { id: 'koya_tofu', label: '高野豆腐', defaultStorageLocation: 'room_temperature' },
      { id: 'harusame', label: '春雨', defaultStorageLocation: 'room_temperature' },
      { id: 'dried_shiitake', label: '干ししいたけ', defaultStorageLocation: 'room_temperature' },
    ],
  },
  {
    label: 'レトルト',
    items: [
      { id: 'retort_curry', label: 'レトルトカレー', defaultStorageLocation: 'room_temperature' },
      { id: 'pasta_sauce', label: 'パスタソース', defaultStorageLocation: 'room_temperature' },
      { id: 'retort_rice_bowl', label: 'レトルト丼', defaultStorageLocation: 'room_temperature' },
      { id: 'retort_soup', label: 'レトルトスープ', defaultStorageLocation: 'room_temperature' },
      { id: 'instant_miso_soup', label: 'インスタント味噌汁', defaultStorageLocation: 'room_temperature' },
    ],
  },
  {
    label: '主食系保存品',
    items: [
      { id: 'instant_noodles', label: '袋麺', defaultStorageLocation: 'room_temperature' },
      { id: 'cup_noodles', label: 'カップ麺', defaultStorageLocation: 'room_temperature', featured: true },
      { id: 'cereal', label: 'シリアル', defaultStorageLocation: 'room_temperature' },
    ],
  },
  {
    label: 'その他',
    items: [
      { id: 'curry_roux', label: 'カレールー', defaultStorageLocation: 'room_temperature', featured: true },
      { id: 'stew_roux', label: 'シチュールー', defaultStorageLocation: 'room_temperature' },
      { id: 'pancake_mix', label: 'ホットケーキミックス', defaultStorageLocation: 'room_temperature' },
    ],
  },
]
