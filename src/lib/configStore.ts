import type { ApiConfiguration, ApiInterfaceFormat } from "@/types/sheepai"

const CONFIGS_KEY = "sheepai-tools-api-configs"
const ACTIVE_CONFIG_KEY = "sheepai-tools-active-api-config"

const DEFAULT_TIMEOUT_SECONDS = 600

export interface ApiConfigDraft {
  name: string
  apiBaseUrl: string
  apiKey: string
  interfaceFormat: ApiInterfaceFormat
  modelIds: string[]
  timeoutSeconds: number
  selectedModelId: string
}

export function createEmptyConfigDraft(): ApiConfigDraft {
  return {
    name: "默认",
    apiBaseUrl: "https://www.sheepai.top/v1",
    apiKey: "",
    interfaceFormat: "openai-compatible",
    modelIds: ["gpt-4o-mini"],
    timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
    selectedModelId: "gpt-4o-mini",
  }
}

function safeParseConfigs(raw: string | null): ApiConfiguration[] {
  if (!raw) return []

  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value
      .map(normalizeConfig)
      .filter((config): config is ApiConfiguration => config !== null)
  } catch {
    return []
  }
}

function normalizeConfig(value: unknown): ApiConfiguration | null {
  if (typeof value !== "object" || value === null) return null
  const raw = value as Partial<ApiConfiguration>
  if (typeof raw.id !== "string" || raw.id.trim().length === 0) return null

  const modelIds = Array.isArray(raw.modelIds)
    ? raw.modelIds.map((id) => String(id).trim()).filter(Boolean)
    : []
  const now = Date.now()

  return {
    id: raw.id,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "未命名配置",
    apiBaseUrl: typeof raw.apiBaseUrl === "string" ? raw.apiBaseUrl.trim().replace(/\/+$/, "") : "",
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey : "",
    interfaceFormat: raw.interfaceFormat === "anthropic-compatible" ? "anthropic-compatible" : "openai-compatible",
    modelIds,
    timeoutSeconds: typeof raw.timeoutSeconds === "number" && Number.isFinite(raw.timeoutSeconds) && raw.timeoutSeconds > 0
      ? Math.round(raw.timeoutSeconds)
      : DEFAULT_TIMEOUT_SECONDS,
    selectedModelId: typeof raw.selectedModelId === "string" && raw.selectedModelId.trim()
      ? raw.selectedModelId.trim()
      : modelIds[0] ?? "",
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : now,
  }
}

export function loadApiConfigurations(): ApiConfiguration[] {
  return safeParseConfigs(window.localStorage.getItem(CONFIGS_KEY))
}

export function saveApiConfigurations(configs: ApiConfiguration[]): void {
  window.localStorage.setItem(CONFIGS_KEY, JSON.stringify(configs))
}

export function loadActiveConfigId(): string {
  return window.localStorage.getItem(ACTIVE_CONFIG_KEY) ?? ""
}

export function saveActiveConfigId(configId: string): void {
  if (configId) {
    window.localStorage.setItem(ACTIVE_CONFIG_KEY, configId)
  } else {
    window.localStorage.removeItem(ACTIVE_CONFIG_KEY)
  }
}

export function buildConfigFromDraft(draft: ApiConfigDraft, existing?: ApiConfiguration): ApiConfiguration {
  const now = Date.now()
  const modelIds = [...new Set(draft.modelIds.map((id) => id.trim()).filter(Boolean))]
  const selectedModelId = modelIds.includes(draft.selectedModelId.trim())
    ? draft.selectedModelId.trim()
    : modelIds[0] ?? ""

  return {
    id: existing?.id ?? crypto.randomUUID(),
    name: draft.name.trim() || "未命名配置",
    apiBaseUrl: draft.apiBaseUrl.trim().replace(/\/+$/, ""),
    apiKey: draft.apiKey.trim(),
    interfaceFormat: draft.interfaceFormat,
    modelIds,
    timeoutSeconds: Math.max(1, Math.round(draft.timeoutSeconds || DEFAULT_TIMEOUT_SECONDS)),
    selectedModelId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

export function draftFromConfig(config: ApiConfiguration): ApiConfigDraft {
  return {
    name: config.name,
    apiBaseUrl: config.apiBaseUrl,
    apiKey: config.apiKey,
    interfaceFormat: config.interfaceFormat,
    modelIds: config.modelIds,
    timeoutSeconds: config.timeoutSeconds,
    selectedModelId: config.selectedModelId,
  }
}
