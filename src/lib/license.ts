// Pro機能のライセンス管理・無料枠カウント

const WORKER_URL = "https://nukitoru-api.ume0117.workers.dev"
const LICENSE_KEY_STORAGE = "nukitoru_license_key"
const LICENSE_VALID_CACHE = "nukitoru_license_valid_cache"
const CACHE_TTL_MS = 1000 * 60 * 60 * 6 // 6時間キャッシュ

export type PlanType = "free" | "pro" | "pro_max"

type LicenseCache = {
  valid: boolean
  plan: PlanType
  checkedAt: number
}

export function getSavedLicenseKey(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(LICENSE_KEY_STORAGE)
}

export function saveLicenseKey(key: string) {
  localStorage.setItem(LICENSE_KEY_STORAGE, key)
  localStorage.removeItem(LICENSE_VALID_CACHE)
}

export function clearLicenseKey() {
  localStorage.removeItem(LICENSE_KEY_STORAGE)
  localStorage.removeItem(LICENSE_VALID_CACHE)
}

async function fetchLicenseInfo(key: string): Promise<{ valid: boolean; plan: PlanType }> {
  try {
    const res = await fetch(WORKER_URL + "/verify-license?key=" + encodeURIComponent(key))
    const data = await res.json()
    const plan: PlanType = data.plan === "pro_max" ? "pro_max" : data.plan === "pro" ? "pro" : "free"
    return { valid: !!data.valid, plan }
  } catch {
    return { valid: false, plan: "free" }
  }
}

async function getLicenseInfo(): Promise<{ valid: boolean; plan: PlanType }> {
  const key = getSavedLicenseKey()
  if (!key) return { valid: false, plan: "free" }

  const cachedRaw = localStorage.getItem(LICENSE_VALID_CACHE)
  if (cachedRaw) {
    try {
      const cached: LicenseCache = JSON.parse(cachedRaw)
      if (Date.now() - cached.checkedAt < CACHE_TTL_MS) {
        return { valid: cached.valid, plan: cached.plan }
      }
    } catch {}
  }

  const info = await fetchLicenseInfo(key)
  localStorage.setItem(
    LICENSE_VALID_CACHE,
    JSON.stringify({ valid: info.valid, plan: info.plan, checkedAt: Date.now() } as LicenseCache)
  )
  return info
}

export async function checkIsPro(): Promise<boolean> {
  const info = await getLicenseInfo()
  return info.valid
}

export async function getPlan(): Promise<PlanType> {
  const info = await getLicenseInfo()
  if (!info.valid) return "free"
  return info.plan
}

// ── 無料枠カウント（日付が変わったら自動リセット） ──────────

type FeatureKey = "priceCheck" | "csvPrice" | "catalogPages" | "multiFile"

const DAILY_LIMITS: Record<FeatureKey, number> = {
  priceCheck: 10,
  csvPrice: 3,
  catalogPages: 3,
  multiFile: 5,
}

function todayKey(): string {
  const d = new Date()
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate()
}

function usageStorageKey(feature: FeatureKey): string {
  return "nukitoru_usage_" + feature
}

export function getRemainingUses(feature: FeatureKey): number {
  if (typeof window === "undefined") return DAILY_LIMITS[feature]
  const raw = localStorage.getItem(usageStorageKey(feature))
  if (!raw) return DAILY_LIMITS[feature]

  try {
    const parsed = JSON.parse(raw)
    if (parsed.date !== todayKey()) return DAILY_LIMITS[feature]
    return Math.max(0, DAILY_LIMITS[feature] - parsed.count)
  } catch {
    return DAILY_LIMITS[feature]
  }
}

export function consumeUse(feature: FeatureKey, amount: number = 1) {
  const raw = localStorage.getItem(usageStorageKey(feature))
  let count = 0

  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed.date === todayKey()) {
        count = parsed.count
      }
    } catch {}
  }

  count += amount
  localStorage.setItem(usageStorageKey(feature), JSON.stringify({ date: todayKey(), count }))
}

export function getDailyLimit(feature: FeatureKey): number {
  return DAILY_LIMITS[feature]
}

// ── 検索履歴クラウド同期 ──────────

const HISTORY_SYNC_STORAGE = "nukitoru_history_sync_enabled"

export function getHistorySyncEnabled(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(HISTORY_SYNC_STORAGE) === "true"
}

export function setHistorySyncEnabled(enabled: boolean) {
  localStorage.setItem(HISTORY_SYNC_STORAGE, enabled ? "true" : "false")
}

export async function fetchRemoteHistory(): Promise<string[] | null> {
  const key = getSavedLicenseKey()
  if (!key || !getHistorySyncEnabled()) return null
  try {
    const res = await fetch(WORKER_URL + "/history-sync?key=" + encodeURIComponent(key))
    const data = await res.json()
    return Array.isArray(data.history) ? data.history : null
  } catch {
    return null
  }
}

export async function pushRemoteHistory(history: string[]): Promise<void> {
  const key = getSavedLicenseKey()
  if (!key || !getHistorySyncEnabled()) return
  try {
    await fetch(WORKER_URL + "/history-sync?key=" + encodeURIComponent(key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history }),
    })
  } catch {}
}
