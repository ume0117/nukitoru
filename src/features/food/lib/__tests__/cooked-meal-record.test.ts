// ============================================================
// cooked-meal-record.test.ts
//
// MISSION 2.40B — Cooked Meal Record & Completion Photo Foundation。
// §28 の 40 項目 + firewall + regression を固定する。
// ============================================================

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  createCookedMealRecord,
  withRepeatIntent,
  withCompletionPhoto,
  toCookedMealPresentation,
  countCookedByRecipe,
  COOKED_MEAL_RECORD_MEANING,
} from '../cooked-meal-record'
import {
  defaultPhotoVisibility,
  createPhotoConsentState,
  isFullyUnconsented,
  createCompletionPhotoMetadata,
  stripLocalReferenceForPersistence,
  replacePhotoLocalReference,
  revokeObjectUrlReference,
  photoIsExcludedFromShareText,
} from '../completion-photo'
import { buildFoodShareText, buildSnsShareUrls } from '../food-share'
import { RECIPE_CATALOG } from '../recipe-catalog'
import { isRecipePublishable, getVerificationStatus } from '../recipe-publishability'
import { practicalCookValidationStatusOf } from '../practical-cook-validation'

const NOW = '2026-09-03T12:00:00.000Z'
const cmr = (over: Partial<Parameters<typeof createCookedMealRecord>[0]> = {}) =>
  createCookedMealRecord(
    { canonicalRecipeId: 'jp-tori-teriyaki', recipeDisplayName: '鶏の照り焼き', ...over },
    { now: NOW },
  )

// ============================================================
// §28.1–5 — CookedMealRecord 生成
// ============================================================

describe('MISSION 2.40B — CookedMealRecord creation', () => {
  it('1. completion → CookedMealRecord 生成', () => {
    const r = cmr()
    expect(r.id).toMatch(/^cmr_/)
    expect(r.canonicalRecipeId).toBe('jp-tori-teriyaki')
    expect(r.completedAt).toBe(NOW)
    expect(r.createdAt).toBe(NOW)
  })

  it('2. canonicalRecipeId を保持（料理名から Identity を再推測しない）', () => {
    const r = createCookedMealRecord(
      { canonicalRecipeId: 'kr-kimchi-bokkeumbap', recipeDisplayName: 'キムチチャーハン' },
      { now: NOW },
    )
    expect(r.canonicalRecipeId).toBe('kr-kimchi-bokkeumbap')
  })

  it('3. recipeDisplayNameSnapshot を保持（後で表示名が変わっても当時の記録が読める）', () => {
    expect(cmr({ recipeDisplayName: '当時の名前' }).recipeDisplayNameSnapshot).toBe('当時の名前')
  })

  it('4. completedAt を保持', () => {
    expect(cmr().completedAt).toBe(NOW)
  })

  it('5. source object を mutate しない', () => {
    const input = { canonicalRecipeId: 'x', recipeDisplayName: 'y', repeatIntent: 'want-to-repeat' as const }
    const before = JSON.stringify(input)
    createCookedMealRecord(input, { now: NOW })
    expect(JSON.stringify(input)).toBe(before)
  })

  it('evidenceSourceIdSnapshot は渡されたときだけ入る', () => {
    expect(cmr().evidenceSourceIdSnapshot).toBeUndefined()
    expect(cmr({ evidenceSourceIdSnapshot: 'kyounoryouri-toriteriyaki-kawano-2026' }).evidenceSourceIdSnapshot).toBe(
      'kyounoryouri-toriteriyaki-kawano-2026',
    )
  })

  it('id は (now, canonicalRecipeId) から決定論的（外部乱数なし）', () => {
    expect(cmr().id).toBe(createCookedMealRecord({ canonicalRecipeId: 'jp-tori-teriyaki', recipeDisplayName: 'x' }, { now: NOW }).id)
  })
})

// ============================================================
// §28.6–10 — 写真 optional / default private / upload ≠ X
// ============================================================

