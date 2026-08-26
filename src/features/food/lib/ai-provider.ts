// ============================================================
// ai-provider.ts
//
// Provider非依存のインターフェース定義のみ。実装クラス・実際のAPI接続は行わない。
//
// 必須アーキテクチャ制約（MISSION 1で確定、変更禁止）:
//   Browser → NUKITORU backend / Cloudflare Worker → AI provider
// クライアントからAI providerへAPIキー付きで直接通信することは禁止。
// APIキーはWorker/server側だけに置く。
// ============================================================

import type { MealSuggestionRequest, MealSuggestionResponse } from '@/features/food/types'

export interface MealSuggestionProvider {
  suggest(input: MealSuggestionRequest): Promise<MealSuggestionResponse>
}
