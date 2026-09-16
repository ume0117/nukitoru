'use client'

import type { DishType, MealSuggestion, Recipe } from '@/features/food/types'
import { cuisineLabel } from '@/features/food/lib/recipe-labels'
import { filterSafeArrangements } from '@/features/food/lib/recipe-safety'
import { splitRequiredIngredients } from '@/features/food/lib/recipe-suggestion-engine'
import { isProductCookingTimeEstablished } from '@/features/food/lib/recipe-time'
import { productCheckMessage } from '@/features/food/lib/product-check-messages'
import { recipeEvidenceSummaryFor } from '@/features/food/lib/recipe-evidence-summary'
import { RecipeFeedback } from './RecipeFeedback'

interface Props {
  recipe: Recipe
  suggestion: MealSuggestion
  /** MISSION 2.10のSingle Source of Truth（selectedMemberIds由来）。ここで新しい人数を作らない */
  todayMemberCount: number
  availableIngredientNames: string[]
  /** その日選択されているメンバー全員のallergiesをunionした結果。arrangementの安全フィルタに使う */
  mergedAllergyNames: string[]
  onBack: () => void
  onCookedClick: () => void
  /** Cooking Modeへ変換可能な場合のみ渡される。undefinedならボタン自体を表示しない */
  onStartCooking?: () => void
}

const DISH_TYPE_LABELS: Record<DishType, string> = {
  main: '主菜',
  side: '副菜',
  soup: '汁物',
  other: 'その他',
}

/**
 * MISSION 2.11 PHASE D — 候補一覧から選択された1レシピの詳細画面。
 * 表示順序: 料理名 → cuisine/type → 今日の人数 → 調理時間 → 使う食材 →
 * 調味料 → 調理に使う水・湯 → アレルギー・原材料確認 → 準備するもの →
 * 調理前の準備（MISSION 2.20・存在時のみ）→ 作り方 → ちょいアレンジ →
 * 注意事項 → 作った！
 *
 * MISSION 2.20: 調理時間の Product Time が review/unknown の Recipe は
 * 確定値「約○分」を表示せず「確認中」と表示する。preparation（調理前の準備）は
 * steps（作り方）とは別セクションで表示し、未設定の Recipe は従来どおり非表示。
 *
 * 安全上の絶対ルール:
 * - arrangementsはfilterSafeArrangements()で、その日のアレルギーと
 *   一致するaddIngredientsを持つものだけを非表示にする。基本Recipe自体は
 *   arrangementの安全性に関わらず常に表示する。
 * - stepsやnotesに存在しない内容をこの画面側で生成しない
 *   （Recipe catalogに存在する確定データのみ表示する）。
 *
 * MISSION 2.11 PHASE D.5 — アレルギー・原材料確認（PRODUCT CHECK ALERT）は
 * 既存のAllergy HARD EXCLUSION（filterSafeArrangements/rankRecipes）とは
 * 完全に別レイヤー。ここで表示するのは「商品によって原材料が異なり得るので
 * 確認してほしい」という一般的な注意喚起のみで、特定の商品・アレルゲンの
 * 有無を断定しない。mergedAllergyNamesはこのセクションの視認性を上げる
 * ためだけに使い、「この食材に該当のアレルゲンが含まれる」とは判定しない。
 */
