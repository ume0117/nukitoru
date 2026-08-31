import { describe, it, expect } from 'vitest'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { canonicalizeIngredientName, isSameIngredient } from '../ingredient-normalization'
import { allergyRelevantIngredients, arrangementRelevantIngredients } from '../recipe-safety'
import { productCheckMessage, PRODUCT_CHECK_TARGET_INGREDIENTS } from '../product-check-messages'
import { EVIDENCE_SOURCE_CATALOG, getEvidenceSourceById, isPlaceholderUrl } from '../evidence-sources'
import {
  isRecipePublishable,
  isValidCheckedAt,
  applicableFieldsFor,
  getVerificationStatus,
} from '../recipe-publishability'

// ============================================================
// Recipe Quality Gate
//
// 30〜50品の今だけでなく、将来数千品になっても同じテストで検査できるよう、
// 個別のrecipeを名指しせず RECIPE_CATALOG 全件を走査する形にする。
// ============================================================

/**
 * 断定的な安全保証表現のブロックリスト。
 * 「中心まで火を通す」等の行動指示はここに含めない。禁止するのは
 * 「これで安全」「食中毒を防げる」のような断定・保証表現のみ。
 */
const DANGEROUS_SAFETY_CLAIM_PATTERNS = [
  '安全です',
  '安全に食べられ',
  '食中毒を防げ',
  '食中毒を防ぎ',
  '完全に安全',
  '絶対に安全',
  '安心して食べ',
]

function containsDangerousClaim(text: string): boolean {
  return DANGEROUS_SAFETY_CLAIM_PATTERNS.some((pattern) => text.includes(pattern))
}

// ============================================================
// MISSION 2.11 PHASE D.1/D.2 — Cooking Reality Quality Gate
//
// 「料理として自然か」の全自動判定はしない。ここでは機械的に検出できる
// 範囲の明白な矛盾のみを検査する。誤検出が多いheuristicは無理に
// 自動化せず、narrow・具体的な範囲に留める（PHASE D.2で明示された方針）。
//
// PHASE D.2時点でKNOWN_*_EXCEPTIONSは全て解消済み（0件）。
// 新しいrecipeを追加してこのゲートに引っかかった場合は、
// 「例外リストに追加する」のではなく、recipe側を実際に直すことを優先する。
// ============================================================

/** 米はcanonicalization辞書上ごはん/ご飯とも同一視されるため、steps側の表記ゆれを許容する */
const RICE_STEP_ALIASES = ['米', 'ごはん', 'ご飯']

function ingredientAppearsInSteps(ingredient: string, steps: string[]): boolean {
  const joined = steps.join('')
  if (joined.includes(ingredient)) return true
  if (canonicalizeIngredientName(ingredient) === '米') {
    return RICE_STEP_ALIASES.some((alias) => joined.includes(alias))
  }
  return false
}

const KNIFE_STEP_KEYWORDS = ['切る', '切り', '刻む', 'せん切り', '千切り']

function needsKnife(steps: string[]): boolean {
  return steps.some((step) => KNIFE_STEP_KEYWORDS.some((kw) => step.includes(kw)))
}

function hasKnifeEquipment(equipment: string[] | undefined): boolean {
  if (!equipment) return false
  return equipment.some((item) => item.includes('包丁') || item.includes('まな板'))
}

/**
 * 調理動詞 → 対応する調理器具（equipmentにいずれか1つ含まれればOK）。
 * 「煮る」はフライパンでも鍋でも成立するため両方を許容する。
 * 過剰検出を避けるため、動詞と器具の対応が明確なものだけに限定する。
 */
const COOKING_VERB_EQUIPMENT_RULES: Array<{ verbs: string[]; equipmentAnyOf: string[] }> = [
  { verbs: ['揚げ'], equipmentAnyOf: ['フライパン', '鍋'] },
  { verbs: ['焼く', '焼き'], equipmentAnyOf: ['フライパン', 'グリル', 'トースター'] },
  { verbs: ['煮る', '煮込む', '煮立た', '煮詰め'], equipmentAnyOf: ['鍋', 'フライパン'] },
  { verbs: ['ゆでる', '茹でる'], equipmentAnyOf: ['鍋'] },
  { verbs: ['炊く', '炊飯'], equipmentAnyOf: ['炊飯器'] },
]

/**
 * steps文中で「油」が使われていても、缶詰の油をきる／調理で出た脂をふき取る、
 * といった「追加のingredientではない」用法はseasonings記載を要求しない。
 * これは自動判定できないため、人間監査で確認済みのrecipeのみを列挙する
 * （新規追加不可: 新しいrecipeでこの種の用法が出たら都度人間が判断する）。
 */
const OIL_REMOVAL_NOT_INGREDIENT_EXCEPTIONS = new Set([
  'tuna-mayo-don', // 缶詰ツナの油をきる（追加していない）
  'tori-teriyaki', // 鶏肉から出た余分な脂をふき取る（追加していない）
  'tuna-daikon-salad', // 缶詰ツナの油をきる（追加していない）
  'tuna-sandwich', // 缶詰ツナの油をきる（追加していない）
])

