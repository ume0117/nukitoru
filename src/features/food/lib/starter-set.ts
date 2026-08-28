// ============================================================
// starter-set.ts
//
// MISSION 2.12 PHASE B — First 10 Families Verified Starter Set。
//
// Starter Setは「First 10 Families Betaで役立ちそうだと人間が選んだ
// Recipe id一覧」というProduct selection layerに過ぎない。Safety/Evidence
// Gateではなく、ここに載っているというだけではPublishableにもVerifiedにも
// ならない。
//
// 絶対ルール:
// - 新しい第二のPublishability Gateをここに作らない。
// - Public Betaとして実際に公開できるかどうかの最終判定は、必ず既存の
//   isRecipePublishable()（recipe-publishability.ts）だけに委ねる。
// - Starter Set自体にVERIFIED/REVIEW/UNVERIFIEDが混ざっていてよい
//   （選定＝品質保証ではない）。
// ============================================================

import type { Recipe } from '@/features/food/types'
import { RECIPE_CATALOG } from './recipe-catalog'
import { isRecipePublishable } from './recipe-publishability'

/**
 * MISSION 2.12 PHASE B — Starter Recipe Candidatesの選定結果（recipeIdのみ）。
 * Priority 1/2/Holdの分類・選定理由はSelection Report（ミッション報告）側に記載する。
 * 新Recipeを追加せず、既存RECIPE_CATALOGに実在するidのみを列挙する。
 */
export const STARTER_SET_RECIPE_IDS: readonly string[] = [
  // Priority 1
  'gyudon',
  'oyako-don',
  'maguro-don',
  'medama-yaki',
  'hiyayakko',
  'sake-shioyaki',
  // Priority 2
  'tori-soboro-don',
  'tuna-mayo-don',
  'pork-cabbage-miso-stirfry',
  'tofu-miso-soup',
  // Hold（Evidence上の構造的な理由でVERIFIED化が難しい。Coverageの記録として残す）
  'shio-musubi',
  'onigiri-nori',
  'natto-gohan',
  'curry-rice',
]

/**
 * Starter Set候補のうち、実際にRECIPE_CATALOGへ存在するRecipeだけを返す
 * （存在しないidを静かに無視するのではなく、テスト側でid整合性を別途検査する）。
 */
export function getStarterSetRecipes(catalog: Recipe[] = RECIPE_CATALOG): Recipe[] {
  const ids = new Set(STARTER_SET_RECIPE_IDS)
  return catalog.filter((r) => ids.has(r.id))
}

/**
 * Public Betaへ実際に公開できるStarter Recipeのみを返す。
 * 判定は必ずisRecipePublishable()に委譲し、ここでは独自のSafety/Evidence判定を
 * 一切行わない（Starter Setは選定layerであり、Gateではない）。
 */
export function getBetaPublishableStarterRecipes(catalog: Recipe[] = RECIPE_CATALOG): Recipe[] {
  return getStarterSetRecipes(catalog).filter((r) => isRecipePublishable(r))
}
