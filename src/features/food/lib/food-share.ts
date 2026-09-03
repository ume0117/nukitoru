// ============================================================
// food-share.ts
//
// MISSION 2.40 — FOOD の Share 文言 / ハッシュタグ / SNS intent URL を
// 「事実のみ」から生成する純粋関数群。
//
// 探す → 作る → 気に入る → 覚える → また作る → みんなにシェアする、の最後の自然な action。
// 「シェアしてください！」と強制しない。完成後 or Recipe Detail から。
//
// 絶対ルール:
// - Share payload に在庫 / 家族 Preference / Allergy / 個人設定を含めない。
//   引数は recipeName（原文）と、呼び出し側が明示的に渡す factualTags のみ。
// - 国 / Meal Occasion / 料理ジャンルを「推測して」タグ付与しない。
//   factualHashtagsFrom() は明示 metadata / Evidence がある値だけを受け取る。
// - 既存 layout.tsx footer の SNS URL パターン（X/Bluesky/Facebook/LINE）を再利用する。
//   新しい Share provider abstraction を重複実装しない。
// - Web Share API は family-share.ts と同じく navigator.share → clipboard fallback。
// - deterministic（乱数・現在時刻・AI なし）。
// ============================================================

import type { FoodShareInput, MealOccasion } from '@/features/food/types'
import { MEAL_OCCASION_JA_LABELS } from './meal-occasion'

export const FOOD_SHARE_URL = 'https://nukitoru.pages.dev/food'
export const BRAND_HASHTAGS: readonly string[] = ['#NUKITORU', '#NUKITORUFOOD']

/** 明示 metadata（occasion）と Evidence つきの国名ラベルからのみ factual タグを作る（# 抜き） */
export function factualTagsFrom(input: {
  /** 明示 Meal Occasion metadata（空なら occasion タグ無し） */
  mealOccasions?: MealOccasion[]
  /** Evidence がある場合のみ渡す料理圏ラベル（例: "日本料理"） */
  cuisineLabelWithEvidence?: string
}): string[] {
  const tags: string[] = []
  if (input.cuisineLabelWithEvidence && input.cuisineLabelWithEvidence.trim()) {
    tags.push(input.cuisineLabelWithEvidence.trim())
  }
  for (const o of input.mealOccasions ?? []) {
    tags.push(MEAL_OCCASION_JA_LABELS[o])
  }
  return [...new Set(tags)]
}

/** 最終的なハッシュタグ配列（brand 先頭 + factual。すべて "#" 始まり・dedup） */
export function buildFoodShareHashtags(factualTags: string[] = []): string[] {
  const normalized = factualTags
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
  return [...new Set([...BRAND_HASHTAGS, ...normalized])]
}

/**
 * Share 本文。Evidence 未確認 Recipe を「安全」「検証済み」等と断定しない
 * （family-share.ts と同じ規律）。在庫・個人情報を含めない。
 */
export function buildFoodShareText(input: FoodShareInput): string {
  const hashtags = buildFoodShareHashtags(input.factualTags ?? [])
  return [
    `${input.recipeName} を作りました`,
    '',
    'NUKITORU FOOD',
    FOOD_SHARE_URL,
    '',
    hashtags.join(' '),
  ].join('\n')
}

// ------------------------------------------------------------
// SNS intent URL（既存 layout.tsx footer と同じパターン）
// ------------------------------------------------------------

export interface SnsShareUrls {
  x: string
  bluesky: string
  facebook: string
  line: string
}

/** X / Bluesky / Facebook / LINE の intent URL を本文から生成（layout.tsx footer と同型） */
export function buildSnsShareUrls(input: FoodShareInput): SnsShareUrls {
  const text = buildFoodShareText(input)
  const encodedText = encodeURIComponent(text)
  const encodedUrl = encodeURIComponent(FOOD_SHARE_URL)
  return {
    x: `https://twitter.com/intent/tweet?text=${encodedText}`,
    bluesky: `https://bsky.app/intent/compose?text=${encodedText}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    line: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`,
  }
}

// ------------------------------------------------------------
// Web Share API（family-share.ts と同じ channel-neutral fallback）
// ------------------------------------------------------------

export type FoodShareOutcome = 'shared' | 'copied' | 'unavailable' | 'cancelled'

export async function shareFood(input: FoodShareInput): Promise<FoodShareOutcome> {
  const text = buildFoodShareText(input)

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'NUKITORU FOOD', text })
      return 'shared'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return 'copied'
    } catch {
      return 'unavailable'
    }
  }
  return 'unavailable'
}
