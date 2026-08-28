// ============================================================
// global-codes.ts
//
// MISSION 2.11 PHASE E.1.1 — Global Code Extensibility Fix。
//
// PHASE E.1では LanguageCode/CountryCode 自体を 'ja'|'en' / 'JP'|'US' に閉じた
// unionとして定義しており、「現在サポートしている値」と「世界で将来扱える基盤」を
// 混同していた。本ファイルは、その是正後の設計における
// 「現在NUKITORUがProductとして正式サポートする値（closed）」を集約する。
//
// LanguageCode/CountryCode/Locale自体（types/index.ts）はopenなGlobal primitiveの
// ままとし、ここでは「今どこまでを公式サポートとして扱うか」だけを閉じた形で管理する。
// ============================================================

import type {
  CountryCode,
  LanguageCode,
  Locale,
  SupportedCountryCode,
  SupportedLanguageCode,
  SupportedLocale,
} from '@/features/food/types'

export const SUPPORTED_LANGUAGES: readonly SupportedLanguageCode[] = ['ja', 'en']

export const SUPPORTED_COUNTRIES: readonly SupportedCountryCode[] = ['JP', 'US']

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = [
  { language: 'ja', country: 'JP' },
  { language: 'en', country: 'US' },
]

/** 現在NUKITORUが正式サポートする言語かどうかを判定する（未サポートの将来言語はfalse） */
export function isSupportedLanguage(code: LanguageCode): code is SupportedLanguageCode {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code)
}

/** 現在NUKITORUが正式サポートする国かどうかを判定する（未サポートの将来国はfalse） */
export function isSupportedCountry(code: CountryCode): code is SupportedCountryCode {
  return (SUPPORTED_COUNTRIES as readonly string[]).includes(code)
}

/**
 * 現在NUKITORUが正式サポートするlocaleかどうかを判定する。
 * 未サポートのlocale（例: ko-KR）は、Globalに表現可能であっても自動的に
 * サポート済み扱いにはならない（falseを返す）。
 */
export function isSupportedLocale(locale: Locale): locale is SupportedLocale {
  return SUPPORTED_LOCALES.some((l) => l.language === locale.language && l.country === locale.country)
}

/**
 * ISO 639-1形式（小文字2文字）の構造検証のみ行う。実際のISO 639データセットとの
 * 照合は行わない（大規模dataset導入は禁止のため）。将来的な検証機構の入り口として
 * 用意するものであり、形式が正しくても実在する言語コードであることは保証しない。
 */
export function isValidLanguageCodeFormat(code: string): boolean {
  return /^[a-z]{2}$/.test(code)
}

/**
 * ISO 3166-1 alpha-2形式（大文字2文字）の構造検証のみ行う。
 * isValidLanguageCodeFormatと同様の方針（大規模country databaseは導入しない）。
 */
export function isValidCountryCodeFormat(code: string): boolean {
  return /^[A-Z]{2}$/.test(code)
}