const FORBIDDEN_AMOUNT_VALUES = new Set(['', '不明', 'unknown', 'Unknown', 'UNKNOWN', 'TBD', 'tbd', 'あとで', '?', '？'])

describe('recipe-catalog.ts — Quality Gate（全件走査、件数に依存しない）', () => {
  it('A: idが全件で重複していない', () => {
    const ids = RECIPE_CATALOG.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('B: nameが空文字のrecipeがない', () => {
    for (const recipe of RECIPE_CATALOG) {
      expect(recipe.name.trim().length).toBeGreaterThan(0)
    }
  })

  it('C: requiredIngredientsが1件以上ある', () => {
    for (const recipe of RECIPE_CATALOG) {
      expect(recipe.requiredIngredients.length).toBeGreaterThan(0)
    }
  })

  it('D: cookingTimeMinutesが正の値である', () => {
    for (const recipe of RECIPE_CATALOG) {
      expect(recipe.cookingTimeMinutes).toBeGreaterThan(0)
    }
  })

  it('E: servingsBaseが正の値である', () => {
    for (const recipe of RECIPE_CATALOG) {
      expect(recipe.servingsBase).toBeGreaterThan(0)
    }
  })

  it('F: stepsを持つrecipeに空工程が含まれない', () => {
    for (const recipe of RECIPE_CATALOG) {
      if (!recipe.steps) continue
      expect(recipe.steps.length).toBeGreaterThan(0)
      for (const step of recipe.steps) {
        expect(step.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('G: equipmentに空文字が含まれない', () => {
    for (const recipe of RECIPE_CATALOG) {
      if (!recipe.equipment) continue
      for (const item of recipe.equipment) {
        expect(item.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('H: arrangementsのidがカタログ全体で重複していない', () => {
    const arrangementIds = RECIPE_CATALOG.flatMap((r) => (r.arrangements ?? []).map((a) => a.id))
    expect(new Set(arrangementIds).size).toBe(arrangementIds.length)
  })

  it('I: arrangement.addIngredientsに空文字が含まれない', () => {
    for (const recipe of RECIPE_CATALOG) {
      for (const arrangement of recipe.arrangements ?? []) {
        for (const ing of arrangement.addIngredients ?? []) {
          expect(ing.trim().length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('J: steps/notesに危険な安全保証表現が含まれない', () => {
    for (const recipe of RECIPE_CATALOG) {
      for (const step of recipe.steps ?? []) {
        expect(containsDangerousClaim(step)).toBe(false)
      }
      for (const note of recipe.notes ?? []) {
        expect(containsDangerousClaim(note)).toBe(false)
      }
    }
  })

  it('K: canonicalization後にrequiredIngredients内で同一食材が重複していない', () => {
    for (const recipe of RECIPE_CATALOG) {
      const canonical = recipe.requiredIngredients.map((i) => canonicalizeIngredientName(i.name))
      expect(new Set(canonical).size).toBe(canonical.length)
    }
  })

  it('L: seasoningsに空文字・重複がない', () => {
    for (const recipe of RECIPE_CATALOG) {
      if (!recipe.seasonings) continue
      for (const s of recipe.seasonings) {
        expect(s.name.trim().length).toBeGreaterThan(0)
      }
      const canonical = recipe.seasonings.map((i) => canonicalizeIngredientName(i.name))
      expect(new Set(canonical).size).toBe(canonical.length)
    }
  })

  it('件数チェック: 最低30品、目標50品の範囲内', () => {
    expect(RECIPE_CATALOG.length).toBeGreaterThanOrEqual(30)
  })

  it('M: requiredIngredientsがstepsと完全に無関係になっていない', () => {
    for (const recipe of RECIPE_CATALOG) {
      if (!recipe.steps || recipe.steps.length === 0) continue
      for (const ingredient of recipe.requiredIngredients) {
        expect(
          ingredientAppearsInSteps(ingredient.name, recipe.steps),
          `${recipe.id}: 「${ingredient.name}」がstepsのどこにも現れない`,
        ).toBe(true)
      }
    }
  })

  it('N: 切る工程があるrecipeにはequipmentへ包丁またはまな板が含まれる', () => {
    for (const recipe of RECIPE_CATALOG) {
      if (!recipe.steps) continue
      if (needsKnife(recipe.steps)) {
        expect(
          hasKnifeEquipment(recipe.equipment),
          `${recipe.id}: 切る工程があるのにequipmentに包丁/まな板がない`,
        ).toBe(true)
      }
    }
  })

  it('O: 揚げる/焼く/煮る/ゆでる/炊く工程があるrecipeには対応するequipmentが含まれる', () => {
    for (const recipe of RECIPE_CATALOG) {
      if (!recipe.steps) continue
      const joined = recipe.steps.join('')
      for (const rule of COOKING_VERB_EQUIPMENT_RULES) {
        if (!rule.verbs.some((v) => joined.includes(v))) continue
        const ok = (recipe.equipment ?? []).some((item) =>
          rule.equipmentAnyOf.some((keyword) => item.includes(keyword)),
        )
        expect(
          ok,
          `${recipe.id}: 「${rule.verbs.join('/')}」工程があるのにequipmentへ${rule.equipmentAnyOf.join('または')}がない`,
        ).toBe(true)
      }
    }
  })

  it('P: seasoningsとして使われる食材がstepsにだけ突然出現していない（だし・片栗粉等のIngredient Integrity）', () => {
    const seasoningVocab = new Set<string>()
    for (const recipe of RECIPE_CATALOG) {
      for (const s of recipe.seasonings ?? []) seasoningVocab.add(s.name)
    }
    for (const recipe of RECIPE_CATALOG) {
      if (!recipe.steps) continue
      const joined = recipe.steps.join('')
      const known = new Set([
        ...recipe.requiredIngredients.map((i) => i.name),
        ...(recipe.seasonings ?? []).map((i) => i.name),
        ...(recipe.arrangements ?? []).flatMap((a) => a.addIngredients ?? []),
      ])
      for (const word of seasoningVocab) {
        if (!joined.includes(word) || known.has(word)) continue
        if (word === '油' && OIL_REMOVAL_NOT_INGREDIENT_EXCEPTIONS.has(recipe.id)) continue
        expect.fail(`${recipe.id}: 「${word}」がstepsに現れるがrequiredIngredients/seasonings/arrangementsに含まれない`)
      }
    }
  })

  it('Q: nameが全件で重複していない', () => {
    const names = RECIPE_CATALOG.map((r) => r.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('R: 米/ごはんの状態整合 — 米(生米)を要求するrecipeは炊飯器を持ち、現実的な調理時間を持つ', () => {
    for (const recipe of RECIPE_CATALOG) {
      if (!recipe.requiredIngredients.some((i) => i.name === '米')) continue
      expect(
        (recipe.equipment ?? []).some((item) => item.includes('炊飯器')),
        `${recipe.id}: 米(生米)が必須なのにequipmentへ炊飯器が含まれない`,
      ).toBe(true)
      expect(
        recipe.cookingTimeMinutes,
        `${recipe.id}: 米(生米)を炊く前提のrecipeなのにcookingTimeMinutesが非現実的に短い`,
      ).toBeGreaterThanOrEqual(30)
    }
  })

  it('R2: ごはん(炊飯済み)を要求するrecipeのstepsに生米の炊飯工程が紛れ込んでいない', () => {
    for (const recipe of RECIPE_CATALOG) {
      if (!recipe.requiredIngredients.some((i) => i.name === 'ごはん')) continue
      if (!recipe.steps) continue
      const joined = recipe.steps.join('')
      expect(
        joined.includes('米'),
        `${recipe.id}: ごはん(炊飯済み)前提なのにstepsに生米の炊飯工程が含まれている`,
      ).toBe(false)
    }
  })

  // ============================================================
  // MISSION 2.11 PHASE D.3 — Amount Reality Gate
  // ============================================================

  it('S: 全requiredIngredientsのnameとamountが非空である', () => {
    for (const recipe of RECIPE_CATALOG) {
      for (const ingredient of recipe.requiredIngredients) {
        expect(ingredient.name.trim().length, `${recipe.id}: requiredIngredient.nameが空`).toBeGreaterThan(0)
        expect(
          ingredient.amount.trim().length,
          `${recipe.id}: 「${ingredient.name}」のamountが空`,
        ).toBeGreaterThan(0)
      }
    }
  })

  it('T: 全seasoningsのnameとamountが非空である', () => {
    for (const recipe of RECIPE_CATALOG) {
      for (const seasoning of recipe.seasonings ?? []) {
        expect(seasoning.name.trim().length, `${recipe.id}: seasoning.nameが空`).toBeGreaterThan(0)
        expect(
          seasoning.amount.trim().length,
          `${recipe.id}: 「${seasoning.name}」のamountが空`,
        ).toBeGreaterThan(0)
      }
    }
  })

  it('U: amountが空白のみの値を持たない', () => {
    for (const recipe of RECIPE_CATALOG) {
      for (const ingredient of [...recipe.requiredIngredients, ...(recipe.seasonings ?? [])]) {
        expect(ingredient.amount).not.toBe('')
        expect(ingredient.amount.trim()).not.toBe('')
      }
    }
  })

  it('V: servingsBaseが正の値である（amountの基準人数として必須）', () => {
    for (const recipe of RECIPE_CATALOG) {
      expect(recipe.servingsBase, `${recipe.id}: servingsBaseが0以下`).toBeGreaterThan(0)
    }
  })

  it('W: RecipeIngredient化後もrequiredIngredients内でcanonical重複がない', () => {
    for (const recipe of RECIPE_CATALOG) {
      const canonical = recipe.requiredIngredients.map((i) => canonicalizeIngredientName(i.name))
      expect(new Set(canonical).size, `${recipe.id}: requiredIngredients内で重複`).toBe(canonical.length)
    }
  })

  it('X: RecipeIngredient化後もseasonings内でcanonical重複がない', () => {
    for (const recipe of RECIPE_CATALOG) {
      if (!recipe.seasonings) continue
      const canonical = recipe.seasonings.map((i) => canonicalizeIngredientName(i.name))
      expect(new Set(canonical).size, `${recipe.id}: seasonings内で重複`).toBe(canonical.length)
    }
  })

  it('Y: 同じcanonical ingredientがrequiredIngredientsとseasoningsの両方に重複していない', () => {
    for (const recipe of RECIPE_CATALOG) {
      const requiredCanonical = new Set(
        recipe.requiredIngredients.map((i) => canonicalizeIngredientName(i.name)),
      )
      for (const seasoning of recipe.seasonings ?? []) {
        const c = canonicalizeIngredientName(seasoning.name)
        expect(
          requiredCanonical.has(c),
          `${recipe.id}: 「${seasoning.name}」がrequiredIngredientsとseasonings両方に存在する`,
        ).toBe(false)
      }
    }
  })

  it('Z: 禁止amount値（不明・unknown・TBD・あとで・?等）が使われていない', () => {
    for (const recipe of RECIPE_CATALOG) {
      for (const ingredient of [...recipe.requiredIngredients, ...(recipe.seasonings ?? [])]) {
        const trimmed = ingredient.amount.trim()
        expect(
          FORBIDDEN_AMOUNT_VALUES.has(trimmed),
          `${recipe.id}: 「${ingredient.name}」のamountに禁止値「${ingredient.amount}」が使われている`,
        ).toBe(false)
      }
    }
  })

  it('AA: steps内に大さじ/小さじの数値が明示されている場合、catalogのamountと矛盾していない', () => {
    for (const recipe of RECIPE_CATALOG) {
      if (!recipe.steps) continue
      const joined = recipe.steps.join(' ')
      for (const seasoning of recipe.seasonings ?? []) {
        const escaped = seasoning.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const pattern = new RegExp(`${escaped}\\s*(大さじ|小さじ)\\s*([0-9０-９]+(?:と\\s*1/2)?)`)
        const match = joined.match(pattern)
        if (!match) continue
        const stepsAmount = `${match[1]}${match[2]}`.replace(/\s/g, '')
        expect(
          seasoning.amount.replace(/\s/g, '').includes(stepsAmount),
          `${recipe.id}: steps内「${stepsAmount}」とcatalog amount「${seasoning.amount}」が矛盾する可能性がある`,
        ).toBe(true)
      }
    }
  })
})

// ============================================================
// MISSION 2.11 PHASE D.4 — Cooking Liquid Reality Gate
//
// cookingLiquidsは候補判定・allergy判定に一切使わないが、Recipe Detail
// 画面だけを見て家庭で再現できるかどうかを左右する。requiredIngredients/
// seasoningsと同じ「絶対量の実在性」を検査する（S〜AA同様、件数に
// 依存しない全件走査）。
// ============================================================

describe('recipe-catalog.ts — Cooking Liquid Reality Gate', () => {
  it('AB: cookingLiquidsが存在する場合、nameが非空である', () => {
    for (const recipe of RECIPE_CATALOG) {
      for (const liquid of recipe.cookingLiquids ?? []) {
        expect(liquid.name.trim().length, `${recipe.id}: cookingLiquid.nameが空`).toBeGreaterThan(0)
      }
    }
  })

  it('AC: cookingLiquidsが存在する場合、amountが非空である', () => {
    for (const recipe of RECIPE_CATALOG) {
      for (const liquid of recipe.cookingLiquids ?? []) {
        expect(liquid.amount.trim().length, `${recipe.id}: cookingLiquid.amountが空`).toBeGreaterThan(0)
      }
    }
  })

  it('AD: cookingLiquidsに禁止amount値（不明・unknown・TBD・あとで・?等）が使われていない', () => {
    for (const recipe of RECIPE_CATALOG) {
      for (const liquid of recipe.cookingLiquids ?? []) {
        const trimmed = liquid.amount.trim()
        expect(
          FORBIDDEN_AMOUNT_VALUES.has(trimmed),
          `${recipe.id}: 「${liquid.name}」のamountに禁止値「${liquid.amount}」が使われている`,
        ).toBe(false)
      }
    }
  })

  it('AE: 同一Recipe内でcookingLiquids同士がcanonical重複していない', () => {
    for (const recipe of RECIPE_CATALOG) {
      const liquids = recipe.cookingLiquids ?? []
      const seen = new Set<string>()
      for (const liquid of liquids) {
        const c = canonicalizeIngredientName(liquid.name)
        expect(seen.has(c), `${recipe.id}: cookingLiquids内で「${liquid.name}」がcanonical重複している`).toBe(false)
        seen.add(c)
      }
    }
  })

  it('AF: cookingLiquidsの食材名がrequiredIngredients/seasoningsとcanonical重複していない', () => {
    for (const recipe of RECIPE_CATALOG) {
      const otherCanonical = new Set([
        ...recipe.requiredIngredients.map((i) => canonicalizeIngredientName(i.name)),
        ...(recipe.seasonings ?? []).map((i) => canonicalizeIngredientName(i.name)),
      ])
      for (const liquid of recipe.cookingLiquids ?? []) {
        const c = canonicalizeIngredientName(liquid.name)
        expect(
          otherCanonical.has(c),
          `${recipe.id}: cookingLiquidの「${liquid.name}」がrequiredIngredients/seasoningsと重複している`,
        ).toBe(false)
      }
    }
  })

  it('AG: cookingLiquidsが存在する場合、stepsの中でその液体名が最低1回使われている', () => {
    for (const recipe of RECIPE_CATALOG) {
      const liquids = recipe.cookingLiquids ?? []
      if (liquids.length === 0) continue
      const joined = (recipe.steps ?? []).join('')
      for (const liquid of liquids) {
        expect(
          joined.includes(liquid.name),
          `${recipe.id}: cookingLiquidの「${liquid.name}」がstepsのどこにも登場しない`,
        ).toBe(true)
      }
    }
  })

  it('AH: steps内に明示的な水量数値（例: 水400ml）がある場合、cookingLiquids.amountと矛盾していない', () => {
    for (const recipe of RECIPE_CATALOG) {
      if (!recipe.steps) continue
      const joined = recipe.steps.join(' ')
      for (const liquid of recipe.cookingLiquids ?? []) {
        const escaped = liquid.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const pattern = new RegExp(`${escaped}\\s*([0-9０-９]+\\s*ml)`)
        const match = joined.match(pattern)
        if (!match) continue
        const stepsAmount = match[1].replace(/\s/g, '')
        expect(
          liquid.amount.replace(/\s/g, '').includes(stepsAmount),
          `${recipe.id}: steps内「${stepsAmount}」とcatalog cookingLiquid amount「${liquid.amount}」が矛盾する可能性がある`,
        ).toBe(true)
      }
    }
  })

  /**
   * AI: 44Recipe Liquid Audit（PHASE D.4）で「絶対量が必要」と判定した
   * Recipeの固定リスト。将来Recipeを追加・変更する際にこのリストの
   * いずれかからcookingLiquidsが失われた場合に検知する回帰防止テスト
   * （新規Recipeの水量要否をここで自動判定するものではない）。
   */
  const RECIPES_REQUIRING_COOKING_LIQUID = [
    'oyako-don',
    'curry-rice',
    'nikujaga',
    'mabo-tofu',
    'saba-misoni',
    'tofu-tamago-soup',
    'tofu-miso-soup',
    'vegetable-soup',
    'tonjiru',
    'jagaimo-potage',
    'kakitama-jiru',
    'shoyu-udon',
    'niku-udon',
  ]

  it('AI: 水量なしでは再現不能と判定済みのRecipeにcookingLiquidsが定義されている', () => {
    for (const id of RECIPES_REQUIRING_COOKING_LIQUID) {
      const recipe = RECIPE_CATALOG.find((r) => r.id === id)
      expect(recipe, `${id}がRECIPE_CATALOGに見つからない`).toBeDefined()
      expect(
        (recipe!.cookingLiquids ?? []).length,
        `${id}: 水量が再現性上必要と判定済みだがcookingLiquidsが未設定`,
      ).toBeGreaterThan(0)
    }
  })
})

// ============================================================
// MISSION 2.11 PHASE D.5 — Allergen Alert Reality Gate
//
// ingredientChecks（PRODUCT CHECK ALERT）は既存のAllergy HARD EXCLUSIONと
// 完全に別レイヤー。ここではデータの整合性（空値なし・実在チェック対象のみ・
// 重複なし・requiredIngredients/seasoningsとの整合・禁止安全断定表現なし・
// cookingLiquidsとの分離）のみを検査する。candidate A/B判定への非影響は
// recipe-suggestion-engine.test.ts側でテストする。
// ============================================================

describe('recipe-catalog.ts — Allergen Alert Reality Gate', () => {
  it('AJ: ingredientChecksが存在する場合、ingredientNameが非空である', () => {
    for (const recipe of RECIPE_CATALOG) {
      for (const check of recipe.ingredientChecks ?? []) {
        expect(check.ingredientName.trim().length, `${recipe.id}: ingredientCheck.ingredientNameが空`).toBeGreaterThan(0)
      }
    }
  })

  it('AK: ingredientChecksの全ingredientNameがPRODUCT_CHECK_TARGET_INGREDIENTSに実在し、非空messageを生成できる', () => {
    for (const recipe of RECIPE_CATALOG) {
      for (const check of recipe.ingredientChecks ?? []) {
        const message = productCheckMessage(check.ingredientName)
        expect(message, `${recipe.id}: 「${check.ingredientName}」はPRODUCT_CHECK_TARGET_INGREDIENTSに未登録`).toBeDefined()
        expect((message ?? '').trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('AL: ingredientChecksのingredientNameがcanonicalize後、同一Recipeのrequired/seasoningsに実在する', () => {
    for (const recipe of RECIPE_CATALOG) {
      const ownCanonical = new Set([
        ...recipe.requiredIngredients.map((i) => canonicalizeIngredientName(i.name)),
        ...(recipe.seasonings ?? []).map((i) => canonicalizeIngredientName(i.name)),
      ])
      for (const check of recipe.ingredientChecks ?? []) {
        expect(
          ownCanonical.has(canonicalizeIngredientName(check.ingredientName)),
          `${recipe.id}: ingredientCheckの「${check.ingredientName}」がrequiredIngredients/seasoningsに実在しない`,
        ).toBe(true)
      }
    }
  })

  it('AM: 同一Recipe内でingredientChecksがcanonical重複していない', () => {
    for (const recipe of RECIPE_CATALOG) {
      const checks = recipe.ingredientChecks ?? []
      const seen = new Set<string>()
      for (const check of checks) {
        const c = canonicalizeIngredientName(check.ingredientName)
        expect(seen.has(c), `${recipe.id}: ingredientChecks内で「${check.ingredientName}」がcanonical重複している`).toBe(false)
        seen.add(c)
      }
    }
  })

  const DANGEROUS_PRODUCT_CLAIM_PATTERNS = [
    '安全です',
    '安全に食べられ',
    '含みません',
    '心配はありません',
    '確認しました',
    'NUKITORUが安全',
    '問題ありません',
  ]

  it('AN: product-check-messagesのテンプレート文言に禁止安全断定表現が含まれない', () => {
    for (const target of PRODUCT_CHECK_TARGET_INGREDIENTS) {
      const message = productCheckMessage(target)
      expect(message).toBeDefined()
      for (const pattern of DANGEROUS_PRODUCT_CLAIM_PATTERNS) {
        expect(
          (message ?? '').includes(pattern),
          `product-check-messages: 「${target}」のmessageに禁止表現「${pattern}」が含まれている`,
        ).toBe(false)
      }
    }
  })

  it('AO: cookingLiquidsの食材名がingredientChecksに一切現れない（水・湯はProduct Check対象外）', () => {
    for (const recipe of RECIPE_CATALOG) {
      const liquidCanonical = new Set((recipe.cookingLiquids ?? []).map((l) => canonicalizeIngredientName(l.name)))
      for (const check of recipe.ingredientChecks ?? []) {
        expect(
          liquidCanonical.has(canonicalizeIngredientName(check.ingredientName)),
          `${recipe.id}: cookingLiquidの「${check.ingredientName}」がingredientChecksにも含まれている`,
        ).toBe(false)
      }
    }
  })

  it('44 Recipe監査: PRODUCT_CHECK_TARGET_INGREDIENTSを含むRecipeには必ずingredientChecksが設定されている', () => {
    for (const recipe of RECIPE_CATALOG) {
      const allNames = [
        ...recipe.requiredIngredients.map((i) => i.name),
        ...(recipe.seasonings ?? []).map((i) => i.name),
      ]
      const shouldHaveChecks = allNames.some((name) => productCheckMessage(name) !== undefined)
      if (shouldHaveChecks) {
        expect((recipe.ingredientChecks ?? []).length, `${recipe.id}: 対象食材があるのにingredientChecksが未設定`).toBeGreaterThan(0)
      } else {
        expect((recipe.ingredientChecks ?? []).length, `${recipe.id}: 対象食材がないのにingredientChecksが設定されている`).toBe(0)
      }
    }
  })
})

describe('recipe-catalog.ts — Allergy Safety CASE 1〜4', () => {
  it('CASE 1: Recipe.requiredIngredients=["卵"]相当のrecipeが、canonicalization後にallergy=["たまご"]と一致する', () => {
    const eggRecipe = RECIPE_CATALOG.find((r) => r.requiredIngredients.some((i) => i.name === '卵'))
    expect(eggRecipe).toBeDefined()
    const relevant = allergyRelevantIngredients(eggRecipe!)
    const hit = relevant.some((ingredient) => isSameIngredient(ingredient, 'たまご'))
    expect(hit).toBe(true)
  })

  it('CASE 2: seasoningsにアレルギー該当食材がある場合、allergyRelevantIngredientsで検出できる', () => {
    // 味噌はアレルギー特定原材料ではないが、seasoningsが判定対象集合に含まれることの確認として使う
    const misoRecipe = RECIPE_CATALOG.find((r) => (r.seasonings ?? []).some((i) => i.name === '味噌'))
    expect(misoRecipe).toBeDefined()
    const relevant = allergyRelevantIngredients(misoRecipe!)
    expect(relevant).toContain('味噌')
  })

  it('CASE 3: 基本Recipe（まぐろ丼）には卵が含まれないが、arrangementには卵黄をのせるものがある', () => {
    const maguroDon = RECIPE_CATALOG.find((r) => r.id === 'maguro-don')
    expect(maguroDon).toBeDefined()
    const baseRelevant = allergyRelevantIngredients(maguroDon!)
    expect(baseRelevant).not.toContain('卵')

    const eggArrangement = maguroDon!.arrangements?.find((a) => (a.addIngredients ?? []).includes('卵'))
    expect(eggArrangement).toBeDefined()
  })

  it('CASE 4: arrangementRelevantIngredientsは該当arrangementのaddIngredientsのみを返す（卵を含む）', () => {
    const maguroDon = RECIPE_CATALOG.find((r) => r.id === 'maguro-don')!
    const eggArrangement = maguroDon.arrangements!.find((a) => a.id === 'maguro-don-egg-yolk')!
    expect(arrangementRelevantIngredients(eggArrangement)).toEqual(['卵'])
  })

  it('CASE 5（基本料理とアレンジの混同がないことの確認）: 卵アレルギーの場合でも基本のまぐろ丼は除外対象にならない', () => {
    const maguroDon = RECIPE_CATALOG.find((r) => r.id === 'maguro-don')!
    const allergyNames = new Set(['卵'])
    const baseHitsAllergy = allergyRelevantIngredients(maguroDon).some((n) => allergyNames.has(n))
    expect(baseHitsAllergy).toBe(false)
  })
})

// ============================================================
// MISSION 2.11 PHASE D.7-A — Evidence Audit Gate (BG〜BP)
//
// 最初の10 Recipeに対して実施したEvidence Auditの結果（EVIDENCE_SOURCE_CATALOG
// への実データ登録・各Recipeのverification設定）が、既存のNo Guessing Gate
// （AQ〜BF）と矛盾なく、かつ「対象外34Recipeへ影響していないこと」を検査する。
// ============================================================

const AUDITED_RECIPE_IDS_D7A = [
  'shio-musubi',
  'onigiri-nori',
  'maguro-don',
  'tori-soboro-don',
  'gyudon',
  'oyako-don',
  'natto-gohan',
  'tuna-mayo-don',
  'curry-rice',
  'pork-cabbage-miso-stirfry',
]

// MISSION 2.12 PHASE B — First 10 Families Starter Set Evidence Resolutionで
// 新たにverification（review/verified）が設定されたRecipe。
const AUDITED_RECIPE_IDS_PHASE_B = ['medama-yaki', 'hiyayakko', 'sake-shioyaki', 'tofu-miso-soup']

// MISSION 2.18 Batch 3 — Evidence Resolutionで初めてverification（review）が
// 設定されたRecipe。いずれもstatus=review（VERIFIEDではない）。
const AUDITED_RECIPE_IDS_BATCH3 = ['tori-teriyaki', 'buta-shogayaki']

const ALL_AUDITED_RECIPE_IDS = [
  ...AUDITED_RECIPE_IDS_D7A,
  ...AUDITED_RECIPE_IDS_PHASE_B,
  ...AUDITED_RECIPE_IDS_BATCH3,
]

describe('recipe-catalog.ts — Evidence Audit Gate (BG〜BP, PHASE D.7-A)', () => {
  it('BG: EVIDENCE_SOURCE_CATALOGのsource URLが実データ用placeholderでない', () => {
    for (const source of EVIDENCE_SOURCE_CATALOG) {
      expect(isPlaceholderUrl(source.url), `${source.id}: URL「${source.url}」がplaceholderパターンに一致`).toBe(
        false,
      )
    }
  })

  it('BH: verificationを持つRecipeのsourceIdsは実在するEVIDENCE_SOURCE_CATALOG entryを参照する', () => {
    for (const recipe of RECIPE_CATALOG) {
      for (const sourceId of recipe.verification?.sourceIds ?? []) {
        expect(getEvidenceSourceById(sourceId), `${recipe.id}: sourceId「${sourceId}」がcatalogに存在しない`).toBeDefined()
      }
    }
  })

  it('BI: status=verifiedのRecipeはcritical field evidence completenessを満たす（isRecipePublishable経由）', () => {
    for (const recipe of RECIPE_CATALOG) {
      if (recipe.verification?.status === 'verified') {
        expect(isRecipePublishable(recipe), `${recipe.id}: status=verifiedだがisRecipePublishableがfalse`).toBe(true)
      }
    }
  })

  it('BJ: status=verifiedのRecipeはhasUnsupportedInference=falseまたは未設定である', () => {
    for (const recipe of RECIPE_CATALOG) {
      if (recipe.verification?.status === 'verified') {
        expect(recipe.verification.hasUnsupportedInference).not.toBe(true)
      }
    }
  })

  it('BK: reviewNotesが残っているRecipeはstatus=verifiedにならない（CONFLICT未解決でVERIFIED禁止）', () => {
    for (const recipe of RECIPE_CATALOG) {
      const hasUnresolvedNotes = (recipe.verification?.reviewNotes ?? []).length > 0
      if (hasUnresolvedNotes) {
        expect(recipe.verification?.status, `${recipe.id}: reviewNotesが残っているのにstatus=verified`).not.toBe(
          'verified',
        )
      }
    }
  })

  it('BL: verifiedなRecipeはapplicableFieldsForの全fieldがfieldVerificationsでカバーされている（NOT_FOUND禁止）', () => {
    for (const recipe of RECIPE_CATALOG) {
      if (recipe.verification?.status !== 'verified') continue
      const coveredFields = new Set((recipe.verification.fieldVerifications ?? []).map((fv) => fv.field))
      for (const field of applicableFieldsFor(recipe)) {
        expect(coveredFields.has(field), `${recipe.id}: verifiedだがfield「${field}」が未カバー`).toBe(true)
      }
    }
  })

  it('BM: EVIDENCE_SOURCE_CATALOGの全sourceがcheckedAtを持つ', () => {
    for (const source of EVIDENCE_SOURCE_CATALOG) {
      expect(isValidCheckedAt(source.checkedAt), `${source.id}: checkedAt「${source.checkedAt}」が無効`).toBe(true)
    }
  })

  it('BN: verification source 0件のRecipeはstatus=verifiedにならない', () => {
    for (const recipe of RECIPE_CATALOG) {
      if ((recipe.verification?.sourceIds ?? []).length === 0) {
        expect(recipe.verification?.status, `${recipe.id}: source 0件なのにstatus=verified`).not.toBe('verified')
      }
    }
  })

  it('BO: 監査対象以外のRecipeは勝手にVERIFIEDされていない（verification未設定のまま）', () => {
    for (const recipe of RECIPE_CATALOG) {
      if (!ALL_AUDITED_RECIPE_IDS.includes(recipe.id)) {
        expect(recipe.verification, `${recipe.id}: 対象外なのにverificationが設定されている`).toBeUndefined()
      }
    }
  })

  it('BP: 今回対象外Recipeの内容（代表サンプル）が意図せず変更されていない', () => {
    const tamagoyaki = RECIPE_CATALOG.find((r) => r.id === 'tamagoyaki')!
    expect(tamagoyaki.requiredIngredients).toEqual([{ name: '卵', amount: '3個' }])
    expect(tamagoyaki.cookingTimeMinutes).toBe(10)

    const iritamago = RECIPE_CATALOG.find((r) => r.id === 'iritamago')!
    expect(iritamago.requiredIngredients).toEqual([{ name: '卵', amount: '2個' }])

    expect(RECIPE_CATALOG.length).toBe(44)
  })

  it('対象10 Recipeは全件verificationが設定されている（UNVERIFIED放置ではない。statusはreview/verifiedいずれか）', () => {
    for (const id of AUDITED_RECIPE_IDS_D7A) {
      const recipe = RECIPE_CATALOG.find((r) => r.id === id)
      expect(recipe, `${id}が見つからない`).toBeDefined()
      expect(recipe!.verification, `${id}: verificationが未設定`).toBeDefined()
      expect(['review', 'verified']).toContain(recipe!.verification!.status)
    }
  })

  it('BY: 監査対象以外のRecipeはPHASE D.7-B以降も引き続きUNVERIFIED（verification未設定）のまま', () => {
    for (const recipe of RECIPE_CATALOG) {
      if (!ALL_AUDITED_RECIPE_IDS.includes(recipe.id)) {
        expect(recipe.verification, `${recipe.id}: 対象外なのにverificationが設定されている`).toBeUndefined()
        expect(getVerificationStatus(recipe)).toBe('unverified')
      }
    }
  })

  it('BZ: 今回対象外Recipeの内容（追加の代表サンプル）がPHASE D.7-B以降も意図せず変更されていない', () => {
    const tonjiru = RECIPE_CATALOG.find((r) => r.id === 'tonjiru')!
    expect(tonjiru.seasonings).toEqual([{ name: '味噌', amount: '大さじ2' }])
    expect(tonjiru.cookingLiquids).toEqual([{ name: '水', amount: '600ml' }])
    expect(tonjiru.cookingTimeMinutes).toBe(25)

    const nikujaga = RECIPE_CATALOG.find((r) => r.id === 'nikujaga')!
    expect(nikujaga.cookingTimeMinutes).toBe(30)
  })
})
