import type { ApiConfiguration, ApiInterfaceFormat, ModelCapability, ModelIdGroups } from "@/types/sheepai"

const CONFIGS_KEY = "sheepai-tools-api-configs"
const ACTIVE_CONFIG_KEY = "sheepai-tools-active-api-config"

const DEFAULT_TIMEOUT_SECONDS = 600

const MODEL_CAPABILITIES: ModelCapability[] = ["text", "vision", "imageGeneration", "imageEdit", "tts", "stt"]

export function createEmptyModelIdGroups(): ModelIdGroups {
  return {
    text: [],
    vision: [],
    imageGeneration: [],
    imageEdit: [],
    tts: [],
    stt: [],
  }
}

export interface ApiConfigDraft {
  name: string
  apiBaseUrl: string
  apiKey: string
  interfaceFormat: ApiInterfaceFormat
  modelIds: string[]
  modelIdGroups: ModelIdGroups
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
    modelIdGroups: {
      text: ["gpt-4o-mini"],
      vision: ["gpt-4o-mini"],
      imageGeneration: [],
      imageEdit: [],
      tts: [],
      stt: [],
    },
    timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
    selectedModelId: "gpt-4o-mini",
  }
}

function uniqueModelIds(modelIds: string[]): string[] {
  return [...new Set(modelIds.map((id) => id.trim()).filter(Boolean))]
}

export function flattenModelIdGroups(groups: ModelIdGroups): string[] {
  return uniqueModelIds(MODEL_CAPABILITIES.flatMap((capability) => groups[capability]))
}

function normalizeModelIdGroups(value: unknown, legacyModelIds: string[]): ModelIdGroups {
  const groups = createEmptyModelIdGroups()
  if (typeof value === "object" && value !== null) {
    const raw = value as Partial<Record<ModelCapability, unknown>>
    for (const capability of MODEL_CAPABILITIES) {
      groups[capability] = Array.isArray(raw[capability])
        ? uniqueModelIds(raw[capability].map((id) => String(id)))
        : []
    }
  }

  if (MODEL_CAPABILITIES.some((capability) => groups[capability].length > 0)) {
    return groups
  }

  const migratedModelIds = uniqueModelIds(legacyModelIds)
  const imageModelIds = migratedModelIds.filter((modelId) => /(^|[-_])(image|dall|flux|wan|sdxl|midjourney|mj)([-_]|$)|qwen-image|gpt-image/i.test(modelId))
  const ttsModelIds = migratedModelIds.filter((modelId) => /tts|speech|audio|voice/i.test(modelId))
  const textModelIds = migratedModelIds.filter((modelId) => !imageModelIds.includes(modelId) && !ttsModelIds.includes(modelId))
  return {
    ...groups,
    text: textModelIds,
    vision: textModelIds,
    imageGeneration: imageModelIds,
    imageEdit: imageModelIds,
    tts: ttsModelIds,
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

  const legacyModelIds = Array.isArray(raw.modelIds)
    ? raw.modelIds.map((id) => String(id).trim()).filter(Boolean)
    : []
  const modelIdGroups = normalizeModelIdGroups(raw.modelIdGroups, legacyModelIds)
  const modelIds = flattenModelIdGroups(modelIdGroups)
  const now = Date.now()

  return {
    id: raw.id,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "未命名配置",
    apiBaseUrl: typeof raw.apiBaseUrl === "string" ? raw.apiBaseUrl.trim().replace(/\/+$/, "") : "",
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey : "",
    interfaceFormat: raw.interfaceFormat === "anthropic-compatible" ? "anthropic-compatible" : "openai-compatible",
    modelIds,
    modelIdGroups,
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

export const normalizeConfigForTest = normalizeConfig

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
  const modelIdGroups = normalizeModelIdGroups(draft.modelIdGroups, draft.modelIds)
  const modelIds = flattenModelIdGroups(modelIdGroups)
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
    modelIdGroups,
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
    modelIdGroups: config.modelIdGroups,
    timeoutSeconds: config.timeoutSeconds,
    selectedModelId: config.selectedModelId,
  }
}