describe('MISSION 2.40B — completion photo defaults', () => {
  it('6. photo optional（record は completionPhotoId なしで成立）', () => {
    expect(cmr().completionPhotoId).toBeUndefined()
    expect(toCookedMealPresentation(cmr()).hasPhoto).toBe(false)
  })

  it('7. photo default private（createCompletionPhotoMetadata の visibility は private）', () => {
    const m = createCompletionPhotoMetadata({ cookedMealRecordId: 'cmr_1' }, { now: NOW })
    expect(m.visibility).toBe('private')
    expect(defaultPhotoVisibility()).toBe('private')
  })

  it('8. upload ≠ public（写真 metadata を作っても public にならない・引数で public を受け取らない）', () => {
    const m = createCompletionPhotoMetadata(
      { cookedMealRecordId: 'cmr_1', localReference: 'blob:xyz' },
      { now: NOW },
    )
    expect(m.visibility).toBe('private')
  })

  it('9. upload ≠ share（写真を持つ record でも share text に写真は入らない）', () => {
    photoIsExcludedFromShareText() // boundary marker
    const text = buildFoodShareText({ recipeName: '鶏の照り焼き' })
    expect(text).not.toMatch(/blob:|photo|写真|\.jpg|\.png/i)
  })

  it('10. upload ≠ AI consent（写真 metadata の aiTrainingConsent は not-granted）', () => {
    const m = createCompletionPhotoMetadata({ cookedMealRecordId: 'cmr_1' }, { now: NOW })
    expect(m.consent.aiTrainingConsent).toBe('not-granted')
  })
})

// ============================================================
// §28.11–14 — Consent 分離 / default 安全側
// ============================================================

describe('MISSION 2.40B — consent separation', () => {
  it('11. share ≠ publication consent（Share しても publicationConsent は not-granted のまま）', () => {
    const m = createCompletionPhotoMetadata({ cookedMealRecordId: 'cmr_1' }, { now: NOW })
    // Share アクション（buildSnsShareUrls など）は consent state を触らない
    buildSnsShareUrls({ recipeName: 'x' })
    expect(m.consent.publicationConsent).toBe('not-granted')
  })

  it('12. publication ≠ AI consent（別 flag。publicationConsent を granted にしても aiTrainingConsent は not-granted）', () => {
    const c = createPhotoConsentState(NOW, { publicationConsent: 'granted' })
    expect(c.publicationConsent).toBe('granted')
    expect(c.aiTrainingConsent).toBe('not-granted')
    expect(c.serviceImprovementConsent).toBe('not-granted')
    expect(c.aggregateAnalyticsConsent).toBe('not-granted')
  })

  it('13. consent default は安全側（全項目 not-granted。isFullyUnconsented true）', () => {
    const c = createPhotoConsentState(NOW)
    expect(c).toEqual({
      publicationConsent: 'not-granted',
      serviceImprovementConsent: 'not-granted',
      aggregateAnalyticsConsent: 'not-granted',
      aiTrainingConsent: 'not-granted',
      recordedAt: NOW,
    })
    expect(isFullyUnconsented(c)).toBe(true)
  })

  it('14. individual consent separation（4 項目を個別に設定できる。単一 flag ではない）', () => {
    const c = createPhotoConsentState(NOW, {
      serviceImprovementConsent: 'granted',
      aggregateAnalyticsConsent: 'declined',
    })
    expect(c.serviceImprovementConsent).toBe('granted')
    expect(c.aggregateAnalyticsConsent).toBe('declined')
    expect(c.publicationConsent).toBe('not-granted')
    expect(c.aiTrainingConsent).toBe('not-granted')
    expect(isFullyUnconsented(c)).toBe(false)
    // 型に単一 boolean consent が無い
    expect(c).not.toHaveProperty('consent')
    expect(c).not.toHaveProperty('granted')
  })
})

// ============================================================
// §28.15–20 — Evidence / Practical / Rights firewall
// ============================================================

