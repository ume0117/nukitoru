// ============================================================
// world-food-sources.ts
//
// MISSION 2.37 — Source-level 権利登録簿（WorldFoodSource）。
//
// MISSION 2.36 / 2.36A の Rights Audit で「実際に一次情報で確認できた範囲だけ」を
// 表現する。checkedAt 未設定 = 未確認。conditional / unknown を無理に allowed へしない。
//
// 絶対ルール:
// - このファイルは rights metadata のみ。料理事実（分量・工程）は持たない。
// - RIGHTS EVIDENCE（保存・利用してよいか）であって CULINARY EVIDENCE ではない。
// - 実データ ingest は本 MISSION では行わない。API key も取得しない。
// - `synthetic-*` prefix の entry は Rights Gate のテスト専用（実在の情報源ではない）。
// ============================================================

import type { WorldFoodSource } from '@/features/food/types'

const CHECKED_AT = '2026-09-03' // MISSION 2.36 / 2.36A の一次確認日

export const WORLD_FOOD_SOURCE_REGISTRY: WorldFoodSource[] = [
  // ----------------------------------------------------------
  // 実在の情報源（MISSION 2.36 / 2.36A で一次確認した rights のみ記載）
  // ----------------------------------------------------------
  {
    sourceId: 'kr-mfds-cookrcp01',
    name: '조리식품의 레시피 DB (COOKRCP01)',
    organization: '식품의약품안전처 (Ministry of Food and Drug Safety, Korea)',
    sourceType: 'government',
    country: 'KR',
    languages: ['ko'],
    officialUrl: 'https://www.data.go.kr/data/15060073/openapi.do',
    rights: {
      // data.go.kr 15060073「이용허락범위: 제한 없음」を一次確認。
      // ただし運用ステージは審査承認が必要で、商用 product 利用の条件が未確定のため conditional。
      commercialUse: 'conditional',
      structuredFactStorage: 'conditional',
      verbatimTextStorage: 'prohibited', // 手順の逐語コピーはしない方針
      imageReuse: 'unknown', // 画像著作権・第三者権利は未確認
      aiMlUse: 'unknown',
    },
    // SourceRightsClassification に 'conditional' は無い。運用条件が未確定なので 'unknown'。
    // 条件つきである事実は rights.structuredFactStorage = 'conditional' が表現する（MISSION 2.36A §16）。
    classification: 'unknown',
    checkedAt: CHECKED_AT,
    rightsEvidenceUrl: 'https://www.data.go.kr/data/15060073/openapi.do',
    notes: [
      '이용허락범위「제한 없음」は一次確認済み。ただし運用ステージ審査未了 + 商用条件未確定のため',
      'classification=unknown / structuredFactStorage=conditional を保つ（MISSION 2.36A §16）。',
      '審査完了・条件確認まで production ingest しない。API key も取得しない。',
    ],
  },
  {
    sourceId: 'jp-maff-kyodo-ryori',
    name: 'うちの郷土料理〜次世代に伝えたい大切な味〜',
    organization: '農林水産省 (MAFF)',
    sourceType: 'government',
    country: 'JP',
    languages: ['ja'],
    officialUrl: 'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/',
    rights: {
      // 公共データ利用規約（第1.0版）= CC BY 4.0 互換 → 出典表示を条件に商用可（MAFF-held facts）。
      commercialUse: 'allowed',
      structuredFactStorage: 'allowed', // MAFF-held の facts（record 単位で第三者提供元を確認すること）
      verbatimTextStorage: 'prohibited', // 監修者の説明 prose を逐語転載しない
      imageReuse: 'prohibited', // 写真は第三者が権利を有する場合が多い（別 asset・ページ同意ゲート）
      aiMlUse: 'unknown', // PDL1.0 本文に AI/ML 記載なし
    },
    classification: 'use',
    checkedAt: CHECKED_AT,
    rightsEvidenceUrl: 'https://www.maff.go.jp/j/use/link.html',
    notes: [
      'PDL1.0 は CC BY 4.0 互換（一次確認）。Source default で MAFF-held facts は商用 USE 可。',
      'ただし個々の recipe に第三者「レシピ提供・監修・編集」がある（例: だし(山形県) → 山形県郷土料理探訪）。',
      'record ごとに thirdPartyRights の確認が必要。画像は imageReuse=prohibited（別 asset review）。',
    ],
  },
  {
    sourceId: 'us-usda-myplate',
    name: 'USDA MyPlate Kitchen',
    organization: 'U.S. Department of Agriculture (CNPP / SNAP-Ed)',
    sourceType: 'government',
    country: 'US',
    languages: ['en'],
    officialUrl: 'https://www.myplate.gov/myplate-kitchen',
    rights: {
      commercialUse: 'unknown',
      structuredFactStorage: 'unknown', // Source 全体を PD 扱いしない
      verbatimTextStorage: 'unknown',
      imageReuse: 'unknown',
      aiMlUse: 'unknown',
    },
    classification: 'unknown',
    checkedAt: CHECKED_AT,
    rightsEvidenceUrl: 'https://www.usda.gov/about-usda/policies-and-links',
    notes: [
      'MISSION 2.36A §0.4 C1/C2: Source 全体を Public Domain としない。',
      'recipe の多くが grantee（州立大学 SNAP-Ed / 州の栄養教育プログラム）由来 or "adapted from" 第三者',
      '（例: 2-Step Chicken ← ONIE Project = OU Health Sciences Center のグラント事業）。',
      '17 USC §105 は連邦職員の職務著作物のみを PD にする。record 単位でのみ判定する。',
    ],
  },

  // ----------------------------------------------------------
  // SYNTHETIC — Rights Gate のテスト専用（実在の情報源ではない）
  // ----------------------------------------------------------
  {
    sourceId: 'synthetic-cleared-open-source',
    name: 'SYNTHETIC — Fully-Cleared Open Government Source (TEST ONLY)',
    organization: 'SYNTHETIC / NUKITORU internal test',
    sourceType: 'open-dataset',
    country: 'US',
    languages: ['en'],
    officialUrl: 'https://example.invalid/synthetic-cleared-open-source',
    rights: {
      commercialUse: 'allowed',
      structuredFactStorage: 'allowed',
      verbatimTextStorage: 'conditional',
      imageReuse: 'prohibited', // 画像は不可（test E: それでも facts は Import 可能）
      aiMlUse: 'unknown', // AI 利用は未確認（test F: それでも facts は Import 可能）
    },
    classification: 'use',
    checkedAt: CHECKED_AT,
    rightsEvidenceUrl: 'https://example.invalid/synthetic-cleared-open-source/terms',
    notes: [
      'SYNTHETIC test source。実在しない。Rights Gate の PASS 経路を検証するためだけに存在する。',
      'imageReuse=prohibited / aiMlUse=unknown で「facts は通るが画像は入らない / AI 扱いにしない」を検証。',
    ],
  },
  {
    sourceId: 'synthetic-scrape-dataset',
    name: 'SYNTHETIC — Scrape-Derived Dataset, No Redistribution Right (TEST ONLY)',
    organization: 'SYNTHETIC / NUKITORU internal test',
    sourceType: 'academic-dataset',
    country: 'US',
    languages: ['en'],
    officialUrl: 'https://example.invalid/synthetic-scrape-dataset',
    rights: {
      commercialUse: 'prohibited',
      structuredFactStorage: 'prohibited',
      verbatimTextStorage: 'prohibited',
      imageReuse: 'prohibited',
      aiMlUse: 'prohibited',
    },
    classification: 'do-not-ingest',
    checkedAt: CHECKED_AT,
    notes: [
      'SYNTHETIC test source。MISSION 2.36A R6（uploader-set license ≠ 再配布権）を表す。',
      'Rights Gate の SOURCE_DO_NOT_INGEST BLOCK 経路を検証する。',
    ],
  },
]

export function listWorldFoodSourceIds(
  registry: WorldFoodSource[] = WORLD_FOOD_SOURCE_REGISTRY,
): string[] {
  return registry.map((s) => s.sourceId)
}

/** 実在の（非 synthetic）source だけを返す */
export function realWorldFoodSources(
  registry: WorldFoodSource[] = WORLD_FOOD_SOURCE_REGISTRY,
): WorldFoodSource[] {
  return registry.filter((s) => !s.sourceId.startsWith('synthetic-'))
}