export function RecipeDetailView({
  recipe,
  suggestion,
  todayMemberCount,
  availableIngredientNames,
  mergedAllergyNames,
  onBack,
  onCookedClick,
  onStartCooking,
}: Props) {
  const { have, missing } = splitRequiredIngredients(recipe.requiredIngredients, availableIngredientNames)
  const safeArrangements = filterSafeArrangements(recipe, mergedAllergyNames)
  const cuisine = cuisineLabel(recipe.cuisine)
  const evidence = recipeEvidenceSummaryFor(recipe)

  return (
    <div className="border border-gray-200 dark:border-gray-800 p-4 space-y-4">
      <button
        onClick={onBack}
        className="text-[10px] tracking-[0.1em] text-gray-400 dark:text-gray-600 hover:text-blue-600 uppercase transition-colors"
      >
        ← おすすめに戻る
      </button>

      <div className="space-y-1">
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {[cuisine, DISH_TYPE_LABELS[recipe.type]].filter(Boolean).join(' ・ ')}
        </p>
        <p className="text-lg font-medium text-gray-900 dark:text-white break-words">{recipe.name}</p>
      </div>

      {evidence && (
        <details className="text-[12px] border border-gray-200 dark:border-gray-800 p-2.5">
          <summary className="flex flex-wrap items-center gap-x-2 cursor-pointer text-gray-700 dark:text-gray-300">
            <span>✓ レシピ確認済み</span>
            <span className="text-blue-600 dark:text-blue-400 underline">根拠を見る</span>
          </summary>
          <div className="mt-2 space-y-2">
            {evidence.verifiedFieldLabels.length > 0 && (
              <p className="text-gray-500 dark:text-gray-400">
                確認済み：{evidence.verifiedFieldLabels.join('・')}
              </p>
            )}
            {evidence.sources.length > 0 && (
              <ul className="space-y-1">
                {evidence.sources.map((source) => (
                  <li key={source.url} className="text-gray-600 dark:text-gray-400">
                    {source.publisher}「{source.title}」
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all text-blue-600 dark:text-blue-400 underline"
                    >
                      {source.url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      )}

      <div className="text-[12px] text-gray-600 dark:text-gray-400 space-y-0.5">
        <p>今日の人数：{todayMemberCount}人</p>
        {recipe.servingsBase > 0 && <p>レシピの基本目安：{recipe.servingsBase}人分</p>}
        {/* MISSION 2.20: Product Time が未確定（review/unknown）なら確定値「約○分」を出さない */}
        {isProductCookingTimeEstablished(recipe) ? (
          <p>調理時間の目安：約{recipe.cookingTimeMinutes}分</p>
        ) : (
          <p>調理時間の目安：確認中</p>
        )}
        <p className="text-[11px] text-gray-400 dark:text-gray-600">材料の分量は基本目安の人数分です。</p>
      </div>

      <section className="space-y-1.5">
        <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">
          使う食材（{recipe.servingsBase}人分）
        </p>
        {have.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-gray-400 dark:text-gray-600">家にある</p>
            {have.map((ingredient) => (
              <p key={ingredient.name} className="text-sm text-gray-800 dark:text-gray-100">
                ✓ {ingredient.name}
                <span className="text-gray-500 dark:text-gray-400"> {ingredient.amount}</span>
              </p>
            ))}
          </div>
        )}
        {missing.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-amber-600 dark:text-amber-400">足りない</p>
            {missing.map((ingredient) => (
              <p key={ingredient.name} className="text-sm text-gray-800 dark:text-gray-100">
                ・{ingredient.name}
                <span className="text-gray-500 dark:text-gray-400"> {ingredient.amount}</span>
              </p>
            ))}
          </div>
        )}
        {suggestion.warnings.length > 0 && (
          <div className="space-y-1 border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2.5 mt-1.5">
            {suggestion.warnings.map((warning, wi) => (
              <p key={wi} className="text-[11px] text-amber-700 dark:text-amber-400">
                ⚠ {warning}
              </p>
            ))}
          </div>
        )}
      </section>

      {recipe.seasonings && recipe.seasonings.length > 0 && (
        <section className="space-y-1">
          <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">調味料</p>
          {recipe.seasonings.map((seasoning) => (
            <p key={seasoning.name} className="text-sm text-gray-700 dark:text-gray-300">
              {seasoning.name}
              <span className="text-gray-500 dark:text-gray-400"> {seasoning.amount}</span>
            </p>
          ))}
        </section>
      )}

      {recipe.cookingLiquids && recipe.cookingLiquids.length > 0 && (
        <section className="space-y-1">
          <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">調理に使う水・湯</p>
          {recipe.cookingLiquids.map((liquid) => (
            <p key={liquid.name} className="text-sm text-gray-700 dark:text-gray-300">
              {liquid.name}
              <span className="text-gray-500 dark:text-gray-400"> {liquid.amount}</span>
            </p>
          ))}
        </section>
      )}

      {recipe.ingredientChecks && recipe.ingredientChecks.length > 0 && (
        <section className="space-y-1.5 border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2.5">
          <p className="text-[9px] tracking-[0.2em] text-amber-700 dark:text-amber-400 uppercase">
            ⚠ アレルギー・原材料確認
          </p>
          {recipe.ingredientChecks.map((check) => {
            const message = productCheckMessage(check.ingredientName)
            if (!message) return null
            return (
              <p key={check.ingredientName} className="text-[12px] text-amber-800 dark:text-amber-300">
                {message}
              </p>
            )
          })}
          {mergedAllergyNames.length > 0 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-500">
              アレルギー情報が登録されています。上記の原材料表示を必ず確認してください。
            </p>
          )}
        </section>
      )}

      {recipe.equipment && recipe.equipment.length > 0 && (
        <section className="space-y-1">
          <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">準備するもの</p>
          <ul className="space-y-0.5">
            {recipe.equipment.map((item) => (
              <li key={item} className="text-sm text-gray-700 dark:text-gray-300">
                ・{item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {recipe.preparation && recipe.preparation.length > 0 && (
        <section className="space-y-1">
          <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">調理前の準備</p>
          <ol className="space-y-1 list-decimal list-inside">
            {recipe.preparation.map((prep, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
                {prep.text}
              </li>
            ))}
          </ol>
        </section>
      )}

      {recipe.steps && recipe.steps.length > 0 && (
        <section className="space-y-1">
          <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">作り方</p>
          <ol className="space-y-1 list-decimal list-inside">
            {recipe.steps.map((step, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
                {step}
              </li>
            ))}
          </ol>
        </section>
      )}

      {safeArrangements.length > 0 && (
        <section className="space-y-1">
          <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">ちょいアレンジ</p>
          <ul className="space-y-0.5">
            {safeArrangements.map((arrangement) => (
              <li key={arrangement.id} className="text-sm text-gray-700 dark:text-gray-300">
                ・{arrangement.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {recipe.notes && recipe.notes.length > 0 && (
        <section className="space-y-1 border-t border-gray-100 dark:border-gray-800 pt-3">
          <p className="text-[9px] tracking-[0.2em] text-gray-400 dark:text-gray-600 uppercase">注意事項</p>
          {recipe.notes.map((note, i) => (
            <p key={i} className="text-[11px] text-gray-500 dark:text-gray-400">
              {note}
            </p>
          ))}
        </section>
      )}

      {onStartCooking && (
        <button
          onClick={onStartCooking}
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-[12px] tracking-[0.15em] uppercase font-medium transition-colors"
        >
          調理を始める
        </button>
      )}

      <button
        onClick={onCookedClick}
        className="w-full h-11 border border-gray-400 dark:border-gray-600 hover:border-blue-600 hover:text-blue-600 text-[11px] tracking-[0.15em] uppercase font-medium text-gray-500 dark:text-gray-400 transition-colors"
      >
        作った！
      </button>

      <RecipeFeedback recipeId={recipe.id} />
    </div>
  )
}
