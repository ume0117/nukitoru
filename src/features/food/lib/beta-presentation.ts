// ============================================================
// beta-presentation.ts
//
// MISSION 2.12 PHASE A — First 10 Families Beta。
//
// 「候補を大量に見せない」ための表示件数キャップのみを扱う純粋関数。
// rankRecipes()自体の件数・順序・安全判定には一切関与しない
// （ここに来る時点で既にAllergy HARD EXCLUSION・Candidate A/Bを通過済み）。
//
// 絶対ルール:
// - 候補が3件未満の場合、無理に3件へ水増ししない（sliceは足りない分を
//   埋めない。1件なら1件、2件なら2件のまま返す）。
// - 順序を並び替えない（rankRecipesが決めた順序をそのまま尊重する）。
// ============================================================

export const BETA_MAX_CANDIDATES = 3

export function selectBetaCandidates<T>(suggestions: T[]): T[] {
  return suggestions.slice(0, BETA_MAX_CANDIDATES)
}