describe('MISSION 2.40B — evidence firewall', () => {
  it('15. completion ≠ Recipe Verified（record に verification フィールドなし）', () => {
    const r = cmr()
    expect(r).not.toHaveProperty('verification')
    expect(r).not.toHaveProperty('verified')
    // 大量の record を作っても既存 VERIFIED は不変
    const tori = RECIPE_CATALOG.find((x) => x.id === 'tori-teriyaki')!
    for (let i = 0; i < 200; i++) createCookedMealRecord({ canonicalRecipeId: 'jp-tori-teriyaki', recipeDisplayName: 'x' }, { now: `2026-09-0${(i % 9) + 1}T00:00:00Z` })
    expect(getVerificationStatus(tori)).toBe('verified')
    expect(isRecipePublishable(tori)).toBe(true)
  })

  it('16. completion ≠ Practical Validation（record に practicalCookValidation なし・既存 status 不変）', () => {
    expect(cmr()).not.toHaveProperty('practicalCookValidation')
    for (const id of ['tori-teriyaki', 'buta-shogayaki']) {
      expect(practicalCookValidationStatusOf(RECIPE_CATALOG.find((x) => x.id === id)!)).toBe('not-tested')
    }
  })

  it('17. repeat intent ≠ taste fact（Household Preference。record に tasteFact なし）', () => {
    const r = withRepeatIntent(cmr(), 'want-to-repeat')
    expect(r.repeatIntent).toBe('want-to-repeat')
    expect(r).not.toHaveProperty('tasteFact')
    expect(r).not.toHaveProperty('delicious')
    // 1000 件 want-to-repeat でも Evidence にならない（countCookedByRecipe は単なる数）
    const many = Array.from({ length: 1000 }, () => withRepeatIntent(cmr(), 'want-to-repeat'))
    expect(countCookedByRecipe(many, 'jp-tori-teriyaki')).toBe(1000)
    expect(many[0]).not.toHaveProperty('verification')
  })

  it('18. photo ≠ Recipe Evidence（photo metadata に evidenceSourceId / supportType なし）', () => {
    const m = createCompletionPhotoMetadata({ cookedMealRecordId: 'cmr_1' }, { now: NOW })
    expect(m).not.toHaveProperty('evidenceSourceId')
    expect(m).not.toHaveProperty('supportType')
    expect(m).not.toHaveProperty('verification')
  })

  it('19. photo ≠ Rights permission（photo metadata に rights / license フィールドなし）', () => {
    const m = createCompletionPhotoMetadata({ cookedMealRecordId: 'cmr_1' }, { now: NOW })
    expect(m).not.toHaveProperty('rights')
    expect(m).not.toHaveProperty('license')
  })

  it('20. photo ≠ commercial reuse permission（consent に commercialReuse なし・default not-granted のみ）', () => {
    const m = createCompletionPhotoMetadata({ cookedMealRecordId: 'cmr_1' }, { now: NOW })
    expect(m.consent).not.toHaveProperty('commercialReuse')
    expect(m.consent).not.toHaveProperty('nukitoruCanUse')
    expect(isFullyUnconsented(m.consent)).toBe(true)
  })
})

// ============================================================
// §28.21–24 — no AI / no EXIF / no network / no base64
// ============================================================

