// ============================================================
// mock-meal-provider.ts
//
// MealSuggestionProvider の決定論的・ルールベースなローカル実装。
// AI APIへの実接続は行わない（MISSION 2のスコープ外）。
//
// 設計方針（MISSION 2 Planに準拠）:
// - 献立選定に実際に使うのは「食材」「アレルギー」「苦手食材」「調理時間」のみ。
// - household / dailyCondition / season / shoppingMode / pantry は
//   選定ロジックには影響させず、notes等の参考情報にのみ反映する
//   （dailyConditionは「登録されている事実」を示すメモに留め、
//    選定へ反映したと誤認させる表現は使わない）。
// - 調理時間は「選ばれた料理の合計時間」で判定する。
//   maxCookingMinutesが指定されている場合、合計時間がそれを超える組み合わせは選ばない。
// - Date.now() 等の非決定要素は使わない。同一入力は常に同一出力になる。
// ============================================================

import type { MealSuggestionProvider } from './ai-provider'
import type {
  MealSuggestionRequest,
  MealSuggestionResponse,
  MealSuggestion,
  Dish,
  DishType,
  Ingredient,
} from '@/features/food/types'

interface CatalogDish {
  name: string
  type: DishType
  requires: string[]
  estimatedMinutes: number
}

const CATALOG: CatalogDish[] = [
  { name: '塩むすび', type: 'main', requires: ['米'], estimatedMinutes: 10 },
  { name: 'まぐろ丼', type: 'main', requires: ['米', 'マグロ'], estimatedMinutes: 15 },
  { name: '冷奴', type: 'side', requires: ['豆腐'], estimatedMinutes: 5 },
  { name: '豆腐と卵のスープ', type: 'soup', requires: ['卵', '豆腐'], estimatedMinutes: 10 },
  { name: '目玉焼き', type: 'side', requires: ['卵'], estimatedMinutes: 5 },
]

const CONDITION_NOTES: Partial<Record<string, string>> = {
  cold_symptoms: '体調メモ：風邪気味として登録されています。',
  low_appetite: '体調メモ：食欲がない状態として登録されています。',
  summer_fatigue: '体調メモ：夏バテ気味として登録されています。',
}

function normalize(name: string): string {
  return name.trim().toLowerCase()
}

function buildIngredientIndex(ingredients: Ingredient[]): Map<string, Ingredient> {
  const index = new Map<string, Ingredient>()
  for (const ingredient of ingredients) {
    const key = normalize(ingredient.name)
    if (!index.has(key)) {
      index.set(key, ingredient)
    }
  }
  return index
}

function containsAnyName(requires: string[], names: Set<string>): boolean {
  for (const r of requires) {
    if (names.has(normalize(r))) {
      return true
    }
  }
  return false
}

function dishToOutput(dish: CatalogDish): Dish {
  return {
    name: dish.name,
    type: dish.type,
    requiredIngredients: dish.requires.map((name) => ({ name })),
  }
}

function sortCandidates(dishes: CatalogDish[], dislikeNames: Set<string>): CatalogDish[] {
  const withPenalty = dishes.map((dish) => ({
    dish,
    penalty: containsAnyName(dish.requires, dislikeNames) ? 1 : 0,
  }))

  withPenalty.sort((a, b) => {
    if (a.penalty !== b.penalty) {
      return a.penalty - b.penalty
    }
    return b.dish.requires.length - a.dish.requires.length
  })

  return withPenalty.map((entry) => entry.dish)
}

interface Combo {
  main: CatalogDish | null
  side: CatalogDish | null
}