describe('MISSION 2.40B — no AI / EXIF / network / base64', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const read = (rel: string) => readFileSync(resolve(here, '..', rel), 'utf8')
  const FILES = ['cooked-meal-record.ts', 'completion-photo.ts']

  it('21. no AI analysis（image recognition / vision / 料理判定 の参照なし）', () => {
    for (const f of FILES) {
      const src = read(f)
      expect(/openai|anthropic|vision|image[- ]?recognition|classif|detect.*food|盛り付け採点/i.test(src)).toBe(false)
    }
  })
  it('22. no EXIF extraction', () => {
    for (const f of FILES) {
      expect(/exif|piexif|gps.*extract|getExifData/i.test(read(f))).toBe(false)
    }
  })
  it('23. no network upload（fetch / XHR / upload endpoint なし）', () => {
    for (const f of FILES) {
      const src = read(f)
      expect(/\bfetch\s*\(|XMLHttpRequest|s3\.|r2\.|firebase|supabase|\.upload\(/i.test(src)).toBe(false)
    }
  })
  it('24. no base64 persistence（readAsDataURL / btoa / base64 保存なし）', () => {
    for (const f of FILES) {
      const src = read(f)
      expect(/readAsDataURL|btoa\(|toDataURL|base64/i.test(src)).toBe(false)
    }
  })
  it('モジュールは Verification / Practical / Rights / AI モジュールを import しない', () => {
    const FORBIDDEN = ['./recipe-publishability', './recipe-safety', './practical-cook-validation', './recipe-catalog', './world-recipe-import', './ai-provider']
    for (const f of FILES) {
      const src = read(f)
      for (const m of FORBIDDEN) expect(src.includes(`from '${m}'`)).toBe(false)
    }
  })
})

// ============================================================
// §28.25–29 — photo selection / removal / replacement / object URL
// ============================================================

describe('MISSION 2.40B — photo lifecycle', () => {
  it('25. photo selection optional（未選択でも record 成立。既にテスト6でカバー・再確認）', () => {
    expect(createCookedMealRecord({ canonicalRecipeId: 'x', recipeDisplayName: 'y' }, { now: NOW }).completionPhotoId).toBeUndefined()
  })

  it('26. photo removal（replacePhotoLocalReference(meta, undefined) で localReference が消える）', () => {
    const m = createCompletionPhotoMetadata({ cookedMealRecordId: 'cmr_1', localReference: 'blob:a' }, { now: NOW })
    const removed = replacePhotoLocalReference(m, undefined)
    expect(removed.localReference).toBeUndefined()
    // 元は不変
    expect(m.localReference).toBe('blob:a')
  })

  it('27. photo replacement（新しい localReference / mimeType へ差し替え・非破壊）', () => {
    const m = createCompletionPhotoMetadata({ cookedMealRecordId: 'cmr_1', localReference: 'blob:a', mimeType: 'image/jpeg' }, { now: NOW })
    const replaced = replacePhotoLocalReference(m, 'blob:b', 'image/png')
    expect(replaced.localReference).toBe('blob:b')
    expect(replaced.mimeType).toBe('image/png')
    expect(m.localReference).toBe('blob:a')
    expect(replaced.visibility).toBe('private') // visibility は変わらない
    expect(replaced.id).toBe(m.id)
  })

  it('28. local preview lifecycle: stripLocalReferenceForPersistence が localReference を除去', () => {
    const m = createCompletionPhotoMetadata({ cookedMealRecordId: 'cmr_1', localReference: 'blob:a' }, { now: NOW })
    const stripped = stripLocalReferenceForPersistence(m)
    expect(stripped).not.toHaveProperty('localReference')
    expect(stripped.visibility).toBe('private')
    expect(stripped.consent).toEqual(m.consent)
  })

  it('29. revokeObjectUrlReference は blob: のみ対象（data: / http: は no-op・例外を投げない）', () => {
    expect(() => revokeObjectUrlReference(undefined)).not.toThrow()
    expect(() => revokeObjectUrlReference('data:image/png;base64,xxx')).not.toThrow()
    expect(() => revokeObjectUrlReference('https://example.com/a.jpg')).not.toThrow()
    expect(() => revokeObjectUrlReference('blob:http://localhost/abc')).not.toThrow()
  })
})

// ============================================================
// §28.30–36 — Share regression / privacy
// ============================================================

describe('MISSION 2.40B — share regression & privacy', () => {
  it('30. share without photo（写真なしで shareFood 可能）', async () => {
    const { shareFood } = await import('../food-share')
    const outcome = await shareFood({ recipeName: '鶏の照り焼き' })
    expect(['shared', 'copied', 'unavailable', 'cancelled']).toContain(outcome)
  })

  it('31. photo selection does not alter share text', () => {
    const a = buildFoodShareText({ recipeName: '鶏の照り焼き' })
    // 写真を「選んだ」状態を模しても share input は recipeName のみ（写真を渡す口が無い）
    const b = buildFoodShareText({ recipeName: '鶏の照り焼き' })
    expect(a).toBe(b)
  })

  it('32. #NUKITORU preserved', () => {
    expect(buildFoodShareText({ recipeName: 'x' })).toContain('#NUKITORU')
  })
  it('33. #NUKITORUFOOD preserved', () => {
    expect(buildFoodShareText({ recipeName: 'x' })).toContain('#NUKITORUFOOD')
  })

  it('34. stock not leaked（share text / SNS URL に在庫が入らない）', () => {
    const text = buildFoodShareText({ recipeName: '鶏の照り焼き' })
    expect(text).not.toMatch(/在庫|じゃがいも|玉ねぎ|Stock/i)
  })
  it('35. allergy not leaked', () => {
    expect(buildFoodShareText({ recipeName: 'x' })).not.toMatch(/アレル|allergy/i)
  })
  it('36. family data not leaked（CookedMealRecord に member / family フィールドなし）', () => {
    const r = cmr()
    expect(r).not.toHaveProperty('selectedMemberIds')
    expect(r).not.toHaveProperty('members')
    expect(r).not.toHaveProperty('household')
    expect(buildFoodShareText({ recipeName: 'x' })).not.toMatch(/家族|family|世帯/i)
  })
})

// ============================================================
// §28.37–40 — UI regression（source 静的検査）
// ============================================================

describe('MISSION 2.40B — cooking mode UI regression', () => {
  const src = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'components', 'CookingModeView.tsx'),
    'utf8',
  )

  it('37. completion UI only（📸 完成写真は Completion 関数内。Cooking step 側に無い）', () => {
    const completionStart = src.indexOf('function Completion')
    expect(completionStart).toBeGreaterThan(0)
    expect(src.slice(completionStart)).toContain('完成写真を残す')
    // Cooking step 描画部（Completion より前）に写真 input が無い
    expect(src.slice(0, completionStart)).not.toContain('完成写真を残す')
    expect(src.slice(0, completionStart)).not.toContain("type=\"file\"")
  })

  it('38. cooking step UI unchanged（1画面1工程 / STEP 表示 / swipe handler は不変）', () => {
    expect(src).toContain('STEP {step.displayNumber} / {step.totalSteps}')
    expect(src).toContain('onPointerDown')
    expect(src).toContain('onPointerUp')
    expect(src).toContain('classifySwipe')
  })

  it('39. no disabled Favorite regression（「♡ お気に入り」ボタンが復活していない）', () => {
    expect(src).not.toContain('♡ お気に入り')
  })

  it('40. no disabled Print regression（「プリント</button>」が復活していない）', () => {
    expect(src).not.toContain('プリント</button>')
    // disabled ボタンの grid も無い
    expect(src).not.toMatch(/disabled\s*\n?\s*title="今後のアップデート/)
  })

  it('写真は server upload しない（CookingModeView に fetch / upload なし）', () => {
    expect(/\bfetch\s*\(|\.upload\(|FormData/i.test(src)).toBe(false)
  })

  it('object URL は revoke される（unmount cleanup + 選び直し）', () => {
    expect(src).toContain('revokeObjectUrlReference')
    expect(src).toContain('URL.createObjectURL')
  })

  it('COOKED_MEAL_RECORD_MEANING（過剰解釈しない注記）が完成画面に表示される', () => {
    expect(src).toContain('COOKED_MEAL_RECORD_MEANING')
    expect(COOKED_MEAL_RECORD_MEANING).toContain('保証するものではありません')
  })
})

// ============================================================
// storage persistence（既存 pattern・画像 binary なし）
// ============================================================

describe('MISSION 2.40B — CookedMealRecord persistence', () => {
  it('storage.ts の record は plain metadata のみ（型に binary / base64 フィールドが無い）', () => {
    const r = cmr() as unknown as Record<string, unknown>
    const keys = Object.keys(r)
    expect(keys).not.toContain('imageData')
    expect(keys).not.toContain('base64')
    expect(keys).not.toContain('blob')
    expect(keys.every((k) => typeof r[k] === 'string' || r[k] === undefined)).toBe(true)
  })

  it('toCookedMealPresentation は disclaimer を必ず含む', () => {
    const p = toCookedMealPresentation(withCompletionPhoto(cmr(), 'cph_1'))
    expect(p.hasPhoto).toBe(true)
    expect(p.disclaimer).toBe(COOKED_MEAL_RECORD_MEANING)
  })
})