function pickBestCombo(
  mains: CatalogDish[],
  sides: CatalogDish[],
  maxMinutes: number | null,
): Combo | null {
  const mainOptions: (CatalogDish | null)[] = [...mains, null]
  const sideOptions: (CatalogDish | null)[] = [...sides, null]

  let best: { combo: Combo; dishCount: number; mainRank: number; sideRank: number } | null = null

  for (let mainRank = 0; mainRank < mainOptions.length; mainRank++) {
    const main = mainOptions[mainRank]
    for (let sideRank = 0; sideRank < sideOptions.length; sideRank++) {
      const side = sideOptions[sideRank]
      if (!main && !side) {
        continue
      }

      const total = (main?.estimatedMinutes ?? 0) + (side?.estimatedMinutes ?? 0)
      if (maxMinutes !== null && total > maxMinutes) {
        continue
      }

      const dishCount = (main ? 1 : 0) + (side ? 1 : 0)
      const isBetter =
        !best ||
        dishCount > best.dishCount ||
        (dishCount === best.dishCount &&
          (mainRank < best.mainRank || (mainRank === best.mainRank && sideRank < best.sideRank)))

      if (isBetter) {
        best = { combo: { main, side }, dishCount, mainRank, sideRank }
      }
    }
  }

  return best ? best.combo : null
}

export const mockMealProvider: MealSuggestionProvider = {
  async suggest(input: MealSuggestionRequest): Promise<MealSuggestionResponse> {
    const ingredientIndex = buildIngredientIndex(input.ingredients)
    const availableNames = new Set(ingredientIndex.keys())
    const allergyNames = new Set((input.allergyProfile?.allergies ?? []).map(normalize))
    const dislikeNames = new Set((input.allergyProfile?.dislikes ?? []).map(normalize))
    const maxMinutes = input.cookingPreference?.maxCookingMinutes ?? null

    const candidates: CatalogDish[] = []
    for (const dish of CATALOG) {
      const hasAllRequired = dish.requires.every((r) => availableNames.has(normalize(r)))
      if (!hasAllRequired) {
        continue
      }
      if (containsAnyName(dish.requires, allergyNames)) {
        continue
      }
      candidates.push(dish)
    }

    const mains = sortCandidates(
      candidates.filter((d) => d.type === 'main'),
      dislikeNames,
    )
    const sides = sortCandidates(
      candidates.filter((d) => d.type === 'side' || d.type === 'soup'),
      dislikeNames,
    )

    const combo = pickBestCombo(mains, sides, maxMinutes)
    if (!combo) {
      return { suggestions: [] }
    }

    const selected = [combo.main, combo.side].filter((d): d is CatalogDish => d !== null)

    const dishes: Dish[] = selected.map(dishToOutput)
    const title = selected.map((d) => d.name).join(' + ')
    const estimatedMinutes = selected.reduce((sum, d) => sum + d.estimatedMinutes, 0)

    const notes: string[] = ['手元の食材を中心に組み合わせました。']

    const conditionNote = input.dailyCondition ? CONDITION_NOTES[input.dailyCondition] : undefined
    if (conditionNote) {
      notes.push(conditionNote)
    }

    const dislikeHits = new Set<string>()
    for (const dish of selected) {
      if (!containsAnyName(dish.requires, dislikeNames)) {
        continue
      }
      for (const r of dish.requires) {
        if (dislikeNames.has(normalize(r))) {
          dislikeHits.add(r)
        }
      }
    }
    for (const name of dislikeHits) {
      notes.push(`苦手食材として登録されている${name}を含みますが、他に候補がないため表示しています。`)
    }

    const warnings: string[] = []
    const vagueHits = new Set<string>()
    for (const dish of selected) {
      for (const r of dish.requires) {
        const ingredient = ingredientIndex.get(normalize(r))
        const mode = ingredient?.quantityMode
        if (ingredient && (mode === 'vague' || mode === 'unknown')) {
          vagueHits.add(ingredient.name)
        }
      }
    }
    for (const name of vagueHits) {
      warnings.push(`${name}の数量は不明として扱い、具体的な数量には確定していません。`)
    }

    const suggestion: MealSuggestion = {
      title,
      reason: '手元の食材を中心に組み合わせました。',
      dishes,
      estimatedMinutes,
      shoppingItems: [],
      notes,
      warnings,
    }

    return { suggestions: [suggestion] }
  },
}
